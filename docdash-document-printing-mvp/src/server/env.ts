/**
 * Server-only environment access with safe dev defaults.
 */

function str(value: string | undefined, fallback: string): string {
  return value && value.length > 0 ? value : fallback;
}

function num(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const serverEnv = {
  /** Secret for signing session JWTs. Override SESSION_SECRET in production. */
  sessionSecret: str(process.env.SESSION_SECRET, "docdash-dev-secret-change-me-in-prod"),
  sessionTtlSeconds: num(process.env.SESSION_TTL_SECONDS, 60 * 60 * 24 * 7),
  /** Hours from order placement to promised delivery. */
  deliveryEtaHours: num(process.env.DELIVERY_ETA_HOURS, 36),
  /** Upload storage driver: "local" (dev) or "s3" (production seam). */
  storageDriver: str(process.env.STORAGE_DRIVER, "local"),
  storageDir: str(process.env.STORAGE_DIR, ".storage"),
  /** Mock gateway switch — when false, UPI falls back to "unavailable". */
  upiMockEnabled: process.env.UPI_MOCK_ENABLED !== "false",
  /** Hard cap again on the server, independent of the client. */
  maxUploadMb: num(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB, 25),
} as const;
