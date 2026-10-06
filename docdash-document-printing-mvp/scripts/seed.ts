/**
 * Seed: one demo user with two historical orders (one paid via mock UPI and
 * printing, one delivered COD). Run with: npm run seed
 *
 * Demo login → mobile: 98765 43210 · password: Passw0rd!
 */
import "dotenv/config";
import { eq, inArray } from "drizzle-orm";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { db, pool } from "@/db";
import { addresses, documents, orders, orderItems, payments, users } from "@/db/schema";
import { hashPassword } from "@/server/auth";
import { createDocument } from "@/server/documents";
import { createOrder } from "@/server/orders";
import { computeQuote } from "@/lib/pricing";

const DEMO_MOBILE_E164 = "+919876543210";
const DEMO_NAME = "Asha Verma";
const DEMO_PASSWORD = "Passw0rd!";

const ADDRESS = {
  fullName: "Asha Verma",
  mobile: "9876543210",
  line1: "Flat 4B, Rose Residency",
  line2: "FC Road, Shivajinagar",
  city: "Pune",
  state: "Maharashtra",
  pincode: "411005",
  landmark: "Opposite Good Luck Café",
};
// align with the CreateOrderInput address type

async function makePdf(pages: number, title: string): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < pages; i++) {
    const page = doc.addPage([612, 792]);
    page.drawText(`${title} — page ${i + 1}`, { x: 48, y: 730, size: 16, font });
    page.drawText("Seeded demo content for DocDash.", { x: 48, y: 706, size: 10, font });
  }
  return Buffer.from(await doc.save());
}

async function purgeDemoUser() {
  const existing = await db.select().from(users).where(eq(users.mobileE164, DEMO_MOBILE_E164));
  if (existing.length === 0) return;
  const userId = existing[0].id;
  const os = await db.select().from(orders).where(eq(orders.userId, userId));
  const ids = os.map((o) => o.id);
  if (ids.length > 0) {
    await db.delete(payments).where(inArray(payments.orderId, ids));
    await db.delete(orderItems).where(inArray(orderItems.orderId, ids));
  }
  await db.delete(documents).where(eq(documents.userId, userId));
  await db.delete(orders).where(eq(orders.userId, userId));
  await db.delete(addresses).where(eq(addresses.userId, userId));
  await db.delete(users).where(eq(users.id, userId));
}

async function main() {
  await purgeDemoUser();

  const [user] = await db
    .insert(users)
    .values({ name: DEMO_NAME, mobileE164: DEMO_MOBILE_E164, passwordHash: hashPassword(DEMO_PASSWORD) })
    .returning();
  console.log(`• user: ${DEMO_NAME} (${DEMO_MOBILE_E164})`);

  // Order 1 — paid UPI, has real attached PDFs.
  const notes = await createDocument({
    userId: user.id,
    fileName: "semester5-notes.pdf",
    mimeType: "application/pdf",
    data: await makePdf(24, "Semester 5 Notes"),
  });
  const cover = await createDocument({
    userId: user.id,
    fileName: "lab-report-cover.pdf",
    mimeType: "application/pdf",
    data: await makePdf(1, "Lab Report Cover"),
  });
  const quote1 = computeQuote([
    { pageCount: notes.pageCount, copies: 2, colorMode: "bw" },
    { pageCount: cover.pageCount, copies: 1, colorMode: "color" },
  ]);
  const order1 = await createOrder(user.id, {
    items: [
      { documentId: notes.id, copies: 2, colorMode: "bw" },
      { documentId: cover.id, copies: 1, colorMode: "color" },
    ],
    address: { ...ADDRESS },
    paymentMethod: "upi",
    upiId: "asha@okhdfc",
    expectedTotalPaise: quote1.totalPaise,
    idempotencyKey: "seed-order-upi-0001",
  });
  console.log(`• order ${order1.order.orderNumber} (UPI, paid)`);

  // Order 2 — COD, marked delivered.
  const thesis = await createDocument({
    userId: user.id,
    fileName: "mini-thesis.pdf",
    mimeType: "application/pdf",
    data: await makePdf(42, "Mini Thesis"),
  });
  const quote2 = computeQuote([{ pageCount: thesis.pageCount, copies: 1, colorMode: "bw" }]);
  const order2 = await createOrder(user.id, {
    items: [{ documentId: thesis.id, copies: 1, colorMode: "bw" }],
    address: { ...ADDRESS, line2: "Hostel C, Room 210" },
    paymentMethod: "cod",
    expectedTotalPaise: quote2.totalPaise,
    idempotencyKey: "seed-order-cod-0001",
  });
  await db.update(orders).set({ status: "delivered", paymentStatus: "paid" }).where(eq(orders.id, order2.order.id));
  await db.update(payments).set({ status: "paid" }).where(eq(payments.orderId, order2.order.id));
  console.log(`• order ${order2.order.orderNumber} (COD, delivered)`);

  console.log("\nDemo credentials:");
  console.log("  mobile:   98765 43210");
  console.log("  password: Passw0rd!");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
