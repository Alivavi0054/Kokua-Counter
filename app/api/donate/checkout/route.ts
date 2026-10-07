import { NextResponse } from "next/server";
import { z } from "zod";
import { MAX_DONATION_CENTS, MEAL_VALUE_CENTS } from "@/lib/constants";
import { getAppUrl } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe/client";
import { rateLimit } from "@/lib/rate-limit";
import { parseJsonBody, verifyOriginMatches } from "@/lib/security";

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "local";
  return forwarded.split(",")[0].trim() || "local";
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  amount_cents: z.number().int().min(MEAL_VALUE_CENTS).max(MAX_DONATION_CENTS)
    .refine((amount) => amount % 100 === 0),
  donor_email: z.string().email().max(254).optional(),
  is_anonymous: z.boolean().optional().default(true),
}).strict();

export async function POST(request: Request) {
  if (!verifyOriginMatches(request, getAppUrl("donation checkout requests"))) {
    return NextResponse.json({ error: "Invalid request." }, { status: 403 });
  }

  const clientIp = getClientIp(request);
  const limited = rateLimit(`donate:${clientIp}`, 10, 60_000);
  if (!limited.ok) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const parsedBody = await parseJsonBody(request, bodySchema);
  if (!parsedBody.ok) {
    return NextResponse.json({ error: parsedBody.error }, { status: parsedBody.status });
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

  const admin = createAdminClient();
  const { data: contribution, error } = await admin
    .from("contributions")
    .insert({
      donor_user_id: parsedBody.data.is_anonymous ? null : user?.id ?? null,
      amount_cents: parsedBody.data.amount_cents,
      currency: "usd",
      status: "pending",
      is_anonymous: parsedBody.data.is_anonymous,
    })
    .select("id")
    .single();

  if (error || !contribution) {
    return NextResponse.json(
      { error: "Could not start donation." },
      { status: 500 },
    );
  }

  let session;
  try {
    session = await getStripe().checkout.sessions.create({
      mode: "payment",
      success_url: `${appUrl}/donate/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/donate/canceled`,
      customer_email: donorEmail ?? user?.email,
      metadata: {
        contribution_id: contribution.id,
      },
      payment_intent_data: {
        metadata: {
          contribution_id: contribution.id,
        },
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: parsedBody.data.amount_cents,
            product_data: {
              name: "Kōkua Counter meal credits",
            },
          },
        },
      ],
    });
  } catch (error) {
    await admin
      .from("contributions")
      .update({ status: "failed" })
      .eq("id", contribution.id)
      .eq("status", "pending");
    if (error instanceof Error && error.message.startsWith("Missing ")) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: "Could not start checkout." }, { status: 502 });
  }

  if (!session.url) {
    await admin
      .from("contributions")
      .update({ status: "failed" })
      .eq("id", contribution.id)
      .eq("status", "pending");
    return NextResponse.json(
      { error: "Could not start checkout." },
      { status: 500 },
    );
  }

  await admin
    .from("contributions")
    .update({ stripe_checkout_session_id: session.id })
    .eq("id", contribution.id);

  return NextResponse.json({ url: session.url });
}
