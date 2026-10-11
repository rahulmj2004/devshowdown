# DevShowdown

**Enter the arena. Prove your skills.** The website for the DevShowdown developer
competition: five competitions, a multi-step registration flow, and Razorpay payments.

Next.js 16 (App Router, Cache Components) · React 19 · TypeScript (strict) ·
Tailwind CSS v4 · Motion · Three.js · Zod · Supabase · Razorpay.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
```

No environment variables are needed. With none set the site runs in **demo mode**:
the whole registration flow works, but it is held in memory, labelled as a demo on
every screen, and never claims to be a real registration or a real payment.

To try the payment steps locally before any fee is confirmed:

```bash
REGISTRATION_STATUS=open DEV_FEE_OVERRIDE_INR=50 npm run dev
```

## Editing content

Everything the organizers decide lives in two files. Nothing else needs to change.

| What                                                                         | Where              |
| ---------------------------------------------------------------------------- | ------------------ |
| Competitions: title, tagline, format, eligibility, team rule, **fee**, rules | `config/events.ts` |
| Dates, venue, countdown instant, timezone, prize pool and split, schedule,   | `config/site.ts`   |
| sponsors, FAQ, contact, socials, multiple-entry policy                       |                    |
| Registration open/closed and the hero announcement badge                     | Admin dashboard    |

**Anything left as `null` (or an empty list) renders as "TBA" / "Awaiting
confirmation". Nothing is guessed.** Search both files for `ORGANIZER` to find every
decision still outstanding. Notable ones:

- `prize.approximate`: `true` labels ₹15,000 as approximate and awaiting confirmation
  everywhere. Set it to `false` once the amount is final.
- `prize.distribution`: fills in the podium.
- `details.startsAt`: an ISO instant with offset (`2027-03-14T09:30:00+05:30`). The hero
  countdown shows empty cells until this is set.
- `events[].fee`: whole rupees. `null` means no fee is confirmed, so none is displayed
  and none is charged.
- `events[].team`: `{ min, max }` including the registrant. Drives the team fields in the
  form. `null` offers only an optional team name.
- `registration.allowMultipleEvents`: whether one person may enter several competitions.

## How registration and payment work

1. **Choose competition → details → review.** Validated in the browser for convenience
   and again on the server with the same schema (`lib/validation/registration.ts`).
2. **Submit.** The server re-derives which events are open, the team rules and every fee
   from its own config. It never accepts a price from the browser. A registration with
   nothing to pay is confirmed here; otherwise it is stored as `pending_payment`.
3. **Pay.** The server creates a Razorpay order for the stored amount (official SDK) and
   the browser opens Razorpay Checkout. Card and UPI details are entered in Razorpay's
   own window and never touch this site.
4. **Verify.** Checkout's result is only a claim. The server checks the signature against
   the order _it_ stored, then fetches the payment from Razorpay with the secret key and
   compares status, amount, currency and order id. The webhook does the same
   independently.
5. **Confirm.** Only a verified, captured payment for the exact amount confirms the
   registration.

Payment states shown to participants: **Pending**, **Paid** (successful), **Failed**,
and **Verification required** (money may have moved but could not be matched cleanly,
for example an amount mismatch or an authorized-but-uncaptured payment; it is flagged
for organizers and the participant is told not to pay again).

### Safety properties

- **No double charge.** A registration has at most one open order (a database unique
  index), and a retry reuses it. Razorpay lets an order be paid once.
- **No duplicate registration.** Each submission carries a random browser key; resubmits
  and double clicks return the original. One live entry per person per event is enforced
  by a unique index. A fresh attempt replaces an unpaid one.
- **Idempotent webhooks.** Each delivery id is stored once; redeliveries are acknowledged
  and skipped. Recording a payment is itself idempotent, so a delivery reprocessed after a
  crash cannot double-apply, and a late `payment.failed` cannot undo a confirmed payment.
- **Refresh-safe.** The browser keeps only the registration reference and its random key
  (no personal details) and resumes at the payment step.
- **Private.** A registration can be read back only with both its reference and that key.
  All tables are closed to the anon key by Row Level Security.

### The four payment modes

Decided on the server from environment variables and the UPI ID in `config/site.ts`
(`lib/payments/mode.ts`). The register
page shows the current mode under "System status".

| Mode           | When                                                           | Behaviour                                                                                                               |
| -------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `razorpay`     | Razorpay keys set (and a database, unless they are test keys)  | Real Checkout, signature verification, webhook                                                                          |
| `upi`          | No Razorpay keys, a UPI ID in `config/site.ts`, and a database | The participant pays the UPI ID from a QR code and enters the transaction ID; an organizer approves it in the dashboard |
| `mock`         | `PAYMENT_MODE=mock`, or nothing configured at all (demo mode)  | A clearly labelled simulated checkout. No money moves. Entries are flagged as test payments                             |
| `unconfigured` | Database connected but no Razorpay keys or UPI ID              | Free registrations work. Registrations with a fee are refused before anything is saved                                  |

Live Razorpay keys are refused when no database is connected, because a real payment that
cannot be recorded is worse than no payment. A UPI ID without a database is refused in
production for the same reason; under `next dev` the UPI screens can still be previewed.

## Environment variables

Copy `.env.example` to `.env.local`. All are optional and validated at startup
(`lib/validation/env.ts`). Never commit real values.

| Variable                        | Purpose                                                                    |
| ------------------------------- | -------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`          | Public URL, for canonical and social-share links                           |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase project URL                                                       |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon / publishable key                                            |
| `SUPABASE_SERVICE_ROLE_KEY`     | **Server only.** Stores registrations and payments                         |
| `REGISTRATION_STATUS`           | `not_open` \| `open` \| `closed`. Only used when Supabase is not connected |
| `RAZORPAY_KEY_ID`               | Razorpay key id (public; sent to the browser to open Checkout)             |
| `RAZORPAY_KEY_SECRET`           | **Server only.** Creates orders, verifies payment signatures               |
| `RAZORPAY_WEBHOOK_SECRET`       | **Server only.** Verifies webhook signatures                               |
| `PAYMENT_MODE`                  | `mock` forces the simulated gateway                                        |
| `DEV_FEE_OVERRIDE_INR`          | Test fee per event, honoured by the mock gateway only                      |
| `RESEND_API_KEY`, `EMAIL_FROM`  | Optional confirmation email through Resend. Set both                       |

