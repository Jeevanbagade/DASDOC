"use client";

import { Minus, Plus, Info } from "lucide-react";
import type { ColorMode } from "@/lib/pricing";
import { PRICING, formatINRShort, computeQuote, rateFor } from "@/lib/pricing";
import { StepShell } from "@/components/ui";
import type { WizardDoc } from "./types";

interface Props {
  docs: WizardDoc[];
  onChange: (docs: WizardDoc[]) => void;
}

export function StepOptions({ docs, onChange }: Props) {
  const liveQuote = computeQuote(docs.map((d) => ({ pageCount: d.pageCount, copies: d.copies, colorMode: d.colorMode })));

  function updateDoc(id: string, patch: Partial<Pick<WizardDoc, "copies" | "colorMode">>) {
    onChange(docs.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }

  function setAll(colorMode: ColorMode) {
    onChange(docs.map((d) => ({ ...d, colorMode })));
  }

  const anyEstimated = docs.some((d) => d.pageCountEstimated);

  return (
    <StepShell
      eyebrow="Step 2 of 5"
      title="Print options"
      blurb="Copies and ink for each document. B&W is ₹2/page, colour is ₹5/page."
    >
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setAll("bw")} className="btn btn-ghost px-4 py-1.5 text-xs">
          All B&W
        </button>
        <button type="button" onClick={() => setAll("color")} className="btn btn-ghost px-4 py-1.5 text-xs">
          All colour
        </button>
      </div>

      <ul className="mt-5 flex flex-col gap-4">
        {docs.map((doc) => (
          <li key={doc.id} className="hard-card-flat p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold" title={doc.name}>
                  {doc.name}
                </p>
                <p className="mt-0.5 text-xs text-muted tabular-nums">
                  {doc.pageCount} {doc.pageCount === 1 ? "page" : "pages"}
                  {doc.pageCountEstimated && " (estimated)"}
                  {" · "}
                  {formatINRShort(rateFor(doc.colorMode))}/page
                </p>
              </div>
              <p className="text-sm font-bold tabular-nums" data-testid={`line-estimate-${doc.id}`}>
                {formatINRShort(doc.pageCount * doc.copies * rateFor(doc.colorMode))}
              </p>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-4">
              {/* Copies stepper */}
              <div>
                <p className="mb-1.5 text-[0.68rem] font-bold tracking-[0.14em] text-muted uppercase">Copies</p>
                <div className="inline-flex items-center gap-1 rounded-full border-[1.5px] border-ink bg-card p-1">
                  <button
                    type="button"
                    onClick={() => updateDoc(doc.id, { copies: Math.max(1, doc.copies - 1) })}
                    disabled={doc.copies <= 1}
                    className="rounded-full p-1.5 transition-colors hover:bg-cream disabled:opacity-30"
                    aria-label={`Fewer copies of ${doc.name}`}
                  >
                    <Minus size={15} />
                  </button>
                  <span className="w-8 text-center text-sm font-bold tabular-nums" data-testid={`copies-${doc.id}`}>
                    {doc.copies}
                  </span>
                  <button
                    type="button"
                    onClick={() => updateDoc(doc.id, { copies: Math.min(PRICING.maxCopiesPerDoc, doc.copies + 1) })}
                    disabled={doc.copies >= PRICING.maxCopiesPerDoc}
                    className="rounded-full p-1.5 transition-colors hover:bg-cream disabled:opacity-30"
                    aria-label={`More copies of ${doc.name}`}
                  >
                    <Plus size={15} />
                  </button>
                </div>
              </div>

              {/* Colour mode segmented control */}
              <div>
                <p className="mb-1.5 text-[0.68rem] font-bold tracking-[0.14em] text-muted uppercase">Ink</p>
                <div
                  role="radiogroup"
                  aria-label={`Ink for ${doc.name}`}
                  className="inline-flex rounded-full border-[1.5px] border-ink bg-card p-1"
                >
                  {(
                    [
                      { value: "bw", label: `B&W · ${formatINRShort(PRICING.bwPerPagePaise)}/pg` },
                      { value: "color", label: `Colour · ${formatINRShort(PRICING.colorPerPagePaise)}/pg` },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      role="radio"
                      aria-checked={doc.colorMode === opt.value}
                      onClick={() => updateDoc(doc.id, { colorMode: opt.value })}
                      className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
                        doc.colorMode === opt.value ? "bg-ink text-cream" : "text-ink-soft hover:bg-cream"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {anyEstimated && (
        <p className="mt-4 flex items-start gap-2 rounded-xl border-[1.5px] border-dashed border-gold bg-[#fff8ec] px-4 py-3 text-xs font-medium text-[#7a5410]">
          <Info size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          Some Word files have estimated page counts (Word reflows per printer). We flag them on your bill; the shop
          confirms the final count while printing.
        </p>
      )}

      <div className="mt-6 flex items-center justify-between rounded-xl bg-ink px-5 py-3.5 text-cream">
        <p className="text-sm font-semibold">
          Live estimate · {liveQuote.totalSheets} sheets
          {liveQuote.totalSheets === 1 ? "" : ""}
        </p>
        <p className="font-display text-xl font-black tabular-nums" data-testid="live-subtotal">
          {formatINRShort(liveQuote.subtotalPaise)} + {formatINRShort(liveQuote.deliveryFeePaise)} delivery
        </p>
      </div>
    </StepShell>
  );
}
