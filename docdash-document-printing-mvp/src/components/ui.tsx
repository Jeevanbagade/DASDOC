import type { InputHTMLAttributes, ReactNode } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

export function Spinner({ size = 18, className = "" }: { size?: number; className?: string }) {
  return <Loader2 size={size} className={`animate-spin ${className}`} aria-hidden="true" />;
}

export function ErrorBanner({ message, onDismiss }: { message: string | null; onDismiss?: () => void }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="animate-pop-in flex items-start gap-3 rounded-xl border-[1.5px] border-rose bg-[#fff1ef] px-4 py-3 text-sm text-rose"
    >
      <AlertTriangle size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
      <p className="flex-1 font-medium">{message}</p>
      {onDismiss && (
        <button onClick={onDismiss} className="font-bold underline underline-offset-2" aria-label="Dismiss error">
          OK
        </button>
      )}
    </div>
  );
}

export function Field({
  label,
  error,
  hint,
  children,
  htmlFor,
}: {
  label: string;
  error?: string | null;
  hint?: string;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[0.83rem] font-bold tracking-wide">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs font-semibold text-rose" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  leftAdornment?: ReactNode;
}

export function TextInput({ invalid, leftAdornment, className = "", ...rest }: TextInputProps) {
  if (leftAdornment) {
    return (
      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-sm font-semibold text-ink-soft">
          {leftAdornment}
        </span>
        <input className={`field-input pl-14 ${className}`} aria-invalid={invalid || undefined} {...rest} />
      </div>
    );
  }
  return <input className={`field-input ${className}`} aria-invalid={invalid || undefined} {...rest} />;
}

export function StepShell({
  eyebrow,
  title,
  blurb,
  children,
}: {
  eyebrow: string;
  title: string;
  blurb?: string;
  children: ReactNode;
}) {
  return (
    <section aria-label={title}>
      <p className="text-[0.72rem] font-bold tracking-[0.18em] text-brand uppercase">{eyebrow}</p>
      <h2 className="font-display mt-1 text-[1.7rem] leading-tight font-black tracking-tight">{title}</h2>
      {blurb && <p className="mt-1.5 text-sm text-ink-soft">{blurb}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}
