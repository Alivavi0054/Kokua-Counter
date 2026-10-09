import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createContribution: vi.fn(),
  sessionsCreate: vi.fn(),
  sessionsRetrieve: vi.fn(),
  updates: [] as Array<{ values: Record<string, unknown> }>,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      update: (values: Record<string, unknown>) => {
        mocks.updates.push({ values });
        const chain = { eq: () => chain, then: (resolve: (v: unknown) => unknown) => resolve({ error: null }) };
        return chain;
      },
    }),
  }),
}));
vi.mock("@/lib/finance", () => ({ createContribution: mocks.createContribution }));
vi.mock("@/lib/stripe/client", () => ({
  getStripe: () => ({ checkout: { sessions: { create: mocks.sessionsCreate, retrieve: mocks.sessionsRetrieve } } }),
}));

import { POST } from "@/app/api/donate/checkout/route";

let ip = 0;
function checkoutRequest(body: Record<string, unknown>, headers: Record<string, string> = {}) {
  ip += 1;
  return new Request("https://app.example.com/api/donate/checkout", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://app.example.com", "x-real-ip": `192.0.2.${ip}`, ...headers },
    body: JSON.stringify(body),
  });
}

const created = (overrides: Record<string, unknown> = {}) => ({
  ok: true,
  replay: false,
  contributionId: "contrib-1",
  principalCents: 800,
  operationalFeeCents: 40,
  totalChargedCents: 840,
  feeRateBps: 500,
  status: "pending",
  stripeCheckoutSessionId: null,
  ...overrides,
});

beforeEach(() => {
  vi.resetAllMocks();
  mocks.updates.length = 0;
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubEnv("APP_URL", "https://app.example.com");
  mocks.createContribution.mockResolvedValue(created());
  mocks.sessionsCreate.mockResolvedValue({ id: "cs_1", url: "https://checkout.stripe.com/c/cs_1" });
});

describe("POST /api/donate/checkout", () => {
  it("charges principal + fee as itemized line items, and tells the donor the breakdown", async () => {
    const response = await POST(checkoutRequest({ amount_cents: 800 }));
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.url).toBe("https://checkout.stripe.com/c/cs_1");
    expect(payload.breakdown).toEqual({ donation_cents: 800, operational_fee_cents: 40, operational_fee_rate_bps: 500, total_cents: 840 });

    const [params, options] = mocks.sessionsCreate.mock.calls[0];
    const lines = params.line_items.map((line: { price_data: { unit_amount: number; product_data: { name: string } } }) => [line.price_data.product_data.name, line.price_data.unit_amount]);
    expect(lines).toEqual([["Kōkua Counter meal credits (1 meal)", 800], ["Operational fee (5%)", 40]]);
    expect(lines.reduce((sum: number, [, amount]: [string, number]) => sum + amount, 0)).toBe(840);
    expect(params.metadata).toMatchObject({ contribution_id: "contrib-1", donation_cents: "800", operational_fee_cents: "40", fee_rate_bps: "500" });
    expect(options).toEqual({ idempotencyKey: "checkout-session:contrib-1" });
  });

  it("the database is asked to price only the donation the client intended", async () => {
    await POST(checkoutRequest({ amount_cents: 800 }));
    expect(mocks.createContribution).toHaveBeenCalledWith({ donorUserId: null, principalCents: 800, isAnonymous: true, requestKey: null });
  });

  it("rejects client-supplied fee, rate or total fields instead of trusting them", async () => {
    for (const extra of [{ total_cents: 800 }, { operational_fee_cents: 0 }, { fee_rate_bps: 0 }, { total_charged_cents: 1 }, { fee_percent: 0 }]) {
      const response = await POST(checkoutRequest({ amount_cents: 800, ...extra }));
      expect(response.status, JSON.stringify(extra)).toBe(400);
    }
    expect(mocks.createContribution).not.toHaveBeenCalled();
    expect(mocks.sessionsCreate).not.toHaveBeenCalled();
  });

  it("enforces the donation limits and whole dollars server-side", async () => {
    for (const amount of [799, 850, 80_100, -800, 0]) {
      expect((await POST(checkoutRequest({ amount_cents: amount }))).status, String(amount)).toBe(400);
    }
    expect(mocks.createContribution).not.toHaveBeenCalled();
  });

  it("refuses to charge when the donor's expected total no longer matches (fee changed)", async () => {
    mocks.createContribution.mockResolvedValue(created({ operationalFeeCents: 80, totalChargedCents: 880, feeRateBps: 1000 }));
    const response = await POST(checkoutRequest({ amount_cents: 800, expected_total_cents: 840 }));
    expect(response.status).toBe(409);
    const payload = await response.json();
    expect(payload.breakdown).toMatchObject({ total_cents: 880, operational_fee_cents: 80 });
    expect(mocks.sessionsCreate).not.toHaveBeenCalled();
    expect(mocks.updates.some((update) => update.values.failure_reason === "fee_changed")).toBe(true);
  });

  it("an accurate expected total goes through", async () => {
    expect((await POST(checkoutRequest({ amount_cents: 800, expected_total_cents: 840 }))).status).toBe(200);
  });

  it("a repeated request with an open Stripe session returns that session instead of charging again", async () => {
    mocks.createContribution.mockResolvedValue(created({ replay: true, stripeCheckoutSessionId: "cs_existing" }));
    mocks.sessionsRetrieve.mockResolvedValue({ status: "open", url: "https://checkout.stripe.com/c/cs_existing" });
    const response = await POST(checkoutRequest({ amount_cents: 800 }, { "idempotency-key": "attempt-12345678" }));
    expect((await response.json()).url).toBe("https://checkout.stripe.com/c/cs_existing");
    expect(mocks.sessionsCreate).not.toHaveBeenCalled();
    expect(mocks.createContribution.mock.calls[0][0].requestKey).toBe("attempt-12345678");
  });

  it("a repeated request for an already-finished checkout is refused", async () => {
    mocks.createContribution.mockResolvedValue(created({ replay: true, status: "completed", stripeCheckoutSessionId: "cs_done" }));
    expect((await POST(checkoutRequest({ amount_cents: 800 }, { "idempotency-key": "attempt-12345678" }))).status).toBe(409);
    expect(mocks.sessionsCreate).not.toHaveBeenCalled();
  });

  it("rejects a malformed idempotency key", async () => {
    expect((await POST(checkoutRequest({ amount_cents: 800 }, { "idempotency-key": "bad key!" }))).status).toBe(400);
  });

  it("marks the contribution failed (no revenue) when Stripe session creation fails, and hides the detail", async () => {
    mocks.sessionsCreate.mockRejectedValue(new Error("Missing STRIPE_SECRET_KEY"));
    const response = await POST(checkoutRequest({ amount_cents: 800 }));
    const text = await response.text();
    expect(response.status).toBe(500);
    expect(text).not.toContain("STRIPE_SECRET_KEY");
    expect(mocks.updates.some((update) => update.values.status === "failed")).toBe(true);
  });

  it("a legacy 0% rate sends only the donation line", async () => {
    mocks.createContribution.mockResolvedValue(created({ operationalFeeCents: 0, totalChargedCents: 800, feeRateBps: 0 }));
    await POST(checkoutRequest({ amount_cents: 800 }));
    expect(mocks.sessionsCreate.mock.calls[0][0].line_items).toHaveLength(1);
  });

  it("rejects requests from other origins", async () => {
    const response = await POST(checkoutRequest({ amount_cents: 800 }, { origin: "https://evil.example.com" }));
    expect(response.status).toBe(403);
  });
});