Secrets are read only in modules that import `server-only`, so importing them from a
Client Component is a build error.

## Connecting Supabase

1. Create a Supabase project. In the SQL editor run, in order,
   `supabase/migrations/0001_init.sql`, `0002_registration_payments.sql` and
   `0003_upi_payments.sql` (or `supabase db push`). Each is safe to run twice.
2. Set the three Supabase variables and redeploy.
3. Create the organizer's user under **Authentication → Users**, then grant access:
   ```sql
   insert into public.admins (user_id) values ('<auth user uuid>');
   ```
4. Sign in at `/admin/login`. The dashboard lists every entry with its reference and
   payment state, and exports CSV.

`0002` renames the one-row-per-event table from `0001` to `registrations_v1_legacy`
(keeping any rows) and creates: `participants`, `registrations`, `registration_events`,
`team_members`, `payment_orders`, `payment_transactions`, `payment_webhook_events`, the
organizer view `admin_registration_entries`, and the transactional functions
`create_registration` and `record_payment`.

## Taking payment by UPI (no gateway)

The simplest way to collect fees: money goes straight to an organizer's own UPI account,
and an organizer confirms each payment by hand.

1. Connect Supabase as above, including `0003_upi_payments.sql`.
2. In `config/site.ts` set `payment.upi.vpa` (the UPI ID that receives the money) and
   `payment.upi.payeeName`. Leave the Razorpay variables empty.
3. Set the fees in `config/events.ts`, then open registration from the dashboard.

What happens then:

- The participant registers, sees a QR code for the exact amount (the registration
  reference is the payment note), pays in their own UPI app, and enters the 12-digit UPI
  transaction ID (UTR) from the receipt.
- The registration waits as **Needs review**. It is never confirmed on the participant's
  word alone.
- In `/admin`, **UPI payments to check** lists each one with the amount and transaction ID.
  Find it in the UPI app's history, check the amount, then **Mark paid** (confirms the
  registration and sends the confirmation email, if email is configured) or **Reject** (the
  participant can enter a different ID).
- One transaction ID cannot be used for two registrations.

Before opening registration, pay a small real amount yourself and take it through to
**Mark paid**. Some banks limit payments to a personal UPI ID from a QR code, so check that
the QR works from at least two different UPI apps.

## Connecting Razorpay

1. In the Razorpay dashboard generate API keys. **Start in Test Mode.**
2. Set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`.
3. Create a webhook pointing at `https://<your-domain>/api/webhooks/razorpay` with the
   events `payment.captured`, `payment.failed`, `payment.authorized` and `order.paid`.
   Choose a secret and set it as `RAZORPAY_WEBHOOK_SECRET`.
