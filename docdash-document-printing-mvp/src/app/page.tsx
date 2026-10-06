import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Camera, FileText, ImageIcon, Lock, PackageCheck, ScanLine, Zap } from "lucide-react";
import { getSessionUser } from "@/server/auth";
import { Receipt } from "@/components/receipt";
import { formatINRShort, PRICING } from "@/lib/pricing";

export const dynamic = "force-dynamic";

const TICKER = [
  "PDF ready",
  "Word .docx",
  "JPG · PNG · HEIC",
  `B&W ${formatINRShort(PRICING.bwPerPagePaise)}/page`,
  `Colour ${formatINRShort(PRICING.colorPerPagePaise)}/page`,
  `${formatINRShort(PRICING.deliveryFeePaise)} flat delivery`,
  "Camera-to-print scans",
  "UPI or Cash on Delivery",
];

const HOW_IT_WORKS = [
  {
    step: "01",
    icon: ScanLine,
    title: "Snap or upload",
    body: "PDFs, Word files, photos — or just point your camera at a page. We count the pages for you.",
  },
  {
    step: "02",
    icon: FileText,
    title: "Pick your ink",
    body: "Black & white or full colour, per document. Copies multiplied, total locked before you pay.",
  },
  {
    step: "03",
    icon: PackageCheck,
    title: "Doorstep in ~36h",
    body: "Crisp prints, neatly packed, delivered where you are. Pay by UPI or cash when it arrives.",
  },
];

