# Kōkua Counter

## Integration audit

- Fixed the README contract and section names so the required Local Setup, Supabase, Stripe, Cron, Test Accounts, Decisions, and Known Limitations sections are present.
- Confirmed the app writes to the ledger only through SQL functions in [supabase/migrations/0003_functions.sql](supabase/migrations/0003_functions.sql), with append-only enforcement in [supabase/migrations/0002_ledger_triggers.sql](supabase/migrations/0002_ledger_triggers.sql).
- Fixed the lost-token problem by keeping the raw token in session storage while the pass is active and adding a cancel/release path for a replacement pass.
- Added the missing service-role health helper migration and the health endpoint contract for end-to-end checks.
- Standardized env validation so the app fails clearly with a list of missing variables instead of blank runtime failures.

## Getting it running

1. Create a Supabase project.
2. Fill `.env.local` with:
   - `NEXT_PUBLIC_APP_URL` — app URL, usually `http://localhost:3000`
   - `NEXT_PUBLIC_SUPABASE_URL` — Project URL from Supabase Dashboard → Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Project API keys → anon public key
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — Stripe Dashboard → Developers → API keys → publishable key
   - `SUPABASE_SERVICE_ROLE_KEY` — Supabase Dashboard → Project API keys → service role secret
   - `SUPABASE_PROJECT_REF` — Supabase project ref from the project URL or dashboard
   - `DATABASE_URL` — Project Settings → Database → Connection string
   - `STRIPE_SECRET_KEY` — Stripe Dashboard → Developers → API keys → secret key
   - `STRIPE_WEBHOOK_SECRET` — output of `stripe listen --forward-to localhost:3000/api/donate/webhook`
   - `CRON_SECRET` — random secret for the cron endpoint
   - `MEAL_VALUE_CENTS=800`
   - `ENABLE_DEV_LOGIN=false`
   - `SEED_ADMIN_PASSWORD`, `SEED_STUDENT_PASSWORD`, `SEED_EATERY_PASSWORD` — local seed passwords
3. Run `npm run db:setup`.
4. Run `npm run db:seed`.
5. Run `npm run dev`.
6. Open `http://localhost:3000/api/health` and expect `200`.
7. Run `stripe listen --forward-to localhost:3000/api/donate/webhook` and paste the printed `whsec_...` value into `STRIPE_WEBHOOK_SECRET`.
8. Make a $24 donation in the app.
9. Log in at `/auth/dev-login` as the student and get a meal pass.
10. Log in as the eatery and scan the pass.
11. Run `npm run smoke`.

## Local Setup

```sh
npm install
cp .env.example .env.local
npm run db:setup
npm run db:seed
npm run dev
```

The app expects a Supabase project with the schema in `supabase/migrations`, a Stripe test account, and env values populated in `.env.local`.

For local testing only, `npm run dev:credit` creates a pending test contribution for 2400 cents and credits it through the database `record_credit` function; pass a different amount with `npm run dev:credit -- 8000`. It is guarded by `ENABLE_DEV_LOGIN=true` and refuses production mode. Never run it against a real project or real donor funds.

Daily limits default to one redeemed meal, three generated passes per student, and 200 redemptions per eatery in Hawaiʻi time. Set `MEALS_PER_DAY`, `PASSES_GENERATED_PER_DAY`, and `EATERY_DAILY_LIMIT` only in server environment configuration; values are validated and are never accepted from the browser.

## Supabase

The SQL schema, row-level security, and ledger enforcement live in the migration files in `supabase/migrations`. The service role client is used only for internal admin operations; authenticated app code reads through user-scoped clients. The `public_eateries` view is intentionally public and readable by anonymous users.

## Stripe

Use Stripe test-mode keys and verify each webhook by posting signed Stripe events to `/api/donate/webhook`. The webhook must validate the signature before it touches the database.

## Cron

The cron endpoint expires stale QR holds and should be called with the shared `CRON_SECRET` in the Authorization header.

## Test Accounts

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@example.com` | seeded from `SEED_ADMIN_PASSWORD` |
| Student | `student@hawaii.edu` | seeded from `SEED_STUDENT_PASSWORD` |
| Eatery | `eatery@example.com` | seeded from `SEED_EATERY_PASSWORD` |

These are intended for the local dev database only.

## Decisions

- The meal value is fixed at `800` cents.
- QR tokens are hashed before storage and the raw token is kept only in the active browser session.
- `pool_ledger` is append-only; the app never writes to it directly.
- Student users must use a `@hawaii.edu` address.
- The ledger is authoritative for pool balance and holds.
- Students may redeem one meal per Honolulu calendar day by default; this limit prevents repeated same-day redemption. Three pass generations per Honolulu day and a one-minute post-cancel/expiry cooldown limit pass hoarding while leaving room to recover from a failed scan.
- Eateries are capped at 200 redemptions per Honolulu day by default as an abuse and reconciliation safeguard.

## Known Limitations

- Health checks rely on the matching Supabase schema and the service-role client in the current environment.
- QR expiration still depends on the expiration routine and cron endpoint running as expected.
- The dev login page is intentionally disabled outside local/non-production environments.
- The app does not implement settlement payouts or eatery management beyond the MVP flow.
- Camera scanning requires browser camera access and HTTPS or localhost.
- Email alias prevention compares normalized `hawaii.edu` mailbox names (+tags removed), but cannot establish that separate unrelated mailboxes belong to different people.
- The daily eatery limit is operationally configurable and is not a substitute for manual review of unusual redemption patterns.
- Security policies could not be checked against `SPEC.md` because that file is not present in the repository.
- Privacy and terms pages are drafts and require legal review; their owner contact placeholder must be completed before public launch.

## Troubleshooting

- Health 503: verify all env vars are present in `.env.local`, then check the database connection and the migration status.
- Migration failure: run `npm run db:setup` again after checking the exact migration file listed in the error output.
- Invalid API key: verify the correct Supabase and Stripe keys in `.env.local` and confirm the service role key is not the anon key.
- Webhook signature errors: ensure `stripe listen` is pointed at the correct route and `STRIPE_WEBHOOK_SECRET` matches the printed `whsec_...` value.
- Camera not opening: browser permissions and localhost/HTTPS context are required.

## Manual verification checklist

- Run the accounting lifecycle SQL test against a disposable local database.
- Replay the same Stripe refund event twice and confirm only one refund ledger row is created.
- Open the same active QR in two tabs and confirm only one redemption succeeds.
- Confirm the cron endpoint rejects a missing or incorrect secret.
