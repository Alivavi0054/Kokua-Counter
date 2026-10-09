/**
 * Eatery payout accounts (Stripe Connect, Accounts v2).
 *
 * Kōkua Counter collects every donation on the platform account and later pays each eatery with a
 * transfer ("separate charges and transfers"). So each eatery is a *recipient*: it only needs to receive
 * transfers. New Connect platforms must use the Accounts v2 API (`/v2/core/accounts`); the resulting
 * `acct_...` id works as the `destination` of a normal v1 Transfer.
 */

import type Stripe from "stripe";

type V2Account = {
  id: string;
  configuration?: {
    recipient?: {
      capabilities?: { stripe_balance?: { stripe_transfers?: { status?: string } } };
    } | null;
  } | null;
};

/** The slice of the Stripe client this module uses (lets tests pass a fake). */
export type ConnectStripe = {
  v2: {
    core: {
      accounts: {
        create: (params: Record<string, unknown>) => Promise<V2Account>;
        retrieve: (id: string, params?: { include?: string[] }) => Promise<V2Account>;
      };
      accountLinks: {
        create: (params: Record<string, unknown>) => Promise<{ url: string }>;
      };
    };
  };
};

export function recipientAccountParams(eatery: { id: string; name: string; contact_email: string }): Stripe.V2.Core.AccountCreateParams {
  return {
    display_name: eatery.name.slice(0, 100),
    contact_email: eatery.contact_email,
    // Express: Stripe hosts onboarding and gives the eatery a simple dashboard for its payouts.
    dashboard: "express",
    identity: { country: "US" },
    configuration: {
      recipient: { capabilities: { stripe_balance: { stripe_transfers: { requested: true } } } },
    },
    defaults: {
      currency: "usd",
      // The platform pays eateries from the pool, so it is responsible for fees and for any losses.
      responsibilities: { fees_collector: "application", losses_collector: "application" },
    },
    metadata: { eatery_id: eatery.id },
  };
}

export async function createRecipientAccount(
  stripe: ConnectStripe,
  eatery: { id: string; name: string; contact_email: string },
): Promise<string> {
  const account = await stripe.v2.core.accounts.create(recipientAccountParams(eatery) as unknown as Record<string, unknown>);
  return account.id;
}

export function onboardingLinkParams(accountId: string, appUrl: string): Stripe.V2.Core.AccountLinkCreateParams {
  return {
    account: accountId,
    use_case: {
      type: "account_onboarding",
      account_onboarding: { refresh_url: `${appUrl}/eatery`, return_url: `${appUrl}/eatery` },
    },
  };
}

export async function createOnboardingLink(stripe: ConnectStripe, accountId: string, appUrl: string): Promise<string> {
  const link = await stripe.v2.core.accountLinks.create(onboardingLinkParams(accountId, appUrl) as unknown as Record<string, unknown>);
  return link.url;
}

export type PayoutReadiness = "not_started" | "ready" | "incomplete" | "unknown";

/** Whether the eatery can actually receive settlement transfers yet (onboarding finished and approved). */
export async function getPayoutReadiness(stripe: ConnectStripe, accountId: string | null): Promise<PayoutReadiness> {
  if (!accountId) return "not_started";
  try {
    const account = await stripe.v2.core.accounts.retrieve(accountId, { include: ["configuration.recipient"] });
    const status = account.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.status;
    return status === "active" ? "ready" : "incomplete";
  } catch {
    return "unknown";
  }
}

/** Stripe errors that mean the platform itself is not set up for Connect yet (an admin must fix it in Stripe). */
export function isPlatformNotReadyError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { message, code } = error as { message?: unknown; code?: unknown };
  if (code === "accounts_v2_access_blocked") return true;
  return typeof message === "string" && /signed up for Connect|platform-profile|managing losses for connected accounts/i.test(message);
}
