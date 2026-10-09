import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  role: "admin" as string | null,
  rows: { pool_ledger: [] as unknown[], operations_ledger: [] as unknown[] },
  calls: [] as Array<{ table: string; method: string; args: unknown[] }>,
  audit: vi.fn(),
}));

vi.mock("@/lib/auth/guards", async () => {
  const { NextResponse } = await import("next/server");
  return {
    requireApiRole: async (required: string) =>
      !mocks.role
        ? { ok: false, response: NextResponse.json({ error: "Sign in required." }, { status: 401 }) }
        : mocks.role !== required
          ? { ok: false, response: NextResponse.json({ error: "Not permitted." }, { status: 403 }) }
          : { ok: true, user: { id: "admin-1" } },
  };
});
vi.mock("@/lib/rate-limit", () => ({ rateLimit: () => ({ ok: true }) }));
vi.mock("@/lib/audit", () => ({ recordAdminAction: mocks.audit }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: "pool_ledger" | "operations_ledger") => {
      const chain: Record<string, unknown> = {};
      for (const method of ["select", "gte", "lt", "order"]) {
        chain[method] = (...args: unknown[]) => {
          mocks.calls.push({ table, method, args });
          return chain;
        };
      }
      chain.range = async (...args: unknown[]) => {
        mocks.calls.push({ table, method: "range", args });
        return { data: mocks.rows[table], error: null };
      };
      return chain;
    },
  }),
}));

import { GET } from "@/app/api/admin/finance/export/route";

const get = (query: string) => GET(new Request(`https://app.example.com/api/admin/finance/export${query}`));

beforeEach(() => {
  mocks.role = "admin";
  mocks.calls.length = 0;
  mocks.audit.mockReset();
  mocks.rows.pool_ledger = [{ created_at: "2026-10-05T20:00:00Z", entry_type: "credit", amount_cents: 800, contribution_id: "c1", reference_key: "k1" }];
  mocks.rows.operations_ledger = [{ created_at: "2026-10-05T20:00:00Z", entry_type: "fee_charge", amount_cents: 40, contribution_id: "c1", refund_id: null, reference_key: "k2" }];
});

describe("GET /api/admin/finance/export", () => {
  it("is admin-only", async () => {
    for (const role of [null, "student", "eatery"]) {
      mocks.role = role;
      expect((await get("?month=2026-10")).status).toBe(role ? 403 : 401);
    }
    expect(mocks.calls).toHaveLength(0);
  });

  it("rejects missing or malformed months without querying", async () => {
    for (const query of ["", "?month=", "?month=2026-13", "?month=oct", "?month=2026-10-01"]) {
      expect((await get(query)).status, query).toBe(400);
    }
    expect(mocks.calls).toHaveLength(0);
  });

  it("returns a no-store CSV for the Hawaii month and audits the export", async () => {
    const response = await get("?month=2026-10&view=summary");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="kokua-counter-summary-2026-10.csv"');
    expect(response.headers.get("cache-control")).toBe("no-store");
    const text = await response.text();
    expect(text).toContain("Operational fees charged,0.4,40");
    expect(text).toContain("Donations received,8,800");

    const gte = mocks.calls.find((call) => call.method === "gte");
    const lt = mocks.calls.find((call) => call.method === "lt");
    expect(gte?.args).toEqual(["created_at", "2026-10-01T10:00:00.000Z"]);
    expect(lt?.args).toEqual(["created_at", "2026-11-01T10:00:00.000Z"]);
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "export.finance", details: { month: "2026-10", view: "summary", rows: 2 } }));
  });

  it("defaults to the entry-level view", async () => {
    const text = await (await get("?month=2026-10")).text();
    expect(text.split("\n")[0]).toContain("Entry type");
    expect(text.split("\n")).toHaveLength(3);
  });
});
