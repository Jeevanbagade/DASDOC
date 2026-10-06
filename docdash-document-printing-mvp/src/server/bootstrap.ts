/**
 * Boot-time idempotent bootstrap. Ensures the demo account always exists
 * (and always has the documented demo password) so a fresh preview/deploy
 * is immediately explorable. Disable with SEED_DEMO_USER=false.
 */
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { hashPassword } from "./auth";
import { log } from "./log";

const DEMO = {
  name: "Asha Verma",
  mobileE164: "+919876543210",
  password: "Passw0rd!",
} as const;

export async function ensureDemoUser(): Promise<void> {
  const passwordHash = hashPassword(DEMO.password);
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.mobileE164, DEMO.mobileE164))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(users).values({ name: DEMO.name, mobileE164: DEMO.mobileE164, passwordHash });
    log.info("bootstrap.demo_user_created", {});
  } else {
    // Re-pin the demo password so documented credentials can never rot.
    await db.update(users).set({ passwordHash }).where(eq(users.id, existing[0].id));
    log.info("bootstrap.demo_user_refreshed", {});
  }
}

export const DEMO_CREDENTIALS = { mobile: "98765 43210", password: DEMO.password } as const;
