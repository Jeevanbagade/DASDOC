/**
 * Order service — the authoritative checkout write path.
 *
 * Guarantees:
 *  - Totals are recomputed server-side from DB page counts; a client-sent
 *    `expectedTotalPaise` that disagrees is rejected with PRICING_MISMATCH.
 *  - Idempotent placement: a unique idempotency key means retries and
 *    double-clicks return the original order instead of duplicating it.
 *  - Documents are attached atomically inside the same transaction, so a
 *    document can never land in two paid orders.
 */
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  addresses,
  documents,
  orders,
  orderItems,
  payments,
  type AddressRow,
  type OrderItemRow,
  type OrderRow,
  type PaymentRow,
} from "@/db/schema";
import { AppError } from "@/lib/errors";
import { computeQuote, maskUpiId, type Quote } from "@/lib/pricing";
import { normalizeMobile, isValidUpiId } from "@/lib/validators";
import { DEFAULT_COUNTRY_CODE } from "@/lib/config";
import type { CreateOrderInput } from "@/lib/schemas";
import { serverEnv } from "./env";
import { getUpiProvider } from "./payments";
import { log } from "./log";

// ------------------------------------------------------------------- DTOs

export interface OrderItemDTO {
  id: string;
  fileName: string;
  pageCount: number;
  copies: number;
  colorMode: "bw" | "color";
  ratePerPagePaise: number;
  lineTotalPaise: number;
}

export interface AddressDTO {
  fullName: string;
  mobileE164: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
  landmark: string;
}

export interface PaymentDTO {
  provider: string;
  status: "pending" | "paid" | "failed";
  amountPaise: number;
  txnRef: string | null;
  upiIdMasked: string | null;
}

export interface OrderSummaryDTO {
  id: string;
  orderNumber: string;
  status: string;
  paymentMethod: "upi" | "cod";
  paymentStatus: "pending" | "paid" | "failed";
  subtotalPaise: number;
  deliveryFeePaise: number;
  totalPaise: number;
  etaAt: string;
  createdAt: string;
  itemCount: number;
  totalSheets: number;
}

export interface OrderDetailDTO extends Omit<OrderSummaryDTO, "itemCount" | "totalSheets"> {
  items: OrderItemDTO[];
  address: AddressDTO;
  payment: PaymentDTO | null;
}

function toItemDTO(row: OrderItemRow): OrderItemDTO {
  return {
    id: row.id,
    fileName: row.fileName,
    pageCount: row.pageCount,
    copies: row.copies,
    colorMode: row.colorMode,
    ratePerPagePaise: row.ratePerPagePaise,
    lineTotalPaise: row.lineTotalPaise,
  };
}

function toAddressDTO(row: AddressRow): AddressDTO {
  return {
    fullName: row.fullName,
    mobileE164: row.mobileE164,
    line1: row.line1,
    line2: row.line2,
    city: row.city,
    state: row.state,
    pincode: row.pincode,
    landmark: row.landmark,
  };
}

function toPaymentDTO(row: PaymentRow): PaymentDTO {
  return {
    provider: row.provider,
    status: row.status,
    amountPaise: row.amountPaise,
    txnRef: row.txnRef,
    upiIdMasked: row.upiIdMasked,
  };
}

