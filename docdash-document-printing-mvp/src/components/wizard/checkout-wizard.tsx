"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  MapPin,
  ReceiptText,
  SlidersHorizontal,
  UploadCloud,
  Wallet,
} from "lucide-react";
import type { OrderDetailDTO } from "@/server/orders";
import { apiFetch } from "@/lib/api-client";
import { computeQuote, formatINR, type Quote } from "@/lib/pricing";
import { deliveryAddressSchema } from "@/lib/schemas";
import { UPI_AVAILABLE } from "@/lib/config";
import { ApiClientError } from "@/lib/errors";
import { Spinner } from "@/components/ui";
import { StepUpload, clientSideCheck, uploadOne, uploadErrorMessage } from "./step-upload";
import { StepOptions } from "./step-options";
import { StepDelivery, validateAddressAll } from "./step-delivery";
import { StepBill } from "./step-bill";
import { StepPayment } from "./step-payment";
import { StepConfirm } from "./step-confirm";
import { EMPTY_ADDRESS, type AddressForm, type InFlightUpload, type PaymentState, type RejectedFile, type WizardDoc } from "./types";

const STEPS = [
  { key: "upload", label: "Upload", icon: UploadCloud },
  { key: "options", label: "Options", icon: SlidersHorizontal },
  { key: "delivery", label: "Delivery", icon: MapPin },
  { key: "bill", label: "Bill", icon: ReceiptText },
  { key: "payment", label: "Payment", icon: Wallet },
] as const;

