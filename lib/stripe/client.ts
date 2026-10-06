import "server-only";
import Stripe from "stripe";
import { getStripeSecretKey } from "@/lib/env";

let stripe: Stripe | undefined;

export function getStripe(): Stripe {
  if (!stripe) {
    stripe = new Stripe(getStripeSecretKey());
  }
  return stripe;
}
