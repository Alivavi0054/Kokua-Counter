import "server-only";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe/client";
import { getServerEnv } from "@/lib/env";

export function constructStripeEvent(
  rawBody: string,
  signature: string | null,
): Stripe.Event {
  if (!signature) {
    throw new Error("missing_stripe_signature");
  }
  return getStripe().webhooks.constructEvent(
    rawBody,
    signature,
    getServerEnv().STRIPE_WEBHOOK_SECRET,
  );
}

export function asStripeId(
  value: string | { id: string } | null | undefined,
): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}
