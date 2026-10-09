import "server-only";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe/client";

export function constructStripeEvent(
  rawBody: string,
  signature: string | null,
  webhookSecret: string,
): Stripe.Event {
  if (!signature) {
    throw new Error("missing_stripe_signature");
  }
  return getStripe().webhooks.constructEvent(
    rawBody,
    signature,
    webhookSecret,
  );
}

export { asStripeId } from "@/lib/stripe/webhook-handlers";
