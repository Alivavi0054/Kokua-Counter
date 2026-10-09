import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  role: "admin" as "admin" | "student" | "eatery" | null,
  setOperationalFeeRate: vi.fn(),
  startRefund: vi.fn(),
}));

vi.mock("@/lib/auth/guards", async () => {
  const { NextResponse } = await import("next/server");
  return {
    requireApiRole: async (required: string) => {
      if (!mocks.role) return { ok: false, response: NextResponse.json({ error: "Sign in required." }, { status: 401 }) };
      if (mocks.role !== required) return { ok: false, response: NextResponse.json({ error: "Not permitted." }, { status: 403 }) };
      return { ok: true, user: { id: "admin-1" } };
    },
  };
});
vi.mock("@/lib/rate-limit", () => ({ rateLimit: () => ({ ok: true }) }));
vi.mock("@/lib/finance", () => ({
  setOperationalFeeRate: mocks.setOperationalFeeRate,
  getCurrentFeeRateBps: vi.fn().mockResolvedValue(500),
  listFeeSettings: vi.fn().mockResolvedValue([]),
  databaseRefundDeps: () => ({}),
}));
vi.mock("@/lib/refunds", () => ({ startRefund: mocks.startRefund }));
vi.mock("@/lib/stripe/client", () => ({ getStripe: () => ({}) }));

import { POST as postRefund } from "@/app/api/admin/contributions/[id]/refund/route";
import { GET as getFees, POST as postFee } from "@/app/api/admin/fee-settings/route";

const CONTRIBUTION = "22222222-2222-4222-8222-222222222222";
const json = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`https://app.example.com${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://app.example.com", ...headers },
    body: JSON.stringify(body),
  });
const refundParams = { params: Promise.resolve({ id: CONTRIBUTION }) };

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.role = "admin";
  mocks.setOperationalFeeRate.mockResolvedValue({ ok: true });
});

describe("fee settings authorization and validation", () => {
  it("only administrators can read or change the fee", async () => {
    for (const role of [null, "student", "eatery"] as const) {
      mocks.role = role;
      expect((await postFee(json("/api/admin/fee-settings", { rate_bps: 0 }))).status).toBe(role ? 403 : 401);
      expect((await getFees()).status).toBe(role ? 403 : 401);
    }
    expect(mocks.setOperationalFeeRate).not.toHaveBeenCalled();
  });

  it("accepts a valid rate and records who changed it", async () => {
    const response = await postFee(json("/api/admin/fee-settings", { rate_bps: 750, note: "Hosting costs" }));
    expect(response.status).toBe(200);
    expect(mocks.setOperationalFeeRate).toHaveBeenCalledWith({ rateBps: 750, effectiveAt: null, createdBy: "admin-1", note: "Hosting costs" });
  });

  it("rejects invalid rates and unknown fields", async () => {
    for (const body of [{ rate_bps: -1 }, { rate_bps: 2001 }, { rate_bps: 5.5 }, { rate_bps: "500" }, {}, { rate_bps: 500, extra: 1 }]) {
      expect((await postFee(json("/api/admin/fee-settings", body))).status, JSON.stringify(body)).toBe(400);
    }
    expect(mocks.setOperationalFeeRate).not.toHaveBeenCalled();
  });

  it("surfaces a back-dated change as a validation error", async () => {
    mocks.setOperationalFeeRate.mockResolvedValue({ ok: false, errorCode: "effective_in_past" });
    const response = await postFee(json("/api/admin/fee-settings", { rate_bps: 500, effective_at: "2020-01-01T00:00:00Z" }));
    expect(response.status).toBe(400);
  });
});

describe("refund endpoint authorization and mapping", () => {
  it("donors, students, eateries and anonymous callers cannot refund anything", async () => {
    for (const role of [null, "student", "eatery"] as const) {
      mocks.role = role;
      expect((await postRefund(json("/x", {}), refundParams)).status).toBe(role ? 403 : 401);
    }
    expect(mocks.startRefund).not.toHaveBeenCalled();
  });

  it("passes the admin, amount, reason and idempotency key to the workflow", async () => {
    mocks.startRefund.mockResolvedValue({ status: "started", refundId: "r1", replay: false, amountCents: 420, principalCents: 400, feeCents: 20, stripeRefundId: "re_1" });
    const response = await postRefund(json("/x", { amount_cents: 420, reason: "Duplicate gift" }, { "idempotency-key": "click-12345678" }), refundParams);
    expect(response.status).toBe(200);
    expect(mocks.startRefund.mock.calls[0][0]).toEqual({ contributionId: CONTRIBUTION, amountCents: 420, reason: "Duplicate gift", requestedBy: "admin-1", idempotencyRef: "click-12345678" });
    expect((await response.json()).refund).toEqual({ total_cents: 420, donation_cents: 400, operational_fee_cents: 20 });
  });

  it("maps rejections, failures and unknown outcomes to clear statuses", async () => {
    const cases: Array<[Record<string, unknown>, number]> = [
      [{ status: "rejected", errorCode: "exceeds_remaining" }, 400],
      [{ status: "rejected", errorCode: "disputed" }, 409],
      [{ status: "rejected", errorCode: "not_found" }, 404],
      [{ status: "failed", refundId: "r1" }, 502],
      [{ status: "needs_reconciliation", refundId: "r1" }, 202],
    ];
    for (const [result, status] of cases) {
      mocks.startRefund.mockResolvedValue(result);
      expect((await postRefund(json("/x", {}), refundParams)).status, JSON.stringify(result)).toBe(status);
    }
  });

  it("rejects malformed bodies, ids and keys without touching the workflow", async () => {
    expect((await postRefund(json("/x", { amount_cents: -5 }), refundParams)).status).toBe(400);
    expect((await postRefund(json("/x", { amount_cents: 100, unknown: true }), refundParams)).status).toBe(400);
    expect((await postRefund(json("/x", {}, { "idempotency-key": "short" }), refundParams)).status).toBe(400);
    expect((await postRefund(json("/x", {}), { params: Promise.resolve({ id: "not-a-uuid" }) })).status).toBe(400);
    expect(mocks.startRefund).not.toHaveBeenCalled();
  });

  it("never leaks internal failures to the caller", async () => {
    mocks.startRefund.mockRejectedValue(new Error("connection string postgres://secret"));
    const response = await postRefund(json("/x", {}), refundParams);
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("postgres://");
  });
});
