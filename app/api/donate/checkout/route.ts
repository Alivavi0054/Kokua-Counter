import { NextResponse } from "next/server";
import { z } from "zod";
import { MAX_DONATION_CENTS, MEAL_VALUE_CENTS } from "@/lib/constants";
import { getServerEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe/client";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  amount_cents: z.number().int().min(MEAL_VALUE_CENTS).max(MAX_DONATION_CENTS),
  donor_email: z.string().email().max(254).optional(),
  is_anonymous: z.boolean().optional().default(true),
});

export async function POST(request: Request) {
  const limited = rateLimit(
    `donate:${request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() ?? "local"}`,
    10,
    60_000,
  );
  if (!limited.ok) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter a whole-dollar amount of at least $8." },
      { status: 400 },
    );
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = createAdminClient();
  const { data: contribution, error } = await admin
    .from("contributions")
    .insert({
      donor_user_id: user?.id ?? null,
      amount_cents: parsed.data.amount_cents,
      currency: "usd",
      status: "pending",
      donor_email: parsed.data.donor_email ?? user?.email ?? null,
      is_anonymous: parsed.data.is_anonymous,
    })
    .select("id")
    .single();

  if (error || !contribution) {
    return NextResponse.json(
      { error: "Could not start donation." },
      { status: 500 },
    );
  }

  const appUrl = getServerEnv().NEXT_PUBLIC_APP_URL;
  let session;
  try {
    session = await getStripe().checkout.sessions.create({
      mode: "payment",
      success_url: `${appUrl}/donate/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/donate/canceled`,
      customer_email: parsed.data.donor_email ?? user?.email,
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
            unit_amount: parsed.data.amount_cents,
            product_data: {
              name: "Kōkua Counter meal credits",
            },
          },
        },
      ],
    });
  } catch {
    await admin
      .from("contributions")
      .update({ status: "failed" })
      .eq("id", contribution.id)
      .eq("status", "pending");
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
