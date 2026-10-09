import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/client";
import { fetchProcessorFee } from "@/lib/stripe/processor-fees";
import type { WebhookDeps } from "@/lib/stripe/webhook-handlers";
import { sendEmail } from "@/lib/email";
import { buildReceiptEmail } from "@/lib/receipt";
import { getSiteContact } from "@/lib/site";
import { recordCredit, recordRefund, recordRefundReversal } from "@/lib/ledger";
import { recordDisputeClosed, recordDisputeOpened, recordProcessorFee } from "@/lib/finance";

/** The real database/Stripe implementation of the webhook handler's dependencies. */
export function databaseWebhookDeps(): WebhookDeps {
  return {
    async getContribution(id) {
      const { data, error } = await createAdminClient()
        .from("contributions")
        .select("amount_cents, operational_fee_cents, fee_rate_bps, total_charged_cents, currency")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    async findContributionIdByPaymentIntent(paymentIntentId) {
      const { data, error } = await createAdminClient()
        .from("contributions")
        .select("id")
        .eq("stripe_payment_intent_id", paymentIntentId)
        .maybeSingle();
      if (error) throw error;
      return data?.id ?? null;
    },
    async markContributionFailed(contributionId, reason) {
      const { error } = await createAdminClient()
        .from("contributions")
        .update({ status: "failed", failure_reason: reason })
        .eq("id", contributionId)
        .eq("status", "pending");
      if (error) throw error;
    },
    recordCredit,
    recordRefund,
    recordRefundReversal,
    recordDisputeOpened,
    recordDisputeClosed,
    fetchProcessorFee: (paymentIntentId) => fetchProcessorFee(getStripe(), paymentIntentId),
    recordProcessorFee,
    async sendReceipt(params) {
      if (!params.email || !process.env.RESEND_API_KEY?.trim()) return;
      const admin = createAdminClient();
      const { data: claimed, error } = await admin.rpc("claim_receipt_email", { p_contribution_id: params.contributionId });
      if (error) throw error;
      if (claimed !== true) return; // already sent for this donation
      const contact = getSiteContact();
      const message = buildReceiptEmail({
        contributionId: params.contributionId,
        donationCents: params.donationCents,
        feeCents: params.feeCents,
        feeRateBps: params.feeRateBps,
        totalCents: params.totalCents,
        paidAt: new Date(),
        operatingOrganization: contact.organization,
        contactEmail: contact.email,
      });
      const result = await sendEmail({ to: params.email, ...message });
      if (!result.sent) {
        // Let a later event or manual retry try again instead of silently losing the receipt.
        await admin.rpc("release_receipt_email", { p_contribution_id: params.contributionId });
      }
    },
    log: (message, detail) => console.error(`donate/webhook: ${message}`, detail),
  };
}
