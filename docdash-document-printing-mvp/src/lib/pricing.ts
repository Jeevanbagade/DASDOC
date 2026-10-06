/**
 * Single source of truth for pricing. This module is pure (no Node, no DOM)
 * so the exact same code powers the UI's live estimates AND the server's
 * authoritative totals. All money is integer paise — never floats.
 */
import { AppError } from "./errors";

export type ColorMode = "bw" | "color";

export const PRICING = {
  /** ₹2.00 per page, black & white */
  bwPerPagePaise: 200,
  /** ₹5.00 per page, color */
  colorPerPagePaise: 500,
  /** ₹5.00 flat delivery fee per order */
  deliveryFeePaise: 500,
  maxCopiesPerDoc: 50,
  maxDocsPerOrder: 20,
  currency: "INR",
} as const;

export interface QuoteItemInput {
  pageCount: number;
  copies: number;
  colorMode: ColorMode;
}

export interface QuoteLine extends QuoteItemInput {
  ratePerPagePaise: number;
  /** pages in the source document × copies = printed sheets */
  sheetCount: number;
  lineTotalPaise: number;
}

export interface Quote {
  lines: QuoteLine[];
  subtotalPaise: number;
  deliveryFeePaise: number;
  totalPaise: number;
  totalPages: number;
  totalSheets: number;
}

export function rateFor(colorMode: ColorMode): number {
  return colorMode === "color" ? PRICING.colorPerPagePaise : PRICING.bwPerPagePaise;
}

function assertInt(value: number, what: string): void {
  if (!Number.isInteger(value)) {
    throw new AppError("PRICING_INVALID", `${what} must be a whole number, got ${value}`);
  }
}

export function computeLine(item: QuoteItemInput): QuoteLine {
  assertInt(item.pageCount, "page count");
  assertInt(item.copies, "copies");
  if (item.pageCount < 1) {
    throw new AppError("PRICING_INVALID", "A document must have at least 1 page to price it");
  }
  if (item.copies < 1) {
    throw new AppError("PRICING_INVALID", "Copies must be at least 1");
  }
  if (item.copies > PRICING.maxCopiesPerDoc) {
    throw new AppError("PRICING_INVALID", `Copies cannot exceed ${PRICING.maxCopiesPerDoc}`);
  }
  const ratePerPagePaise = rateFor(item.colorMode);
  const sheetCount = item.pageCount * item.copies;
  return {
    ...item,
    ratePerPagePaise,
    sheetCount,
    lineTotalPaise: sheetCount * ratePerPagePaise,
  };
}

/**
 * Authoritative order total. Throws EMPTY_ORDER for an empty list so a
 * zero-file order can never be priced (or placed).
 */
export function computeQuote(items: QuoteItemInput[]): Quote {
  if (items.length === 0) {
    throw new AppError("EMPTY_ORDER", "Add at least one document before checkout");
  }
  if (items.length > PRICING.maxDocsPerOrder) {
    throw new AppError("PRICING_INVALID", `An order can contain at most ${PRICING.maxDocsPerOrder} documents`);
  }
  const lines = items.map(computeLine);
  const subtotalPaise = lines.reduce((sum, l) => sum + l.lineTotalPaise, 0);
  const totalSheets = lines.reduce((sum, l) => sum + l.sheetCount, 0);
  const totalPages = lines.reduce((sum, l) => sum + l.pageCount, 0);
  const deliveryFeePaise = PRICING.deliveryFeePaise;
  return {
    lines,
    subtotalPaise,
    deliveryFeePaise,
    totalPaise: subtotalPaise + deliveryFeePaise,
    totalPages,
    totalSheets,
  };
}

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** paise → "₹1,234.00" */
export function formatINR(paise: number): string {
  assertInt(paise, "amount");
  return inr.format(paise / 100);
}

/** paise → compact display for prose, e.g. "₹2" or "₹4.50" */
export function formatINRShort(paise: number): string {
  assertInt(paise, "amount");
  if (paise % 100 === 0) return `₹${paise / 100}`;
  return `₹${(paise / 100).toFixed(2)}`;
}

export function maskUpiId(upiId: string): string {
  const [local = "", bank = ""] = upiId.split("@");
  const head = local.slice(0, 2);
  return `${head}${"*".repeat(Math.max(local.length - 2, 2))}@${bank}`;
}
