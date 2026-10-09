import type { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import { createMigratedDb } from "./harness";

let db: PGlite;

async function hit(key: string, limit = 3, windowMs = 60_000) {
  const result = await db.query<{ res: { ok: boolean; retry_after_ms: number } }>(
    "SELECT public.rate_limit_hit($1, $2, $3) AS res",
    [key, limit, windowMs],
  );
  return result.rows[0].res;
}

beforeEach(async () => {
  db = await createMigratedDb();
}, 60_000);

describe("shared rate limit (SQL)", () => {
  it("allows up to the limit, then blocks, with a retry hint", async () => {
    expect((await hit("login:1.2.3.4")).ok).toBe(true);
    expect((await hit("login:1.2.3.4")).ok).toBe(true);
    expect((await hit("login:1.2.3.4")).ok).toBe(true);
    const blocked = await hit("login:1.2.3.4");
    expect(blocked.ok).toBe(false);
    expect(blocked.retry_after_ms).toBeGreaterThan(0);
    expect(blocked.retry_after_ms).toBeLessThanOrEqual(60_000);
  });

  it("counts keys independently", async () => {
    for (let i = 0; i < 4; i += 1) await hit("login:a");
    expect((await hit("login:a")).ok).toBe(false);
    expect((await hit("login:b")).ok).toBe(true);
  });

  it("keeps counting exactly under many 'simultaneous' hits and never overflows", async () => {
    const results = await Promise.all(Array.from({ length: 20 }, () => hit("burst", 5)));
    expect(results.filter((r) => r.ok)).toHaveLength(5);
    const row = await db.query<{ hits: number }>("SELECT hits FROM public.rate_limits WHERE key = 'burst'");
    expect(row.rows[0].hits).toBe(6); // capped at limit + 1
  });

  it("starts a fresh window once the old one has expired", async () => {
    for (let i = 0; i < 4; i += 1) await hit("expiring");
    expect((await hit("expiring")).ok).toBe(false);
    await db.query("UPDATE public.rate_limits SET reset_at = now() - interval '1 second' WHERE key = 'expiring'");
    expect((await hit("expiring")).ok).toBe(true);
  });

  it("removes long-expired rows opportunistically", async () => {
    await hit("old-key");
    await db.query("UPDATE public.rate_limits SET reset_at = now() - interval '2 hours' WHERE key = 'old-key'");
    await hit("fresh-key");
    const rows = await db.query("SELECT key FROM public.rate_limits");
    expect(rows.rows.map((r) => (r as { key: string }).key)).toEqual(["fresh-key"]);
  });

  it("truncates very long keys and rejects bad arguments", async () => {
    await hit("x".repeat(300));
    const row = await db.query<{ n: number }>("SELECT max(length(key))::int AS n FROM public.rate_limits");
    expect(row.rows[0].n).toBe(128);
    await expect(db.query("SELECT public.rate_limit_hit('k', 0, 60000)")).rejects.toThrow(/invalid_arguments/);
    await expect(db.query("SELECT public.rate_limit_hit('k', 5, 10)")).rejects.toThrow(/invalid_arguments/);
    await expect(db.query("SELECT public.rate_limit_hit(NULL, 5, 60000)")).rejects.toThrow(/invalid_arguments/);
  });

  it("is not callable or readable by clients", async () => {
    for (const role of ["anon", "authenticated"]) {
      const fn = await db.query<{ ok: boolean }>("SELECT has_function_privilege($1, 'public.rate_limit_hit(text,integer,integer)', 'execute') AS ok", [role]);
      const table = await db.query<{ ok: boolean }>("SELECT has_table_privilege($1, 'public.rate_limits', 'SELECT') AS ok", [role]);
      expect(fn.rows[0].ok, role).toBe(false);
      expect(table.rows[0].ok, role).toBe(false);
    }
  });
});
