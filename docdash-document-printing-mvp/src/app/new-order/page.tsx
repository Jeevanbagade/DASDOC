import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/auth";
import { CheckoutWizard } from "@/components/wizard/checkout-wizard";

export const metadata: Metadata = { title: "New print order" };
export const dynamic = "force-dynamic";

export default async function NewOrderPage() {
  // Authoritative session check in the Node runtime (middleware alone only
  // checks cookie presence, and the API re-verifies again on every call).
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/new-order");
  return <CheckoutWizard />;
}
