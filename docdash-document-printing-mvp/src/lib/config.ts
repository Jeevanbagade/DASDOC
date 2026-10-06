/**
 * Client-safe configuration. Only NEXT_PUBLIC_* variables may be read here —
 * this module is bundled for the browser.
 */

function num(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const APP_NAME = "DocDash";
export const APP_TAGLINE = "Print it fast, skip the past";

export const MAX_UPLOAD_MB = num(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB, 25);
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

/** Country code used for mobile normalization + display. */
export const DEFAULT_COUNTRY_CODE = process.env.NEXT_PUBLIC_DEFAULT_COUNTRY_CODE || "+91";

/** UPI availability flag — COD becomes the default when this is false. */
export const UPI_AVAILABLE = process.env.NEXT_PUBLIC_UPI_AVAILABLE !== "false";

export const SESSION_COOKIE_NAME = "dd_session";
