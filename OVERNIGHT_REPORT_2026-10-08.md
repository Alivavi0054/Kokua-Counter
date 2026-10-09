# Overnight report, 2026-10-08

Branch: `overnight/improvements-2026-10-08` (from `audit/security-fixes-2026-10-08`). Nothing pushed, deployed or applied to any database.

## Summary

Every item on the work list is done and committed (15 commits). At the end: `tsc` clean, `eslint .` exits 0 (was 4 errors, 1 warning), 44 unit tests pass (was 10), `npm run build` succeeds, `npm audit --omit=dev` reports 0 vulnerabilities.

Two migrations are waiting for you: **0010** (revoke settlement RPCs from PUBLIC) and **0011** (organizations and school registrations tables). Code that uses 0011 will fail on the admin Organizations and Registrations pages until you apply it. The school form keeps working without it.

## Start here (risky or needs a human)

1. **Apply 0010 first.** The settlement RPCs may be callable by anyone right now. Check on the live DB: `select has_function_privilege('anon','public.create_settlement(uuid,timestamptz)','execute');` If it returns `true`, you are exposed today.
2. **Settlement behavior changed on purpose** (see decisions). If Stripe's response is ambiguous (connection or 5xx error), the settlement now stays `processing` with its redemptions locked, and the admin sees "do not retry, reconcile manually". There is no UI or script for reconciling yet. Review `lib/settlement.ts`.
3. **There is no cron schedule.** The repo has no `vercel.json`, so nothing calls `/api/cron/expire-qrs`. Expired QR holds may never be released. See "Vercel recon".
4. **Apply 0011 before the next deploy**, or `/admin/organizations` and `/admin/registrations` will error (they now throw on storage errors instead of silently showing an empty list).
5. The README (line ~34) still says "the app does not transfer money to eateries", which is no longer true because the settle route pays out via Stripe Connect. I left that wording alone.

## Items

| # | Item | Status | Commit |
|---|------|--------|--------|
| 1.1 | Migration 0010 revoking settlement RPCs from PUBLIC/anon/authenticated, service_role grants kept; privilege assertion added to `supabase/tests/accounting.sql` | Done | 900d066 |
| 1.2 | Settle route: `lib/settlement.ts` (`settleEatery`), Stripe `idempotencyKey = settlement_id`, only marks `failed` when the transfer failed, mark-paid failure no longer releases redemptions, guarded failure path; 6 unit tests | Done | dda87bb |
| 1.3 | Refund idempotency key from contribution id + amount + refunded_amount_cents (`lib/refund.ts`) + tests | Done | cf53a54 |
| 1.4 | Login uses `isAllowedRedirect`; it now rejects backslashes, control characters, percent-encoded `%5C`/`%09`/`%0a`/`%0d`/`%00`, decoded `//`; tests for `/\evil.com`, `//evil.com`, `/%5Cevil.com`, `https://evil.com` and more | Done | cf53a54 |
| 1.5 | Checkout, webhook, cron return generic errors; detail is `console.error`ed (`lib/errors.ts` `describeError`). Webhook failures now log event id/type. | Done | 6f967a9 |
| 1.6 | CSV formula neutralization (`= + - @ \t \r` get a leading `'`, strings only) and `\r` quoting + tests | Done | aa015e8 |
| 1.7 | Static CSP removed from `next.config.mjs`; `proxy.ts` is the only CSP. Verified on a production build with dummy env | Done | 524d55a |
| 2.1 | Migration 0011 + `types/database.ts` + `lib/organization-store.ts` on Supabase (same exports/shapes), no destructive overwrite, `data/*.json` removed, tests | Done | 907c609 |
| 2.2 | Admin create user/eatery: generic errors, rollback of the auth user on any later failure (`lib/admin-accounts.ts`), 9 tests with a mocked admin client | Done | ad37a04 |
| 3.1 | `getClientIp` in `lib/security.ts`, used by login, donate checkout, school register; `docs/SECURITY.md` rate-limit section | Done | d6f45f9 |
| 4.1 | ESLint clean: commented disable in `student-meal-pass.tsx`; `enable-stripe-connect.js` renamed to `.mjs` (ESM); `tailwind.config.ts` imports the plugin; unused `request` removed | Done | d6b5069 |
| 4.2 | Debug `console.log` removed from the scanner | Done | ae8af7a |
| 4.3 | Stray prototype folder and `.eslintrc.json` removed; vitest to devDependencies; `vitest.config.mts` (CJS warning gone) | Done | bd938be |
| 4.4 | `SCHOOL_REGISTRATION_TO_EMAIL`, sender sanitized with `/[^\x20-\x7e]/g`, subject control chars stripped, 4 route tests | Done | 52b0415 |
| 4.5 | `.env.example` completed, README fixed (Next 16, Node 20.9+, `APP_URL`) | Done | fbf050d |
| 5.1 | Tests for every changed behavior; `npx eslint .` added to `.github/workflows/security.yml` | Done | 3780372 (plus tests in each commit above) |

