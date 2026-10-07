import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/guards";
import { getAppUrl } from "@/lib/env";
import { getStripe } from "@/lib/stripe/client";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireApiRole("eatery");
  if (!auth.ok) return auth.response;

  const limited = rateLimit(`eatery-connect-onboard:${auth.user.id}`, 5, 60_000);
  if (!limited.ok) {
    return NextResponse.json({ error: "Please wait before trying again." }, { status: 429 });
  }

  const admin = createAdminClient();
  const { data: eatery, error } = await admin
    .from("eateries")
    .select("id, name, contact_email, stripe_connect_account_id")
    .eq("owner_user_id", auth.user.id)
    .maybeSingle();

  if (error || !eatery) {
    return NextResponse.json({ error: "Could not find your eatery account." }, { status: 404 });
  }

  const stripe = getStripe();
  const appUrl = getAppUrl("eatery payout onboarding redirects");
  let accountId = eatery.stripe_connect_account_id;

  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      email: eatery.contact_email,
      business_type: "company",
      company: { name: eatery.name },
    });
    accountId = account.id;
    const { error: updateError } = await admin
      .from("eateries")
      .update({ stripe_connect_account_id: accountId })
      .eq("id", eatery.id);
    if (updateError) {
      return NextResponse.json({ error: "Could not save payout account." }, { status: 500 });
    }
  }

  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${appUrl}/eatery`,
    return_url: `${appUrl}/eatery`,
    type: "account_onboarding",
  });

  return NextResponse.json({ url: accountLink.url });
}
