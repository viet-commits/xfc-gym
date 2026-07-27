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
public/               Static assets served as-is; also _headers, robots.txt, sitemap.xml
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
| `BOOKING_NOTIFY_TO` | no | Inbox that receives new leads. Defaults to `cd@xfcgym.com.au`. |
| `ALLOWED_ORIGIN` | no | Exact origin permitted to POST the form, e.g. `https://xfcgym.com.au`. Defaults to the request's own origin. Set it explicitly in production. |
| `TURNSTILE_SECRET_KEY` | no | When set, the booking endpoint requires a valid Cloudflare Turnstile token. Leave unset until the widget is added to the form. |

Mark `RESEND_API_KEY` and `TURNSTILE_SECRET_KEY` as **encrypted**.

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
Phase 1 (blockers) is complete; Phases 2–5 are not.
