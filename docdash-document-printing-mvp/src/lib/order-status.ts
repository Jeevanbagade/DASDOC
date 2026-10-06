/** Order status metadata for badges + the progress timeline (client-safe). */

export type OrderStatus = "placed" | "confirmed" | "printing" | "out_for_delivery" | "delivered" | "cancelled";

export const STATUS_META: Record<OrderStatus, { label: string; chipClass: string }> = {
  placed: { label: "Placed", chipClass: "bg-[#e4eaff] text-cobalt" },
  confirmed: { label: "Confirmed", chipClass: "bg-[#e4eaff] text-cobalt" },
  printing: { label: "Printing", chipClass: "bg-[#fff3d6] text-[#7a5410]" },
  out_for_delivery: { label: "Out for delivery", chipClass: "bg-brand-soft text-brand-deep" },
  delivered: { label: "Delivered", chipClass: "bg-[#e5f3e9] text-mint" },
  cancelled: { label: "Cancelled", chipClass: "bg-line text-ink-soft" },
};

/** Timeline steps shown on the order detail page. */
export const TIMELINE: Array<{ key: OrderStatus; label: string }> = [
  { key: "placed", label: "Placed" },
  { key: "printing", label: "Printing" },
  { key: "out_for_delivery", label: "Out for delivery" },
  { key: "delivered", label: "Delivered" },
];

export function timelineIndex(status: OrderStatus): number {
  if (status === "cancelled") return -1;
  if (status === "confirmed") return 0;
  return TIMELINE.findIndex((t) => t.key === status);
}
