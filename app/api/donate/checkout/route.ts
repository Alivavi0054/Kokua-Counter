import { NextResponse } from "next/server";
import { z } from "zod";
import { MAX_DONATION_CENTS, MEAL_VALUE_CENTS } from "@/lib/constants";
import { describeError } from "@/lib/errors";
import { getAppUrl } from "@/lib/env";
import { formatFeeRate } from "@/lib/fees";
import { createContribution } from "@/lib/finance";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe/client";
import { rateLimitShared } from "@/lib/rate-limit-shared";
import { getClientIp, parseJsonBody, verifyOriginMatches } from "@/lib/security";
import { mealsFromCents } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Clients send only the intended donation. Any fee, rate or total field is rejected (.strict()):
// the server alone decides what is charged. expected_total_cents is a consistency check only: if
// the server's total differs (e.g. the fee changed while the page was open), nothing is charged.
const bodySchema = z.object({
  amount_cents: z.number().int().min(MEAL_VALUE_CENTS).max(MAX_DONATION_CENTS)
    .refine((amount) => amount % 100 === 0),
  donor_email: z.string().email().max(254).optional(),
  is_anonymous: z.boolean().optional().default(true),
  expected_total_cents: z.number().int().positive().optional(),
}).strict();

const requestKeySchema = z.string().regex(/^[A-Za-z0-9_-]{8,100}$/);

export async function POST(request: Request) {
  if (!verifyOriginMatches(request, getAppUrl("donation checkout requests"))) {
    return NextResponse.json({ error: "Invalid request." }, { status: 403 });
  }

  const clientIp = getClientIp(request);
  const limited = await rateLimitShared(`donate:${clientIp}`, 10, 60_000);
  if (!limited.ok) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const parsedBody = await parseJsonBody(request, bodySchema);
  if (!parsedBody.ok) {
    return NextResponse.json({ error: parsedBody.error }, { status: parsedBody.status });
  }

  const rawKey = request.headers.get("idempotency-key");
  let requestKey: string | null = null;
  if (rawKey) {
    if (!requestKeySchema.safeParse(rawKey).success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    requestKey = rawKey;
  }

  const donorEmail = parsedBody.data.donor_email?.trim().toLowerCase();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user && donorEmail && donorEmail !== user.email?.toLowerCase()) {
    return NextResponse.json({ error: "Donor email does not match the signed-in account." }, { status: 400 });
  }

  const appUrl = getAppUrl("donation checkout redirects");

  // The database calculates the operational fee from the current rate and snapshots it.
  let created;
  try {
    created = await createContribution({
      donorUserId: user?.id ?? null,
      principalCents: parsedBody.data.amount_cents,
      isAnonymous: parsedBody.data.is_anonymous,
      requestKey,
    });
  } catch (error) {
    console.error("donate/checkout: contribution insert failed", describeError(error));
    return NextResponse.json({ error: "Could not start donation." }, { status: 500 });
  }
  if (!created.ok) {
    console.error("donate/checkout: contribution rejected", created.errorCode);
    const reused = created.errorCode === "request_key_reused";
    return NextResponse.json({ error: reused ? "Invalid request." : "Could not start donation." }, { status: reused ? 400 : 500 });
  }

  const admin = createAdminClient();
  const breakdown = {
    donation_cents: created.principalCents,
    operational_fee_cents: created.operationalFeeCents,
    operational_fee_rate_bps: created.feeRateBps,
    total_cents: created.totalChargedCents,
  };

  if (
    parsedBody.data.expected_total_cents !== undefined &&
    parsedBody.data.expected_total_cents !== created.totalChargedCents
  ) {
    if (!created.replay) {
      await admin
        .from("contributions")
        .update({ status: "failed", failure_reason: "fee_changed" })
        .eq("id", created.contributionId)
        .eq("status", "pending");
    }
    return NextResponse.json(
      { error: "The operational fee changed. Please review the updated total and try again.", breakdown },
      { status: 409 },
    );
  }

  // A repeated request (double click, network retry) must not charge the donor twice.
  if (created.replay) {
    if (created.status !== "pending") {
      return NextResponse.json({ error: "This checkout was already completed or closed. Please start again." }, { status: 409 });
    }
    if (created.stripeCheckoutSessionId) {
      try {
        const existing = await getStripe().checkout.sessions.retrieve(created.stripeCheckoutSessionId);
        if (existing.status === "open" && existing.url) {
          return NextResponse.json({ url: existing.url, breakdown });
        }
      } catch (error) {
        console.error("donate/checkout: could not reopen existing session", describeError(error));
      }
      return NextResponse.json({ error: "This checkout expired. Please start again." }, { status: 409 });
    }
  }

  const meals = mealsFromCents(created.principalCents);
  let session;
  try {
    session = await getStripe().checkout.sessions.create(
      {
        mode: "payment",
        success_url: `${appUrl}/donate/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}/donate/canceled`,
        customer_email: donorEmail ?? user?.email,
        metadata: {
          contribution_id: created.contributionId,
          donation_cents: String(created.principalCents),
          operational_fee_cents: String(created.operationalFeeCents),
          fee_rate_bps: String(created.feeRateBps),
        },
        payment_intent_data: {
          metadata: { contribution_id: created.contributionId },
        },
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: created.principalCents,
              product_data: {
                name: `Kōkua Counter meal credits (${meals} meal${meals === 1 ? "" : "s"})`,
                description: "Your full donation goes to the shared meal pool.",
              },
            },
          },
          ...(created.operationalFeeCents > 0
            ? [
                {
                  quantity: 1,
                  price_data: {
                    currency: "usd",
                    unit_amount: created.operationalFeeCents,
                    product_data: {
                      name: `Operational fee (${formatFeeRate(created.feeRateBps)})`,
                      description: "Added on top of your donation to cover platform operating costs. It is not part of the donation.",
                    },
                  },
                },
              ]
            : []),
        ],
      },
      { idempotencyKey: `checkout-session:${created.contributionId}` },
    );
  } catch (error) {
    await admin
      .from("contributions")
      .update({ status: "failed", failure_reason: "checkout_creation_failed" })
      .eq("id", created.contributionId)
      .eq("status", "pending");
    console.error("donate/checkout: Stripe session creation failed", describeError(error));
    if (error instanceof Error && error.message.startsWith("Missing ")) {
      return NextResponse.json({ error: "Could not start checkout." }, { status: 500 });
    }
    return NextResponse.json({ error: "Could not start checkout." }, { status: 502 });
  }

  if (!session.url) {
    await admin
      .from("contributions")
      .update({ status: "failed", failure_reason: "checkout_creation_failed" })
      .eq("id", created.contributionId)
      .eq("status", "pending");
    return NextResponse.json({ error: "Could not start checkout." }, { status: 500 });
  }

  await admin
    .from("contributions")
    .update({ stripe_checkout_session_id: session.id })
    .eq("id", created.contributionId);

  return NextResponse.json({ url: session.url, breakdown });
}
