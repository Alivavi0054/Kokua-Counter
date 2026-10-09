import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/guards";
import { getAppUrl } from "@/lib/env";
import { describeError } from "@/lib/errors";
import { getStripe } from "@/lib/stripe/client";
import { createOnboardingLink, createRecipientAccount, isPlatformNotReadyError, type ConnectStripe } from "@/lib/stripe/connect";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
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

  const stripe = getStripe() as unknown as ConnectStripe;
  const appUrl = getAppUrl("eatery payout onboarding redirects");
  let accountId = eatery.stripe_connect_account_id;

  if (!accountId) {
    try {
      accountId = await createRecipientAccount(stripe, eatery);
      const { error: updateError } = await admin
        .from("eateries")
        .update({ stripe_connect_account_id: accountId })
        .eq("id", eatery.id);
      if (updateError) {
        return NextResponse.json({ error: "Could not save payout account." }, { status: 500 });
      }
    } catch (error) {
      console.error("eatery/connect/onboard: account creation failed", describeError(error));
      if (isPlatformNotReadyError(error)) {
        return NextResponse.json({ error: "Payout setup is not available yet." }, { status: 403 });
      }
      return NextResponse.json({ error: "Could not start payout setup. Please try again." }, { status: 502 });
    }
  }

  try {
    const url = await createOnboardingLink(stripe, accountId, appUrl);
    return NextResponse.json({ url });
  } catch (error) {
    console.error("eatery/connect/onboard: account link failed", describeError(error));
    if (isPlatformNotReadyError(error)) {
      return NextResponse.json({ error: "Payout setup is not available yet." }, { status: 403 });
    }
    return NextResponse.json({ error: "Could not start payout setup. Please try again." }, { status: 502 });
  }
}
