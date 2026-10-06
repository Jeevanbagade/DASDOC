import { requireUser } from "@/server/auth";
import { ok, fail } from "@/server/http";
import { deleteDocument } from "@/server/documents";

export const runtime = "nodejs";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(req);
    const { id } = await params;
    await deleteDocument(user.id, id);
    return ok({ ok: true });
  } catch (err) {
    return fail(err);
  }
}
