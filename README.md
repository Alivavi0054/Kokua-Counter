# Kōkua Counter

Kōkua Counter is a shared meal-credit platform for University of Hawaiʻi students and participating local food businesses. Donors contribute to one shared pool, eligible students request a short-lived QR pass, and eatery staff scan the pass at redemption.

## Product Overview

- A meal credit is fixed at **$8 USD**. Donations are made in whole-dollar amounts of at least $8.
- Donations are not assigned to an individual student or a specific eatery. Credits join one shared pool.
- Stripe confirms successful payments before the application records credits in the accounting ledger.
- Student sign-in requires an existing account with a confirmed `@hawaii.edu` email and password. There is no public registration or password-reset screen.
- A student can hold one active pass at a time. Passes expire after 30 minutes and are single-use.
- Eatery staff scan the QR code. The scanner verifies the pass without displaying the student's name or email.
- An **eatery** is a participating food business, such as a restaurant or campus food counter, where students redeem meal passes.
- Admins can view pool, contribution, active-pass, redemption, and participating-eatery summaries.

## Roles and Pages

| Role | Main page | Capabilities |
| --- | --- | --- |
| Student | `/student` | Request a meal pass and view meal history. |
| Eatery staff | `/eatery` | View today's accepted meals and open the QR scanner at `/eatery/scan`. |
| Admin | `/admin` | Review pool balance, contributions, active holds, redemptions, and active eateries. |
| Public | `/`, `/about`, `/donate` | Learn about the program, review participating eateries, and donate. |

All roles use the same password login at `/auth/login`. Users must already exist in Supabase Auth and have a matching role in the `public.users` table. The app does not currently provide account creation, invitations, or password recovery.

## How the Money and Passes Work

1. A donor starts Stripe Checkout. The application creates a pending contribution, but does not credit the pool yet.
2. Stripe sends a signed success webhook. The webhook verifies the amount and currency, then records the contribution through a database function.
3. A student requests a pass. The database reserves one $8 credit as an active hold; the raw QR token is kept in that browser session, while only its hash is stored in the database.
4. Eatery staff scan the QR code. A database function atomically checks and redeems the pass, preventing the same pass from being accepted twice.
5. Cancelled or expired holds are released back to the pool through ledger functions.

The append-only `pool_ledger` is the source of truth for available funds. Application code must not write directly to that table. Stripe refunds are recorded through the webhook. **The app does not transfer money to eateries:** the charity/operator must reconcile completed redemptions and pay participating businesses outside the app.

## Technology

- Next.js 16 App Router, React 19, and TypeScript
- Supabase Auth, PostgreSQL, row-level security, and server-side service-role operations
- Stripe Checkout and signed webhooks
- `html5-qrcode` for eatery pass scanning
- SQL migrations and database functions for ledger, pass, and redemption invariants

## Requirements

- Node.js 20.9 or newer (Node 22 LTS recommended; required by Next.js 16)
- npm
- A Supabase project, or a local Supabase stack
- A Stripe account for donation checkout; Stripe test mode is sufficient for development
- Stripe CLI for local webhook forwarding (optional but recommended)

## Local Setup

1. Install dependencies and create a local environment file:

   ```sh
   npm install
   cp .env.example .env.local
   ```

