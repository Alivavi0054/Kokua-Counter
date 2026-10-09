import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { describeError } from "@/lib/errors";
import { constructStripeEvent } from "@/lib/stripe/webhook";
import { handleStripeEvent } from "@/lib/stripe/webhook-handlers";
import { databaseWebhookDeps } from "@/lib/stripe/webhook-deps";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();

  if (!webhookSecret) {
    console.error("donate/webhook: STRIPE_WEBHOOK_SECRET is not configured");
    return NextResponse.json({ error: "Webhook is not configured." }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = constructStripeEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Missing ")) {
      console.error("donate/webhook: configuration error", describeError(error));
      return NextResponse.json({ error: "Webhook is not configured." }, { status: 500 });
    }
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  try {
    await handleStripeEvent(event, databaseWebhookDeps());
  } catch (error) {
    console.error("donate/webhook: handler failed", { eventId: event.id, eventType: event.type }, describeError(error));
    return NextResponse.json({ error: "Webhook handler failed." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
