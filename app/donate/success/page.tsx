import Link from "next/link";
import type { Metadata } from "next";
import { FeeBreakdown } from "@/components/fee-breakdown";
import { PageHeader } from "@/components/page-header";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Thank you",
  description: "Your Kōkua Counter contribution.",
};

async function loadReceipt(sessionId: string | undefined) {
  if (!sessionId || !/^cs_[A-Za-z0-9_]{10,200}$/.test(sessionId)) return null;
  const { data } = await createAdminClient()
    .from("contributions")
    .select("amount_cents, operational_fee_cents, fee_rate_bps, total_charged_cents, status, refunded_amount_cents, fee_refunded_cents")
    .eq("stripe_checkout_session_id", sessionId)
    .maybeSingle();
  return data;
}

export default async function DonateSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id: sessionId } = await searchParams;
  const receipt = await loadReceipt(sessionId).catch(() => null);
  const confirmed = receipt?.status === "completed" || receipt?.status === "refunded";

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <PageHeader eyebrow="Mahalo" title="Thank you for giving" />
      {receipt ? (
        <>
          <FeeBreakdown
            donationCents={receipt.amount_cents}
            feeCents={receipt.operational_fee_cents}
            feeRateBps={receipt.fee_rate_bps}
            totalCents={receipt.total_charged_cents}
          />
          {confirmed ? (
            <Alert variant="success">Your payment is confirmed and your donation has been added to the shared meal pool.</Alert>
          ) : (
            <Alert variant="info">
              We are waiting for Stripe to confirm your payment. Your donation is added to the meal pool only after it is confirmed, which usually takes a few seconds.
              Refresh this page to check.
            </Alert>
          )}
          {receipt.refunded_amount_cents + receipt.fee_refunded_cents > 0 ? (
            <Alert variant="warning">Part or all of this payment has been refunded.</Alert>
          ) : null}
        </>
      ) : (
        <p className="text-muted-foreground">
          If your payment completed, your donation will be added to the shared pool once Stripe confirms it. You will find an itemized receipt in the email from Stripe. You can close this page.
        </p>
      )}
      <Button asChild>
        <Link href="/">Back home</Link>
      </Button>
    </div>
  );
}
