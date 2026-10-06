// @vitest-environment jsdom
/**
 * Component tests for the checkout wizard's presentational steps: the Bill
 * receipt and the per-document Options step. These run in jsdom with the
 * real components (no mocks beyond callbacks).
 */
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { Receipt } from "@/components/receipt";
import { StepOptions } from "@/components/wizard/step-options";
import { validateAddressAll } from "@/components/wizard/step-delivery";
import { PRICING } from "@/lib/pricing";
import type { WizardDoc } from "@/components/wizard/types";

afterEach(cleanup);

const doc = (over: Partial<WizardDoc> = {}): WizardDoc => ({
  id: "doc-1",
  name: "semester5-notes.pdf",
  kind: "pdf",
  mimeType: "application/pdf",
  sizeBytes: 120_000,
  pageCount: 24,
  pageCountEstimated: false,
  copies: 2,
  colorMode: "bw",
  ...over,
});

describe("Receipt (bill step)", () => {
  it("renders per-document line totals, subtotal, delivery and total", () => {
    render(
      <Receipt
        lines={[
          {
            key: "a",
            fileName: "notes.pdf",
            pageCount: 24,
            copies: 2,
            colorMode: "bw",
            ratePerPagePaise: PRICING.bwPerPagePaise,
            lineTotalPaise: 24 * 2 * 200,
          },
          {
            key: "b",
            fileName: "cover.jpg",
            pageCount: 1,
            copies: 1,
            colorMode: "color",
            ratePerPagePaise: PRICING.colorPerPagePaise,
            lineTotalPaise: 500,
          },
        ]}
        subtotalPaise={24 * 2 * 200 + 500}
        deliveryFeePaise={500}
        totalPaise={24 * 2 * 200 + 500 + 500}
      />,
    );

    expect(screen.getByTestId("line-total-a")).toHaveTextContent("96.00"); // ₹96.00
    expect(screen.getByTestId("line-total-b")).toHaveTextContent("5.00");
    expect(screen.getByTestId("receipt-subtotal")).toHaveTextContent("101.00");
    expect(screen.getByTestId("receipt-delivery")).toHaveTextContent("5.00");
    expect(screen.getByTestId("receipt-total")).toHaveTextContent("106.00");
    expect(screen.getByText("notes.pdf")).toBeInTheDocument();
  });

  it("flags estimated page counts", () => {
    render(
      <Receipt
        lines={[
          {
            key: "w",
            fileName: "letter.docx",
            pageCount: 3,
            copies: 1,
            colorMode: "bw",
            ratePerPagePaise: 200,
            lineTotalPaise: 600,
            estimated: true,
          },
        ]}
        subtotalPaise={600}
        deliveryFeePaise={500}
        totalPaise={1100}
      />,
    );
    expect(screen.getByText(/est\. pages/i)).toBeInTheDocument();
  });
});

describe("StepOptions (wizard step 2)", () => {
  it("bumps copies and recalculates the live estimate", () => {
    const onChange = vi.fn();
    render(<StepOptions docs={[doc()]} onChange={onChange} />);

    const plus = screen.getByRole("button", { name: /more copies/i });
    fireEvent.click(plus);

    expect(onChange).toHaveBeenCalledTimes(1);
    const nextDocs = onChange.mock.calls[0][0] as WizardDoc[];
    expect(nextDocs[0].copies).toBe(3);
  });

  it("never goes below 1 copy", () => {
    const onChange = vi.fn();
    render(<StepOptions docs={[doc({ copies: 1 })]} onChange={onChange} />);
    const minus = screen.getByRole("button", { name: /fewer copies/i });
    expect(minus).toBeDisabled();
  });

  it("switches a document to colour via the segmented control", () => {
    const onChange = vi.fn();
    render(<StepOptions docs={[doc()]} onChange={onChange} />);

    fireEvent.click(screen.getByRole("radio", { name: /colour/i }));
    const nextDocs = onChange.mock.calls[0][0] as WizardDoc[];
    expect(nextDocs[0].colorMode).toBe("color");
  });

  it("applies colour to every document with the quick action", () => {
    const onChange = vi.fn();
    render(<StepOptions docs={[doc(), doc({ id: "doc-2", name: "b.pdf" })]} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: /all colour/i }));
    const nextDocs = onChange.mock.calls[0][0] as WizardDoc[];
    expect(nextDocs.every((d) => d.colorMode === "color")).toBe(true);
  });

  it("shows the live subtotal (pages × copies × rate)", () => {
    render(<StepOptions docs={[doc()]} onChange={() => {}} />);
    // 24 pages × 2 copies × ₹2 = ₹96
    expect(screen.getByTestId("live-subtotal")).toHaveTextContent("₹96");
  });
});

describe("delivery address validation (shared Zod schema)", () => {
  const good = {
    fullName: "Asha Verma",
    mobile: "9876543210",
    line1: "Flat 4B, Rose Residency",
    line2: "",
    city: "Pune",
    state: "Maharashtra",
    pincode: "411001",
    landmark: "",
  };

  it("accepts a complete address", () => {
    expect(validateAddressAll(good)).toEqual({});
  });

  it("flags every missing required field", () => {
    const errors = validateAddressAll({
      fullName: "",
      mobile: "",
      line1: "",
      line2: "",
      city: "",
      state: "",
      pincode: "",
      landmark: "",
    });
    for (const key of ["fullName", "mobile", "line1", "city", "state", "pincode"]) {
      expect(errors[key]).toBeTruthy();
    }
  });

  it("flags a bad pincode specifically", () => {
    const errors = validateAddressAll({ ...good, pincode: "1234" });
    expect(errors.pincode).toMatch(/6-digit/);
  });
});