## Vercel recon (read-only)

The `/Vercel:*` prompts (system_instructions, quick_status, project_health_check, fix_recent_build, optimize_deployment) were not available as callable prompts in this unattended session. I used the read-only Vercel tools directly instead (list teams/projects/deployments, get project, list env vars). I did not run optimize_deployment or project_health_check, so there are no recommendations to report. Nothing was created, changed or deployed on Vercel.

- Team `kokua-counter` (`team_l7mg8PJ7Hy34Tcz2XApAroxa`), project `kokua-counter` (`prj_zYdQUrYM98yTtVF8lIhGid8k85Aq`), Next.js, Node 24.x.
- Latest production deployment `dpl_7mKsbTBT6f3aU6kRedpXBroF1RJh` is READY, built from `main` at 96b21ae. The last 8 deployments are all READY; no failed builds, so fix_recent_build had nothing to diagnose. All deployments are from `main`; I saw no preview deployments.
- Domains: `kokuacounter.app`, `www.kokuacounter.app`, plus the vercel.app aliases. SSO protection is on for everything except custom domains. Password protection is off.
- **Runtime logs: not available.** The log API refused every window ("Hobby plan does not retain runtime logs for the requested time range"), so I could not check `/api/donate/*`, `/api/qr/*`, `/api/auth/login`, `/api/cron/expire-qrs` or `/api/eatery/connect/onboard` for errors. Please check them in the Vercel dashboard.
- **No cron schedule:** there is no `vercel.json`. Unless you configured a schedule elsewhere (Vercel Cron needs a `crons` entry), `/api/cron/expire-qrs` is never called. On Hobby, cron jobs can run at most once per day. I did not add one because it is not in the work list.

### Env var names on Vercel (production and preview; values not read)

Present: `APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PROJECT_REF`, `DATABASE_URL`, `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `CRON_SECRET`, `MEAL_VALUE_CENTS`, `ENABLE_DEV_LOGIN`.

- **Missing, but the code reads them:** `SCHOOL_REGISTRATION_TO_EMAIL` (new, required for the registration email), `RESEND_API_KEY`, `EMAIL_FROM` (optional; has a default). Without `RESEND_API_KEY` or `SCHOOL_REGISTRATION_TO_EMAIL` no registration email is sent. Registrations are still saved once 0011 is applied.
- Optional, not set (defaults apply): `MEALS_PER_DAY`, `PASSES_GENERATED_PER_DAY`, `EATERY_DAILY_LIMIT`.
- **Unused by the code:** `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (Checkout is a hosted redirect), `MEAL_VALUE_CENTS` (hardcoded to 800), `SUPABASE_PROJECT_REF` and `DATABASE_URL` (only for local scripts, not needed at runtime; `DATABASE_URL` is a secret that could be removed from Vercel). They are harmless, but removing `DATABASE_URL` from Vercel reduces exposure.
- `ENABLE_DEV_LOGIN` exists in production and preview. I could not see its value. The code ignores it when `NODE_ENV=production`, but consider deleting it from Vercel.
- `KOKUA_DATA_DIR` is no longer read by anything.

## Decisions I made for you

