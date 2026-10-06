"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut, Menu, Printer, X } from "lucide-react";
import { apiFetch } from "@/lib/api-client";

interface Props {
  user: { id: string; name: string; mobileE164: string } | null;
}

export function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-[10px] border-[1.5px] border-ink bg-brand text-cream"
      style={{ width: size, height: size, boxShadow: "2.5px 2.5px 0 0 #1a150e" }}
      aria-hidden="true"
    >
      <Printer size={size * 0.55} strokeWidth={2.4} />
    </span>
  );
}

export function SiteHeader({ user }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
      router.push("/");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const navItems = user
    ? [
        { href: "/new-order", label: "New Order" },
        { href: "/orders", label: "My Orders" },
      ]
    : [];

  const firstName = user?.name.split(" ")[0] ?? "";

  return (
    <header className="sticky top-0 z-50 border-b-[1.5px] border-ink bg-paper/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href={user ? "/new-order" : "/"} className="flex items-center gap-2.5" aria-label="DocDash home">
          <LogoMark />
          <span className="font-display text-[1.35rem] font-black tracking-tight">
            Doc<span className="text-brand">Dash</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                pathname.startsWith(item.href) ? "bg-ink text-cream" : "hover:bg-cream"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {user ? (
            <>
              <span className="chip border-transparent bg-brand-soft text-brand-deep normal-case">
                Hello, {firstName}
              </span>
              <button onClick={logout} disabled={busy} className="btn btn-ghost px-4 py-2 text-sm">
                <LogOut size={15} />
                {busy ? "Leaving…" : "Log out"}
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="btn btn-ghost px-4 py-2 text-sm">
                Log in
              </Link>
              <Link href="/signup" className="btn btn-primary px-5 py-2 text-sm">
                Create account
              </Link>
            </>
          )}
        </div>

        <button
          className="btn btn-ghost p-2 md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label="Toggle menu"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {open && (
        <div className="animate-fade-slide border-t-[1.5px] border-ink bg-paper px-4 py-4 md:hidden">
          <div className="flex flex-col gap-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`rounded-xl px-4 py-3 text-sm font-semibold ${
                  pathname.startsWith(item.href) ? "bg-ink text-cream" : "bg-card"
                }`}
              >
                {item.label}
              </Link>
            ))}
            {user ? (
              <button onClick={logout} disabled={busy} className="btn btn-ghost justify-start px-4 py-3 text-sm">
                <LogOut size={15} /> Log out ({firstName})
              </button>
            ) : (
              <>
                <Link href="/login" onClick={() => setOpen(false)} className="btn btn-ghost px-4 py-3 text-sm">
                  Log in
                </Link>
                <Link href="/signup" onClick={() => setOpen(false)} className="btn btn-primary px-4 py-3 text-sm">
                  Create account
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
