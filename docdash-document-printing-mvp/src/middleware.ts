import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

/**
 * Route guard.
 *
 * Protected pages gate on cookie PRESENCE only — authoritative verification
 * always happens in the Node runtime (page guards + API route handlers).
 * That keeps session trust on a single code path and makes edge/env secret
 * drift incapable of producing login redirect loops.
 *
 * Auth pages still try to bounce genuinely-signed-in users into the app
 * (best-effort, advisory only).
 */
const PROTECTED = ["/new-order", "/orders"];
const AUTH_PAGES = ["/login", "/signup"];

const secret = new TextEncoder().encode(
  process.env.SESSION_SECRET ?? "docdash-dev-secret-change-me-in-prod",
);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get("dd_session")?.value;

  if (PROTECTED.some((p) => pathname.startsWith(p))) {
    if (!token) {
      const url = new URL("/login", req.url);
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (AUTH_PAGES.some((p) => pathname.startsWith(p)) && token) {
    try {
      await jwtVerify(token, secret, { issuer: "docdash" });
      return NextResponse.redirect(new URL("/new-order", req.url));
    } catch {
      // stale/forged token — simply show the auth page
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/new-order/:path*", "/orders/:path*", "/login", "/signup"],
};
