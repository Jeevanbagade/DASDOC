"use client";

import { Banknote, Landmark, MapPin, Pencil, Zap } from "lucide-react";
import { formatINR } from "@/lib/pricing";
import { DEFAULT_COUNTRY_CODE, UPI_AVAILABLE } from "@/lib/config";
import { isValidUpiId } from "@/lib/validators";
import { ErrorBanner, Field, StepShell, TextInput } from "@/components/ui";
import type { AddressForm, PaymentState, WizardDoc } from "./types";

interface Props {
  payment: PaymentState;
  onPaymentChange: (payment: PaymentState) => void;
  docs: WizardDoc[];
  address: AddressForm;
  totalPaise: number;
  error: string | null;
  onJumpToStep: (step: number) => void;
}

export function StepPayment({ payment, onPaymentChange, docs, address, totalPaise, error, onJumpToStep }: Props) {
  const upiIdValid = payment.method === "cod" || isValidUpiId(payment.upiId);

  return (
    <StepShell
      eyebrow="Step 5 of 5"
      title="How are you paying?"
      blurb="UPI is instant. Or keep it old-school and pay cash when the prints arrive."
    >
      <div className="grid gap-4 sm:grid-cols-2" role="radiogroup" aria-label="Payment method">
        <button
          type="button"
          role="radio"
          aria-checked={payment.method === "upi"}
          onClick={() => UPI_AVAILABLE && onPaymentChange({ ...payment, method: "upi" })}
          className={`hard-card-flat relative p-5 text-left transition-all ${
            payment.method === "upi" ? "shadow-hard -translate-y-0.5 bg-brand-soft/40" : "hover:bg-cream"
          } ${!UPI_AVAILABLE ? "cursor-not-allowed opacity-50" : ""}`}
        >
          <div className="flex items-center justify-between">
            <span className="rounded-xl border-[1.5px] border-ink bg-cream p-2">
              <Zap size={18} className="text-brand" aria-hidden="true" />
            </span>
            {UPI_AVAILABLE ? (
              <span className="chip border-transparent bg-[#e5f3e9] text-mint normal-case">Instant</span>
            ) : (
              <span className="chip border-transparent bg-line text-ink-soft normal-case">Unavailable</span>
            )}
          </div>
          <p className="mt-3 font-display text-lg font-black">UPI</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-soft">
            GPay, PhonePe, Paytm — approve in your app and we start printing immediately.
          </p>
        </button>

        <button
          type="button"
          role="radio"
          aria-checked={payment.method === "cod"}
          onClick={() => onPaymentChange({ ...payment, method: "cod" })}
          className={`hard-card-flat relative p-5 text-left transition-all ${
            payment.method === "cod" ? "shadow-hard -translate-y-0.5 bg-brand-soft/40" : "hover:bg-cream"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="rounded-xl border-[1.5px] border-ink bg-cream p-2">
              <Banknote size={18} className="text-mint" aria-hidden="true" />
            </span>
            {!UPI_AVAILABLE && <span className="chip border-transparent bg-brand-soft text-brand-deep normal-case">Default</span>}
          </div>
          <p className="mt-3 font-display text-lg font-black">Cash on Delivery</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-soft">
            Pay {formatINR(totalPaise)} to the courier. Keep change handy — they rarely carry any.
          </p>
        </button>
      </div>

      {!UPI_AVAILABLE && (
        <p className="mt-4 rounded-xl border-[1.5px] border-dashed border-gold bg-[#fff8ec] px-4 py-3 text-xs font-medium text-[#7a5410]">
          UPI is temporarily unavailable, so Cash on Delivery is selected for you.
        </p>
      )}

      {payment.method === "upi" && (
        <div className="animate-fade-slide mt-5">
          <Field
            label="Your UPI handle"
            htmlFor="upi-id"
            hint="Phrase it like name@bank. (Mock gateway — a real Razorpay/Stripe collects via their SDK here.)"
          >
            <TextInput
              id="upi-id"
              placeholder="asha@okhdfc"
              autoComplete="off"
              value={payment.upiId}
              onChange={(e) => onPaymentChange({ ...payment, upiId: e.target.value })}
              leftAdornment={<Landmark size={14} />}
              invalid={payment.upiId.length > 0 && !upiIdValid}
            />
          </Field>
          {payment.upiId.length > 0 && !upiIdValid && (
            <p className="mt-1 text-xs font-semibold text-rose" role="alert">
              That handle doesn&apos;t look right — expected something like name@bank.
            </p>
          )}
        </div>
      )}

      <ErrorBanner message={error} />

      {/* Recap strip */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="hard-card-flat relative p-4">
          <p className="text-[0.68rem] font-bold tracking-[0.14em] text-muted uppercase">
            Delivering to
            <button
              type="button"
              onClick={() => onJumpToStep(2)}
              className="ml-2 inline-flex items-center gap-1 text-brand normal-case underline underline-offset-2"
            >
              <Pencil size={11} /> edit
            </button>
          </p>
          <p className="mt-1.5 flex items-start gap-2 text-sm font-semibold">
            <MapPin size={15} className="mt-0.5 shrink-0 text-brand" aria-hidden="true" />
            <span>
              {address.fullName}
              <br />
              <span className="font-normal text-ink-soft">
                {address.line1}
                {address.line2 ? `, ${address.line2}` : ""}, {address.city}, {address.state} — {address.pincode}
              </span>
            </span>
          </p>
        </div>
        <div className="hard-card-flat relative p-4">
          <p className="text-[0.68rem] font-bold tracking-[0.14em] text-muted uppercase">
            Printing
            <button
              type="button"
              onClick={() => onJumpToStep(0)}
              className="ml-2 inline-flex items-center gap-1 text-brand normal-case underline underline-offset-2"
            >
              <Pencil size={11} /> edit
            </button>
          </p>
          <ul className="mt-1.5 text-sm font-semibold">
            {docs.map((d) => (
              <li key={d.id} className="truncate">
                {d.name} <span className="font-normal text-muted">×{d.copies}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </StepShell>
  );
}
