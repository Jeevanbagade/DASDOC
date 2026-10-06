import { LogoMark } from "@/components/site-header";
import { formatINRShort } from "@/lib/pricing";
import { PRICING } from "@/lib/pricing";

export function SiteFooter() {
  return (
    <footer className="border-t-[1.5px] border-ink bg-ink text-cream">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <LogoMark size={30} />
            <span className="font-display text-xl font-black">
              Doc<span className="text-brand">Dash</span>
            </span>
          </div>
          <p className="mt-3 max-w-sm text-sm text-cream/70">
            Print it fast, skip the past. Upload from your phone, pick your ink, and get crisp pages at your door.
          </p>
        </div>
        <div className="text-sm text-cream/70">
          <p className="font-semibold text-cream">Straight-up pricing</p>
          <p className="mt-1">
            B&amp;W {formatINRShort(PRICING.bwPerPagePaise)}/page · Colour {formatINRShort(PRICING.colorPerPagePaise)}
            /page · Delivery {formatINRShort(PRICING.deliveryFeePaise)} flat
          </p>
          <p className="mt-3 text-cream/50">© {new Date().getFullYear()} DocDash. Made for people who still love paper.</p>
        </div>
      </div>
    </footer>
  );
}