function baseOrderDTO(row: OrderRow) {
  return {
    id: row.id,
    orderNumber: row.orderNumber,
    status: row.status,
    paymentMethod: row.paymentMethod,
    paymentStatus: row.paymentStatus,
    subtotalPaise: row.subtotalPaise,
    deliveryFeePaise: row.deliveryFeePaise,
    totalPaise: row.totalPaise,
    etaAt: row.etaAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

// -------------------------------------------------------------- order number

const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // no 0/O/1/I/L confusables

function generateOrderNumber(): string {
  const now = new Date();
  const ymd = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, "0")}${String(
    now.getDate(),
  ).padStart(2, "0")}`;
  let suffix = "";
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  for (const b of bytes) suffix += ALPHABET[b % ALPHABET.length];
  return `DD-${ymd}-${suffix}`;
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "23505"
  );
}

// ------------------------------------------------------------------ create

export interface CreateOrderResult {
  order: OrderDetailDTO;
  quote: Quote;
  duplicated: boolean;
}

export async function createOrder(userId: string, input: CreateOrderInput): Promise<CreateOrderResult> {
  // Idempotency short-circuit (also the retry path after a network blip).
  const existing = await db
    .select()
    .from(orders)
    .where(and(eq(orders.idempotencyKey, input.idempotencyKey), eq(orders.userId, userId)))
    .limit(1);
  if (existing.length > 0) {
    const detail = await getOrderDetail(userId, existing[0].id);
    log.info("order.duplicate_replayed", { userId, orderNumber: detail.orderNumber });
    const quote: Quote = {
      lines: detail.items.map((i) => ({
        pageCount: i.pageCount,
        copies: i.copies,
        colorMode: i.colorMode,
        ratePerPagePaise: i.ratePerPagePaise,
        sheetCount: i.pageCount * i.copies,
        lineTotalPaise: i.lineTotalPaise,
      })),
      subtotalPaise: detail.subtotalPaise,
      deliveryFeePaise: detail.deliveryFeePaise,
      totalPaise: detail.totalPaise,
      totalPages: detail.items.reduce((s, i) => s + i.pageCount, 0),
      totalSheets: detail.items.reduce((s, i) => s + i.pageCount * i.copies, 0),
    };
    return { order: detail, quote, duplicated: true };
  }

  // 1) Load the referenced documents and verify ownership + availability.
  const docIds = input.items.map((i) => i.documentId);
  const rows = await db.select().from(documents).where(inArray(documents.id, docIds));
  const byId = new Map(rows.map((r) => [r.id, r]));
  for (const item of input.items) {
    const row = byId.get(item.documentId);
    if (!row || row.userId !== userId) {
      throw new AppError("DOC_NOT_FOUND", "One of the documents is missing — re-upload it and retry");
    }
    if (row.orderId !== null) {
      throw new AppError("DOC_ALREADY_ORDERED", `"${row.originalName}" is already part of another order`);
    }
  }
  const distinctIds = new Set(docIds);
  if (distinctIds.size !== docIds.length) {
    throw new AppError("VALIDATION", "Each document can appear only once per order");
  }

  // 2) Authoritative pricing — from the DB, never from client-sent numbers.
  let serverQuote: Quote;
  try {
    serverQuote = computeQuote(
      input.items.map((i) => ({
        pageCount: byId.get(i.documentId)!.pageCount,
        copies: i.copies,
        colorMode: i.colorMode,
      })),
    );
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError("PRICING_INVALID", "Could not price this order");
  }
  if (serverQuote.totalPaise !== input.expectedTotalPaise) {
    throw new AppError("PRICING_MISMATCH", "The total changed since you reviewed it — please re-check the bill", {
      clientTotalPaise: input.expectedTotalPaise,
      serverTotalPaise: serverQuote.totalPaise,
    });
  }

  // 3) Address (validated shape already; normalize the phone to E.164).
  const addr = input.address;
  const mobile = normalizeMobile(addr.mobile, DEFAULT_COUNTRY_CODE);
  if (!mobile) throw new AppError("VALIDATION", "Delivery mobile number is invalid");

  // 4) Payment intent happens BEFORE persistence so a failed UPI charge
  //    never leaves a phantom order behind.
  const provider = getUpiProvider();
  const orderNumber = generateOrderNumber();
  let paymentOutcome: {
    provider: string;
    status: "pending" | "paid" | "failed";
    txnRef: string | null;
    upiIdMasked: string | null;
    failureReason: string | null;
  };
  if (input.paymentMethod === "upi") {
    if (!input.upiId || !isValidUpiId(input.upiId)) {
      throw new AppError("UPI_ID_INVALID", "That UPI handle doesn't look right (expected name@bank)");
    }
    const result = await provider.charge({
      amountPaise: serverQuote.totalPaise,
      upiId: input.upiId,
      orderNumber,
    });
    if (result.status === "failed") {
      throw new AppError("PAYMENT_FAILED", result.failureReason ?? "UPI payment failed — no money was taken");
    }
    paymentOutcome = {
      provider: result.provider,
      status: "paid",
      txnRef: result.txnRef,
      upiIdMasked: maskUpiId(input.upiId),
      failureReason: null,
    };
  } else {
    paymentOutcome = {
      provider: "cod",
      status: "pending",
      txnRef: null,
      upiIdMasked: null,
      failureReason: null,
    };
  }

  // 5) Persist everything atomically.
  const etaAt = new Date(Date.now() + serverEnv.deliveryEtaHours * 60 * 60 * 1000);
  try {
    const created = await db.transaction(async (tx) => {
      const [addressRow] = await tx
        .insert(addresses)
        .values({
          userId,
          fullName: addr.fullName,
          mobileE164: mobile.e164,
          line1: addr.line1,
          line2: addr.line2 ?? "",
          city: addr.city,
          state: addr.state,
          pincode: addr.pincode,
          landmark: addr.landmark ?? "",
        })
        .returning();

      const [orderRow] = await tx
        .insert(orders)
        .values({
          orderNumber,
          userId,
          addressId: addressRow.id,
          status: "placed",
          paymentMethod: input.paymentMethod,
          paymentStatus: paymentOutcome.status === "paid" ? "paid" : "pending",
          subtotalPaise: serverQuote.subtotalPaise,
          deliveryFeePaise: serverQuote.deliveryFeePaise,
          totalPaise: serverQuote.totalPaise,
          etaAt,
          idempotencyKey: input.idempotencyKey,
        })
        .returning();

      await tx.insert(orderItems).values(
        input.items.map((i) => {
          const doc = byId.get(i.documentId)!;
          const line = serverQuote.lines[input.items.indexOf(i)];
          return {
            orderId: orderRow.id,
            documentId: doc.id,
            fileName: doc.originalName,
            pageCount: doc.pageCount,
            copies: i.copies,
            colorMode: i.colorMode,
            ratePerPagePaise: line.ratePerPagePaise,
            lineTotalPaise: line.lineTotalPaise,
          };
        }),
      );

      // Attach documents atomically — the isNull guard is the race defense.
      const attached = await tx
        .update(documents)
        .set({ orderId: orderRow.id })
        .where(and(inArray(documents.id, docIds), isNull(documents.orderId)))
        .returning({ id: documents.id });
      if (attached.length !== docIds.length) {
        throw new AppError("DOC_ALREADY_ORDERED", "A document was claimed by another order — please retry");
      }

      await tx.insert(payments).values({
        orderId: orderRow.id,
        provider: paymentOutcome.provider,
        status: paymentOutcome.status,
        amountPaise: serverQuote.totalPaise,
        txnRef: paymentOutcome.txnRef,
        upiIdMasked: paymentOutcome.upiIdMasked,
        failureReason: paymentOutcome.failureReason,
      });

      return { orderRow, addressRow };
    });

    log.info("order.created", {
      userId,
      orderNumber: created.orderRow.orderNumber,
      totalPaise: created.orderRow.totalPaise,
      method: input.paymentMethod,
      items: input.items.length,
    });

    const detail = await getOrderDetail(userId, created.orderRow.id);
    return { order: detail, quote: serverQuote, duplicated: false };
  } catch (err) {
    // Lost the race on idempotency key or order number — resolve, don't 500.
    if (isUniqueViolation(err)) {
      const replay = await db
        .select()
        .from(orders)
        .where(and(eq(orders.idempotencyKey, input.idempotencyKey), eq(orders.userId, userId)))
        .limit(1);
      if (replay.length > 0) {
        const detail = await getOrderDetail(userId, replay[0].id);
        return {
          order: detail,
          quote: serverQuote,
          duplicated: true,
        };
      }
      // Exceedingly rare orderNumber collision — retry once with a fresh number.
      return createOrder(userId, { ...input });
    }
    throw err;
  }
}

// -------------------------------------------------------------------- reads

export async function listOrders(userId: string): Promise<OrderSummaryDTO[]> {
  const orderRows = await db
    .select()
    .from(orders)
    .where(eq(orders.userId, userId))
    .orderBy(desc(orders.createdAt));
  if (orderRows.length === 0) return [];
  const itemRows = await db
    .select()
    .from(orderItems)
    .where(
      inArray(
        orderItems.orderId,
        orderRows.map((o) => o.id),
      ),
    );
  const byOrder = new Map<string, OrderItemRow[]>();
  for (const item of itemRows) {
    const list = byOrder.get(item.orderId) ?? [];
    list.push(item);
    byOrder.set(item.orderId, list);
  }
  return orderRows.map((row) => {
    const items = byOrder.get(row.id) ?? [];
    return {
      ...baseOrderDTO(row),
      itemCount: items.length,
      totalSheets: items.reduce((s, i) => s + i.pageCount * i.copies, 0),
    };
  });
}

export async function getOrderDetail(userId: string, orderId: string): Promise<OrderDetailDTO> {
  const orderRows = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.userId, userId)))
    .limit(1);
  if (orderRows.length === 0) throw new AppError("ORDER_NOT_FOUND", "Order not found");
  const row = orderRows[0];

  const itemRows = await db.select().from(orderItems).where(eq(orderItems.orderId, row.id));
  const addressRows = await db.select().from(addresses).where(eq(addresses.id, row.addressId)).limit(1);
  const paymentRows = await db
    .select()
    .from(payments)
    .where(eq(payments.orderId, row.id))
    .orderBy(desc(payments.createdAt))
    .limit(1);

  return {
    ...baseOrderDTO(row),
    items: itemRows.map(toItemDTO),
    address: addressRows.length ? toAddressDTO(addressRows[0]) : ({} as AddressDTO),
    payment: paymentRows.length ? toPaymentDTO(paymentRows[0]) : null,
  };
}
