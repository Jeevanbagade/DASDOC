import { quoteRequestSchema } from "@/lib/schemas";
import { computeQuote } from "@/lib/pricing";
import { requireUser } from "@/server/auth";
import { ok, fail, readJson } from "@/server/http";

export const runtime = "nodejs";

/**
 * Authoritative quote — the Bill step calls this so the numbers on screen
 * are always the server's numbers, and the checkout asserts the same total
 * again at order creation.
 */
export async function POST(req: Request) {
  try {
    await requireUser(req);
    const input = quoteRequestSchema.parse(await readJson(req));
    const quote = computeQuote(input.items);
    return ok({ quote });
  } catch (err) {
    return fail(err);
  }
}
