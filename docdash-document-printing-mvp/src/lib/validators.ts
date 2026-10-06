/**
 * Field-level validators shared by client forms, Zod schemas, and the server.
 * Mobile numbers are stored normalized as E.164 (country code + 10 digits).
 */

export interface NormalizedMobile {
  /** e.g. "+91" */
  countryCode: string;
  /** 10-digit national number, e.g. "9876543210" */
  national: string;
  /** "+919876543210" */
  e164: string;
}

/**
 * Normalizes a user-typed mobile number. Accepts inputs like
 * "98765 43210", "+91 98765-43210", "919876543210", "09876543210".
 * Returns null when nothing usable remains.
 */
export function normalizeMobile(raw: string, countryCode = "+91"): NormalizedMobile | null {
  const ccDigits = countryCode.replace(/\D/g, "");
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 0) return null;
  // Strip an explicit country prefix (longest match first).
  if (ccDigits && digits.startsWith(ccDigits) && digits.length === ccDigits.length + 10) {
    digits = digits.slice(ccDigits.length);
  }
  // Strip a single trunk "0" prefix (common in India).
  if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }
  if (digits.length !== 10) return null;
  if (!isValidNationalMobile(digits, countryCode)) return null;
  return { countryCode, national: digits, e164: `${countryCode}${digits}` };
}

/**
 * 10-digit mobile validation. For +91 (India) the first digit must be 6-9
 * per TRAI numbering rules; other country codes fall back to a length check.
 */
export function isValidNationalMobile(national: string, countryCode = "+91"): boolean {
  if (!/^\d{10}$/.test(national)) return false;
  if (countryCode.replace(/\D/g, "") === "91") {
    return /^[6-9]/.test(national);
  }
  return true;
}

export function isValidMobile(raw: string, countryCode = "+91"): boolean {
  return normalizeMobile(raw, countryCode) !== null;
}

/** Indian PIN codes are 6 digits and never start with 0. */
export function isValidPincode(pin: string): boolean {
  return /^[1-9]\d{5}$/.test(pin.trim());
}

export interface PasswordRule {
  id: string;
  label: string;
  test: (pw: string) => boolean;
}

export const PASSWORD_RULES: PasswordRule[] = [
  { id: "length", label: "At least 8 characters", test: (pw) => pw.length >= 8 },
  { id: "letter", label: "Contains a letter", test: (pw) => /[a-zA-Z]/.test(pw) },
  { id: "number", label: "Contains a number", test: (pw) => /\d/.test(pw) },
];

/** Returns ids of unmet rules; empty array = password is acceptable. */
export function passwordIssues(pw: string): string[] {
  return PASSWORD_RULES.filter((r) => !r.test(pw)).map((r) => r.id);
}

export function isAcceptablePassword(pw: string): boolean {
  return passwordIssues(pw).length === 0 && pw.length <= 72;
}

export type PasswordStrength = "weak" | "fair" | "strong";

export function passwordStrength(pw: string): PasswordStrength {
  if (pw.length === 0) return "weak";
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;
  if (score <= 2) return "weak";
  if (score <= 3) return "fair";
  return "strong";
}

/** Loose-but-sane UPI handle check: local@bank */
export function isValidUpiId(upiId: string): boolean {
  return /^[a-zA-Z0-9._-]{2,64}@[a-zA-Z][a-zA-Z0-9]{1,31}$/.test(upiId.trim());
}
