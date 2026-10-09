# Kōkua Counter Security & Bug Audit Report
**Date:** 2026-10-08
**Scope:** Static review of the local repo (`main` @ 96b21ae). No live Supabase/Stripe access; RLS and function grants were reviewed from the migration files only, not verified against the deployed database.
**Note:** The stack is Next.js 16 / React 19 (not 14), and `middleware.ts` is now `proxy.ts`.

## Summary
- **Auto-fixed:** 4 (tooling and lint only; no auth, payment or schema code touched)
- **High (escalated, not changed):** 5
- **Medium (documented):** 8
- **Low / hygiene:** 6

## Auto-fixed (this branch)
1. `npm run lint` was broken: `next lint` no longer exists in Next 16, and ESLint 9 ignores `.eslintrc.json`. Added `eslint.config.mjs` (flat config) and changed the script to `eslint .` ([package.json](package.json)). The legacy `.eslintrc.json` is now unused and can be deleted.
2. Unused `Button` import removed ([components/eatery-scanner.tsx](components/eatery-scanner.tsx)).
3. Four unescaped `'` / `"` in JSX text escaped (same file).
4. Unused catch binding removed ([scripts/dev-credit.ts](scripts/dev-credit.ts)).

## High priority (ESCALATED, manual review required)

1. **Settlement RPCs may be callable by any user.** [supabase/migrations/0009_settlements.sql:92-93](supabase/migrations/0009_settlements.sql#L92-L93) revokes EXECUTE from `anon, authenticated` but never from `PUBLIC`, unlike every earlier migration (e.g. 0003 and 0006 do `REVOKE ALL ... FROM PUBLIC`). Postgres grants EXECUTE to PUBLIC by default, and `anon`/`authenticated` inherit it, so `create_settlement` and `mark_settlement_result` (both `SECURITY DEFINER`) are probably reachable through PostgREST `/rpc/`. Impact: an anonymous caller could lock an eatery's redemptions into a bogus "processing" settlement, or mark settlements `paid`/`failed`. **Fix:** new migration with `REVOKE ALL ON FUNCTION ... FROM PUBLIC` for both functions. **Verify now** on the live DB: `select has_function_privilege('anon','public.create_settlement(uuid,timestamptz)','execute');`. Note `0007` also redefines `create_qr_hold`, `redeem_qr` etc. and does revoke from PUBLIC, so those are fine.
2. **Settlement can double-pay.** [app/api/admin/eateries/[id]/settle/route.ts:38-53](app/api/admin/eateries/[id]/settle/route.ts#L38-L53): `markSettlementResult("paid")` is inside the same `try` as `transfers.create`. If the transfer succeeds but the DB call throws, the `catch` marks the settlement `failed`, which releases the redemptions (`settlement_id = NULL`), so the next settlement pays them again. Also the catch's own `markSettlementResult` is unguarded, and the transfer has no idempotency key. **Fix:** separate the transfer from the DB update, pass `idempotencyKey: settlement_id` to Stripe, and only mark failed when the transfer itself failed.
3. **Refund and settlement endpoints have no idempotency/double-submit protection** ([refund/route.ts:71](app/api/admin/contributions/[id]/refund/route.ts#L71)). Two quick admin clicks can create two partial refunds before the webhook updates `refunded_amount_cents`. Add an idempotency key and re-check inside a DB function.
4. **Login rate limit is weak.** [lib/rate-limit.ts](lib/rate-limit.ts) is in-memory and per serverless instance, and keys on the first `x-forwarded-for` value, which a client can spoof if the proxy appends rather than replaces. Effective brute-force protection is lower than the 8/min suggests. Use a shared store (Upstash/Supabase) and a trusted IP source (`x-real-ip` / Vercel's header). The same applies to the donate and school-register limits.
5. **Open redirect via `next` on login.** [app/api/auth/login/route.ts:17-20](app/api/auth/login/route.ts#L17-L20) `safeNext` allows `/\evil.com`, which browsers treat as `//evil.com`; the client then does `window.location.href = redirect` ([login-form.tsx:57](components/login-form.tsx#L57)). `isAllowedRedirect` in [lib/security.ts](lib/security.ts) is stricter (and tested) but is not used here. Reuse it. Touches auth, so not auto-fixed.

## Medium (documented)

1. **Organization/school data lives in `/tmp` JSON files** ([lib/organization-store.ts:4](lib/organization-store.ts#L4)). On Vercel this is ephemeral and per-instance: admin pages and CSV exports will show missing or inconsistent data. `readJson` also overwrites the file with the fallback `[]` on any read/parse error, which silently destroys data. Move to Supabase tables (with RLS).
2. **CSV formula injection.** [lib/csv.ts](lib/csv.ts) doesn't neutralize cells starting with `= + - @`, and the school-registration fields are public input exported to an admin's spreadsheet. Prefix such cells with `'`. Also quote cells containing `\r`.
3. **Config error text leaks to clients.** Checkout ([route.ts:108](app/api/donate/checkout/route.ts#L108)), webhook ([route.ts:84,94](app/api/donate/webhook/route.ts#L84)) and cron ([route.ts:20](app/api/cron/expire-qrs/route.ts#L20)) return `Missing STRIPE_...`/`CRON_SECRET` messages. Return a generic error and log server-side.
4. **Admin create user/eatery returns raw Supabase error messages** ([users/route.ts:50](app/api/admin/users/route.ts#L50), [eateries/route.ts:60](app/api/admin/eateries/route.ts#L60)); this enables account enumeration (admin-only, low risk). Also no rollback: if the profile/eatery insert fails, the auth user is left orphaned.
5. **Duplicate and diverging security headers.** [next.config.mjs](next.config.mjs) sets a static CSP (`script-src 'self'` with no nonce) while [proxy.ts](proxy.ts) sets a nonce-based CSP on the same responses. Two CSPs are enforced together (intersection). Pick one; the `next.config` copy appears redundant.
6. **Sign-out CSRF check allows missing Origin** ([app/auth/signout/route.ts:6](app/auth/signout/route.ts#L6)); `proxy.ts` already enforces origin on POST, so this is defense in depth only.
7. **Webhook swallows all errors** ([webhook route:130](app/api/donate/webhook/route.ts#L130)): returns 500 (so Stripe retries, which is correct) but logs nothing, making failed credits hard to diagnose. Add server-side logging without PII.
8. **Admin list endpoints / pages have no pagination** (not verified in the page components; the route handlers reviewed have none).

## Low / hygiene
- 13 `console.log` debug lines in [components/eatery-scanner.tsx](components/eatery-scanner.tsx) (added deliberately in recent camera-debugging commits; remove once resolved).
- `k-kua-counter-oct-6-2026-6-56-01-pm/` (29 files, an AI Studio Vite prototype) is committed and unused. Remove or move out of the repo.
- Hardcoded recipient `alifnabulla@gmail.com` in [schools/register/route.ts:76](app/api/schools/register/route.ts#L76); make it an env var. Source also contains raw control characters in a regex on line 66 (works, but unreadable; use `/[^\x00-\x7f]/g`).
- `.env.example` is missing `APP_URL`, `RESEND_API_KEY`, `EMAIL_FROM`, `KOKUA_DATA_DIR`, all of which the code reads. It also lists `NEXT_PUBLIC_APP_URL`, which the code doesn't use.
- Remaining lint errors, not auto-fixed: `react-hooks/set-state-in-effect` in [student-meal-pass.tsx:130](components/student-meal-pass.tsx#L130) (behavioral change), `require()` in [scripts/enable-stripe-connect.js](scripts/enable-stripe-connect.js) and [tailwind.config.ts:58](tailwind.config.ts#L58), unused `request` in the Connect onboard route (payments file, left alone).
- `vitest` is in `dependencies` rather than `devDependencies`. [vitest.config.ts](vitest.config.ts) triggers a Vite CJS-config warning.

## Checked and found OK
- No secrets in tracked files or git history (grep for Stripe/Supabase/Resend/AWS patterns; only test fixtures and docs matched). `.env.local` and `.env.vercel` are gitignored.
- Stripe webhook verifies the signature on the raw body and rejects when the secret or header is missing; checkout amount/currency is cross-checked against the DB before crediting.
- All `/api/admin/*`, QR, and Connect routes enforce role via `requireApiRole`; `loadUser` also checks `is_active` and email confirmation for students.
- Dev login is gated on non-production and `ENABLE_DEV_LOGIN`, with a second gate in `proxy.ts`.
- QR tokens: 128 bits of randomness, stored only as SHA-256 hashes; redemption and scan-failure throttling are in DB functions.
- Cron endpoint uses a timing-safe bearer comparison.
- No raw SQL in app code (all PostgREST/RPC), no `dangerouslySetInnerHTML`, no `any` types.
- RLS is enabled on every table with select-own policies and no write policies for `authenticated`. `pool_ledger` is revoked from clients. All other `SECURITY DEFINER` functions pin `search_path` and revoke from PUBLIC (except the two in finding H1).
- `npm audit --omit=dev`: 0 vulnerabilities.

## Tests
- ESLint: ❌ 4 errors, 1 warning remain (was: command unusable)
- TypeScript (`tsc --noEmit`): ✅ Pass
- Unit tests: ✅ 10/10
- Build: ✅ Success
- Not run: integration tests against Supabase, Stripe webhook replay, `check:secrets`.

## Recommended next steps
1. Check finding H1 against the live database today; if confirmed, ship the REVOKE migration first.
2. Fix H2 (settlement double-pay) and add Stripe idempotency keys.
3. Reuse `isAllowedRedirect` in login (H5) and move rate limiting to a shared store (H4).
4. Replace the `/tmp` JSON store with Supabase tables.
5. Test any payment/auth change with Stripe CLI webhooks in a preview deployment before production.
