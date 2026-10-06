import { AppError } from "@/lib/errors";
import { formatBytes } from "@/lib/files";
import { requireUser } from "@/server/auth";
import { ok, fail } from "@/server/http";
import { createDocument } from "@/server/documents";
import { serverEnv } from "@/server/env";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);

    const form = await req.formData().catch(() => {
      throw new AppError("VALIDATION", "Expected multipart/form-data with a 'file' field");
    });
    const file = form.get("file");
    if (!file || typeof file === "string") {
      throw new AppError("VALIDATION", "No file found — attach one as the 'file' field");
    }

    // Cheap pre-check using the multipart size before buffering the body.
    const maxBytes = serverEnv.maxUploadMb * 1024 * 1024;
    if (file.size > maxBytes) {
      throw new AppError(
        "FILE_TOO_LARGE",
        `"${file.name}" is ${formatBytes(file.size)} — the limit is ${formatBytes(maxBytes)}.`,
      );
    }
    const data = Buffer.from(await file.arrayBuffer());

    const document = await createDocument({
      userId: user.id,
      fileName: file.name || "document",
      mimeType: file.type,
      data,
    });
    return ok({ document }, { status: 201 });
  } catch (err) {
    return fail(err);
  }
}
