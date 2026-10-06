/**
 * Operator tool: reset a user's password directly in the database.
 *
 *   npm run reset-password -- 8088462503 'NewPass123'
 *
 * Accepts the mobile in any format a user would enter (spaces, +91, etc).
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, pool } from "@/db";
import { users } from "@/db/schema";
import { hashPassword } from "@/server/auth";
import { normalizeMobile, isAcceptablePassword } from "@/lib/validators";
import { DEFAULT_COUNTRY_CODE } from "@/lib/config";

async function main() {
  const [, , mobileArg, newPassword] = process.argv;
  if (!mobileArg || !newPassword) {
    console.error("Usage: npm run reset-password -- <mobile> <newPassword>");
    console.error("  e.g. npm run reset-password -- 8088462503 'NewPass123'");
    process.exit(1);
  }
  const mobile = normalizeMobile(mobileArg, DEFAULT_COUNTRY_CODE);
  if (!mobile) {
    console.error(`✗ "${mobileArg}" is not a valid mobile number`);
    process.exit(1);
  }
  if (!isAcceptablePassword(newPassword.trim())) {
    console.error("✗ New password must be 8+ characters with at least one letter and one number");
    process.exit(1);
  }

  const updated = await db
    .update(users)
    .set({ passwordHash: hashPassword(newPassword.trim()) })
    .where(eq(users.mobileE164, mobile.e164))
    .returning({ id: users.id, name: users.name });

  if (updated.length === 0) {
    console.error(`✗ No account found for ${mobile.e164}`);
    process.exit(1);
  }
  console.log(`✓ Password reset for ${updated[0].name} (${mobile.e164}). They can log in immediately.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
