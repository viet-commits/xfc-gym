# XFC Carrum Downs

Marketing site for XFC Carrum Downs — an Astro static build deployed to Cloudflare Pages,
with Pages Functions and a D1 database behind the trial booking form.

## Stack

| Piece | Detail |
| --- | --- |
| Framework | Astro 5 (`output: 'static'`) |
| Styling | Tailwind 3 via `@astrojs/tailwind`, plus global CSS in `src/layouts/Layout.astro` |
| Hosting | Cloudflare Pages (`pages_build_output_dir = "dist"`) |
| API | Cloudflare Pages Functions in `functions/api/` |
| Database | Cloudflare D1 (`DB` binding, schema in `schema.sql`) |
| Package manager | **pnpm** — see the note below |

> **Use pnpm.** The repo ships `pnpm-lock.yaml` only. `packageManager` is pinned in
> `package.json`, so `corepack` will select the right version automatically.
> Astro is intentionally held at 5.x because `@astrojs/tailwind@6` does not support
> Astro 6 — upgrading Astro requires migrating to `@tailwindcss/vite` and Tailwind 4 first.

## Local development

```sh
corepack enable
pnpm install
pnpm dev          # http://localhost:4321
```

| Command | Action |
| --- | --- |
| `pnpm dev` | Dev server with HMR |
| `pnpm build` | Production build to `./dist/` |
| `pnpm preview` | Serve the built output locally |
| `npx tsc --noEmit` | Type check (should report 0 errors) |

`pnpm dev` serves the static pages but **not** `functions/`. To exercise the booking
endpoint locally, build first and run it through Wrangler:

```sh
pnpm build
npx wrangler pages dev dist --d1 DB=xfc-db
```

## Project layout

```
functions/api/        Cloudflare Pages Functions (booking intake, timetable read)
public/               Static assets served as-is; also _headers and robots.txt
src/data/gym.ts       Business name, address, phone, hours — single source of truth
src/components/       Nav, Footer, Icon
src/layouts/          Layout.astro — <head>, global CSS, structured data
src/pages/            One file per route
schema.sql            D1 schema + seed data for the classes table
```

## Database

Create the database once, then apply the schema:

```sh
npx wrangler d1 create xfc-db                      # already provisioned; id is in wrangler.toml
npx wrangler d1 execute xfc-db --remote --file=./schema.sql
```

Read recent trial enquiries:

```sh
npx wrangler d1 execute xfc-db --remote \
  --command="SELECT created_at, name, email, phone, class_interest FROM bookings ORDER BY id DESC LIMIT 20"
```

Note that `bookings.created_at` defaults to `datetime('now')`, which is **UTC** — roughly
10 hours behind Melbourne. Notification emails render the local time correctly.

## Environment variables

Set these in the Cloudflare Pages dashboard under **Settings → Environment variables**.
Only `DB` is strictly required; everything else degrades gracefully rather than breaking
the form.

| Variable | Required | Purpose |
| --- | --- | --- |
| `DB` | **yes** | D1 binding (configured as a binding, not a plain variable) |
| `RESEND_API_KEY` | strongly recommended | Enables the lead notification email and the enquirer autoresponder. Without it, bookings are still saved to D1 but **nobody is told**. |
| `BOOKING_FROM` | with `RESEND_API_KEY` | Verified sender, e.g. `XFC Carrum Downs <noreply@xfcgym.com.au>` |
| `BOOKING_NOTIFY_TO` | no | Inbox that receives new leads. Defaults to `jamie@xfcgym.com.au` (confirmed by the business). |
| `ALLOWED_ORIGIN` | no | Exact origin permitted to POST the form, e.g. `https://xfcgym.com.au`. Defaults to the request's own origin. Set it explicitly in production. |
| `TURNSTILE_SECRET_KEY` | no | When set, the booking endpoint requires a valid Cloudflare Turnstile token. Leave unset until the widget is added to the form. |
| `PUBLIC_GA_ID` | no | GA4 measurement ID (e.g. `G-XXXXXXXXXX`). **Build-time**, so a redeploy is needed after changing it. Without it no analytics tag is emitted at all, which is why the site currently reports nothing. The form fires a `generate_lead` event on success. |

