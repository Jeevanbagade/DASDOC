/**
 * Next.js startup hook (runs once per server boot, Node runtime only).
 * Keeps the demo login alive across deploys without baking anything into
 * request paths.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.SEED_DEMO_USER === "false") return;
  try {
    const { ensureDemoUser } = await import("@/server/bootstrap");
    await ensureDemoUser();
  } catch (err) {
    console.error("[bootstrap] demo user ensure failed:", err);
  }
}
