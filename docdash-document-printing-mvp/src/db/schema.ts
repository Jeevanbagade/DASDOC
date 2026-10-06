import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const colorModeEnum = pgEnum("color_mode", ["bw", "color"]);
export const paymentMethodEnum = pgEnum("payment_method", ["upi", "cod"]);
export const paymentStatusEnum = pgEnum("payment_status", ["pending", "paid", "failed"]);
export const orderStatusEnum = pgEnum("order_status", [
  "placed",
  "confirmed",
  "printing",
  "out_for_delivery",
  "delivered",
  "cancelled",
]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    /** E.164, e.g. "+919876543210" — unique so mobile doubles as username */
    mobileE164: text("mobile_e164").notNull(),
    passwordHash: text("password_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("users_mobile_uq").on(t.mobileE164)],
);

export const addresses = pgTable("addresses", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  fullName: text("full_name").notNull(),
  mobileE164: text("mobile_e164").notNull(),
  line1: text("line1").notNull(),
  line2: text("line2").notNull().default(""),
  city: text("city").notNull(),
  state: text("state").notNull(),
  pincode: text("pincode").notNull(),
  landmark: text("landmark").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Human-facing id, e.g. "DD-260304-X7Q2" */
    orderNumber: text("order_number").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    addressId: uuid("address_id")
      .notNull()
      .references(() => addresses.id),
    status: orderStatusEnum("status").notNull().default("placed"),
    paymentMethod: paymentMethodEnum("payment_method").notNull(),
    paymentStatus: paymentStatusEnum("payment_status").notNull().default("pending"),
    subtotalPaise: integer("subtotal_paise").notNull(),
    deliveryFeePaise: integer("delivery_fee_paise").notNull(),
    totalPaise: integer("total_paise").notNull(),
    etaAt: timestamp("eta_at", { withTimezone: true, mode: "date" }).notNull(),
    /** Client-generated key: makes order placement safe to retry / double-click */
    idempotencyKey: text("idempotency_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("orders_number_uq").on(t.orderNumber),
    uniqueIndex("orders_idempotency_uq").on(t.idempotencyKey),
    index("orders_user_idx").on(t.userId),
  ],
);

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    originalName: text("original_name").notNull(),
    mimeType: text("mime_type").notNull(),
    kind: text("kind").notNull(), // pdf | word | image
    sizeBytes: integer("size_bytes").notNull(),
    pageCount: integer("page_count").notNull(),
    /** true when the page count is a heuristic (Word files, legacy .doc) */
    pageCountEstimated: boolean("page_count_estimated").notNull().default(false),
    storageKey: text("storage_key").notNull(),
    /** null until the document is attached to a placed order */
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("documents_storage_key_uq").on(t.storageKey), index("documents_user_idx").on(t.userId)],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id),
    /** Snapshot fields so the bill survives file deletion / renames */
    fileName: text("file_name").notNull(),
    pageCount: integer("page_count").notNull(),
    copies: integer("copies").notNull(),
    colorMode: colorModeEnum("color_mode").notNull(),
    ratePerPagePaise: integer("rate_per_page_paise").notNull(),
    lineTotalPaise: integer("line_total_paise").notNull(),
  },
  (t) => [uniqueIndex("order_items_document_uq").on(t.documentId), index("order_items_order_idx").on(t.orderId)],
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    /** "mock_upi" today — a real provider (Razorpay/Stripe) slots in behind PaymentProvider */
    provider: text("provider").notNull(),
    status: paymentStatusEnum("status").notNull().default("pending"),
    amountPaise: integer("amount_paise").notNull(),
    /** masked, e.g. "ab****@okhdfc" — never store raw UPI handles */
    upiIdMasked: text("upi_id_masked"),
    txnRef: text("txn_ref"),
    failureReason: text("failure_reason"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("payments_order_idx").on(t.orderId)],
);

export type UserRow = typeof users.$inferSelect;
export type AddressRow = typeof addresses.$inferSelect;
export type OrderRow = typeof orders.$inferSelect;
export type DocumentRow = typeof documents.$inferSelect;
export type OrderItemRow = typeof orderItems.$inferSelect;
export type PaymentRow = typeof payments.$inferSelect;
