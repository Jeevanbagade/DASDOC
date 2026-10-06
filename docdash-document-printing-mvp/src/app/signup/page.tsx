import type { Metadata } from "next";
import { SignupForm } from "@/components/auth/signup-form";
import { AuthPanel } from "@/components/auth/auth-panel";

export const metadata: Metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_1.05fr] lg:gap-14">
      <AuthPanel
        heading="Thirty seconds to your first print."
        blurb="One account for uploads, orders and delivery tracking. No card required to start."
      />
      <div className="flex items-center">
        <SignupForm />
      </div>
    </div>
  );
}
