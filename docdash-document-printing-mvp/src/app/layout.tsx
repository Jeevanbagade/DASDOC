import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Fraunces, Space_Grotesk } from "next/font/google";
import { getSessionUser } from "@/server/auth";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import "./globals.css";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
});

const body = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space",
});

export const metadata: Metadata = {
  title: {
    default: "DocDash — Print it fast, skip the past",
    template: "%s · DocDash",
  },
  description:
    "Upload PDFs, Word docs or photos from your phone. We print them crisp and deliver to your door — B&W ₹2/page, colour ₹5/page, ₹5 flat delivery.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser().catch(() => null);
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="min-h-screen font-sans">
        <div className="grain" aria-hidden="true" />
        <SiteHeader user={user} />
        <main>{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
