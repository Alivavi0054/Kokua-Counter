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

- **Public endpoints** (sign-in, donation checkout, school registration) use a limiter shared by every
  serverless instance: `rateLimitShared()` in `lib/rate-limit-shared.ts`, backed by the `rate_limits` table and
  the atomic `rate_limit_hit` SQL function (migration 0013, service role only). Counts are exact even under
  concurrent requests. If the database is unreachable it **fails open** to the per-instance limiter below (and logs
  it) so an outage cannot lock every visitor out.
- **Authenticated routes** (admin tools, QR generate/redeem/status) still use the in-memory limiter in
  `lib/rate-limit.ts`. It is per instance and resets on cold start, so treat it as a speed bump; these routes are
  also protected by role checks and, for passes, by database-enforced daily limits.
- The client key comes from `getClientIp()` in `lib/security.ts`: `x-vercel-forwarded-for`, then `x-real-ip` (both
  set by the platform), then the **last** `x-forwarded-for` entry. The first `x-forwarded-for` entry is
  client-controlled and is never trusted. Without any valid IP the key is `local`, so all such requests share one bucket.
- Supabase Auth also has its own rate limits and CAPTCHA settings that apply across instances; keep them enabled.

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
