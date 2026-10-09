import type { Metadata } from "next";
import { DonateForm } from "@/components/donate-form";
import { PageHeader } from "@/components/page-header";
import { Alert } from "@/components/ui/alert";
import { getSiteContact, isStripeTestMode } from "@/lib/site";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Donate",
  description: "Contribute to the shared Kōkua Counter meal pool.",
};

export default function DonatePage() {
  const { organization } = getSiteContact();
  const testMode = isStripeTestMode();

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageHeader
        eyebrow="Give a meal"
        title="Fund a meal for a student"
        description="Your payment adds meal credits to one shared pool. Students redeem those credits at participating eateries. Credits are added only after Stripe confirms the payment."
      />
      {testMode ? (
        <Alert variant="warning">
          <strong>Test mode.</strong> Payments run through the Stripe sandbox, so no real money is charged. Use card
          number 4242 4242 4242 4242 with any future expiry date and any CVC.
        </Alert>
      ) : null}
      <DonateForm />
      <p className="text-sm leading-relaxed text-muted-foreground">
        Donations fund the shared pool and are not tax-deductible unless the operating organization is a registered nonprofit.
        {organization ? ` Operating organization: ${organization}.` : ""}
      </p>
    </div>
  );
}
