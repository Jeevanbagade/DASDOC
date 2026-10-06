import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/config";
import { ok } from "@/server/http";
import { sessionCookieAttributes } from "@/server/auth";

export const runtime = "nodejs";

export async function POST() {
  const res: NextResponse = ok({ ok: true });
  // Mirror the attributes the cookie was set with (incl. the partition key)
  // so the browser actually deletes it.
  res.cookies.set(SESSION_COOKIE_NAME, "", { ...sessionCookieAttributes(), maxAge: 0 });
  return res;
}