export default async function LandingPage() {
  const user = await getSessionUser().catch(() => null);
  const ctaHref = user ? "/new-order" : "/signup";

  return (
    <div className="overflow-x-clip">
      {/* ---------------------------------------------------------- HERO */}
      <section className="relative mx-auto max-w-6xl px-4 pt-14 pb-10 sm:px-6 lg:pt-20">
        <div
          aria-hidden="true"
          className="absolute -top-8 -left-24 h-72 w-72 rounded-full bg-brand/15 blur-3xl"
        />
        <div className="grid items-center gap-12 lg:grid-cols-[1.15fr_1fr]">
          <div className="relative">
            <span className="chip animate-pop-in bg-cream">
              <Zap size={12} className="text-brand" />
              The print shop in your pocket
            </span>
            <h1 className="font-display mt-5 text-[clamp(3rem,9vw,6.2rem)] leading-[0.95] font-black tracking-tight text-balance">
              Print it fast,
              <br />
              <em className="text-brand not-italic italic">skip the past.</em>
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-ink-soft">
              DocDash turns the files on your phone into crisp printed pages at your door. Upload, pick your ink, pay —
              done before your chai cools.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link href={ctaHref} className="btn btn-primary px-7 py-3.5 text-base">
                Start a print order <ArrowRight size={18} />
              </Link>
              <a href="#pricing" className="btn btn-ghost px-7 py-3.5 text-base">
                See pricing
              </a>
            </div>
            <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-4">
              {[
                ["₹2", "per page, B&W"],
                ["36h", "typical delivery"],
                ["25 MB", "max per file"],
              ].map(([big, small]) => (
                <div key={small}>
                  <dt className="font-display text-3xl font-black tracking-tight">{big}</dt>
                  <dd className="text-xs font-semibold tracking-wide text-muted uppercase">{small}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="relative mx-auto w-full max-w-md lg:max-w-none">
            <div className="animate-floaty">
              <div className="hard-card overflow-hidden">
                <Image
                  src="/images/hero-riso.jpg"
                  alt="Risograph illustration of a scooter delivering a tall stack of printed documents"
                  width={1024}
                  height={1024}
                  className="h-auto w-full object-cover"
                  priority
                />
              </div>
            </div>
            <div className="hard-card-flat absolute -bottom-6 -left-4 rotate-[-4deg] bg-cream px-4 py-3 sm:-left-8">
              <p className="text-[0.65rem] font-bold tracking-[0.18em] text-muted uppercase">Order DD-TODAY</p>
              <p className="font-display text-xl font-black">42 pages · ₹89.00</p>
              <p className="text-xs font-semibold text-mint">Arriving tomorrow by 9 PM</p>
            </div>
            <div className="hard-card-flat absolute -top-5 -right-3 hidden rotate-[5deg] bg-card px-4 py-2.5 sm:block">
              <p className="flex items-center gap-2 text-sm font-bold">
                <Camera size={16} className="text-brand" /> Camera scan accepted
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- TICKER */}
      <div className="border-y-[1.5px] border-ink bg-ink py-3 text-cream">
        <div className="animate-marquee flex w-max gap-8 whitespace-nowrap" aria-hidden="true">
          {[...TICKER, ...TICKER, ...TICKER, ...TICKER].map((item, i) => (
            <span key={i} className="flex items-center gap-8 text-sm font-bold tracking-[0.14em] uppercase">
              {item}
              <span className="text-brand">✳</span>
            </span>
          ))}
        </div>
      </div>

      {/* -------------------------------------------------- HOW IT WORKS */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="font-display max-w-md text-[2.4rem] leading-[1.05] font-black tracking-tight">
            From camera roll to doorstep in three moves.
          </h2>
          <p className="max-w-xs text-sm leading-relaxed text-ink-soft">
            No print-shop queues, no pen drives, no "come back tomorrow". The whole thing takes a minute.
          </p>
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {HOW_IT_WORKS.map((item, i) => (
            <article
              key={item.step}
              className="hard-card group relative overflow-hidden p-6 transition-transform duration-200 hover:-translate-y-1.5"
              style={{ transform: `rotate(${i % 2 === 0 ? -0.6 : 0.6}deg)` }}
            >
              <div className="flex items-start justify-between">
                <span className="font-display text-5xl font-black text-brand/90">{item.step}</span>
                <span className="rounded-xl border-[1.5px] border-ink bg-cream p-2.5 transition-colors group-hover:bg-brand group-hover:text-cream">
                  <item.icon size={22} />
                </span>
              </div>
              <h3 className="font-display mt-5 text-xl font-black tracking-tight">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------- PRICING */}
      <section id="pricing" className="border-y-[1.5px] border-ink bg-cream/70 py-20">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
          <div>
            <span className="chip bg-card">
              <Lock size={12} className="text-cobalt" />
              Locked-in totals
            </span>
            <h2 className="font-display mt-4 text-[2.4rem] leading-[1.05] font-black tracking-tight">
              A bill you can read before you pay it.
            </h2>
            <p className="mt-4 max-w-md text-[0.95rem] leading-relaxed text-ink-soft">
              Every document is priced as <strong>pages × copies × rate</strong>, plus a flat{" "}
              {formatINRShort(PRICING.deliveryFeePaise)} delivery. The total is computed on our servers with the exact
              same formula you see here — what you review is what you pay, or the order doesn&apos;t go through.
            </p>
            <ul className="mt-6 flex flex-col gap-2.5 text-sm font-semibold">
              <li className="flex items-center gap-2.5">
                <FileText size={16} className="text-brand" /> B&amp;W — {formatINRShort(PRICING.bwPerPagePaise)} per page
              </li>
              <li className="flex items-center gap-2.5">
                <ImageIcon size={16} className="text-brand" /> Colour — {formatINRShort(PRICING.colorPerPagePaise)} per
                page
              </li>
              <li className="flex items-center gap-2.5">
                <PackageCheck size={16} className="text-brand" /> Delivery — {formatINRShort(PRICING.deliveryFeePaise)}{" "}
                flat, anywhere we serve
              </li>
            </ul>
            <Link href={ctaHref} className="btn btn-dark mt-8 px-7 py-3">
              Try it with your own file <ArrowRight size={16} />
            </Link>
          </div>

          <div className="mx-auto w-full max-w-md rotate-[1.2deg]">
            <Receipt
              title="Sample bill"
              stamp="Demo"
              lines={[
                {
                  key: "a",
                  fileName: "semester5-notes.pdf",
                  pageCount: 24,
                  copies: 2,
                  colorMode: "bw",
                  ratePerPagePaise: PRICING.bwPerPagePaise,
                  lineTotalPaise: 24 * 2 * PRICING.bwPerPagePaise,
                },
                {
                  key: "b",
                  fileName: "lab-report-cover.jpg",
                  pageCount: 1,
                  copies: 1,
                  colorMode: "color",
                  ratePerPagePaise: PRICING.colorPerPagePaise,
                  lineTotalPaise: PRICING.colorPerPagePaise,
                },
                {
                  key: "c",
                  fileName: "internship-letter.docx",
                  pageCount: 3,
                  copies: 1,
                  colorMode: "bw",
                  ratePerPagePaise: PRICING.bwPerPagePaise,
                  lineTotalPaise: 3 * PRICING.bwPerPagePaise,
                  estimated: true,
                },
              ]}
              subtotalPaise={24 * 2 * PRICING.bwPerPagePaise + PRICING.colorPerPagePaise + 3 * PRICING.bwPerPagePaise}
              deliveryFeePaise={PRICING.deliveryFeePaise}
              totalPaise={
                24 * 2 * PRICING.bwPerPagePaise + PRICING.colorPerPagePaise + 3 * PRICING.bwPerPagePaise + PRICING.deliveryFeePaise
              }
              note="Word page counts are estimated from content length and flagged on your bill."
            />
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- CLOSER */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="hard-card relative overflow-hidden bg-ink px-6 py-14 text-center text-cream sm:px-12">
          <div
            aria-hidden="true"
            className="absolute -top-16 -right-16 h-56 w-56 rounded-full bg-brand/25 blur-3xl"
          />
          <h2 className="font-display mx-auto max-w-2xl text-[clamp(2rem,5vw,3.2rem)] leading-[1.02] font-black tracking-tight text-balance">
            Your notes deserve better than a queue at the photocopy shop.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-cream/70">
            Create a free account in thirty seconds. Your first delivery is forty pages away.
          </p>
          <Link href={ctaHref} className="btn btn-primary mt-8 px-8 py-3.5 text-base">
            {user ? "Start a new order" : "Create your account"} <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </div>
  );
}