export function CheckoutWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [maxStep, setMaxStep] = useState(0);
  const [docs, setDocs] = useState<WizardDoc[]>([]);
  const [inFlight, setInFlight] = useState<InFlightUpload[]>([]);
  const [rejected, setRejected] = useState<RejectedFile[]>([]);
  const [address, setAddress] = useState<AddressForm>(EMPTY_ADDRESS);
  const [addressErrors, setAddressErrors] = useState<Record<string, string>>({});
  const [payment, setPayment] = useState<PaymentState>({ method: UPI_AVAILABLE ? "upi" : "cod", upiId: "" });
  const [serverQuote, setServerQuote] = useState<Quote | null>(null);
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);
  const [placedOrder, setPlacedOrder] = useState<OrderDetailDTO | null>(null);
  const [idemKey, setIdemKey] = useState(() => crypto.randomUUID());

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  // Client-side quote (same shared module the server uses) — for button labels
  // and as `expectedTotalPaise`; the server still has the final word.
  const clientQuote = docs.length
    ? computeQuote(docs.map((d) => ({ pageCount: d.pageCount, copies: d.copies, colorMode: d.colorMode })))
    : null;

  function goTo(next: number) {
    setStep(next);
    setMaxStep((m) => Math.max(m, next));
  }

  // ---- uploads -----------------------------------------------------------
  async function handleAddFiles(files: File[]) {
    for (const file of files) {
      const check = clientSideCheck(file);
      if (!check.ok) {
        setRejected((r) => [...r, { id: crypto.randomUUID(), name: file.name, message: check.message }]);
        continue;
      }
      const tempId = crypto.randomUUID();
      setInFlight((f) => [...f, { tempId, name: file.name, sizeBytes: file.size }]);
      try {
        const document = await uploadOne(file);
        const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined;
        setDocs((d) => [
          ...d,
          {
            id: document.id,
            name: document.name,
            kind: document.kind,
            mimeType: document.mimeType,
            sizeBytes: document.sizeBytes,
            pageCount: document.pageCount,
            pageCountEstimated: document.pageCountEstimated,
            copies: 1,
            colorMode: "bw",
            previewUrl,
          },
        ]);
      } catch (err) {
        setRejected((r) => [...r, { id: crypto.randomUUID(), name: file.name, message: uploadErrorMessage(err) }]);
      } finally {
        setInFlight((f) => f.filter((u) => u.tempId !== tempId));
      }
    }
  }

  async function handleRemoveDoc(doc: WizardDoc) {
    setDocs((d) => d.filter((x) => x.id !== doc.id));
    if (doc.previewUrl) URL.revokeObjectURL(doc.previewUrl);
    try {
      await apiFetch(`/api/uploads/${doc.id}`, { method: "DELETE" });
    } catch (err) {
      // Roll back the optimistic removal.
      setDocs((d) => [...d, doc]);
      setRejected((r) => [
        ...r,
        {
          id: crypto.randomUUID(),
          name: doc.name,
          message: err instanceof ApiClientError ? err.message : "Could not remove the file — retry.",
        },
      ]);
    }
  }

  // ---- place order -------------------------------------------------------
  async function placeOrder() {
    setPlaceError(null);
    if (!clientQuote) return;
    const addressCheck = deliveryAddressSchema.safeParse(address);
    if (!addressCheck.success) {
      setAddressErrors(validateAddressAll(address));
      goTo(2);
      return;
    }
    setPlacing(true);
    try {
      const res = await apiFetch<{ order: OrderDetailDTO; duplicated: boolean }>("/api/orders", {
        json: {
          items: docs.map((d) => ({ documentId: d.id, copies: d.copies, colorMode: d.colorMode })),
          address: addressCheck.data,
          paymentMethod: payment.method,
          upiId: payment.method === "upi" ? payment.upiId.trim() : undefined,
          expectedTotalPaise: clientQuote.totalPaise,
          idempotencyKey: idemKey,
        },
      });
      setPlacedOrder(res.order);
      setStep(5);
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.code === "AUTH_EXPIRED" || err.code === "AUTH_REQUIRED") {
          router.push(`/login?next=/new-order`);
          return;
        }
        if (err.code === "PRICING_MISMATCH") {
          setServerQuote(null); // force the Bill step to refetch authoritative numbers
          setPlaceError(`${err.message} We've refreshed your bill — review it once more.`);
        } else if (err.code === "DOC_ALREADY_ORDERED" || err.code === "DOC_NOT_FOUND") {
          setPlaceError(err.message);
        } else {
          setPlaceError(err.message);
        }
      } else {
        setPlaceError("Something unexpected happened — retry in a moment.");
      }
    } finally {
      setPlacing(false);
    }
  }

  function startAnother() {
    docs.forEach((d) => d.previewUrl && URL.revokeObjectURL(d.previewUrl));
    setDocs([]);
    setRejected([]);
    setAddress(EMPTY_ADDRESS);
    setAddressErrors({});
    setPayment({ method: UPI_AVAILABLE ? "upi" : "cod", upiId: "" });
    setServerQuote(null);
    setPlacedOrder(null);
    setPlaceError(null);
    setIdemKey(crypto.randomUUID());
    setMaxStep(0);
    setStep(0);
  }

  // ---- navigation rules --------------------------------------------------
  function canContinue(): boolean {
    if (step === 0) return docs.length > 0 && inFlight.length === 0;
    if (step === 2) {
      const errors = validateAddressAll(address);
      return Object.keys(errors).length === 0;
    }
    return true;
  }

  function onContinue() {
    if (step === 2) {
      const errors = validateAddressAll(address);
      setAddressErrors(errors);
      if (Object.keys(errors).length > 0) return;
    }
    if (step === 4) {
      placeOrder();
      return;
    }
    goTo(step + 1);
  }

  const showRail = placedOrder === null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-14">
      <div className="grid gap-10 lg:grid-cols-[240px_1fr]">
        {/* Step rail */}
        {showRail && (
          <ol className="hidden flex-col gap-0 lg:flex" aria-label="Checkout progress">
            {STEPS.map((s, i) => {
              const done = step > i;
              const current = step === i;
              const clickable = i <= maxStep;
              return (
                <li key={s.key} className="relative flex gap-4 pb-8 last:pb-0">
                  {i < STEPS.length - 1 && (
                    <span
                      aria-hidden="true"
                      className={`absolute top-9 left-[17px] h-[calc(100%-2rem)] w-[2px] ${done ? "bg-ink" : "bg-line"}`}
                    />
                  )}
                  <button
                    type="button"
                    disabled={!clickable}
                    onClick={() => clickable && setStep(i)}
                    className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-[1.5px] border-ink font-bold transition-all ${
                      current
                        ? "bg-brand text-cream shadow-hard-sm"
                        : done
                          ? "bg-ink text-cream"
                          : clickable
                            ? "bg-card text-ink hover:bg-cream"
                            : "bg-paper text-muted"
                    }`}
                    aria-current={current ? "step" : undefined}
                  >
                    {i + 1}
                  </button>
                  <div className="pt-1.5">
                    <p className={`text-sm font-bold ${current ? "text-ink" : done ? "text-ink" : "text-muted"}`}>
                      {s.label}
                    </p>
                    <p className="text-xs text-muted">
                      {i === 0 && `${docs.length} file${docs.length === 1 ? "" : "s"}`}
                      {i === 1 && "copies & ink"}
                      {i === 2 && (address.city ? address.city : "address")}
                      {i === 3 && (clientQuote ? formatINR(clientQuote.totalPaise) : "—")}
                      {i === 4 && (payment.method === "upi" ? "UPI" : "COD")}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        {/* Mobile progress */}
        {showRail && (
          <div className="lg:hidden">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="tracking-[0.14em] text-brand uppercase">
                Step {Math.min(step + 1, 5)} / 5 — {STEPS[Math.min(step, 4)].label}
              </span>
              {clientQuote && <span className="tabular-nums">{formatINR(clientQuote.totalPaise)}</span>}
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full border border-ink bg-card">
              <div
                className="h-full bg-brand transition-all duration-500"
                style={{ width: `${((Math.min(step, 4) + 1) / 5) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Step body */}
        <div key={step} className="animate-fade-slide min-w-0">
          {step === 0 && (
            <StepUpload
              docs={docs}
              inFlight={inFlight}
              rejected={rejected}
              onAddFiles={handleAddFiles}
              onRemoveDoc={handleRemoveDoc}
              onDismissRejected={(id) => setRejected((r) => r.filter((x) => x.id !== id))}
            />
          )}
          {step === 1 && <StepOptions docs={docs} onChange={setDocs} />}
          {step === 2 && (
            <StepDelivery
              address={address}
              errors={addressErrors}
              onChange={(a) => {
                setAddress(a);
                setAddressErrors((e) => {
                  const next = { ...e };
                  delete next[Object.keys(a).find((k) => a[k as keyof AddressForm] !== address[k as keyof AddressForm]) ?? ""];
                  return next;
                });
              }}
              onFieldBlur={(field) => {
                const errors = validateAddressAll({ ...address });
                setAddressErrors((prev) => {
                  const next = { ...prev };
                  if (errors[field]) next[field] = errors[field];
                  else delete next[field];
                  return next;
                });
              }}
            />
          )}
          {step === 3 && <StepBill docs={docs} serverQuote={serverQuote} onServerQuote={setServerQuote} />}
          {step === 4 && (
            <StepPayment
              payment={payment}
              onPaymentChange={setPayment}
              docs={docs}
              address={address}
              totalPaise={(serverQuote ?? clientQuote)?.totalPaise ?? 0}
              error={placeError}
              onJumpToStep={goTo}
            />
          )}
          {step === 5 && placedOrder && <StepConfirm order={placedOrder} onStartAnother={startAnother} />}

          {/* Footer nav */}
          {showRail && (
            <div className="mt-8 flex items-center justify-between border-t-[1.5px] border-dashed border-line pt-6">
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={step === 0 || placing}
                className="btn btn-ghost px-5 py-2.5 text-sm"
              >
                <ArrowLeft size={16} /> Back
              </button>
              <button
                type="button"
                onClick={onContinue}
                disabled={!canContinue() || placing}
                className={`btn px-6 py-3 text-sm ${step === 4 ? "btn-dark" : "btn-primary"}`}
                data-testid="wizard-continue"
              >
                {placing ? (
                  <>
                    <Spinner size={16} /> {payment.method === "upi" ? "Waiting on your bank…" : "Placing order…"}
                  </>
                ) : step === 4 ? (
                  <>Place order · {formatINR((serverQuote ?? clientQuote)?.totalPaise ?? 0)}</>
                ) : step === 3 ? (
                  <>
                    Continue to payment <ArrowRight size={16} />
                  </>
                ) : (
                  <>
                    Continue <ArrowRight size={16} />
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
