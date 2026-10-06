"use client";

import { deliveryAddressSchema } from "@/lib/schemas";
import { StepShell, Field, TextInput } from "@/components/ui";
import type { AddressForm } from "./types";

interface Props {
  address: AddressForm;
  errors: Record<string, string>;
  onChange: (address: AddressForm) => void;
  onFieldBlur: (field: keyof AddressForm) => void;
}

export function validateAddressAll(address: AddressForm): Record<string, string> {
  const parsed = deliveryAddressSchema.safeParse(address);
  if (parsed.success) return {};
  const errors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}

const FIELDS: Array<{
  key: keyof AddressForm;
  label: string;
  placeholder: string;
  autoComplete?: string;
  inputMode?: "numeric" | "text";
  span?: boolean;
  required?: boolean;
  maxLength?: number;
}> = [
  { key: "fullName", label: "Full name", placeholder: "Asha Verma", autoComplete: "name", required: true },
  { key: "mobile", label: "Mobile number", placeholder: "98765 43210", autoComplete: "tel", inputMode: "numeric", required: true, maxLength: 14 },
  { key: "line1", label: "Address line 1", placeholder: "Flat 4B, Rose Residency", autoComplete: "address-line1", required: true },
  { key: "line2", label: "Address line 2 (optional)", placeholder: "Street, area", autoComplete: "address-line2" },
  { key: "city", label: "City", placeholder: "Pune", autoComplete: "address-level2", required: true },
  { key: "state", label: "State", placeholder: "Maharashtra", autoComplete: "address-level1", required: true },
  { key: "pincode", label: "Pincode", placeholder: "411001", autoComplete: "postal-code", inputMode: "numeric", required: true, maxLength: 6 },
  { key: "landmark", label: "Landmark (optional)", placeholder: "Near City Library", span: true },
];

export function StepDelivery({ address, errors, onChange, onFieldBlur }: Props) {
  return (
    <StepShell
      eyebrow="Step 3 of 5"
      title="Where should we deliver?"
      blurb="Our courier calls the number below if the gate is tricky. We deliver in ~36 hours."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <div key={f.key} className={f.span ? "sm:col-span-2" : undefined}>
            <Field label={f.label} error={errors[f.key]} htmlFor={`addr-${f.key}`}>
              <TextInput
                id={`addr-${f.key}`}
                placeholder={f.placeholder}
                autoComplete={f.autoComplete}
                inputMode={f.inputMode}
                maxLength={f.maxLength}
                value={address[f.key]}
                onChange={(e) => onChange({ ...address, [f.key]: e.target.value })}
                onBlur={() => onFieldBlur(f.key)}
                invalid={Boolean(errors[f.key])}
              />
            </Field>
          </div>
        ))}
      </div>
    </StepShell>
  );
}
