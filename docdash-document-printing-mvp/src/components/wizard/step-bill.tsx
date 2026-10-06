"use client";

import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import type { Quote } from "@/lib/pricing";
import { apiFetch } from "@/lib/api-client";
import { ApiClientError } from "@/lib/errors";
import { Receipt } from "@/components/receipt";
import { ErrorBanner, Spinner, StepShell } from "@/components/ui";
import type { WizardDoc } from "./types";

interface Props {
  docs: WizardDoc[];
  serverQuote: Quote | null;
  onServerQuote: (quote: Quote | null) => void;
}

/**
 * The Bill step never trusts its own arithmetic for display — it asks the
 * server for the authoritative quote (same shared pricing module, server
 * context) and renders exactly that.
 */
export function StepBill({ docs, serverQuote, onServerQuote }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signature = docs.map((d) => `${d.id}:${d.pageCount}:${d.copies}:${d.colorMode}`).join("|");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiFetch<{ quote: Quote }>("/api/pricing/quote", {
      json: { items: docs.map((d) => ({ pageCount: d.pageCount, copies: d.copies, colorMode: d.colorMode })) },
    })
      .then((res) => {
        if (!cancelled) onServerQuote(res.quote);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiClientError ? err.message : "Could not fetch the bill — retry.");
          onServerQuote(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  return (
    <StepShell
      eyebrow="Step 4 of 5"
      title="The bill, no surprises"
      blurb="Priced as pages × copies × rate, plus one flat delivery fee. The server computes this — your screen just renders it."
    >
      <ErrorBanner message={error} />

      {loading && !serverQuote && (
        <div className="hard-card-flat flex items-center justify-center gap-3 px-6 py-16 text-sm font-semibold text-muted">
          <Spinner size={18} /> Asking the server for your total…
        </div>
      )}

      {serverQuote && (
        <div className={loading ? "opacity-60 transition-opacity" : ""}>
          <div className="mb-3 flex items-center gap-2 text-xs font-bold text-mint">
            <ShieldCheck size={15} aria-hidden="true" />
            Server-verified totals
          </div>
          <Receipt
            lines={serverQuote.lines.map((line, i) => ({
              key: docs[i]?.id ?? String(i),
              fileName: docs[i]?.name ?? `Document ${i + 1}`,
              pageCount: line.pageCount,
              copies: line.copies,
              colorMode: line.colorMode,
              ratePerPagePaise: line.ratePerPagePaise,
              lineTotalPaise: line.lineTotalPaise,
              estimated: docs[i]?.pageCountEstimated,
            }))}
            subtotalPaise={serverQuote.subtotalPaise}
            deliveryFeePaise={serverQuote.deliveryFeePaise}
            totalPaise={serverQuote.totalPaise}
            note="This exact total is re-checked when you place the order. If anything changed, we'll stop and show you the difference instead of charging you."
          />
        </div>
      )}
    </StepShell>
  );
}
