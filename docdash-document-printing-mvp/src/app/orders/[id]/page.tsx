import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Banknote, CircleCheck, CircleDashed, Truck, Zap } from "lucide-react";
import { getSessionUser } from "@/server/auth";
import { getOrderDetail } from "@/server/orders";
import { formatINR } from "@/lib/pricing";
import { formatDateTime, formatEta } from "@/lib/format";
import { STATUS_META, TIMELINE, timelineIndex, type OrderStatus } from "@/lib/order-status";
import { Receipt } from "@/components/receipt";
import { isAppError } from "@/lib/errors";

interface Props {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = { title: "Order details" };
export const dynamic = "force-dynamic";

export default async function OrderDetailPage({ params }: Props) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=/orders/${id}`);

  let order;
  try {
    order = await getOrderDetail(user.id, id);
  } catch (err) {
    if (isAppError(err) && err.code === "ORDER_NOT_FOUND") notFound();
    throw err;
  }

  const status = order.status as OrderStatus;
  const meta = STATUS_META[status] ?? STATUS_META.placed;
  const currentIdx = timelineIndex(status);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <Link href="/orders" className="btn btn-ghost px-4 py-2 text-sm">
        <ArrowLeft size={15} /> All orders
      </Link>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <h1 className="font-display font-mono text-3xl font-black tracking-tight">{order.orderNumber}</h1>
        <span className={`chip border-transparent normal-case ${meta.chipClass}`}>{meta.label}</span>
      </div>
      <p className="mt-2 text-sm text-ink-soft">
        Placed {formatDateTime(order.createdAt)} · arriving {formatEta(order.etaAt)}
      </p>

      {/* Timeline */}
      <ol className="mt-8 flex flex-col gap-0 sm:flex-row" aria-label="Order progress">
        {TIMELINE.map((t, i) => {
          const done = currentIdx >= i;
          return (
            <li key={t.key} className="relative flex flex-1 items-center gap-3 py-2 sm:flex-col sm:items-start sm:gap-2">
              {i < TIMELINE.length - 1 && (
                <span
                  aria-hidden="true"
                  className={`absolute top-[13px] left-3 h-[2px] w-[calc(100%-1.5rem)] sm:left-4 ${currentIdx > i ? "bg-ink" : "bg-line"} hidden sm:block`}
                />
              )}
              <span className={`relative z-10 ${done ? "text-mint" : "text-line"}`}>
                {done ? <CircleCheck size={26} aria-hidden="true" /> : <CircleDashed size={26} aria-hidden="true" />}
              </span>
              <p className={`text-xs font-bold tracking-wide uppercase ${done ? "text-ink" : "text-muted"}`}>
                {t.label}
              </p>
            </li>
          );
        })}
      </ol>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1.15fr_1fr]">
        <Receipt
          title="Order receipt"
          stamp={order.orderNumber}
          lines={order.items.map((item) => ({
            key: item.id,
            fileName: item.fileName,
            pageCount: item.pageCount,
            copies: item.copies,
            colorMode: item.colorMode,
            ratePerPagePaise: item.ratePerPagePaise,
            lineTotalPaise: item.lineTotalPaise,
          }))}
          subtotalPaise={order.subtotalPaise}
          deliveryFeePaise={order.deliveryFeePaise}
          totalPaise={order.totalPaise}
        />

        <div className="flex flex-col gap-4">
          <div className="hard-card p-5">
            <p className="flex items-center gap-2 text-[0.68rem] font-bold tracking-[0.14em] text-muted uppercase">
              <Truck size={13} className="text-brand" aria-hidden="true" /> Delivery
            </p>
            <p className="mt-2 text-sm font-bold">{order.address.fullName}</p>
            <p className="mt-1 text-sm leading-relaxed text-ink-soft">
              {order.address.line1}
              {order.address.line2 ? `, ${order.address.line2}` : ""}
              <br />
              {order.address.city}, {order.address.state} — {order.address.pincode}
              {order.address.landmark ? (
                <>
                  <br />
                  Landmark: {order.address.landmark}
                </>
              ) : null}
            </p>
          </div>

          <div className="hard-card p-5">
            <p className="flex items-center gap-2 text-[0.68rem] font-bold tracking-[0.14em] text-muted uppercase">
              {order.paymentMethod === "upi" ? (
                <Zap size={13} className="text-mint" aria-hidden="true" />
              ) : (
                <Banknote size={13} className="text-gold" aria-hidden="true" />
              )}
              Payment
            </p>
            {order.payment ? (
              <dl className="mt-2 flex flex-col gap-1.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-ink-soft">Method</dt>
                  <dd className="font-bold">{order.paymentMethod === "upi" ? "UPI" : "Cash on Delivery"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-soft">Status</dt>
                  <dd className={`font-bold ${order.payment.status === "paid" ? "text-mint" : "text-gold"}`}>
                    {order.payment.status === "paid" ? "Paid" : "Pending at delivery"}
                  </dd>
                </div>
                {order.payment.txnRef && (
                  <div className="flex justify-between">
                    <dt className="text-ink-soft">Reference</dt>
                    <dd className="font-mono text-xs font-bold">{order.payment.txnRef}</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-ink-soft">Amount</dt>
                  <dd className="font-bold tabular-nums">{formatINR(order.payment.amountPaise)}</dd>
                </div>
              </dl>
            ) : (
              <p className="mt-2 text-sm text-ink-soft">No payment recorded yet.</p>
            )}
          </div>

          <Link href="/new-order" className="btn btn-primary px-6 py-3 text-center text-sm">
            Print something else
          </Link>
        </div>
      </div>
    </div>
  );
}
