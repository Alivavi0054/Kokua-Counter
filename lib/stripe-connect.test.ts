import { describe, expect, it, vi } from "vitest";
import {
  createOnboardingLink,
  createRecipientAccount,
  getPayoutReadiness,
  isPlatformNotReadyError,
  onboardingLinkParams,
  recipientAccountParams,
  type ConnectStripe,
} from "@/lib/stripe/connect";

const eatery = { id: "e1", name: "Test Eatery", contact_email: "eatery@example.com" };

function fakeStripe(overrides: { status?: string; retrieveError?: Error } = {}) {
  const create = vi.fn().mockResolvedValue({ id: "acct_new123" });
  const retrieve = overrides.retrieveError
    ? vi.fn().mockRejectedValue(overrides.retrieveError)
    : vi.fn().mockResolvedValue({
        id: "acct_new123",
        configuration: { recipient: { capabilities: { stripe_balance: { stripe_transfers: { status: overrides.status ?? "active" } } } } },
      });
  const linkCreate = vi.fn().mockResolvedValue({ url: "https://connect.stripe.com/setup/xyz" });
  const stripe = { v2: { core: { accounts: { create, retrieve }, accountLinks: { create: linkCreate } } } } as unknown as ConnectStripe;
  return { stripe, create, retrieve, linkCreate };
}

describe("eatery payout accounts (Stripe Accounts v2)", () => {
  it("creates a recipient that can receive transfers, Express dashboard, platform liable for fees and losses", async () => {
    const { stripe, create } = fakeStripe();
    expect(await createRecipientAccount(stripe, eatery)).toBe("acct_new123");
    expect(create).toHaveBeenCalledWith({
      display_name: "Test Eatery",
      contact_email: "eatery@example.com",
      dashboard: "express",
      identity: { country: "US" },
      configuration: { recipient: { capabilities: { stripe_balance: { stripe_transfers: { requested: true } } } } },
      defaults: { currency: "usd", responsibilities: { fees_collector: "application", losses_collector: "application" } },
      metadata: { eatery_id: "e1" },
    });
  });

  it("never asks for merchant (card payment) capabilities, since donors pay the platform, not the eatery", () => {
    const params = recipientAccountParams(eatery) as unknown as { configuration: Record<string, unknown> };
    expect(Object.keys(params.configuration)).toEqual(["recipient"]);
  });

  it("onboarding link returns to the eatery page", async () => {
    const { stripe, linkCreate } = fakeStripe();
    expect(await createOnboardingLink(stripe, "acct_new123", "https://www.kokuacounter.app")).toBe("https://connect.stripe.com/setup/xyz");
    expect(linkCreate).toHaveBeenCalledWith(onboardingLinkParams("acct_new123", "https://www.kokuacounter.app"));
    expect(onboardingLinkParams("acct_1", "https://x.app")).toEqual({
      account: "acct_1",
      use_case: { type: "account_onboarding", account_onboarding: { refresh_url: "https://x.app/eatery", return_url: "https://x.app/eatery" } },
    });
  });

  it("reports readiness from the transfers capability", async () => {
    expect(await getPayoutReadiness(fakeStripe().stripe, null)).toBe("not_started");
    expect(await getPayoutReadiness(fakeStripe({ status: "active" }).stripe, "acct_1")).toBe("ready");
    for (const status of ["pending", "restricted", "rejected", "unsupported"]) {
      expect(await getPayoutReadiness(fakeStripe({ status }).stripe, "acct_1"), status).toBe("incomplete");
    }
    expect(await getPayoutReadiness(fakeStripe({ retrieveError: new Error("network") }).stripe, "acct_1")).toBe("unknown");
    const { stripe, retrieve } = fakeStripe();
    await getPayoutReadiness(stripe, "acct_9");
    expect(retrieve).toHaveBeenCalledWith("acct_9", { include: ["configuration.recipient"] });
  });

  it("recognises 'the platform is not set up for Connect' errors from Stripe", () => {
    expect(isPlatformNotReadyError(new Error("You can only create new accounts if you've signed up for Connect, which you can do at ..."))).toBe(true);
    expect(isPlatformNotReadyError(new Error("Please review the responsibilities of managing losses for connected accounts at https://dashboard.stripe.com/settings/connect/platform-profile."))).toBe(true);
    expect(isPlatformNotReadyError({ code: "accounts_v2_access_blocked", message: "x" })).toBe(true);
    expect(isPlatformNotReadyError(new Error("Invalid email address"))).toBe(false);
    expect(isPlatformNotReadyError(null)).toBe(false);
  });
});
