type Bucket = { count: number; resetAt: number };

export type RateLimitResult = { ok: true } | { ok: false; retryAfterMs: number };

export interface RateLimitStore {
  get(key: string): Bucket | undefined;
  set(key: string, value: Bucket): void;
  delete(key: string): void;
  pruneExpired?(now: number): void;
  entries?(): Array<[string, Bucket]>;
  size?(): number;
}

class MemoryRateLimitStore implements RateLimitStore {
  private readonly buckets = new Map<string, Bucket>();
  private readonly maxBuckets = 10_000;

  get(key: string): Bucket | undefined {
    return this.buckets.get(key);
  }

  set(key: string, value: Bucket): void {
    this.buckets.set(key, value);
  }

  delete(key: string): void {
    this.buckets.delete(key);
  }

  entries(): Array<[string, Bucket]> {
    return Array.from(this.buckets.entries());
  }

  size(): number {
    return this.buckets.size;
  }

  pruneExpired(now: number): void {
    this.buckets.forEach((bucket, key) => {
      if (bucket.resetAt <= now) {
        this.buckets.delete(key);
      }
    });

    if (this.buckets.size > this.maxBuckets) {
      const entries = Array.from(this.buckets.entries()).sort((a, b) => a[1].resetAt - b[1].resetAt);
      const overflow = entries.slice(0, this.buckets.size - this.maxBuckets);
      overflow.forEach(([key]) => {
        this.buckets.delete(key);
      });
    }
  }
}

export function createRateLimiter(store: RateLimitStore = new MemoryRateLimitStore()) {
  return function rateLimit(
    key: string,
    limit: number,
    windowMs: number,
    now = Date.now(),
  ): RateLimitResult {
    if (!Number.isFinite(limit) || limit <= 0) {
      return { ok: true };
    }

    const normalizedKey = key.slice(0, 128);
    store.pruneExpired?.(now);

    const current = store.get(normalizedKey);
    if (!current || current.resetAt <= now) {
      store.set(normalizedKey, { count: 1, resetAt: now + windowMs });
      return { ok: true };
    }

    if (current.count >= limit) {
      return { ok: false, retryAfterMs: Math.max(0, current.resetAt - now) };
    }

    current.count += 1;
    return { ok: true };
  };
}

export const rateLimit = createRateLimiter();
