# Security overview

## Threat model

This project handles student meal access, donations, and a small ledger. The primary risks are:

- donor fraud and card testing
- QR token theft or replay
- privilege escalation via role changes or client-side manipulation
- account enumeration or login abuse
- webhook forgery and replay
- data leakage to unauthenticated users

## Route guard table

| Route | Guard | Notes |
| --- | --- | --- |
| /student/* | requireRole("student") | Student-only access |
| /eatery/* | requireRole("eatery") | Eatery-only access |
| /admin | requireRole("admin") | Admin-only metrics |
| /api/auth/login | rate-limited + Supabase auth | Generic error messages |
| /api/qr/generate | requireApiRole("student") | 429 retry window |
| /api/qr/redeem | requireApiRole("eatery") | eatery-scoped validation |
| /api/donate/checkout | IP-based rate limit | donation abuse controls |
| /api/donate/webhook | Stripe signature validation | replay window enforcement |
| /api/cron/expire-qrs | CRON secret + timingSafeEqual | cron-only access |

## Controls

- Server-only secrets remain in server modules only.
- All ledger writes flow through service-role SQL functions.
- QR tokens are hashed before storage.
- Origin verification is enforced for state-changing requests.
- Sensitive routes use strict JSON parsing with size caps.

## Rate limiting

- `lib/rate-limit.ts` uses an **in-memory store per server instance** by default. On Vercel every
  serverless instance has its own counters and they reset on cold start, so the real limit is
  higher than the configured number (e.g. login 8/min per instance, not 8/min overall). It slows
  casual abuse but is not a hard brute-force defence.
- The client key comes from `getClientIp()` in `lib/security.ts`: `x-vercel-forwarded-for`, then
  `x-real-ip` (both set by the platform), then the **last** `x-forwarded-for` entry. The first
  `x-forwarded-for` entry is client-controlled and is never trusted. Without any valid IP the key
  is `local`, which means all such requests share one bucket.
- The store sits behind the `RateLimitStore` interface and `createRateLimiter(store)`. To get shared
  limits without new infrastructure code in the routes, the upgrade path is Upstash Redis (or any
  Redis): implement a store, or use `@upstash/ratelimit` directly, backed by `UPSTASH_REDIS_REST_URL`
  and `UPSTASH_REDIS_REST_TOKEN`. Note the current interface is synchronous, so a network-backed store
  requires making `rateLimit()` async and `await`ing it in the callers (login, donate checkout,
  school register and the admin routes). A Supabase table with an atomic upsert RPC is an
  alternative that needs no new vendor. Neither is implemented yet and no new dependency was added.
- For brute-force protection on login, also consider Supabase Auth's built-in rate limits and
  CAPTCHA settings, which are shared across instances.

## Secret rotation

- Rotate Stripe secrets and the cron secret in the deployment environment.
- Rotate Supabase service-role keys and reissue app URLs after any incident.
- Revoke and regenerate any leaked client or webhook secrets immediately.

## Incident response checklist

1. Disable or rotate compromised credentials.
2. Review rate-limit and failed-scan event logs.
3. Check the append-only ledger to confirm no unauthorized credit or refund entries.
4. Verify active QR and donation activity for unusual spikes.
5. Re-deploy with the latest patched dependencies and secrets.

## Known limits

- This project intentionally does not expose a general-purpose public API.
- Production deployment should use a managed Supabase project and hardened infrastructure.
- QR-based access remains dependent on valid mobile/camera support and HTTPS or localhost.
