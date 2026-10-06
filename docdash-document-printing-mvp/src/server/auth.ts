/**
 * Password hashing (Node scrypt) + stateless JWT sessions in an httpOnly
 * cookie. `jose` is used so the same verification logic also runs in Edge
 * middleware. The signed cookie IS the session — no server state needed.
 */
import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify, errors as joseErrors } from "jose";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, type UserRow } from "@/db/schema";
import { serverEnv } from "./env";
import { AppError } from "@/lib/errors";
import { SESSION_COOKIE_NAME } from "@/lib/config";

const secret = new TextEncoder().encode(serverEnv.sessionSecret);

// ---------------------------------------------------------------- passwords

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `s2:${salt}:${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [version, salt, hex] = stored.split(":");
  if (version !== "s2" || !salt || !hex) return false;
  const derived = scryptSync(password, salt, 64);
  const expected = Buffer.from(hex, "hex");
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

/** Used to keep login timing uniform when the account does not exist. */
export const DUMMY_PASSWORD_HASH = hashPassword("dummy-password-for-timing");

// ----------------------------------------------------------------- session

export async function signSessionToken(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuer("docdash")
    .setIssuedAt()
    .setExpirationTime(`${serverEnv.sessionTtlSeconds}s`)
    .sign(secret);
}

export type SessionVerification =
  | { ok: true; userId: string }
  | { ok: false; reason: "expired" | "invalid" };

export async function verifySessionToken(token: string): Promise<SessionVerification> {
  try {
    const { payload } = await jwtVerify(token, secret, { issuer: "docdash" });
    if (typeof payload.sub !== "string" || payload.sub.length === 0) {
      return { ok: false, reason: "invalid" };
    }
    return { ok: true, userId: payload.sub };
  } catch (err) {
    if (err instanceof joseErrors.JWTExpired) return { ok: false, reason: "expired" };
    return { ok: false, reason: "invalid" };
  }
}

export function sessionCookieAttributes() {
  const production = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    // Preview panes embed the app in a cross-site iframe, where browsers
    // treat SameSite=Lax cookies as third-party and block them — the login
    // succeeds but the session silently vanishes and protected pages keep
    // bouncing back. CHIPS (partitioned) + SameSite=None/Secure survive that
    // sandbox. SameSite=None requires Secure, so local http dev stays Lax.
    sameSite: (production ? "none" : "lax") as "none" | "lax",
    secure: production,
    partitioned: production,
    path: "/",
    maxAge: serverEnv.sessionTtlSeconds,
  };
}

function readCookieFromHeader(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    if (part.slice(0, idx).trim() === name) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return null;
}

/** Reads + verifies the session from a raw Request (route handlers, tests). */
export async function getSessionUserId(req: Request): Promise<string | null> {
  const token = readCookieFromHeader(req.headers.get("cookie"), SESSION_COOKIE_NAME);
  if (!token) return null;
  const result = await verifySessionToken(token);
  return result.ok ? result.userId : null;
}

export interface SessionUser {
  id: string;
  name: string;
  mobileE164: string;
}

function toSessionUser(row: UserRow): SessionUser {
  return { id: row.id, name: row.name, mobileE164: row.mobileE164 };
}

/**
 * Requires a valid session for an API route. Throws AUTH_REQUIRED when no
 * cookie is present and AUTH_EXPIRED when the token is bad/expired, so the
 * client knows to bounce to /login.
 */
export async function requireUser(req: Request): Promise<SessionUser> {
  const token = readCookieFromHeader(req.headers.get("cookie"), SESSION_COOKIE_NAME);
  if (!token) throw new AppError("AUTH_REQUIRED", "Please log in to continue");
  const result = await verifySessionToken(token);
  if (!result.ok) {
    throw new AppError(
      result.reason === "expired" ? "AUTH_EXPIRED" : "AUTH_REQUIRED",
      result.reason === "expired" ? "Your session expired — please log in again" : "Please log in to continue",
    );
  }
  const rows = await db.select().from(users).where(eq(users.id, result.userId)).limit(1);
  if (rows.length === 0) throw new AppError("AUTH_REQUIRED", "Account no longer exists — please log in again");
  return toSessionUser(rows[0]);
}

/** RSC helper: returns the signed-in user or null (for server components). */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  const result = await verifySessionToken(token);
  if (!result.ok) return null;
  const rows = await db.select().from(users).where(eq(users.id, result.userId)).limit(1);
  return rows.length ? toSessionUser(rows[0]) : null;
}