2. Configure Supabase. For a local Supabase stack, install the Supabase CLI and run `supabase start`; use the API URL, anon key, service-role key, and database URL it reports. The example database URL points to the usual local port `54322`. Alternatively, use a dedicated Supabase development project and its API keys and PostgreSQL connection string.
3. Fill in the remaining required values described in [Environment Variables](#environment-variables). Keep `.env.local` private; it is ignored by Git.
4. Apply the database migrations:

   ```sh
   npm run db:setup
   ```

   The script applies sorted SQL files in `supabase/migrations` and tracks them in `public._migrations_applied`. It skips migrations already recorded as applied.
5. For a disposable development database only, create the seeded admin, student, and eatery accounts:

   ```sh
   npm run db:seed
   ```

6. Start the app:

   ```sh
   npm run dev
   ```

   Open the URL printed by Next.js. By default this is `http://localhost:3000`. If port 3000 is busy, start with an explicit port, for example `npm run dev -- --port 3002`, and set `APP_URL` to that same origin before restarting. Stripe Checkout return URLs use this setting.
7. Check the application and database schema:

   ```sh
   curl http://localhost:3000/api/health
   ```

   A healthy response has HTTP status 200 and `{"ok":true,"failures":[]}`. Substitute your chosen port if it is not 3000.

### Environment Variables

Copy `.env.example` to `.env.local`. The example documents all supported values.

| Variable | Required | Purpose |
| --- | --- | --- |
| `APP_URL` | Yes | Canonical app origin used for Stripe return URLs and developer-login redirects. Must match the current local port or production HTTPS domain. |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project API URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Public Supabase key used by user-scoped clients. This is safe to expose through the `NEXT_PUBLIC_` prefix when RLS is correctly configured. |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Privileged server-side Supabase key. Never add a `NEXT_PUBLIC_` prefix or expose it in browser code. |
| `DATABASE_URL` | Yes for database scripts | PostgreSQL connection string used by migrations and accounting verification. |
| `STRIPE_SECRET_KEY` | Yes for checkout | Server-side Stripe API key. Use a test-mode key during development. |
| `STRIPE_WEBHOOK_SECRET` | Yes for webhook handling | Signing secret from Stripe or `stripe listen`; keep it private. |
| `CRON_SECRET` | Yes for cron | Random bearer secret required by the QR-expiration endpoint. |
| `SEED_ADMIN_PASSWORD` | Dev seed only | Password assigned to `admin@example.com` by `npm run db:seed`. |
| `SEED_STUDENT_PASSWORD` | Dev seed only | Password assigned to `student@hawaii.edu` by `npm run db:seed`. |
| `SEED_EATERY_PASSWORD` | Dev seed only | Password assigned to `eatery@example.com` by `npm run db:seed`. |
| `ENABLE_DEV_LOGIN` | Optional | Set to `true` only for local development to enable `/auth/dev-login` and `npm run dev:credit`. Keep false or unset in production. |
| `MEALS_PER_DAY` | Optional | Maximum completed meals per student per Hawaiʻi calendar day. Default: `1`. |
| `PASSES_GENERATED_PER_DAY` | Optional | Maximum pass generations per student per Hawaiʻi calendar day. Default: `3`. |
| `EATERY_DAILY_LIMIT` | Optional | Maximum accepted redemptions per eatery per Hawaiʻi calendar day. Default: `200`. |
| `SUPABASE_PROJECT_REF` | Only for `npm run types` | Project reference used by the Supabase CLI type-generation command. |
| `RESEND_API_KEY` | Optional | Resend API key used to email school registration requests. The email is skipped when unset. |
| `EMAIL_FROM` | Optional | Sender address for the registration email. Defaults to `Kokua Counter <noreply@kokuacounter.app>`. Only printable ASCII is kept. |
| `CONTACT_EMAIL` | Optional | Public contact address shown on the privacy and terms pages. Neutral wording is shown when unset. |
| `OPERATING_ORGANIZATION` | Optional | Name of the operating organization shown on the donate page. Omitted when unset. |
| `SCHOOL_REGISTRATION_TO_EMAIL` | Optional | Recipient of school registration emails. The email is skipped when unset. |

Only the Supabase URL and anon key are intended to be public (the meal value is fixed in code at `800` cents, and Stripe Checkout is a hosted redirect, so no Stripe publishable key is read). Service-role, database, Stripe secret, webhook, cron, and seed-password values must remain server-side.

## Database and Security

- Schema, RLS policies, grants, triggers, and database functions are under [supabase/migrations](supabase/migrations/).
- The SQL migration runner uses `DATABASE_URL`; the running app uses the Supabase URL and keys.
- Ledger writes, credit holds, pass cancellation/expiry, redemption, and refunds go through SQL functions. The ledger is append-only and protected by database enforcement and idempotency keys.
- Authenticated users have a role in `public.users`. Server routes check the role before allowing student, eatery, or admin operations.
- Public users can read the `public_eateries` view. Eatery accounts do not receive student identity or unrestricted redemption records.
- QR tokens are bearer credentials: anyone holding an unexpired pass could present it. Do not screenshot or share a live pass.
- Student accounts must use a confirmed `@hawaii.edu` email. Email aliases are normalized for duplicate checks, but unrelated mailboxes cannot be proven to belong to different people.

Do not edit ledger rows manually to correct balances. Use the corresponding refund, cancellation, redemption, or release workflow so the audit trail stays intact.

## Stripe Development

Use Stripe test-mode keys locally. To forward webhook events to the local app, run:

```sh
stripe listen --forward-to localhost:3000/api/donate/webhook
```

Copy the printed `whsec_...` value into `STRIPE_WEBHOOK_SECRET`. If the app uses another port, update both the forwarding URL and `APP_URL`. The webhook validates the Stripe signature before changing contribution or ledger state. It handles paid/failed/expired checkout sessions and refund events.

The checkout currently accepts whole-dollar donations from $8 through $800. Preset amounts are $8, $24, and $80. The database is credited only after a successful signed webhook, not when checkout starts or when the browser returns to the success page.

## QR Expiration and Limits

QR passes expire after **30 minutes**. The app also expires stale holds during admin activity, but production should run the scheduled endpoint so abandoned holds are released promptly:

```http
GET /api/cron/expire-qrs
Authorization: Bearer <CRON_SECRET>
```

Configure your hosting provider or an external scheduler to call this endpoint periodically. Missing or incorrect authorization returns 401. Never place the cron secret in client code. Expired QR scan-failure throttle records are also cleaned up by cron and scan traffic.

Default operational limits use Hawaiʻi time: one redeemed meal per student per day, three pass generations per student per day, and 200 redemptions per eatery per day. A one-minute cooldown applies after cancellation or expiration. These values can be changed with the server environment variables above, within the validation bounds in `lib/constants.ts`.

## Local Test Accounts

`npm run db:seed` creates or updates these confirmed test users and assigns the configured seed passwords:

| Role | Email | Password variable |
| --- | --- | --- |
| Admin | `admin@example.com` | `SEED_ADMIN_PASSWORD` |
| Student | `student@hawaii.edu` | `SEED_STUDENT_PASSWORD` |
| Eatery | `eatery@example.com` | `SEED_EATERY_PASSWORD` |

The eatery seed is named **Test Eatery**. These accounts and passwords are for a disposable development database only. Do not seed them into a production project. Production account provisioning and password recovery must be handled through a trusted admin process; the app has no public registration or password-reset workflow.

## Developer Utilities

- `npm run dev:credit` creates a local test contribution (default $24) and credits it through the ledger function. Pass an amount in cents, for example `npm run dev:credit -- 8000` for $80. It requires `ENABLE_DEV_LOGIN=true` and refuses to run in production. Use only with a disposable development project; it does not use Stripe.
- `/auth/dev-login` is a local-only helper controlled by `ENABLE_DEV_LOGIN`. The regular `/auth/login` page is the shared password login for all roles.
- `npm run types` runs `supabase gen types typescript --project-id "$SUPABASE_PROJECT_REF"`; it requires the Supabase CLI and a configured project reference.

## Tests and Quality Checks

Run these before deploying:

```sh
npm run lint
npx tsc --noEmit
npm run build
npm run check:client-secrets
```

Additional checks:

- `npm run verify` executes the accounting scenarios in [supabase/tests/accounting.sql](supabase/tests/accounting.sql) using `DATABASE_URL`. Use a disposable test database only; the test script is not a production migration.
- `npm run smoke` checks `/api/health`, unauthenticated QR generation, and cron authorization. The app must be running at `APP_URL` first.
- `npm run db:setup` applies schema migrations; `npm run db:seed` writes the three test accounts.

Do not run `npm run build` and `npm run dev` at the same time. Both use `.next`; stop the dev server before building, then restart it afterward if needed.

Manual checks should cover: successful and failed Stripe test checkouts; duplicate webhook delivery; refunds; one-time QR redemption under concurrent scans; expired/cancelled pass release; role-protected routes; unauthorized cron requests; and keyboard/mobile behavior. Run database verification against a disposable database before launch.

## Production Deployment

One managed option is Vercel for Next.js with Supabase for PostgreSQL and Auth:

1. Create a **separate production Supabase project**; keep development and production data apart.
2. Apply the SQL migrations to the production project using its PostgreSQL connection string. Verify the target before running `npm run db:setup`.
3. Push the code to a private GitHub repository and import it into Vercel. Set the production environment variables in the hosting dashboard. Do not commit `.env.local`.
4. Set `APP_URL` to the final HTTPS URL. Add the custom domain in Vercel and configure the DNS records it provides.
5. Configure production Stripe keys and a webhook endpoint at `https://your-domain.example/api/donate/webhook`. Use the live signing secret only in the production environment.
6. Configure a scheduled caller for `/api/cron/expire-qrs` with `Authorization: Bearer <CRON_SECRET>`.
7. Verify `https://your-domain.example/api/health`, then test login, a Stripe test deployment/staging checkout, and QR redemption before accepting real donations.

Never run `npm run db:seed`, `npm run dev:credit`, or `npm run verify` against production. Keep service-role keys and database credentials in the host's server-side environment settings. HTTPS is required for camera access on phones; plain HTTP on a LAN IP is not a secure browser context. An alternative VPS deployment must provide a supported Node.js runtime, persistent process manager, reverse proxy, TLS certificate, environment secrets, monitoring, and database backups.

## Troubleshooting

| Symptom | Checks |
| --- | --- |
| `/api/health` returns 503 | Check Supabase URL/keys, database connectivity, applied migrations, and the service-role key. |
| App redirects to the wrong local port after checkout | Make `APP_URL` match the URL/port in use, then restart Next.js. |
| Login fails for a student | Confirm the account exists, has role `student`, is active, has a password, and uses a confirmed `@hawaii.edu` address. |
| Pass request is unavailable | Check pool balance, an existing active pass, the daily meal/pass limits, and the one-minute cooldown. |
| Camera permission is unavailable | Tap **Enable camera**; allow the browser permission. On a phone use HTTPS. Localhost is treated as secure only on the same device. |
| Stripe signature is invalid | Confirm the webhook secret matches the current Stripe CLI listener or the configured Stripe endpoint. |
| `Cross-origin request rejected` | Use the app through one origin. Reverse proxies must preserve the public host/protocol in `Host` or `X-Forwarded-Host`/`X-Forwarded-Proto`. |
| `ChunkLoadError` after a build | Stop any other Next.js dev server, restart the current one, and reload the page. Do not share `.next` between concurrent dev/build processes. |

## Known Limitations and Launch Checklist

- Eatery settlement payouts, bank details, eatery onboarding, and public account provisioning are not implemented. The operator must reconcile redemptions and pay eateries outside the app.
- Privacy and terms pages are drafts. Complete owner/contact details and have the documents reviewed before public launch.
- Confirm the charity's legal/tax status and make no tax-deductibility claims unless the operating organization supports them.
- Configure database backups, monitoring, and an incident/contact process for the production Supabase project.
- Test production Stripe webhooks and refund handling in staging before using live keys.
- Confirm the cron scheduler is running and review failed webhook/cron executions.
- Camera scanning requires the user's browser permission and HTTPS (except localhost on the same device).
