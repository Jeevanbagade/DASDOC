import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { AuthPanel } from "@/components/auth/auth-panel";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_1.05fr] lg:gap-14">
      <AuthPanel
        heading="Back for another ream?"
        blurb="Log in with your mobile number to pick up right where your prints left off."
      />
      <div className="flex items-center">
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
