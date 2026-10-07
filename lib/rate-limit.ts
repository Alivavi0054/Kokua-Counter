type Bucket = { count: number; resetAt: number };

const MAX_BUCKETS = 10_000;
const buckets = new Map<string, Bucket>();

export type RateLimitResult = { ok: true } | { ok: false; retryAfterMs: number };

function pruneExpiredBuckets(now: number) {
  buckets.forEach((bucket, key) => {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  });

  if (buckets.size > MAX_BUCKETS) {
    const entries = Array.from(buckets.entries()).sort((a, b) => a[1].resetAt - b[1].resetAt);
    const overflow = entries.slice(0, buckets.size - MAX_BUCKETS);
    overflow.forEach(([key]) => {
      buckets.delete(key);
    });
  }
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): RateLimitResult {
  if (!Number.isFinite(limit) || limit <= 0) {
    return { ok: true };
  }

  const normalizedKey = key.slice(0, 128);
  pruneExpiredBuckets(now);

  const current = buckets.get(normalizedKey);
  if (!current || current.resetAt <= now) {
    buckets.set(normalizedKey, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }

  if (current.count >= limit) {
    return { ok: false, retryAfterMs: Math.max(0, current.resetAt - now) };
  }

  current.count += 1;
  return { ok: true };
}
