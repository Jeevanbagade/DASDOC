import { describe, it, expect } from "vitest";
import {
  isValidMobile,
  isValidPincode,
  isValidUpiId,
  normalizeMobile,
  passwordIssues,
  passwordStrength,
} from "@/lib/validators";
import { assertFileAllowed, classifyUpload, formatBytes } from "@/lib/files";
import { AppError } from "@/lib/errors";

describe("normalise + validate mobile numbers (10-digit, configurable country code)", () => {
  const good = ["9876543210", "+91 98765 43210", "919876543210", "09876543210", " 98 7654 3210 "];
  for (const input of good) {
    it(`accepts "${input}"`, () => {
      const result = normalizeMobile(input, "+91");
      expect(result).not.toBeNull();
      expect(result!.national).toBe("9876543210");
      expect(result!.e164).toBe("+919876543210");
    });
  }

  const bad = ["1234567890", "12345", "98765432109", "abcdefghij", "", "5551234567"];
  for (const input of bad) {
    it(`rejects "${input}"`, () => {
      expect(isValidMobile(input, "+91")).toBe(false);
    });
  }

  it("enforces the Indian first-digit rule for +91 (6-9)", () => {
    expect(isValidMobile("5876543210", "+91")).toBe(false);
    expect(isValidMobile("6876543210", "+91")).toBe(true);
  });

  it("falls back to length-only checks for non-+91 codes", () => {
    expect(isValidMobile("5876543210", "+1")).toBe(true);
  });
});

describe("pincode", () => {
  it("accepts real 6-digit pincodes", () => {
    expect(isValidPincode("411001")).toBe(true);
    expect(isValidPincode("110001")).toBe(true);
    expect(isValidPincode(" 560034 ")).toBe(true);
  });
  it("rejects malformed pincodes", () => {
    expect(isValidPincode("011001")).toBe(false); // leading zero
    expect(isValidPincode("41100")).toBe(false); // 5 digits
    expect(isValidPincode("4110011")).toBe(false); // 7 digits
    expect(isValidPincode("4110A1")).toBe(false);
    expect(isValidPincode("")).toBe(false);
  });
});

describe("password strength", () => {
  it("demands 8+ chars, a letter and a number", () => {
    expect(passwordIssues("short1")).toContain("length");
    expect(passwordIssues("onlyletters")).toContain("number");
    expect(passwordIssues("12345678")).toContain("letter");
    expect(passwordIssues("Passw0rd")).toEqual([]);
  });
  it("scores strength sensibly", () => {
    expect(passwordStrength("a1")).toBe("weak");
    expect(passwordStrength("Passw0rd")).toBe("fair");
    expect(passwordStrength("L0nger-Passw0rd!")).toBe("strong");
    expect(passwordStrength("")).toBe("weak");
  });
});

describe("UPI handle", () => {
  it("accepts sane handles", () => {
    expect(isValidUpiId("asha@okhdfc")).toBe(true);
    expect(isValidUpiId("a.v-9_2@paytm")).toBe(true);
  });
  it("rejects junk", () => {
    expect(isValidUpiId("nohandle")).toBe(false);
    expect(isValidUpiId("@bank")).toBe(false);
    expect(isValidUpiId("a@9bank")).toBe(false);
    expect(isValidUpiId("a b@bank")).toBe(false);
  });
});

describe("file classification + limits", () => {
  it("classifies by extension first", () => {
    expect(classifyUpload("notes.pdf", "application/pdf")?.kind).toBe("pdf");
    expect(classifyUpload("letter.docx", "")?.kind).toBe("word");
    expect(classifyUpload("scan.HEIC", "")?.kind).toBe("image");
    expect(classifyUpload("photo.JPEG", "")?.kind).toBe("image");
  });
  it("falls back to MIME when the extension is weird", () => {
    expect(classifyUpload("noext", "application/pdf")?.kind).toBe("pdf");
    expect(classifyUpload("noext", "image/png")?.kind).toBe("image");
  });
  it("returns null for unsupported files", () => {
    expect(classifyUpload("virus.exe", "application/octet-stream")).toBeNull();
    expect(classifyUpload("sheet.xlsx", "")).toBeNull();
    expect(classifyUpload("clip.mp4", "video/mp4")).toBeNull();
  });

  const MB = 1024 * 1024;
  it("flags oversize files with FILE_TOO_LARGE", () => {
    expect(() =>
      assertFileAllowed({ fileName: "big.pdf", mimeType: "application/pdf", sizeBytes: 26 * MB, maxBytes: 25 * MB }),
    ).toThrowError(AppError);
    try {
      assertFileAllowed({ fileName: "big.pdf", mimeType: "application/pdf", sizeBytes: 26 * MB, maxBytes: 25 * MB });
    } catch (err) {
      expect((err as AppError).code).toBe("FILE_TOO_LARGE");
    }
  });
  it("flags unsupported types with UNSUPPORTED_FILE", () => {
    try {
      assertFileAllowed({ fileName: "app.apk", mimeType: "", sizeBytes: 10, maxBytes: 25 * MB });
      expect.unreachable();
    } catch (err) {
      expect((err as AppError).code).toBe("UNSUPPORTED_FILE");
    }
  });
  it("accepts valid uploads", () => {
    const meta = assertFileAllowed({ fileName: "ok.png", mimeType: "image/png", sizeBytes: 1000, maxBytes: 25 * MB });
    expect(meta.kind).toBe("image");
  });
});

describe("formatBytes", () => {
  it("renders human sizes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(3 * 1024 * 1024)).toBe("3.0 MB");
  });
});
