import { requireUser } from "@/server/auth";
import { ok, fail } from "@/server/http";
import { getOrderDetail } from "@/server/orders";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(req);
    const { id } = await params;
    const order = await getOrderDetail(user.id, id);
    return ok({ order });
  } catch (err) {
    return fail(err);
  }
}
