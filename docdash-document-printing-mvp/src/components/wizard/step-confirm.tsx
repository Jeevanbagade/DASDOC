"use client";

import Link from "next/link";
import { ArrowRight, BadgeCheck, Banknote, History, Printer, Truck, Zap } from "lucide-react";
import type { OrderDetailDTO } from "@/server/orders";
import { formatINR } from "@/lib/pricing";
import { formatEta } from "@/lib/format";
import { Receipt } from "@/components/receipt";

interface Props {
  order: OrderDetailDTO;
  onStartAnother: () => void;
}

export function StepConfirm({ order, onStartAnother }: Props) {
  const paid = order.paymentStatus === "paid";
  return (
    <div className="relative">
      {/* Ink stamp */}
      <div className="pointer-events-none absolute -top-6 right-0 z-10 sm:right-6">
        <div className="animate-stamp-in rounded-lg border-[3px] border-mint px-4 py-2">
          <p className="text-lg font-black tracking-[0.14em] text-mint uppercase">Order placed</p>
        </div>
      </div>

      <p className="text-[0.72rem] font-bold tracking-[0.18em] text-brand uppercase">Confirmed</p>
      <h2 className="font-display mt-1 max-w-md text-[2rem] leading-tight font-black tracking-tight">
        {paid ? "Paid. The presses are warming up." : "Locked in. Pay when it lands."}
      </h2>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <span className="chip bg-ink text-cream normal-case" data-testid="order-number">
          <Printer size={13} /> {order.orderNumber}
        </span>
        <span className="chip bg-cream normal-case">
          <Truck size={13} className="text-brand" /> Arriving {formatEta(order.etaAt)}
        </span>
        <span className={`chip normal-case ${paid ? "bg-[#e5f3e9] text-mint" : "bg-brand-soft text-brand-deep"}`}>
          {paid ? <Zap size={13} /> : <Banknote size={13} />}
          {paid
            ? `Paid ${formatINR(order.totalPaise)} via UPI${order.payment?.txnRef ? ` · ${order.payment.txnRef}` : ""}`
            : `COD · pay ${formatINR(order.totalPaise)} on delivery`}
        </span>
        <span className="chip bg-cream normal-case">
          <BadgeCheck size={13} className="text-cobalt" /> Status: {order.status}
        </span>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.1fr_1fr]">
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
          <div className="hard-card-flat p-5">
            <p className="text-[0.68rem] font-bold tracking-[0.14em] text-muted uppercase">Delivering to</p>
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

          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
            <Link href={`/orders/${order.id}`} className="btn btn-dark flex-1 px-5 py-3 text-sm">
              <History size={16} /> Track in order history
            </Link>
            <button type="button" onClick={onStartAnother} className="btn btn-ghost flex-1 px-5 py-3 text-sm">
              Print another <ArrowRight size={16} />
            </button>
          </div>

          <p className="text-xs leading-relaxed text-muted">
            We&apos;ve saved this order to your history. Statuses move from placed → printing → out for delivery →
            delivered as the day goes on.
          </p>
        </div>
      </div>
    </div>
  );
}
