import { DonateForm } from "@/components/donate-form";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Donate",
  description: "Contribute to the shared Kōkua Counter meal pool.",
};

export default function DonatePage() {
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="space-y-2">
        <h1 className="font-serif text-4xl">Donate</h1>
        <p className="text-muted-foreground">
          Your payment adds meal credits to one shared pool. Students redeem
          those credits at participating eateries. This page never adds credits
          on its own — Stripe confirms the payment first.
        </p>
      </div>
      <DonateForm />
      <p className="text-sm text-muted-foreground">
        Donations fund the shared pool. Donations are not tax-deductible unless the operating organization is a registered nonprofit. Operating organization: [OWNER TO FILL IN].
      </p>
    </div>
  );
}
