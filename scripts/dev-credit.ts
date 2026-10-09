import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdminEnv } from "@/lib/env";
import type { Database } from "@/types/database";

if (process.env.NODE_ENV === "production") {
  throw new Error("dev:credit is disabled when NODE_ENV is production.");
}

if (process.env.ENABLE_DEV_LOGIN !== "true") {
  throw new Error("dev:credit requires ENABLE_DEV_LOGIN=true.");
}

if (process.argv.length > 3) {
  throw new Error("Usage: npm run dev:credit [amount_cents]");
}

const amountCents = process.argv[2] === undefined ? 2400 : Number(process.argv[2]);

if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
  throw new Error("amount_cents must be a positive safe integer.");
}

async function main() {
  const contributionId = randomUUID();
  const checkoutSessionId = `dev-credit:${randomUUID()}`;
  const paymentIntentId = `dev-credit-payment:${randomUUID()}`;
  const env = getSupabaseAdminEnv("dev:credit service-role Supabase client");
  const admin = createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: contribution, error } = await admin
    .from("contributions")
    .insert({
      id: contributionId,
      amount_cents: amountCents,
      currency: "usd",
      status: "pending",
      is_anonymous: true,
      stripe_checkout_session_id: checkoutSessionId,
    })
    .select("id")
    .single();

  if (error || !contribution) {
    throw error ?? new Error("Could not create dev contribution.");
  }

  const { error: creditError } = await admin.rpc("record_credit", {
    p_contribution_id: contribution.id,
    p_checkout_session_id: checkoutSessionId,
    p_payment_intent_id: paymentIntentId,
  });
  if (creditError) throw creditError;

  const { data: balanceCents, error: balanceError } = await admin.rpc("get_pool_balance");
  if (balanceError) throw balanceError;
  console.log(`Created dev contribution: ${amountCents} cents`);
  console.log(`Pool balance: ${balanceCents} cents`);
}

main().catch(() => {
  console.error("dev:credit failed. Check the Supabase connection and service-role configuration.");
  process.exit(1);
});