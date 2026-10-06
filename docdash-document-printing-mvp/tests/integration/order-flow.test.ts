/**
 * End-to-end integration: signup → login → upload (real PDF) → quote →
 * order create (COD + UPI) → idempotent replay → PRICING_MISMATCH guard →
 * order detail. Everything goes through the actual route handlers, the real
 * PostgreSQL database and the local-disk storage driver.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { PDFDocument } from "pdf-lib";
import { db, pool } from "@/db";
import { addresses, documents, orders, orderItems, payments, users } from "@/db/schema";
import { computeQuote, PRICING } from "@/lib/pricing";
import { POST as signupPOST } from "@/app/api/auth/signup/route";
import { POST as loginPOST } from "@/app/api/auth/login/route";
import { POST as uploadPOST } from "@/app/api/uploads/route";
import { GET as meGET } from "@/app/api/auth/me/route";
import { POST as quotePOST } from "@/app/api/pricing/quote/route";
import { GET as ordersGET, POST as ordersPOST } from "@/app/api/orders/route";
import { GET as orderGET } from "@/app/api/orders/[id]/route";

const MOBILE = "9000000001";
const SECOND_MOBILE = "9000000999";
const PASSWORD = "TestPassw0rd";
const ADDRESS = {
  fullName: "Integration Tester",
  mobile: MOBILE,
  line1: "Row House 7, Paper Lane",
  line2: "Near Ink Park",
  city: "Pune",
  state: "Maharashtra",
  pincode: "411001",
  landmark: "Opposite the library",
};

// ---------------------------------------------------------------- helpers

async function makePdf(pages: number): Promise<Buffer> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage([612, 792]);
  return Buffer.from(await doc.save());
}

interface ApiResult<T = unknown> {
  status: number;
  body: T;
  sessionCookie: string | null;
}

async function call<T = unknown>(
  handler: (req: Request) => Promise<Response> | Response,
  path: string,
  init: { json?: unknown; formData?: FormData; cookie?: string; method?: string } = {},
): Promise<ApiResult<T>> {
  const headers: Record<string, string> = {};
  if (init.cookie) headers.cookie = init.cookie;
  let body: BodyInit | undefined;
  if (init.json !== undefined) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(init.json);
  } else if (init.formData) {
    body = init.formData;
  }
  const req = new Request(`http://test.local${path}`, {
    method: init.method ?? (body ? "POST" : "GET"),
    headers,
    body,
  });
  const res = await handler(req);
  const text = await res.text();
  const setCookies = res.headers.getSetCookie();
  const sessionLine = setCookies.find((c) => c.startsWith("dd_session="));
  return {
    status: res.status,
    body: (text ? JSON.parse(text) : null) as T,
    sessionCookie: sessionLine ? `dd_session=${sessionLine.split(";")[0].split("=")[1]}` : null,
  };
}

function uploadForm(buf: Buffer, name: string, type: string): FormData {
  const fd = new FormData();
  fd.append("file", new File([new Uint8Array(buf)], name, { type }));
  return fd;
}

async function purgeTestUser(mobile: string = MOBILE) {
  const u = await db.select().from(users).where(eq(users.mobileE164, `+91${mobile}`));
  if (u.length === 0) return;
  const userId = u[0].id;
  const os = await db.select().from(orders).where(eq(orders.userId, userId));
  const orderIds = os.map((o) => o.id);
  if (orderIds.length > 0) {
    await db.delete(payments).where(inArray(payments.orderId, orderIds));
    await db.delete(orderItems).where(inArray(orderItems.orderId, orderIds));
  }
  await db.delete(documents).where(eq(documents.userId, userId));
  await db.delete(orders).where(eq(orders.userId, userId));
  await db.delete(addresses).where(eq(addresses.userId, userId));
  await db.delete(users).where(eq(users.id, userId));
}

// ------------------------------------------------------------------ state

let cookie: string;
let firstDocId: string;
let firstOrderId: string;
let firstOrderNumber: string;
const IDEM = "integration-test-idem-key-0001";

// ------------------------------------------------------------------ tests

beforeAll(async () => {
  await purgeTestUser();
  await purgeTestUser(SECOND_MOBILE);
});

afterAll(async () => {
  await purgeTestUser();
  await purgeTestUser(SECOND_MOBILE);
  await pool.end();
});

describe("auth", () => {
  it("signs up a fresh account and establishes a session", async () => {
    const res = await call<{ user: { id: string; mobileE164: string } }>(signupPOST, "/api/auth/signup", {
      json: { name: "Integration Tester", mobile: MOBILE, password: PASSWORD, confirmPassword: PASSWORD },
    });
    expect(res.status).toBe(201);
    expect(res.body.user.mobileE164).toBe(`+91${MOBILE}`);
    expect(res.sessionCookie).toBeTruthy();
    cookie = res.sessionCookie!;
  });

  it("rejects duplicate mobile signup with DUPLICATE_MOBILE", async () => {
    const res = await call<{ error: { code: string } }>(signupPOST, "/api/auth/signup", {
      json: { name: "Copycat", mobile: `+91 ${MOBILE}`, password: PASSWORD, confirmPassword: PASSWORD },
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("DUPLICATE_MOBILE");
  });

  it("rejects wrong-password login with AUTH_INVALID", async () => {
    const res = await call<{ error: { code: string } }>(loginPOST, "/api/auth/login", {
      json: { mobile: MOBILE, password: "WrongPass123" },
    });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("AUTH_INVALID");
  });

  it("logs in with the right password", async () => {
    const res = await call<{ user: { id: string } }>(loginPOST, "/api/auth/login", {
      json: { mobile: MOBILE, password: PASSWORD },
    });
    expect(res.status).toBe(200);
    expect(res.sessionCookie).toBeTruthy();
  });

  it("identifies the session via /me", async () => {
    const res = await call<{ user: { mobileE164: string } }>(meGET, "/api/auth/me", { cookie });
    expect(res.status).toBe(200);
    expect(res.body.user.mobileE164).toBe(`+91${MOBILE}`);
  });
});

describe("uploads", () => {
  it("rejects unauthenticated uploads", async () => {
    const pdf = await makePdf(1);
    const res = await call<{ error: { code: string } }>(uploadPOST, "/api/uploads", {
      formData: uploadForm(pdf, "anon.pdf", "application/pdf"),
    });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("AUTH_REQUIRED");
  });

  it("uploads a real PDF and extracts an exact page count", async () => {
    const pdf = await makePdf(3);
    const res = await call<{ document: { id: string; pageCount: number; pageCountEstimated: boolean; kind: string } }>(
      uploadPOST,
      "/api/uploads",
      { formData: uploadForm(pdf, "integration-notes.pdf", "application/pdf"), cookie },
    );
    expect(res.status).toBe(201);
    expect(res.body.document.pageCount).toBe(3);
    expect(res.body.document.pageCountEstimated).toBe(false);
    expect(res.body.document.kind).toBe("pdf");
    firstDocId = res.body.document.id;
  });

  it("rejects unsupported file types with UNSUPPORTED_FILE", async () => {
    const buf = Buffer.from("MZ not a real binary, but unsupported anyway");
    const res = await call<{ error: { code: string } }>(uploadPOST, "/api/uploads", {
      formData: uploadForm(buf, "virus.exe", "application/octet-stream"),
      cookie,
    });
    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe("UNSUPPORTED_FILE");
  });
});

describe("pricing endpoint", () => {
  it("returns the same totals the shared module computes (3 pages × 2 copies × B&W + ₹5 delivery)", async () => {
    const expected = computeQuote([{ pageCount: 3, copies: 2, colorMode: "bw" }]);
    const res = await call<{ quote: { totalPaise: number; subtotalPaise: number; deliveryFeePaise: number } }>(
      quotePOST,
      "/api/pricing/quote",
      { json: { items: [{ pageCount: 3, copies: 2, colorMode: "bw" }] }, cookie },
    );
    expect(res.status).toBe(200);
    expect(res.body.quote.subtotalPaise).toBe(3 * 2 * 200);
    expect(res.body.quote.deliveryFeePaise).toBe(500);
    expect(res.body.quote.totalPaise).toBe(expected.totalPaise);
    expect(res.body.quote.totalPaise).toBe(1700);
  });
});

describe("order creation + payment", () => {
  const correctTotal = 3 * 2 * 200 + 500; // 1700 paise

  it("blocks an order whose client-sent total disagrees → PRICING_MISMATCH", async () => {
    const res = await call<{ error: { code: string; details?: { serverTotalPaise: number } } }>(
      ordersPOST,
      "/api/orders",
      {
        json: {
          items: [{ documentId: firstDocId, copies: 2, colorMode: "bw" }],
          address: ADDRESS,
          paymentMethod: "cod",
          expectedTotalPaise: correctTotal - 100, // tampered preview total
          idempotencyKey: IDEM,
        },
        cookie,
      },
    );
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("PRICING_MISMATCH");
    expect(res.body.error.details?.serverTotalPaise).toBe(correctTotal);
  });

  it("rejects zero-item orders", async () => {
    const res = await call<{ error: { code: string } }>(ordersPOST, "/api/orders", {
      json: {
        items: [],
        address: ADDRESS,
        paymentMethod: "cod",
        expectedTotalPaise: PRICING.deliveryFeePaise,
        idempotencyKey: IDEM,
      },
      cookie,
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION");
  });

  it("places the COD order with server-authoritative totals", async () => {
    const res = await call<{
      duplicated: boolean;
      order: {
        id: string;
        orderNumber: string;
        totalPaise: number;
        subtotalPaise: number;
        deliveryFeePaise: number;
        status: string;
        paymentStatus: string;
        paymentMethod: string;
        items: Array<{ lineTotalPaise: number; copies: number }>;
        address: { pincode: string };
      };
    }>(ordersPOST, "/api/orders", {
      json: {
        items: [{ documentId: firstDocId, copies: 2, colorMode: "bw" }],
        address: ADDRESS,
        paymentMethod: "cod",
        expectedTotalPaise: correctTotal,
        idempotencyKey: IDEM,
      },
      cookie,
    });
    expect(res.status).toBe(201);
    expect(res.body.duplicated).toBe(false);
    expect(res.body.order.subtotalPaise).toBe(1200);
    expect(res.body.order.deliveryFeePaise).toBe(500);
    expect(res.body.order.totalPaise).toBe(1700);
    expect(res.body.order.status).toBe("placed");
    expect(res.body.order.paymentStatus).toBe("pending");
    expect(res.body.order.items[0].lineTotalPaise).toBe(1200);
    expect(res.body.order.address.pincode).toBe("411001");
    firstOrderId = res.body.order.id;
    firstOrderNumber = res.body.order.orderNumber;
  });

  it("replays the same idempotency key instead of double-placing", async () => {
    const res = await call<{ duplicated: boolean; order: { id: string; orderNumber: string } }>(
      ordersPOST,
      "/api/orders",
      {
        json: {
          items: [{ documentId: firstDocId, copies: 2, colorMode: "bw" }],
          address: ADDRESS,
          paymentMethod: "cod",
          expectedTotalPaise: correctTotal,
          idempotencyKey: IDEM,
        },
        cookie,
      },
    );
    expect(res.status).toBe(200);
    expect(res.body.duplicated).toBe(true);
    expect(res.body.order.id).toBe(firstOrderId);
    expect(res.body.order.orderNumber).toBe(firstOrderNumber);
  });

  it("blocks reusing a document that's already ordered → DOC_ALREADY_ORDERED", async () => {
    const res = await call<{ error: { code: string } }>(ordersPOST, "/api/orders", {
      json: {
        items: [{ documentId: firstDocId, copies: 1, colorMode: "bw" }],
        address: ADDRESS,
        paymentMethod: "cod",
        expectedTotalPaise: 3 * 200 + 500,
        idempotencyKey: `${IDEM}-different`,
      },
      cookie,
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("DOC_ALREADY_ORDERED");
  });

  it("charges UPI through the mock gateway and marks the order paid", async () => {
    const pdf = await makePdf(2);
    const up = await call<{ document: { id: string } }>(uploadPOST, "/api/uploads", {
      formData: uploadForm(pdf, "colour-cover.pdf", "application/pdf"),
      cookie,
    });
    expect(up.status).toBe(201);
    const total = 2 * 1 * 500 + 500; // 2 pages × 1 copy × colour + delivery = 1500
    const res = await call<{
      order: { paymentStatus: string; paymentMethod: string; payment: { txnRef: string | null; upiIdMasked: string | null } };
    }>(ordersPOST, "/api/orders", {
      json: {
        items: [{ documentId: up.body.document.id, copies: 1, colorMode: "color" }],
        address: ADDRESS,
        paymentMethod: "upi",
        upiId: "tester@okhdfc",
        expectedTotalPaise: total,
        idempotencyKey: `${IDEM}-upi`,
      },
      cookie,
    });
    expect(res.status).toBe(201);
    expect(res.body.order.paymentMethod).toBe("upi");
    expect(res.body.order.paymentStatus).toBe("paid");
    expect(res.body.order.payment.txnRef).toMatch(/^UPI-/);
    expect(res.body.order.payment.upiIdMasked).toContain("@okhdfc");
    expect(res.body.order.payment.upiIdMasked).not.toBe("tester@okhdfc");
  });

  it("declines a failing UPI handle and persists nothing", async () => {
    const before = await call<{ orders: unknown[] }>(ordersGET, "/api/orders", { cookie });
    const pdf = await makePdf(1);
    const up = await call<{ document: { id: string } }>(uploadPOST, "/api/uploads", {
      formData: uploadForm(pdf, "to-fail.pdf", "application/pdf"),
      cookie,
    });
    const res = await call<{ error: { code: string } }>(ordersPOST, "/api/orders", {
      json: {
        items: [{ documentId: up.body.document.id, copies: 1, colorMode: "bw" }],
        address: ADDRESS,
        paymentMethod: "upi",
        upiId: "fail@upi",
        expectedTotalPaise: 200 + 500,
        idempotencyKey: `${IDEM}-fail`,
      },
      cookie,
    });
    expect(res.status).toBe(402);
    expect(res.body.error.code).toBe("PAYMENT_FAILED");
    const after = await call<{ orders: unknown[] }>(ordersGET, "/api/orders", { cookie });
    expect(after.body.orders.length).toBe(before.body.orders.length);
  });
});

describe("order history + confirmation reads", () => {
  it("lists my orders newest-first", async () => {
    const res = await call<{ orders: Array<{ id: string }> }>(ordersGET, "/api/orders", { cookie });
    expect(res.status).toBe(200);
    expect(res.body.orders.length).toBe(2);
    expect(res.body.orders.some((o) => o.id === firstOrderId)).toBe(true);
  });

  it("returns full detail for the confirmation screen", async () => {
    const handler = (req: Request) => orderGET(req, { params: Promise.resolve({ id: firstOrderId }) });
    const res = await call<{
      order: {
        orderNumber: string;
        items: Array<{ pageCount: number; copies: number; ratePerPagePaise: number }>;
        address: { city: string };
        etaAt: string;
      };
    }>(handler, `/api/orders/${firstOrderId}`, { cookie });
    expect(res.status).toBe(200);
    expect(res.body.order.orderNumber).toBe(firstOrderNumber);
    expect(res.body.order.items[0]).toMatchObject({ pageCount: 3, copies: 2, ratePerPagePaise: 200 });
    expect(res.body.order.address.city).toBe("Pune");
    expect(new Date(res.body.order.etaAt).getTime()).toBeGreaterThan(Date.now());
  });

  it("never serves another user's order (ORDER_NOT_FOUND, no existence leak)", async () => {
    const second = await call<unknown>(signupPOST, "/api/auth/signup", {
      json: { name: "Second User", mobile: SECOND_MOBILE, password: PASSWORD, confirmPassword: PASSWORD },
    });
    expect(second.status).toBe(201);
    expect(second.sessionCookie).toBeTruthy();
    const handler = (req: Request) => orderGET(req, { params: Promise.resolve({ id: firstOrderId }) });
    const res = await call<{ error: { code: string } }>(handler, `/api/orders/${firstOrderId}`, {
      cookie: second.sessionCookie!,
    });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("ORDER_NOT_FOUND");
  });
});
