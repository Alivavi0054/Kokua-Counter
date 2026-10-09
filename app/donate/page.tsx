import type { Metadata } from "next";
import { DonateForm } from "@/components/donate-form";
import { PageHeader } from "@/components/page-header";
import { Alert } from "@/components/ui/alert";
import { DEFAULT_OPERATIONAL_FEE_BPS } from "@/lib/public-constants";
import { getCurrentFeeRateBps } from "@/lib/finance";
import { getSiteContact, isStripeTestMode } from "@/lib/site";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Donate",
  description: "Contribute to the shared Kōkua Counter meal pool.",
};

export default async function DonatePage() {
  const { organization } = getSiteContact();
  const testMode = isStripeTestMode();
  // Display only: checkout recalculates with the live rate and refuses to charge a different total.
  const feeRateBps = await getCurrentFeeRateBps().catch(() => DEFAULT_OPERATIONAL_FEE_BPS);

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageHeader
        eyebrow="Give a meal"
        title="Fund a meal for a student"
        description="Your payment adds meal credits to one shared pool. Students redeem those credits at participating eateries. A small operational fee is added on top to cover platform costs, so your full donation reaches the meal pool. Credits are added only after Stripe confirms the payment."
      />
      {testMode ? (
        <Alert variant="warning">
          <strong>Test mode.</strong> Payments run through the Stripe sandbox, so no real money is charged. Use card
          number 4242 4242 4242 4242 with any future expiry date and any CVC.
        </Alert>
      ) : null}
      <DonateForm feeRateBps={feeRateBps} />
      <p className="text-sm leading-relaxed text-muted-foreground">
        Donations fund the shared pool and are not tax-deductible unless the operating organization is a registered nonprofit.
        {organization ? ` Operating organization: ${organization}.` : ""}
      </p>
    </div>
  );
}
