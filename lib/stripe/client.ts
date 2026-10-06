import "server-only";
import Stripe from "stripe";
import { getServerEnv } from "@/lib/env";

let stripe: Stripe | undefined;

export function getStripe(): Stripe {
  if (!stripe) {
    stripe = new Stripe(getServerEnv().STRIPE_SECRET_KEY);
  }
  return stripe;
}
