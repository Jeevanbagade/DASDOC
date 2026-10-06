import { formatINR, formatINRShort, type ColorMode } from "@/lib/pricing";

/**
 * The signature DocDash receipt — used by the checkout Bill step, the order
 * confirmation, the order detail page and (read-only) on the landing page.
 * Purely presentational so it renders identically on server and client, and
 * is trivially unit-testable.
 */

export interface ReceiptLine {
  key: string;
  fileName: string;
  pageCount: number;
  copies: number;
  colorMode: ColorMode;
  ratePerPagePaise: number;
  lineTotalPaise: number;
  estimated?: boolean;
}

export interface ReceiptProps {
  title?: string;
  stamp?: string;
  lines: ReceiptLine[];
  subtotalPaise: number;
  deliveryFeePaise: number;
  totalPaise: number;
  note?: string;
}

function BarcodeStripes() {
  // CSS-only decorative "barcode".
  return (
    <div
      aria-hidden="true"
      className="h-9 w-40 opacity-80"
      style={{
        backgroundImage:
          "repeating-linear-gradient(90deg, #1a150e 0 2px, transparent 2px 4px, #1a150e 4px 7px, transparent 7px 9px, #1a150e 9px 10px, transparent 10px 14px, #1a150e 14px 16px, transparent 16px 19px)",
      }}
    />
  );
}

export function Receipt({ title = "Print bill", stamp, lines, subtotalPaise, deliveryFeePaise, totalPaise, note }: ReceiptProps) {
  return (
    <div className="relative">
      <div className="rounded-t-lg border-[1.5px] border-ink bg-card px-5 pt-6 pb-7 shadow-hard sm:px-7">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[0.68rem] font-bold tracking-[0.22em] text-muted uppercase">DocDash · {title}</p>
            <p className="font-display mt-1 text-lg font-black tracking-tight">Your paper, itemised.</p>
          </div>
          {stamp && (
            <span className="chip rotate-3 border-brand bg-brand-soft text-brand-deep">{stamp}</span>
          )}
        </div>

        <hr className="dash-rule my-4" />

        <ul className="flex flex-col gap-3" data-testid="receipt-lines">
          {lines.map((line) => (
            <li key={line.key} className="flex items-baseline justify-between gap-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-semibold" title={line.fileName}>
                  {line.fileName}
                  {line.estimated && (
                    <span className="ml-1.5 align-middle text-[0.65rem] font-bold tracking-wide text-gold uppercase">
                      est. pages
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-muted tabular-nums">
                  {line.pageCount} pg × {line.copies} {line.copies === 1 ? "copy" : "copies"} ×{" "}
                  {formatINRShort(line.ratePerPagePaise)} {line.colorMode === "color" ? "colour" : "B&W"}
                </p>
              </div>
              <span className="shrink-0 font-semibold tabular-nums" data-testid={`line-total-${line.key}`}>
                {formatINR(line.lineTotalPaise)}
              </span>
            </li>
          ))}
        </ul>

        <hr className="dash-rule my-4" />

        <dl className="flex flex-col gap-1.5 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-soft">Printing subtotal</dt>
            <dd className="font-semibold tabular-nums" data-testid="receipt-subtotal">
              {formatINR(subtotalPaise)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-soft">Delivery (flat)</dt>
            <dd className="font-semibold tabular-nums" data-testid="receipt-delivery">
              {formatINR(deliveryFeePaise)}
            </dd>
          </div>
        </dl>

        <hr className="dash-rule my-4" />

        <div className="flex items-end justify-between">
          <p className="text-sm font-bold tracking-wide uppercase">Total</p>
          <p className="font-display text-[2rem] leading-none font-black tracking-tight tabular-nums" data-testid="receipt-total">
            {formatINR(totalPaise)}
          </p>
        </div>

        {note && <p className="mt-4 text-xs leading-relaxed text-muted">{note}</p>}

        <div className="mt-6 flex items-center justify-between">
          <BarcodeStripes />
          <p className="text-[0.65rem] font-bold tracking-[0.2em] text-muted uppercase">Thank you</p>
        </div>
      </div>
      <div className="receipt-tear" aria-hidden="true" />
    </div>
  );
}
