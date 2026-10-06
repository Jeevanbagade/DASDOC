"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { loginSchema } from "@/lib/schemas";
import { DEFAULT_COUNTRY_CODE } from "@/lib/config";
import { ApiClientError } from "@/lib/errors";
import { ErrorBanner, Field, Spinner, TextInput } from "@/components/ui";
import { EmbeddedNotice } from "@/components/auth/embedded-notice";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");

  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBanner(null);
    setFieldErrors({});

    const parsed = loginSchema.safeParse({ mobile, password });
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
      await apiFetch("/api/auth/login", { json: parsed.data });
      router.push(next && next.startsWith("/") ? next : "/new-order");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.code === "AUTH_INVALID") {
          setBanner(
            "Incorrect mobile number or password. Passwords are case-sensitive — check caps lock and stray spaces.",
          );
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
      <p className="text-[0.72rem] font-bold tracking-[0.18em] text-brand uppercase">Welcome back</p>
      <h1 className="font-display mt-1 text-4xl font-black tracking-tight">Log in</h1>
      <p className="mt-2 text-sm text-ink-soft">
        New to DocDash?{" "}
        <Link href="/signup" className="font-bold text-brand underline underline-offset-4">
          Create an account
        </Link>
      </p>

      <form onSubmit={onSubmit} noValidate className="hard-card mt-7 flex flex-col gap-5 p-6 sm:p-8">
        <ErrorBanner message={banner} onDismiss={() => setBanner(null)} />

        <Field label="Mobile number" error={fieldErrors.mobile} htmlFor="login-mobile">
          <TextInput
            id="login-mobile"
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

        <Field label="Password" error={fieldErrors.password} htmlFor="login-password">
          <div className="relative">
            <input
              id="login-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              className="field-input pr-12"
              placeholder="Your password"
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
        </Field>

        <button type="submit" disabled={busy} className="btn btn-primary px-6 py-3 text-[0.95rem]">
          {busy ? <Spinner size={18} /> : <LogIn size={18} />}
          {busy ? "Checking…" : "Log in"}
        </button>

        <p className="text-center text-xs text-muted">
          Sessions last 7 days. Your mobile number is your username.
        </p>

        <p className="rounded-xl border-[1.5px] border-dashed border-line bg-cream/70 px-4 py-3 text-center text-xs text-ink-soft">
          Just exploring? Demo account — mobile <span className="font-bold tabular-nums">98765 43210</span>, password{" "}
          <span className="font-bold">Passw0rd!</span>
        </p>
      </form>
    </div>
  );
}
