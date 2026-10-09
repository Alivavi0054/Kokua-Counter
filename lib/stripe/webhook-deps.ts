import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/client";
import { fetchProcessorFee } from "@/lib/stripe/processor-fees";
import type { WebhookDeps } from "@/lib/stripe/webhook-handlers";
import { recordCredit, recordRefund, recordRefundReversal } from "@/lib/ledger";
import { recordDisputeClosed, recordDisputeOpened, recordProcessorFee } from "@/lib/finance";

/** The real database/Stripe implementation of the webhook handler's dependencies. */
export function databaseWebhookDeps(): WebhookDeps {
  return {
    async getContribution(id) {
      const { data, error } = await createAdminClient()
        .from("contributions")
        .select("amount_cents, total_charged_cents, currency")
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
    log: (message, detail) => console.error(`donate/webhook: ${message}`, detail),
  };
}