- **Ambiguous Stripe errors leave the settlement `processing`.** Only definitive rejections (invalid request, card, auth, etc.) mark `failed` and release redemptions. `StripeConnectionError` and `StripeAPIError` are treated as "money may have moved", because releasing then could double-pay. Cost: a stuck `processing` settlement needs manual reconciliation. The idempotency key means re-running the same settlement id is safe, but no retry path exists yet.
- The settle route gets the Stripe client before creating the settlement, so a Stripe config problem returns 503 without locking redemptions.
- A "needs reconciliation" response returns HTTP 500 with `settlement_id` and `transfer_id` so the admin can find it in Stripe.
- `isAllowedRedirect` is stricter than asked: it also rejects control characters and any `..`, including percent-decoded. An absent `next` still falls back to the role-based landing page.
- `getClientIp` order: `x-vercel-forwarded-for`, `x-real-ip`, then the **last** `x-forwarded-for` entry; values must be valid IPs, otherwise the key is `local` (all such requests share one bucket).
- The rate-limit store stays in-memory and synchronous. The Upstash path needs `rateLimit()` to become async; that is documented in `docs/SECURITY.md`, not implemented.
- CSV: only string cells get the apostrophe prefix, so real negative numbers (e.g. -500) are unchanged.
- CSP: the non-CSP headers stay in `next.config.mjs` so static assets (not matched by `proxy.ts`) keep them. Static assets never had a useful CSP.
- Org/registration lists are capped at 1000 rows (PostgREST default made explicit); there is still no pagination.
- Cron misconfiguration still returns 401, now with the generic "Unauthorized." body and a server log.
- `enable-stripe-connect.js` became `.mjs` and the `setup:connect` script was updated. Note this script reads `.env.local` itself; I did not run it.
- `.env.example`: removed `NEXT_PUBLIC_APP_URL` (README and code disagreed; the code reads `APP_URL`, so the README was wrong), `MEAL_VALUE_CENTS` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`. `scripts/smoke.ts` now reads `APP_URL`.
- `package-lock.json` was regenerated with `npm install --package-lock-only`. Besides vitest becoming a dev dependency it picked up some optional bundled wasm entries from `@tailwindcss/oxide-wasm32-wasi`; harmless.
- I verified the CSP by building and serving a copy of the repo in my scratch directory without any `.env*` files, using dummy Supabase values. The server was stopped afterwards. `npm run build` in the repo itself will load `.env.local` as Next normally does; I passed dummy `NEXT_PUBLIC_SUPABASE_*`/`APP_URL` in the shell and never printed or opened it.

## Things you must do manually

1. Apply migration **0010**, then **0011**, to Supabase (e.g. in the SQL editor or `supabase db push`, your call). I did not apply them.
2. Verify the privilege: `select has_function_privilege('anon','public.create_settlement(uuid,timestamptz)','execute');` should return `false` after 0010. `npm run verify` now also asserts this (it needs `DATABASE_URL`).
3. Add `SCHOOL_REGISTRATION_TO_EMAIL` in Vercel (production and preview), and `RESEND_API_KEY` / `EMAIL_FROM` if you want the email.
4. Test the Stripe flows with the Stripe CLI against a **preview** deploy before production: `stripe listen --forward-to https://<preview>/api/donate/webhook`, a test checkout, a refund (click twice quickly to confirm only one refund is created), and a settlement to a test Connect account. I only tested with mocks.
5. Decide on a cron schedule for `/api/cron/expire-qrs` (add `vercel.json` `crons`, or an external caller with `Authorization: Bearer <CRON_SECRET>`).
6. Check runtime logs in the dashboard (unavailable to me), and consider deleting `ENABLE_DEV_LOGIN` and `DATABASE_URL` from Vercel.

## Not done / left as is

- Audit item "Sign-out CSRF check allows missing Origin" (defense in depth only; `proxy.ts` already enforces origin on POST).
- Pagination for admin lists.
- A shared rate-limit store (documented upgrade path only; no new dependencies, per instructions).
- A reconciliation tool/UI for stuck `processing` settlements.
- The DB-level re-check inside a function for refunds (the audit mentioned it; I only added the idempotency key as requested).
- `CLAUDE_AUDIT_PROMPT.md` was left untracked and untouched. `GEMINI_STRIPE_PROMPT.md` does not exist in the repo.
