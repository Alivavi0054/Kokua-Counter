import { DonateForm } from "@/components/donate-form";

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
    </div>
  );
}
