import Image from "next/image";
import { BadgeCheck, Truck, Zap } from "lucide-react";

export function AuthPanel({ heading, blurb }: { heading: string; blurb: string }) {
  return (
    <aside className="relative hidden overflow-hidden rounded-2xl border-[1.5px] border-ink shadow-hard lg:block">
      <Image
        src="/images/paper-stack.jpg"
        alt="Risograph illustration of a printer and a tall stack of printed pages"
        fill
        className="object-cover"
        priority
      />
      <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/35 to-transparent" />
      <div className="absolute right-0 bottom-0 left-0 p-8 text-cream">
        <h2 className="font-display max-w-sm text-3xl leading-tight font-black tracking-tight">{heading}</h2>
        <p className="mt-2 max-w-sm text-sm text-cream/80">{blurb}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <span className="chip border-cream/60 bg-cream/10 text-cream normal-case">
            <Zap size={12} /> Prints in ~36h
          </span>
          <span className="chip border-cream/60 bg-cream/10 text-cream normal-case">
            <BadgeCheck size={12} /> Server-verified bills
          </span>
          <span className="chip border-cream/60 bg-cream/10 text-cream normal-case">
            <Truck size={12} /> UPI or COD
          </span>
        </div>
      </div>
    </aside>
  );
}
