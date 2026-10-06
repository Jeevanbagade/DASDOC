import { describe, it, expect } from "vitest";
import { computeQuote, computeLine, formatINR, formatINRShort, maskUpiId, PRICING, rateFor } from "@/lib/pricing";
import { AppError } from "@/lib/errors";

describe("pricing constants", () => {
  it("locks the advertised rates (₹2 B&W, ₹5 colour, ₹5 delivery)", () => {
    expect(PRICING.bwPerPagePaise).toBe(200);
    expect(PRICING.colorPerPagePaise).toBe(500);
    expect(PRICING.deliveryFeePaise).toBe(500);
    expect(rateFor("bw")).toBe(200);
    expect(rateFor("color")).toBe(500);
  });
});

describe("computeLine — full matrix of pages × copies × colour mode", () => {
  const pages = [1, 3, 24, 150];
  const copies = [1, 2, 7, 50];
  const modes = ["bw", "color"] as const;

  for (const p of pages) {
    for (const c of copies) {
      for (const m of modes) {
        it(`${p} pages × ${c} copies × ${m}`, () => {
          const line = computeLine({ pageCount: p, copies: c, colorMode: m });
          const rate = m === "color" ? 500 : 200;
          expect(line.ratePerPagePaise).toBe(rate);
          expect(line.sheetCount).toBe(p * c);
          expect(line.lineTotalPaise).toBe(p * c * rate);
        });
      }
    }
  }
});

describe("computeLine — rejects impossible inputs", () => {
  it("zero pages", () => {
    expect(() => computeLine({ pageCount: 0, copies: 1, colorMode: "bw" })).toThrowError(AppError);
    expect(() => computeLine({ pageCount: 0, copies: 1, colorMode: "bw" })).toThrowError(/at least 1 page/i);
  });
  it("zero copies", () => {
    expect(() => computeLine({ pageCount: 5, copies: 0, colorMode: "bw" })).toThrowError(/copies/i);
  });
  it("copies above the cap", () => {
    expect(() => computeLine({ pageCount: 5, copies: 51, colorMode: "bw" })).toThrowError(/50/);
  });
  it("fractional pages (float guard — money math is integer-only)", () => {
    expect(() => computeLine({ pageCount: 2.5, copies: 1, colorMode: "bw" })).toThrowError(/whole number/i);
  });
});

describe("computeQuote — order totals include the flat delivery fee exactly once", () => {
  it("single document, B&W", () => {
    const q = computeQuote([{ pageCount: 10, copies: 2, colorMode: "bw" }]);
    expect(q.subtotalPaise).toBe(4000); // 10 × 2 × 200
    expect(q.deliveryFeePaise).toBe(500);
    expect(q.totalPaise).toBe(4500);
    expect(q.totalSheets).toBe(20);
  });

  it("multiple documents across colour modes", () => {
    const q = computeQuote([
      { pageCount: 24, copies: 2, colorMode: "bw" }, // 9600
      { pageCount: 1, copies: 1, colorMode: "color" }, // 500
      { pageCount: 3, copies: 5, colorMode: "color" }, // 7500
    ]);
    expect(q.subtotalPaise).toBe(9600 + 500 + 7500);
    expect(q.totalPaise).toBe(9600 + 500 + 7500 + 500); // one delivery fee, not three
    expect(q.lines).toHaveLength(3);
    expect(q.totalPages).toBe(28);
    expect(q.totalSheets).toBe(24 * 2 + 1 + 15);
  });

  it("rejects an empty order with EMPTY_ORDER", () => {
    try {
      computeQuote([]);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe("EMPTY_ORDER");
    }
  });

  it("rejects over the per-order document cap", () => {
    const items = Array.from({ length: 21 }, () => ({ pageCount: 1, copies: 1, colorMode: "bw" as const }));
    expect(() => computeQuote(items)).toThrowError(/20/);
  });
});

describe("money formatting", () => {
  it("formats paise as INR with two decimals", () => {
    expect(formatINR(4500)).toContain("45");
    expect(formatINR(4500)).toContain(".00");
    expect(formatINR(123456)).toContain("1,234.56");
  });
  it("short format drops rupee decimals when whole", () => {
    expect(formatINRShort(200)).toBe("₹2");
    expect(formatINRShort(250)).toBe("₹2.50");
  });
  it("rejects fractional paise", () => {
    expect(() => formatINR(99.5)).toThrowError(/whole number/i);
  });
});

describe("maskUpiId", () => {
  it("masks the local part but keeps the bank handle", () => {
    const masked = maskUpiId("asha.verma@okhdfc");
    expect(masked.startsWith("as")).toBe(true);
    expect(masked.endsWith("@okhdfc")).toBe(true);
    expect(masked).not.toContain("verma");
  });
});
