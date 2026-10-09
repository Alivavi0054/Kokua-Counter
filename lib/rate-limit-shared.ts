import "server-only";
import { describeError } from "@/lib/errors";
import { rateLimit, type RateLimitResult } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

let lastWarning = 0;

/**
 * Rate limit shared by every serverless instance (database-backed). Use it for public endpoints where
 * per-instance counters would let an attacker simply spread requests across instances.
 *
 * If the database is unreachable it FAILS OPEN to the per-instance limiter rather than locking every
 * visitor out of sign-in or checkout; the failure is logged (at most once a minute).
 */
export async function rateLimitShared(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  try {
    const { data, error } = await createAdminClient().rpc("rate_limit_hit", {
      p_key: key,
      p_limit: limit,
      p_window_ms: windowMs,
    });
    if (error) throw error;
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("unexpected_rate_limit_payload");
    const payload = data as { ok?: unknown; retry_after_ms?: unknown };
    if (payload.ok === true) return { ok: true };
    return { ok: false, retryAfterMs: Number(payload.retry_after_ms) || windowMs };
  } catch (error) {
    if (Date.now() - lastWarning > 60_000) {
      lastWarning = Date.now();
      console.error("rate-limit: shared limiter unavailable, using per-instance fallback", describeError(error));
    }
    return rateLimit(key, limit, windowMs);
  }
}
