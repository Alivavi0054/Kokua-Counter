import "server-only";
import type Stripe from "stripe";

/**
 * Looks up the Stripe processing fee for a successful payment from its balance transaction.
 * Stripe keeps its processing fee even when the donor is refunded, so this is a plain expense.
 */
export async function fetchProcessorFee(
  stripe: Pick<Stripe, "paymentIntents">,
  paymentIntentId: string,
): Promise<{ feeCents: number; balanceTransactionId: string | null } | null> {
  const intent = await stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ["latest_charge.balance_transaction"],
  });
  const charge = intent.latest_charge;
  if (!charge || typeof charge === "string") return null;
  const transaction = charge.balance_transaction;
  if (!transaction || typeof transaction === "string") return null;
  if (transaction.currency !== "usd") return null;
  return { feeCents: transaction.fee, balanceTransactionId: transaction.id };
}
