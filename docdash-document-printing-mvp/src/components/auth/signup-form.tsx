"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Eye, EyeOff, Sparkles } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { signupSchema } from "@/lib/schemas";
import { PASSWORD_RULES, passwordStrength } from "@/lib/validators";
import { DEFAULT_COUNTRY_CODE } from "@/lib/config";
import { ApiClientError } from "@/lib/errors";
import { ErrorBanner, Field, Spinner, TextInput } from "@/components/ui";
import { EmbeddedNotice } from "@/components/auth/embedded-notice";

const STRENGTH_STYLES = {
  weak: { width: "33%", bg: "#c22f3d", label: "Weak" },
  fair: { width: "66%", bg: "#b7791f", label: "Fair" },
  strong: { width: "100%", bg: "#0f7b38", label: "Strong" },
} as const;

export function SignupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const strength = passwordStrength(password);
  const strengthStyle = STRENGTH_STYLES[strength];

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBanner(null);
    setFieldErrors({});

    const parsed = signupSchema.safeParse({
      name,
      mobile,
      password: password.trim(),
      confirmPassword: confirmPassword.trim(),
    });
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        if (!errors[key]) errors[key] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }

    setBusy(true);
    try {
      await apiFetch("/api/auth/signup", { json: parsed.data });
      router.push("/new-order");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.code === "DUPLICATE_MOBILE") {
          setFieldErrors({ mobile: "This number already has an account." });
          setBanner("That mobile number is already registered — log in instead?");
        } else {
          setBanner(err.message);
        }
      } else {
        setBanner("Something went wrong — please retry.");
      }
      setBusy(false);
    }
  }

  return (
    <div className="w-full">
      <EmbeddedNotice />
      <p className="text-[0.72rem] font-bold tracking-[0.18em] text-brand uppercase">Join DocDash</p>
      <h1 className="font-display mt-1 text-4xl font-black tracking-tight">Create account</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Already printing with us?{" "}
        <Link href="/login" className="font-bold text-brand underline underline-offset-4">
          Log in
        </Link>
      </p>

      <form onSubmit={onSubmit} noValidate className="hard-card mt-7 flex flex-col gap-5 p-6 sm:p-8">
        <ErrorBanner message={banner} onDismiss={() => setBanner(null)} />

        <Field label="Full name" error={fieldErrors.name} htmlFor="signup-name">
          <TextInput
            id="signup-name"
            autoComplete="name"
            placeholder="Asha Verma"
            value={name}
            onChange={(e) => setName(e.target.value)}
            invalid={Boolean(fieldErrors.name)}
          />
        </Field>

        <Field label="Mobile number" error={fieldErrors.mobile} hint="10 digits — this becomes your login." htmlFor="signup-mobile">
          <TextInput
            id="signup-mobile"
            inputMode="numeric"
            autoComplete="tel"
            placeholder="98765 43210"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            invalid={Boolean(fieldErrors.mobile)}
            leftAdornment={DEFAULT_COUNTRY_CODE}
            maxLength={16}
          />
        </Field>

        <Field label="Password" error={fieldErrors.password} htmlFor="signup-password">
          <div className="relative">
            <input
              id="signup-password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              className="field-input pr-12"
              placeholder="8+ characters, one letter, one number"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={Boolean(fieldErrors.password) || undefined}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute top-1/2 right-3 -translate-y-1/2 rounded-md p-1 text-muted hover:text-ink"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {password.length > 0 && (
            <div className="mt-2">
              <div className="flex items-center justify-between text-[0.7rem] font-bold tracking-wide uppercase">
                <span className="text-muted">Password strength</span>
                <span style={{ color: strengthStyle.bg }}>{strengthStyle.label}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: strengthStyle.width, background: strengthStyle.bg }}
                />
              </div>
            </div>
          )}
          <ul className="mt-2 flex flex-col gap-1">
            {PASSWORD_RULES.map((rule) => {
              const met = rule.test(password);
              return (
                <li
                  key={rule.id}
                  className={`flex items-center gap-1.5 text-xs font-medium ${met ? "text-mint" : "text-muted"}`}
                >
                  <Check size={13} strokeWidth={met ? 3.5 : 2} aria-hidden="true" />
                  {rule.label}
                </li>
              );
            })}
          </ul>
        </Field>

        <Field label="Confirm password" error={fieldErrors.confirmPassword} htmlFor="signup-confirm">
          <TextInput
            id="signup-confirm"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Repeat it once more"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            invalid={Boolean(fieldErrors.confirmPassword)}
          />
        </Field>

        <button type="submit" disabled={busy} className="btn btn-primary px-6 py-3 text-[0.95rem]">
          {busy ? <Spinner size={18} /> : <Sparkles size={18} />}
          {busy ? "Creating…" : "Create account & start printing"}
        </button>
      </form>
    </div>
  );
}
