import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc }) }));

import { rateLimitShared } from "@/lib/rate-limit-shared";

beforeEach(() => {
  rpc.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("rateLimitShared", () => {
  it("returns the database's decision", async () => {
    rpc.mockResolvedValueOnce({ data: { ok: true, retry_after_ms: 0 }, error: null });
    expect(await rateLimitShared("k1", 5, 60_000)).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("rate_limit_hit", { p_key: "k1", p_limit: 5, p_window_ms: 60_000 });

    rpc.mockResolvedValueOnce({ data: { ok: false, retry_after_ms: 4200 }, error: null });
    expect(await rateLimitShared("k1", 5, 60_000)).toEqual({ ok: false, retryAfterMs: 4200 });
  });

  it("fails open to the per-instance limiter when the database errors, and still enforces that limit", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "db down" } });
    expect(await rateLimitShared("fallback-key", 2, 60_000)).toEqual({ ok: true });
    expect(await rateLimitShared("fallback-key", 2, 60_000)).toEqual({ ok: true });
    expect((await rateLimitShared("fallback-key", 2, 60_000)).ok).toBe(false);
  });

  it("falls back when the client throws or returns a malformed payload", async () => {
    rpc.mockRejectedValueOnce(new Error("network"));
    expect((await rateLimitShared("throw-key", 1, 60_000)).ok).toBe(true);
    rpc.mockResolvedValueOnce({ data: "nope", error: null });
    expect((await rateLimitShared("bad-key", 1, 60_000)).ok).toBe(true);
  });
});
