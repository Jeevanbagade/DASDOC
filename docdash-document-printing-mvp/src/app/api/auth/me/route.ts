import { requireUser } from "@/server/auth";
import { ok, fail } from "@/server/http";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    return ok({ user: { id: user.id, name: user.name, mobileE164: user.mobileE164 } });
  } catch (err) {
    return fail(err);
  }
}
