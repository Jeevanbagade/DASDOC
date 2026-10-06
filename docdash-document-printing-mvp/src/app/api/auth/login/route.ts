import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { loginSchema } from "@/lib/schemas";
import { normalizeMobile } from "@/lib/validators";
import { DEFAULT_COUNTRY_CODE, SESSION_COOKIE_NAME } from "@/lib/config";
import { AppError } from "@/lib/errors";
import { DUMMY_PASSWORD_HASH, sessionCookieAttributes, signSessionToken, verifyPassword } from "@/server/auth";
import { ok, fail, readJson } from "@/server/http";
import { log } from "@/server/log";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const input = loginSchema.parse(await readJson(req));
    const mobile = normalizeMobile(input.mobile, DEFAULT_COUNTRY_CODE);
    if (!mobile) throw new AppError("AUTH_INVALID", "Incorrect mobile number or password");

    const rows = await db.select().from(users).where(eq(users.mobileE164, mobile.e164)).limit(1);
    const user = rows[0] ?? null;
    const stored = user?.passwordHash ?? DUMMY_PASSWORD_HASH;
    // Uniform timing: always run a scrypt comparison even when the account
    // doesn't exist, so login can't be used to enumerate numbers.
    let matches = verifyPassword(input.password, stored);
    if (!matches && input.password !== input.password.trim()) {
      // Forgiveness path: stray leading/trailing space typed at the keyboard.
      matches = verifyPassword(input.password.trim(), stored);
    }
    if (!user || !matches) {
      log.warn("auth.login_failed", { found: Boolean(user) });
      throw new AppError("AUTH_INVALID", "Incorrect mobile number or password");
    }

    const token = await signSessionToken(user.id);
    log.info("auth.login", { userId: user.id });
    const res: NextResponse = ok({ user: { id: user.id, name: user.name, mobileE164: user.mobileE164 } });
    res.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieAttributes());
    return res;
  } catch (err) {
    return fail(err);
  }
}
