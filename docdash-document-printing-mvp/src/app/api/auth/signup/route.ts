import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { signupSchema } from "@/lib/schemas";
import { normalizeMobile } from "@/lib/validators";
import { DEFAULT_COUNTRY_CODE, SESSION_COOKIE_NAME } from "@/lib/config";
import { AppError } from "@/lib/errors";
import { hashPassword, sessionCookieAttributes, signSessionToken } from "@/server/auth";
import { ok, fail, readJson } from "@/server/http";
import { log } from "@/server/log";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const input = signupSchema.parse(await readJson(req));
    const mobile = normalizeMobile(input.mobile, DEFAULT_COUNTRY_CODE);
    if (!mobile) throw new AppError("VALIDATION", "Mobile number must be a valid 10-digit number", { field: "mobile" });

    const existing = await db.select({ id: users.id }).from(users).where(eq(users.mobileE164, mobile.e164)).limit(1);
    if (existing.length > 0) {
      throw new AppError("DUPLICATE_MOBILE", "An account already exists for this mobile number — try logging in", {
        field: "mobile",
      });
    }

    const [user] = await db
      .insert(users)
      .values({ name: input.name, mobileE164: mobile.e164, passwordHash: hashPassword(input.password) })
      .returning();

    const token = await signSessionToken(user.id);
    log.info("auth.signup", { userId: user.id });
    const res: NextResponse = ok({ user: { id: user.id, name: user.name, mobileE164: user.mobileE164 } }, { status: 201 });
    res.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieAttributes());
    return res;
  } catch (err) {
    return fail(err);
  }
}
