import "server-only";
import type { ReconcileDeps } from "@/lib/refund-reconcile";
import { databaseRefundDeps, getPaymentIntentIdForContribution, listContributionsMissingProcessorFee, recordProcessorFee } from "@/lib/finance";
import { getStripe } from "@/lib/stripe/client";
import { fetchProcessorFee } from "@/lib/stripe/processor-fees";
import { databaseWebhookDeps } from "@/lib/stripe/webhook-deps";
import { applyProviderRefund } from "@/lib/stripe/webhook-handlers";
import { describeError } from "@/lib/errors";

/** Real Stripe + database implementation of the refund reconciliation dependencies. */
export function realReconcileDeps(): ReconcileDeps {
  const stripe = getStripe();
  return {
    getPaymentIntentId: getPaymentIntentIdForContribution,
    retrieveStripeRefund: (id) => stripe.refunds.retrieve(id),
    applyProviderRefund: (refund) => applyProviderRefund(refund, databaseWebhookDeps()),
    refundDeps: {
      ...databaseRefundDeps(),
      stripe,
      log: (message, detail) => console.error(`refund-reconcile: ${message}`, detail),
    },
  };
}

/** Records Stripe processing fees for completed payments that do not have one yet. */
export async function backfillProcessorFees(limit = 25): Promise<{ checked: number; recorded: number; unavailable: number }> {
  const missing = await listContributionsMissingProcessorFee(limit);
  const stripe = getStripe();
  let recorded = 0;
  let unavailable = 0;
  for (const item of missing) {
    try {
      const fee = await fetchProcessorFee(stripe, item.payment_intent_id);
      if (!fee) {
        unavailable += 1;
        continue;
      }
      await recordProcessorFee({
        contributionId: item.contribution_id,
        paymentIntentId: item.payment_intent_id,
        feeCents: fee.feeCents,
        balanceTransactionId: fee.balanceTransactionId,
      });
      recorded += 1;
    } catch (error) {
      unavailable += 1;
      console.error("processor-fee backfill: lookup failed", describeError(error));
    }
  }
  return { checked: missing.length, recorded, unavailable };
}