Mark `RESEND_API_KEY` and `TURNSTILE_SECRET_KEY` as **encrypted**. `PUBLIC_GA_ID` is
inlined into the built HTML, so it must not hold anything secret.

### Business details live in one place

Name, address, phone, email, social links and opening hours are defined in
`src/data/gym.ts`. The footer, the JSON-LD structured data, the 404 page and the privacy
policy all read from it. Editing them anywhere else will reintroduce the drift that put two
different phone numbers on the site.

### Booking email status (verified 27 Jul 2026)

The pipeline was tested end-to-end locally with the production Resend key:

- The key is valid and correctly scoped (**send-only** — it cannot read account data).
- A test booking returned 200, landed in D1, and the fail-safe held when the send failed.
- The Resend account owner is **jamie@xfcgym.com.au**; a test email was delivered there.
- **One step blocks production email: the domain `xfcgym.com.au` is not verified in
  Resend.** Until it is, Resend refuses to send from `@xfcgym.com.au` addresses and only
  delivers test mail to the account owner.

**Interim option that works today (no DNS needed):** because Jamie owns the Resend
account, setting `BOOKING_FROM` = `XFC Carrum Downs <onboarding@resend.dev>` delivers lead
notifications to `jamie@xfcgym.com.au` immediately, even before the domain is verified.
Only the autoresponder to the enquirer is skipped (it fails safe and is logged). Switch
`BOOKING_FROM` to `noreply@xfcgym.com.au` once the domain verifies.

**To finish properly (10 minutes, needs DNS access):**

1. Log in to Resend (Jamie's account) → https://resend.com/domains → Add Domain →
   `xfcgym.com.au`.
2. Add the DKIM/SPF DNS records Resend displays to the `xfcgym.com.au` DNS zone
   (in Cloudflare DNS if the domain is on Cloudflare). Wait for "Verified".
3. In Cloudflare Pages → Settings → Environment variables, set:
   - `RESEND_API_KEY` = the key (encrypted)
   - `BOOKING_FROM` = `XFC Carrum Downs <noreply@xfcgym.com.au>`
   - `BOOKING_NOTIFY_TO` = `jamie@xfcgym.com.au` (also the code default, so this can be omitted)
4. Redeploy, then run the verification below on the live domain.

> The key was shared in a chat conversation during setup. After the environment variable
> is saved in Cloudflare, it is good hygiene to rotate the key in Resend and update the
> variable — send-only scope limits the damage either way.

### Verifying the booking pipeline after deploy

1. Submit the form on the live domain.
2. Confirm the lead email arrives at `BOOKING_NOTIFY_TO`.
3. Confirm the autoresponder arrives at the address you submitted.
4. Confirm the row exists in D1 (query above).

Watch logs while testing with `npx wrangler pages deployment tail`. The function logs a
warning when email is unconfigured and an error when a send fails — in both cases the lead
is already committed to D1, so nothing is lost.

## Pre-go-live status

Outstanding work is tracked in [`PRE-GO-LIVE-QA.md`](./PRE-GO-LIVE-QA.md), which records
the full QA pass, every finding with a file reference, and a phased remediation plan.
Phases 1–5 are complete, within the constraint that no new photography is available. Two
quality ceilings remain that only new source images can close: the hero is served at 1200px
(scaled ~2.4x on a large 2x display) and the coach portraits are 257x325. The head-coach and
Jamie portraits also still carry a third-party photographer's watermark, which is a
licensing question for the business to resolve.

`docs/unused-assets/` and `docs/source-timetables/` hold files moved out of `public/` so
they are no longer deployed but not lost.

Before launch the business still needs to: confirm the phone number, set `RESEND_API_KEY`
and `BOOKING_FROM` (bookings notify nobody without them), have `/privacy/` reviewed, and
decide whether to reinstate rating markup.