4. Set real fees in `config/events.ts`.

### Before taking real money

This repository has not been run against a live Razorpay account or a hosted Supabase
project: no credentials were available while it was built. The payment logic is covered
by automated tests against a fake gateway that uses real HMAC signatures, and the SQL
was executed against a local Postgres, but that is not the same thing. Do not switch to
live keys until every item below has been done with **test** keys on the deployed site:

- [ ] A test payment confirms a registration and shows the payment reference.
- [ ] A failed test payment leaves it pending, and the retry succeeds without a new order.
- [ ] Closing Checkout leaves it pending and payable.
- [ ] The Razorpay webhook log shows `200` responses, and redelivering an event from the
      dashboard returns `"result":"duplicate"`.
- [ ] Killing the browser tab right after paying still confirms it (via the webhook).
- [ ] The row appears in the admin dashboard as **Paid**, and the CSV export includes it.
- [ ] Automatic capture is enabled on the Razorpay account, or you are prepared to capture
      manually (uncaptured payments show as "Verification required").
- [ ] Terms and privacy notice have the organizers' final text.

## Scripts

| Command             | What it does                                                             |
| ------------------- | ------------------------------------------------------------------------ |
| `npm run dev`       | Development server                                                       |
| `npm run build`     | Production build                                                         |
| `npm run lint`      | ESLint                                                                   |
| `npm run typecheck` | Route type generation + `tsc --noEmit`                                   |
| `npm test`          | Unit and component tests (Vitest + Testing Library)                      |
| `npm run test:e2e`  | End-to-end tests (Playwright; builds and starts its own two servers)     |
| `npm run test:db`   | Applies the migrations to a throwaway local Postgres and runs SQL checks |
| `npm run format`    | Prettier                                                                 |
| `npm run check`     | lint + typecheck + unit tests + build                                    |

First e2e run: `npx playwright install chromium`. `test:db` needs `initdb`, `pg_ctl` and
`psql` on your PATH (`brew install postgresql@16`); it never touches a real database.

## Deploying

Any Node host that runs Next.js works; Vercel is the simplest.

1. Push the repository and import it in Vercel.
2. Add the environment variables for **Production** (and Preview, with test keys).
3. Set `NEXT_PUBLIC_SITE_URL` to the final domain.
4. Deploy, then point the Razorpay webhook at the deployed URL.

Demo mode keeps registrations in the server's memory, which serverless hosts do not
share between instances. It exists for previews and local use; connect Supabase before
opening registration.

## Motion and performance notes

- The hero's 3D core (`components/hero`) loads Three.js in a separate chunk, on the
  client, after the page is idle. Until its first frame, and permanently where WebGL is
  missing, on Save-Data, or on very low-core devices, a CSS/SVG version is shown. It
  pauses when off screen or when the tab is hidden.
- The intro is CSS only, plays once per browser session on the home page, never blocks
  input, and is skipped entirely under `prefers-reduced-motion` or without JavaScript.
- Pointer effects (cursor ring, magnetic buttons, card tilt, hero light) run only for a
  mouse-like pointer; the native cursor is never hidden. Under reduced motion every
  animation resolves to its end state.
- Event illustrations are CSS/SVG with no client JavaScript.

## Structure

```
app/                  routes: /, /events, /events/[slug], /register, /leaderboard, /admin,
                      /rules, /privacy, /terms, /api/webhooks/razorpay
components/           hero, sections, events, registration, motion, layout, ui, admin
config/               events.ts and site.ts: all editable content
lib/payments/         mode selection, signature verification, Razorpay gateway
lib/registration/     service (all rules), Supabase store, in-memory store
lib/                  env, validation/, supabase/, data/, email
supabase/migrations/  schema, constraints, RLS policies, SQL functions
supabase/tests/       SQL behaviour and access-control checks
tests/                unit/ (Vitest) and e2e/ (Playwright)
```

## Not built yet

- Rate limiting on registration and payment actions (there is a honeypot field only).
  Add one at the edge or with a store such as Upstash before opening registration widely.
- Refunds: they are issued from the Razorpay dashboard; this site does not track them.
- Editing events, schedule and prize split from the dashboard (they live in `config/`).
- Resolving "Verification required" entries from the dashboard (organizers fix them in
  the Razorpay dashboard and the Supabase table editor).
- Participant self-service lookup from another device. A registration can be reopened
  only in the browser that created it.
- The privacy notice, terms and general rules are drafts awaiting
  organizer text.
