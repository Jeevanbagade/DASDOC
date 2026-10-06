import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Banknote, FileStack, History, Truck, Zap } from "lucide-react";
import { getSessionUser } from "@/server/auth";
import { listOrders } from "@/server/orders";
import { formatINR } from "@/lib/pricing";
import { formatDate, formatEta } from "@/lib/format";
import { STATUS_META, type OrderStatus } from "@/lib/order-status";

export const metadata: Metadata = { title: "My orders" };
export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/orders");
  const orders = await listOrders(user.id);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[0.72rem] font-bold tracking-[0.18em] text-brand uppercase">Your paperwork</p>
          <h1 className="font-display mt-1 text-4xl font-black tracking-tight">Order history</h1>
        </div>
        <Link href="/new-order" className="btn btn-primary px-5 py-2.5 text-sm">
          New order <ArrowRight size={16} />
        </Link>
      </div>

      {orders.length === 0 ? (
        <div className="hard-card mt-10 flex flex-col items-center px-6 py-16 text-center">
          <span className="rounded-2xl border-[1.5px] border-ink bg-cream p-4">
            <History size={28} className="text-brand" aria-hidden="true" />
          </span>
          <h2 className="font-display mt-5 text-2xl font-black">No orders yet</h2>
          <p className="mt-2 max-w-sm text-sm text-ink-soft">
            Your printed masterpieces will pile up here. Upload a document and become someone with a paper trail.
          </p>
          <Link href="/new-order" className="btn btn-primary mt-6 px-6 py-3 text-sm">
            Start your first order <ArrowRight size={16} />
          </Link>
        </div>
      ) : (
        <ul className="mt-8 grid gap-4">
          {orders.map((order, i) => {
            const meta = STATUS_META[order.status as OrderStatus] ?? STATUS_META.placed;
            return (
              <li key={order.id} className="animate-fade-slide" style={{ animationDelay: `${Math.min(i, 6) * 60}ms` }}>
                <Link
                  href={`/orders/${order.id}`}
                  className="hard-card group flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4 transition-transform hover:-translate-y-0.5"
                >
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-bold tracking-wide">{order.orderNumber}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {formatDate(order.createdAt)} · {order.itemCount} doc{order.itemCount === 1 ? "" : "s"} ·{" "}
                      {order.totalSheets} sheets
                    </p>
                  </div>
                  <span className={`chip border-transparent normal-case ${meta.chipClass}`}>{meta.label}</span>
                  <span className="chip border-transparent bg-cream text-ink-soft normal-case">
                    {order.paymentStatus === "paid" ? (
                      <Zap size={12} className="text-mint" />
                    ) : (
                      <Banknote size={12} className="text-gold" />
                    )}
                    {order.paymentMethod === "upi" ? "UPI" : "COD"}
                  </span>
                  <span className="hidden items-center gap-1.5 text-xs font-semibold text-ink-soft md:flex">
                    <Truck size={13} className="text-brand" aria-hidden="true" />
                    {formatEta(order.etaAt)}
                  </span>
                  <p className="ml-auto font-display text-xl font-black tabular-nums">{formatINR(order.totalPaise)}</p>
                  <ArrowRight size={17} className="text-muted transition-transform group-hover:translate-x-1" aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {orders.length > 0 && (
        <p className="mt-8 flex items-center gap-2 text-xs text-muted">
          <FileStack size={13} aria-hidden="true" />
          {orders.length} order{orders.length === 1 ? "" : "s"} — newest first.
        </p>
      )}
    </div>
  );
}
