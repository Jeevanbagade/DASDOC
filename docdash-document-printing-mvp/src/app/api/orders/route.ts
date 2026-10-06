import { createOrderSchema } from "@/lib/schemas";
import { requireUser } from "@/server/auth";
import { ok, fail, readJson } from "@/server/http";
import { createOrder, listOrders } from "@/server/orders";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    const orders = await listOrders(user.id);
    return ok({ orders });
  } catch (err) {
    return fail(err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    const input = createOrderSchema.parse(await readJson(req));
    const result = await createOrder(user.id, input);
    return ok(
      { order: result.order, duplicated: result.duplicated },
      { status: result.duplicated ? 200 : 201 },
    );
  } catch (err) {
    return fail(err);
  }
}
