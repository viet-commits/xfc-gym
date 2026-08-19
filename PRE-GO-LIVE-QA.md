# XFC Carrum Downs — Pre-Production Go-Live QA & Remediation Plan

**Date:** 27 July 2026
**Audited build:** `claude/pre-prod-go-live-qa-7op9v6` @ `737a165` (Astro 6 as committed)
**Stack:** Astro (static) + Tailwind 3 + Cloudflare Pages Functions + D1
**Note:** Phase 1 pinned Astro to 5.x — see P0-2 and the changelog.

---

## Status

**Phases 1–5 are complete**, within the constraint that no new photography is available.
All nine P0 blockers, all thirteen P1 items, and every P2 item that does not require new
source images. See the changelogs at the end of this document. Verified by browser suites
totalling 140 assertions across desktop and mobile, a clean `pnpm build`, and
`tsc --noEmit` at zero errors.

Two P0 items still need **client confirmation**, not code:

- **P0-9 (phone):** unified to `(03) 9770 8401`, the number that already appeared twice in
  the UI. The conflicting `+61 3 9775 0046` in the structured data was changed to match.
  **Confirm which number is correct** before launch — if it is the other one, one line in
  `Layout.astro` and two in the UI need updating.
- **P0-6 (notifications):** the pipeline is now **verified end-to-end with the production
  Resend key** — a test booking saved to D1 and a test email was delivered to the Resend
  account owner (jamie@xfcgym.com.au). One step remains, and it is not code: **verify the
  `xfcgym.com.au` domain in Resend** (DNS records), then set `RESEND_API_KEY` and
  `BOOKING_FROM` in Cloudflare Pages. Exact steps are in the README.

Three further items now need a **decision or sign-off from the business**, not code:

- **Privacy policy** (`/privacy/`) is a working draft written to match what the code
  actually collects. It has not been legally reviewed, and one section is marked
  "TO CONFIRM" (email provider, retention period, any CRM that receives the data).
- **Rating markup was removed.** The `5.0 / 47 reviews` figures were unverified and the
  markup was invalid. Re-add it only once the numbers reflect reviews shown on this site.
- **Analytics is inert until `PUBLIC_GA_ID` is set** in Cloudflare Pages.

**Two quality ceilings remain and cannot be closed with the current asset library**
(confirmed with the business — the site runs on existing images):

- The hero is served at 1200px. On a 1440px viewport at 2x device-pixel-ratio it is scaled
  about 2.4x (down from 4.5x). The largest source in the repo is 1200x1500.
- The four coach portraits are 257x325, painted at up to 736 device px. These are the only
  copies that exist.
- The head-coach and Jamie portraits still carry a third-party watermark
  ("KICKBOXING.COM.AU / Photo By: Terry Vong / Copyright © 2014"). This is a **licensing
  question, not a technical one**, and it is unresolved.

The original verdict below is retained as the record of what was found at audit time.

---

## Verdict (at time of audit)

**Do not ship yet.** The site looks close, but there are nine blocking defects, two of
which are severe enough to lose customers on contact:

1. **A mobile visitor who opens the menu cannot close it.** The overlay covers its own
   close button, Escape does nothing, and page scroll is locked. The only exits are
   navigating away or reloading. Most gym traffic is mobile.
2. **Trial enquiries go into a database that nobody is notified about.** The booking form
   is the site's only conversion path, and there is no email alert, no webhook, and no
   admin view. Leads will accumulate silently.

Beyond those, `npm ci` fails outright (so a clean CI build cannot install dependencies),
two of ten class cards never render, the words `&AMP;` are visible in three coach titles,
and the homepage's "5-Star Google Rating" badge renders as five **hollow** stars — which
reads as a zero-star rating on the most valuable piece of social proof on the site.

None of these are speculative; every item below was reproduced against a production build.

---

## How this was tested

| Method | Detail |
| --- | --- |
| Static review | All 2,298 lines of `src/` and `functions/` read in full |
| Production build | `pnpm build` → 7 pages, verified against emitted HTML/CSS |
| Live browser | Chromium via Playwright at 1440×900 (1×) and 390×844 (2×, touch) |
| Checks run | Console/JS errors, failed requests, computed styles, WCAG contrast maths, tap-target sizing, image upscale ratios, keyboard/AT exposure, heading order, interaction flows (program tabs, timetable filters, mobile menu, form submit) |
| Type check | `npx tsc --noEmit` |

**Two findings from an early pass were false positives and have been withdrawn:** the
scroll-reveal animation and the `/coaches/` team grid both work correctly. An initial
automated scroll raced the `scroll-smooth` behaviour and reported them as invisible. After
re-testing with smooth scrolling disabled and the observer allowed to settle, only the two
`/classes/` cards below are genuinely stuck. Similarly, an early report of "1×1 pixel
images" was a bad parse of the JFIF density field — **all image assets are intact.**

---

## P0 — Blockers

### P0-1 · Mobile menu cannot be closed
`src/components/Nav.astro:100-113, 128-145, 169`

`.nav-header` is `z-index: 50`. The hamburger inside it declares `z-index: 60`, but that
only ranks it *within* the header's stacking context — it cannot escape the parent. The
overlay is `z-index: 55`, so the whole header, close button included, sits underneath it.

Verified: with the menu open, `document.elementFromPoint()` at the hamburger's centre
returns `mobile-overlay`. Playwright's click timed out with *"mobile-overlay intercepts
pointer events"*. Escape is not bound. `document.body.style.overflow = 'hidden'` means the
page cannot be scrolled either.

**Fix:** move the hamburger outside `.nav-header` (or raise the header above the overlay),
bind Escape, and add a focus trap with focus restore.

### P0-2 · `npm ci` and `npm install` both fail
`package.json`, `package-lock.json`, `pnpm-lock.yaml`

`@astrojs/tailwind@6.0.2` declares `peerDependencies: { astro: "^3 || ^4 || ^5" }`, but
`package.json` pins `astro: ^6.1.9`. npm exits `ERESOLVE`. Only pnpm installs, because it
tolerates the mismatch.

Compounding this, **two lockfiles are committed with different resolutions** —
`package-lock.json` pins astro `6.1.9`, `pnpm-lock.yaml` resolves `6.4.8`. Which one
Cloudflare Pages honours decides what actually ships.

**Fix:** delete `package-lock.json`, commit pnpm only, and set the Pages build command
explicitly. `@astrojs/tailwind` is also deprecated and unsupported on Astro 6 — plan the
move to the Tailwind Vite plugin, or pin Astro to 5.x for launch.

### P0-3 · Two of ten class cards never become visible
`src/layouts/Layout.astro:151-163` · `src/pages/classes.astro:145`

`.reveal-stagger > *` sets `opacity: 0`, and `.visible` restores it for `nth-child(1)`
through `(8)` only. The class grid has **ten** children, so **Boxing** and **Adults
Sparring** stay permanently transparent, leaving a large empty void mid-page. Boxing is a
headline program.

Reproduced on desktop and mobile after a full settled scroll.

**Fix:** replace the eight hardcoded nth-child rules with a CSS-variable delay
(`transition-delay: calc(var(--i) * 100ms)`) or cap the delay and restore opacity for all
children.

### P0-4 · Literal `&AMP;` visible in coach titles
`src/pages/coaches.astro:7,16,23` · `src/pages/index.astro:41,51,58`

The data uses the HTML entity `&amp;` inside a JavaScript string. Astro escapes `{}`
output, so it emits `&amp;amp;` and the browser paints the text `&amp;`. Because the
elements are `text-transform: uppercase`, visitors read:

> HEAD COACH **&AMP;** CO-FOUNDER
> MUAY THAI **&AMP;** KICKBOXING COACH
> COACH — MMA **&AMP;** KICKBOXING

Three instances on `/coaches/`, two on `/`. Note the neighbouring `credentials` arrays use
a plain `&` and render correctly, so the bug looks like sloppy proofreading.

**Fix:** use a literal `&` in the data.

### P0-5 · 88px blank band above the hero
`src/components/Nav.astro:212` · `src/pages/index.astro:80`

The nav is `position: fixed` **and** an 88px spacer `<div>` is rendered after it. A
`100vh` hero therefore starts 88px down instead of underneath the transparent nav.

Measured at a genuine `scrollY === 0`:

| Viewport | Hero top | Hero height | Viewport | Below fold |
| --- | --- | --- | --- | --- |
| 1440×900 | 88px | 900px | 900px | 88px |
| 390×844 | 88px | 844px | 844px | 88px |

This defeats the design intent (the nav is transparent precisely so it can sit over the
hero), puts a black bar above the first impression, and pushes the hero's bottom 88px
below the fold on every device.

**Fix:** drop the spacer on pages with a full-bleed hero (or make the hero
`margin-top: -88px`), and keep the spacer only for the interior pages that need it.

### P0-6 · Booking submissions notify nobody
`functions/api/booking.ts`

The handler inserts a row into D1 and returns `{success: true}`. There is no email, no
webhook, no Slack/SMS, and no admin page. Nothing in the repo reads the `bookings` table.
Every trial enquiry — the site's sole conversion — lands in a database with no process
attached to it.

**Fix (launch-critical):** send a notification on insert (MailChannels is free on
Cloudflare Workers; Resend/Postmark otherwise) to the gym inbox, plus an autoresponder to
the enquirer. Add a documented fallback for send failures so a lead is never lost.

### P0-7 · Booking endpoint is open and unvalidated
`functions/api/booking.ts:7-9, 11-14, 19`

- `Access-Control-Allow-Origin: '*'` on a POST that writes to the database — any website
  can insert rows.
- No honeypot, rate limit, or CAPTCHA.
- Presence-only validation (`!b.name || !b.email`) — no email format check, so an
  unreachable lead is accepted as valid.
- No length caps — a large `message` payload can bloat D1.
- `error: String(e)` returns internal error text to the browser.

**Fix:** restrict CORS to the site origin, add a honeypot plus Turnstile, validate email
shape, cap field lengths, and return a generic error message while logging detail
server-side.

### P0-8 · Google Maps embed renders as a blank grey box
`src/pages/facilities.astro:115`

The "Find Us" map is empty in the browser. The embed URL's place identifier
`0x6ad613a4a3a8f3e5:0x6f3c3c3c3c3c3c3c` is almost certainly fabricated — the second half
is the byte `3c` repeated — and `!4v1` is not a valid version timestamp.

*Caveat:* this sandbox blocks `google.com`, so the observed `ERR_CONNECTION_RESET` is
environmental and not proof on its own. The synthetic-looking identifier is the real
concern.

**Fix:** regenerate the embed from Google Maps for the actual listing and confirm it
renders from a public URL. Add a `title` attribute while you are there (see P2-9).

### P0-9 · Two different phone numbers
`src/components/Footer.astro:50` · `src/pages/join.astro:32` · `src/layouts/Layout.astro:51`

| Location | Number |
| --- | --- |
| Footer link + form error message | **(03) 9770 8401** |
| schema.org `telephone` | **+61 3 9775 0046** |

These are different businesses' worth of digits apart. Google reads the structured data,
so a wrong number there sends callers elsewhere and corrupts the local listing.

**Fix:** confirm the correct number and use one canonical value everywhere.

---

## P1 — High

### P1-1 · `<Icon>` silently discards its `class` and `style` props
`src/components/Icon.astro:16, 53`

```js
svg.replace('class="', 'class="' + cls + ' ')
```

None of the 28 inline SVG strings contain a `class` attribute, so the replacement never
matches and the prop is dropped. `style` is destructured and never used at all. Verified in
the built HTML: the footer's map-pin renders with **no `class` attribute whatsoever**.

Every `<Icon class="…">` on the site is inert. Confirmed consequences:

- **The hero "5-Star Google Rating" badge shows five hollow white outline stars.** The gold
  class is dropped *and* the `star-filled` glyph is defined `fill="none"`, so the site's
  headline social proof visually reads as **zero stars**.
- Footer contact icons render muted grey instead of gold.
- Every `text-2xl` / `text-3xl` size class is ignored — all icons render at 24px.
- Join page pricing-card icons lose `block`, so they sit small and left-aligned against
  centred text.
- Timetable day-header chevrons lose `md:hidden`, so a dropdown affordance appears on
  desktop where the accordion is never wired up (it only binds below 768px).

**Fix:** render the SVG with real attributes instead of string replacement — pass
`class`, `width`, `height`, and `style` through as Astro attributes — and give
`star-filled` a `fill="currentColor"`.

### P1-2 · Instagram "Previous slide" button is empty
`src/pages/index.astro:371` · `src/components/Icon.astro:18-47`

`<Icon name="chevron-left" />` — but `chevron-left` is not in the icon map, so the
component returns nothing. Built output:

```html
<button class="ig-gym-arrow" id="ig-gym-prev" aria-label="Previous slide"></button>
```

The visitor sees an empty gold-outlined square beside a working right arrow.

**Fix:** add the `chevron-left` glyph. Consider failing loudly on an unknown icon name in
dev so this cannot recur.

### P1-3 · `<Icon>` used inside client-side `innerHTML`
`src/pages/index.astro:278` · `src/pages/join.astro:221, 245`

Astro components do not exist at runtime, so these strings inject a literal, unrendered
`<icon>` element. Verified:

- Clicking **any** program tab on the homepage replaces the CTA's working arrow SVG with
  `<icon name="arrow-right"></icon>` — 1 literal element injected, 0 SVGs remaining.
- Submitting the join form never shows the loading spinner, and the button's arrow does not
  return afterwards.

**Fix:** build these nodes from the same inline SVG markup, or toggle pre-rendered spans
rather than rewriting `innerHTML`.

### P1-4 · All six Tailwind opacity-on-`var()` utilities generate no CSS

Tailwind cannot apply an alpha modifier to `var(--x)` — it has no colour channels to work
with — so the class is silently never emitted. All six were verified absent from the built
stylesheet:

| Class | Uses | Visible effect |
| --- | --- | --- |
| `bg-[var(--accent-primary)]/10` | 5 | Facilities feature-icon tiles have no gold background; timetable's active filter button has no tint; Today badge has no fill |
| `border-[var(--accent-primary)]/20` | 4 | Hero badge border, Today badge border, coach-card hover border all missing |
| `border-[var(--accent-primary)]/30` | 1 | Class-card hover border does nothing |
| `bg-[var(--bg-primary)]/30` | 1 | Timetable day headers lose their distinguishing background |
| `bg-[var(--accent-primary)]/[0.03]` | 1 | Today's row highlight never applies |
| `text-[var(--accent-light)]/80` | 1 | Coach chips on the homepage hover overlay |

**Fix:** define the palette as HSL/RGB channel triplets in `tailwind.config.mjs` so
Tailwind can compose alpha (`bg-xfc-gold/10`), or hand-write the six rules as plain CSS.

### P1-5 · Timetable "Boxing" filter also returns Kickboxing
`src/pages/timetable.astro:196`

`cats.includes(filter)` is a substring test, and `"kickboxing".includes("boxing")` is
`true`. Verified: the Boxing filter returns 9 rows including *Kickboxing / Muay Thai*.

**Fix:** store categories as an array and compare exactly (or split on whitespace).

### P1-6 · The hero paints a 640px image across the full viewport
`src/pages/index.astro:82-89`

Three layers stack in the hero: a `<picture>` with a correct 400/800/1200w `srcset`, then
two `.hero-bg` divs whose `background-image` hardcodes the **640×800** `fighter-stance-cage.webp`.
The divs come later in the DOM and paint on top, so the `<picture>` is invisible.

Verified: the browser downloads `fighter-stance-cage-1200w.webp`, then covers it, and
`.hero-bg` paints the 640px file across 1440 CSS px — **2,880 device px at 2× (a 4.5×
upscale)**. The responsive-image work is entirely wasted and the first thing every visitor
sees is soft.

**Fix:** delete the two `.hero-bg` divs and drive the crossfade with the `<picture>`
element (or point the backgrounds at the 1200w asset via `image-set()`). Source a
≥1920px-wide hero.

### P1-7 · Class filter is unusable by keyboard or screen reader
`src/pages/classes.astro:97`

`.class-filter input[type="radio"] { display: none; }` removes all five radios from the tab
order *and* the accessibility tree. The CSS-only filter works with a mouse and is
completely inoperable otherwise.

**Fix:** hide with a clipping `.sr-only` pattern instead of `display: none`, and add a
visible `:focus-visible` style on the labels.

### P1-8 · Mobile timetable shows zero classes on load
`src/pages/timetable.astro:126, 203-219`

All six days collapse by default below 768px, and the day's hours are `hidden md:inline`.
A mobile visitor's first view of the timetable is six bare day names and nothing else.
Applying a filter then yields a blank screen until each day is tapped open.

This is the highest-intent page on the site — people checking whether class times fit
their week.

**Fix:** expand today (or the first day) by default, show hours at every breakpoint, and
auto-expand any day with matches when a filter is applied.

### P1-9 · No analytics or conversion tracking of any kind

No GA4, Google Ads tag, Meta pixel, or privacy-friendly alternative anywhere in `src/` or
`public/`. There is no way to tell whether the $39 trial funnel converts, where enquiries
originate, or whether ad spend works.

**Fix:** add GA4 (or Plausible/Umami) plus a `form_submit` conversion event, behind a
consent mechanism if you intend to advertise into the EU/UK.

### P1-10 · No privacy policy for a form that collects personal information

The form collects name, email, phone, and free text that explicitly invites *"age of
child"* and *"injuries"* — health and children's data — and asserts the user "agrees to be
contacted". There is no privacy policy page and no footer link. Australian Privacy Act
APP 5 expects a collection notice at the point of collection.

**Fix:** publish a privacy policy, link it from the footer and beside the submit button,
and add a parent/guardian consent line for junior enrolments.

### P1-11 · No custom 404 page

There is no `src/pages/404.astro`, so Cloudflare Pages serves its generic error page with
no XFC branding and no route back into the site.

### P1-12 · No security headers
`public/_headers`

Only caching rules are set. Missing `X-Content-Type-Options`, `Referrer-Policy`,
`Permissions-Policy`, `Strict-Transport-Security`, and any CSP / `frame-ancestors`.

### P1-13 · Year-long `immutable` caching on unhashed filenames
`public/_headers:1-2`

`/images/*` is served `max-age=31536000, immutable`, but the filenames are not
content-hashed (`xfc-logo.png`, `coaches-hero.jpg`). **Replacing any photo will not reach
returning visitors for twelve months.** Separately, `/videos/*` (5.3 MB) has no cache rule
at all.

**Fix:** keep `immutable` for `/_astro/*` and `/fonts/*` (which are hashed), drop
`/images/*` to something like `max-age=86400, stale-while-revalidate=604800`, and add a
long cache for `/videos/*`.

---

## P2 — Medium

| # | Finding | Location |
| --- | --- | --- |
| P2-1 | Sitemap URLs omit trailing slashes while canonicals include them, so every entry points at a URL that canonicalises elsewhere. Static file, no `<lastmod>`. | `public/sitemap.xml` |
| P2-2 | Internal links inconsistent with the nav: `/join` ×5, `/coaches` ×2, `/timetable` ×2 — each costs a redirect hop. | `index`, `classes`, `coaches`, `facilities` |
| P2-3 | Standalone `AggregateRating` node is invalid for Google (it must be a property of the business, not a sibling). Self-serving review markup also risks a manual action, and `5.0` / `47 reviews` needs substantiating. | `Layout.astro:53-55` |
| P2-4 | `openingHoursSpecification` contradicts itself — a Mon–Thu block plus separate Tue/Wed/Thu entries. | `Layout.astro:51` |
| P2-5 | schema.org `image` is a relative path; structured data requires absolute URLs. | `Layout.astro:51` |
| P2-6 | `og:image` is a 640×800 portrait — wrong aspect and below the 1200×630 minimum for `summary_large_image`, so link previews will crop badly. | `Layout.astro:11` |
| P2-7 | The hero webp is preloaded `fetchpriority="high"` on **every** page, competing with each page's own hero (`/coaches/` also eager-loads `coaches-hero.jpg`). | `Layout.astro:21` |
| P2-8 | Mobile menu a11y: no `aria-expanded`, no `aria-controls`; the closed overlay keeps six links focusable and screen-reader-visible (hidden by opacity alone); no focus trap or restore; no Home link. | `Nav.astro:128-145, 192, 199` |
| P2-9 | Map `iframe` has no `title`, so assistive tech announces only "frame". | `facilities.astro:114` |
| P2-10 | No `autocomplete` on any of the six form fields (breaks mobile autofill); no `inputmode="tel"` on phone. | `join.astro:41-138` |
| P2-11 | The success banner sits above a long form; after submitting from the bottom the user sees no confirmation without scrolling up. No scroll-into-view, no focus move, no `role="status"`. | `join.astro:28, 235` |
| P2-12 | Filtering leaves empty day cards (BJJ leaves Wednesday and Saturday as bare headers) and there is no "no classes match" state. | `timetable.astro:191-198` |
| P2-13 | The timetable page has **no CTA** — the highest-intent page dead-ends into the footer. | `timetable.astro` |
| P2-14 | The videos page has no trial CTA, only an Instagram link. | `videos.astro:37-42` |
| P2-15 | Every class card links to bare `/timetable`; deep-linking the filter (`/timetable/?filter=bjj`) would carry intent through. | `classes.astro:155` |
| P2-16 | Timetable data is triplicated across the page, `schema.sql`, and the API — and the categories disagree (`intake`/`assessment`/`sparring` in the DB vs `mma kickboxing`/`junior` on the page). The page never calls the API. | `timetable.astro:5-81`, `schema.sql` |
| P2-17 | `ORDER BY day` on a TEXT column returns alphabetical order (fri, mon, sat, thu, tue, wed), not week order. | `functions/api/timetable.ts:7` |
| P2-18 | `src/worker/index.ts` and `src/worker/schema.sql` are dead code duplicating the Pages Functions; they never deploy under `pages_build_output_dir`. | `src/worker/` |
| P2-19 | 9 TypeScript errors: `@cloudflare/workers-types` is not a dependency, so `D1Database` and `PagesFunction` are unresolved and the API layer is untyped. Astro's build does not check `functions/`, so this is invisible at build time. | `functions/`, `package.json` |
| P2-20 | Contrast failures: coach credential chips **2.32:1** (`#AAAAAA` on `rgba(255,255,255,0.06)`, needs 4.5:1); footer copyright and form disclaimer at `text-white/20`; mobile menu links muted grey on black; the coaches hero body copy sits over faces. | multiple |
| P2-21 | Tap targets below 44px on mobile: program tabs 36px tall, carousel arrows 40×40, footer social 36×36, footer email/phone links 20px tall. | `index.astro`, `Footer.astro` |
| P2-22 | The nav logo is a 96×96 source rendered at 80px — 160 device px at 2×, so it is blurry on every modern phone. `xfc-banner-logo.png` (700×700) is already in the repo. | `Nav.astro:173` |
| P2-23 | `bw-training.jpg` is 257×325 **portrait** but fills 16:10 landscape cards for Kickboxing Advanced and Boxing — heavy crop plus upscale to 411 device px. Coach headshots (257×325) upscale to 409 device px. | `classes.astro`, `coaches.astro` |
| P2-24 | Duplicate photography: `two-on-mats.jpg` on both Junior Warriors and BJJ; `sparring-cage.jpg` on MMA and Adults Sparring; `bw-training.jpg` on KB Advanced and Boxing. Visibly repeats within one viewport. | `classes.astro` |
| P2-25 | `wp-our-facility.png` is a **1.5 MB** 1920×540 PNG panorama cropped into a 500×384 box — the largest image on the site, showing a meaningless slice. | `facilities.astro:6` |
| P2-26 | The head-coach and Jamie portraits carry a third-party watermark — *"KICKBOXING.COM.AU / Photo By: Terry Vong / Copyright © 2014"* — on the two most prominent faces on the site. Licensing and professionalism risk. | `haysem-abdallah-c.jpg`, `jamie-abdallah-c.jpg` |
| P2-27 | The facilities strip holds 17 photos with no arrows and no keyboard affordance; a desktop mouse user cannot scroll it horizontally. The first panorama also appears clipped at the viewport edge. | `facilities.astro:53` |
| P2-28 | The Instagram carousel auto-advances every 3.5s with no pause or stop control (WCAG 2.2.2). | `index.astro:506-518` |
| P2-29 | The hero rotates on a permanent 5s `setInterval` with no `visibilitychange` pause — it keeps running in background tabs. | `index.astro:139-148` |
| P2-30 | `<video loading="lazy">` — not a valid attribute on `<video>`. | `videos.astro:27` |

---

## P3 — Low / polish

- Video titles are placeholders ("Coach Sessions", "Fight Night Recap"); no captions or
  `<track>`, and no `VideoObject` schema.
- **~2 MB of unreferenced images ship in the build** — `class-*.png` (5 files, ~2 MB alone),
  plus `gym-1…5`, `facility-1…3,6`, `footer-bg`, `become-champion`, `image-intake`,
  `timetable.jpg`, `xfc-banner-logo`, and several `instagram/*`.
- `dion-douglas-c.jpg` is a coach headshot for someone who appears nowhere on the site —
  possibly a missing coach profile.
- FAQ content is not marked up as `FAQPage` schema (easy rich-result win).
- Heading order skips: `h2 → h4` in the footer on every page; `h1 → h3` on classes/videos.
- `<html lang="en">` while `og:locale` is `en_AU`.
- Only `favicon.ico` is referenced; `favicon.svg` / `favicon.png` ship unused. No
  `apple-touch-icon`, `theme-color`, or web manifest.
- Reviews are hardcoded with first-name-plus-initial attribution under a "5-Star Google
  Reviews" heading — confirm provenance and permission before launch.
- No About or Contact page; contact details exist only in the footer.
- `bookings.created_at` defaults to `datetime('now')` (UTC) — leads will read ~10 hours off
  Melbourne time.
- `class_interest` stores raw slugs (`junior-little-warriors`), so whoever reads the table
  sees slugs rather than labels.
- No Home link anywhere in the nav (desktop relies on the logo; the mobile overlay has
  neither).
- `README.md` is still the stock Astro template.
- Dead CSS: `.nav-cta` declares `display: none` twice.
- Build warning: `Generated an empty chunk: "index.astro_astro_type_script_index_3_lang"` —
  the placeholder comment-only script at `index.astro:575-577`.

---

## Remediation plan

Ordered so that each phase is independently shippable. Estimates are for one developer
familiar with the codebase.

### Phase 1 — Ship blockers (~1 day)

Everything here is a correctness or revenue defect.

| Task | Items | Est. |
| --- | --- | --- |
| Fix the mobile menu stacking, add Escape + focus trap | P0-1, P2-8 | 1.5h |
| Resolve dependencies: drop `package-lock.json`, pin the Astro/Tailwind pairing, add `@cloudflare/workers-types`, set the Pages build command | P0-2, P2-19 | 1.5h |
| Rewrite `reveal-stagger` to handle any child count | P0-3 | 0.5h |
| Replace `&amp;` with `&` in coach/program data | P0-4 | 10m |
| Remove the nav spacer on full-bleed hero pages | P0-5 | 0.5h |
| Booking notifications: email to gym + autoresponder, with a fail-safe | P0-6 | 3h |
| Harden the booking endpoint: same-origin CORS, honeypot + Turnstile, email/length validation, generic errors | P0-7 | 2h |
| Regenerate and verify the Maps embed | P0-8 | 20m |
| Confirm the phone number and unify it everywhere | P0-9 | 15m |

**Gate:** re-run the browser suite; verify a real submission arrives in the gym inbox.

### Phase 2 — Visible quality (~1 day)

The site currently looks unfinished in ways customers notice.

| Task | Items | Est. |
| --- | --- | --- |
| Rewrite `Icon.astro` to pass attributes properly; fix `star-filled` to `fill="currentColor"`; add `chevron-left` | P1-1, P1-2 | 1.5h |
| Remove `<Icon>` from all `innerHTML` strings | P1-3 | 1h |
| Move the palette to channel-based colours so alpha modifiers work; verify all six utilities emit | P1-4 | 1.5h |
| Fix the Boxing/Kickboxing filter to exact matching | P1-5 | 20m |
| Rebuild the hero to use the `<picture>`/srcset it already ships; source a ≥1920px asset | P1-6 | 1.5h |
| Make the class filter keyboard- and AT-operable | P1-7 | 45m |
| Mobile timetable: expand today, show hours at all breakpoints, auto-expand on filter | P1-8 | 1.5h |
| Add a custom 404 page | P1-11 | 30m |

**Gate:** confirm the rating badge shows five **filled gold** stars; walk every page on a real phone.

### Phase 3 — Launch readiness (~1 day)

Compliance, measurement, and operational safety.

| Task | Items | Est. |
| --- | --- | --- |
| Analytics + `form_submit` conversion event | P1-9 | 1.5h |
| Privacy policy page, footer + form links, guardian consent line | P1-10 | 2h |
| Security headers in `_headers` | P1-12 | 30m |
| Correct the caching strategy for `/images/*` and `/videos/*` | P1-13 | 30m |
| SEO correctness: generate the sitemap with `@astrojs/sitemap`, normalise trailing slashes, nest `aggregateRating`, deduplicate opening hours, absolute schema `image`, a proper 1200×630 `og:image` | P2-1 … P2-7 | 2.5h |
| Accessibility sweep: `iframe` title, form `autocomplete`, success-banner focus + `role="status"`, contrast repairs, 44px tap targets | P2-9, P2-10, P2-11, P2-20, P2-21 | 2.5h |

**Gate:** Lighthouse ≥ 90 on Performance / Accessibility / SEO; axe clean on all seven pages.

### Phase 4 — Content & asset pass (~0.5 day, needs the client)

Blocked on the gym supplying material, so start the request now.

- **Replace the watermarked coach portraits** (P2-26) — a licensing question, not just a
  visual one. Request higher-resolution headshots at the same time (P2-23).
- Supply distinct photography for the duplicated class cards (P2-24).
- Convert `wp-our-facility.png` to WebP at display size — a ~1.45 MB saving (P2-25).
- Provide a ≥1920px hero image (feeds P1-6).
- Real video titles; confirm review provenance and the `47` / `5.0` rating claim (P2-3).
- Confirm whether Dion Douglas should have a coach profile.
- Supply a retina-quality logo (P2-22).
- Prune the ~2 MB of unreferenced images.

### Phase 5 — Post-launch enhancements (backlog)

- Drive the timetable from D1 via the existing API instead of triplicated hardcoded data,
  and reconcile the category taxonomy (P2-16, P2-17). Removes a whole class of drift.
- Delete the dead `src/worker/` duplicate (P2-18).
- CTAs on the timetable and videos pages; deep-linked filters from class cards
  (P2-13, P2-14, P2-15).
- Arrow controls and keyboard support for the facilities strip; a pause control for the
  Instagram carousel (P2-27, P2-28).
- `FAQPage` and `VideoObject` schema; heading-order cleanup.
- A simple admin view (or scheduled digest) over the `bookings` table.
- Per-class detail pages — currently every class funnels to the same timetable.

---

## Suggested go/no-go criteria

1. Phases 1–3 complete and verified.
2. A real form submission reaches the gym's inbox, end to end, from the production domain.
3. The Maps embed renders on the live domain.
4. Verified on a physical iPhone and Android device — with specific attention to opening
   **and closing** the mobile menu.
5. Phone number, address, and opening hours confirmed by the client and consistent across
   the footer, structured data, and Google Business Profile.
6. Privacy policy live and linked before any advertising traffic is sent.

---

## Changelog — Phase 1 (blockers)

All nine P0 items addressed. Verified with a 23-assertion browser suite (desktop 1440×900
and mobile 390×844 @2× touch), `pnpm build`, and `npx tsc --noEmit`.

| Item | What changed | Files |
| --- | --- | --- |
| P0-1 | Header raised to `z-index: 60` so it sits above the overlay and the close button stays tappable. Added Escape-to-close, a Tab focus trap that keeps the hamburger reachable, focus restore, `aria-expanded` / `aria-controls`, `visibility: hidden` when closed (so the links leave the tab order and a11y tree), a Home link, and a resize guard that prevents a scroll-locked body behind a hidden overlay. | `Nav.astro` |
| P0-2 | Pinned `astro@^5.18.2` (a combination `@astrojs/tailwind@6` actually supports), deleted `package-lock.json`, pinned `packageManager: pnpm@11.17.0`. `npm install` now resolves cleanly; `pnpm peers check` reports no issues. | `package.json`, `package-lock.json` (removed) |
| P0-3 | `.reveal-stagger.visible > *` now restores opacity for **every** child, with the per-child rules only setting the delay. Previously children beyond the eighth stayed transparent forever. | `Layout.astro` |
| P0-4 | Replaced the HTML entity `&amp;` with a literal `&` in the coach and program data, which Astro was double-escaping into a visible `&AMP;`. | `coaches.astro`, `index.astro` |
| P0-5 | Removed the 88px spacer `<div>` (and the JS that resized it, which also caused a 24px content jump on scroll). Replaced with a `navOverlay` prop: full-bleed hero pages let the hero run under the transparent nav; interior pages offset `<main>` by 88px instead. | `Nav.astro`, `Layout.astro`, `index.astro`, `coaches.astro` |
| P0-6 | Booking notification email to the gym plus an autoresponder to the enquirer, via Resend. Runs in `waitUntil` so it never delays the response, and never fails the request — the D1 write stays the source of truth and unconfigured/failed sends are logged loudly. Class slugs are mapped to readable labels and the timestamp is rendered in Melbourne time. | `booking.ts`, `README.md` |
| P0-7 | Cross-origin POSTs rejected with 403 (CORS alone does not stop the write). Added an off-screen honeypot, optional Turnstile verification, email-shape validation, per-field length caps, and generic client-facing errors with detail logged server-side. | `booking.ts`, `join.astro` |
| P0-8 | Replaced the hand-built `pb=` embed and its invalid place ID with a keyless address-query embed, and added an `iframe` title. | `facilities.astro` |
| P0-9 | Unified on `(03) 9770 8401`; structured data updated to `+61397708401`. **Needs client confirmation** (see Status). | `Layout.astro` |
| P2-19 | Added `@cloudflare/workers-types` and wired it into `tsconfig.json`. The 9 pre-existing type errors in `functions/` are resolved; `tsc --noEmit` is clean. | `package.json`, `tsconfig.json` |

Also folded in while touching the same files: the form now surfaces the server's validation
message (e.g. an invalid email) instead of a generic failure, and the stock Astro
`README.md` was replaced with real setup, D1, and environment-variable documentation.

**Deliberately left for Phase 2** — the hollow rating stars, the empty carousel arrow, and
the icon sizing/colour problems all stem from the single `Icon.astro` prop bug (P1-1) and
are fixed together there.


---

## Changelog — Phase 2 (visible quality)

Verified with a 48-assertion browser suite covering both viewports, plus `pnpm build` and
`npx tsc --noEmit`.

### Regression caught and fixed

**The Phase 1 dependency fix (P0-2) had been silently reverted.** A `git checkout --
package.json` in the Phase 1 cleanup step — intended only to drop a temporary test
dependency — also reverted the Astro pin and the `@cloudflare/workers-types` entry before
they were committed. `package-lock.json` was correctly deleted, but the committed
`package.json` still requested `astro@^6.1.9`, so `npm install` still failed and
`tsconfig.json` referenced a package that was no longer declared.

This is now re-applied and, more importantly, **guarded**: the QA suite asserts the
manifest state directly (`astro` pinned to 5.x, workers-types declared, `packageManager`
pinned, no `package-lock.json`, `npm install --dry-run` resolves, `tsc --noEmit` clean)
rather than trusting that a browser pass implies a correct build. A `pnpm check` script
(`tsc --noEmit && astro build`) was added as the single command to run before committing.

### Fixes

| Item | What changed | Files |
| --- | --- | --- |
| P1-1 | `Icon.astro` rewritten. Icons are stored as inner path markup and rendered into a real `<svg>`, so `class`, `style`, and `size` arrive as genuine attributes. The old code string-replaced `class="` inside markup that had no `class` attribute, so **every** class passed to the component was dropped. `star-filled` now renders `fill="currentColor"` — the hero's "5-Star Google Rating" badge showed five hollow outlines, reading as zero stars. Icons are `aria-hidden` by default with an optional `label`. | `Icon.astro` |
| P1-1 | `text-*` classes never sized an SVG (font-size does not drive width/height attributes). All 17 such usages converted to real `size` props. | `Footer.astro`, `index`, `join`, `coaches`, `facilities` |
| P1-2 | Added the missing `chevron-left` glyph. The Instagram carousel's "Previous slide" button rendered as an empty gold square. Unknown icon names now warn in dev instead of failing silently. | `Icon.astro`, `index.astro` |
| P1-3 | Removed all `<Icon>` usage from client-side `innerHTML`. Astro components do not exist at runtime, so those strings injected unrendered `<icon>` elements. The program slider now updates individual text nodes (leaving the arrow SVG intact) and the submit button toggles a pre-rendered spinner and arrow. | `index.astro`, `join.astro` |
| P1-4 | Palette moved to channel triplets (`--accent-primary-rgb: 184 150 46`) that both the global CSS and `tailwind.config.mjs` read, so alpha modifiers compile. All six previously-dead utilities now generate CSS: the facilities icon tiles, timetable filter tint, Today badge, day-header background, and the class/coach card hover borders all render as designed. | `tailwind.config.mjs`, `Layout.astro`, 5 pages |
| P1-5 | Timetable filtering now matches category tokens exactly. `cats.includes('boxing')` also matched `"kickboxing"`, so the Boxing filter returned Muay Thai classes. Verified: Boxing now returns 4 rows with no Kickboxing/Muay Thai. | `timetable.astro` |
| P1-6 | Deleted the two `.hero-bg` divs that hardcoded the 640px image on top of a correct `<picture>`/srcset — the browser downloaded the 1200w asset and then painted the small one. Replaced with two crossfading `<img>` layers driven by the srcset. Rotation now pauses on `visibilitychange`. **Delivered hero resolution goes from 640px to 1200px**; the residual upscale on large/2× screens needs a ≥1920px source (Phase 4, client). | `index.astro` |
| P1-7 | Class filter radios changed from `display:none` to clip-based hiding, restoring keyboard and screen-reader operation, with a forwarded `:focus-visible` ring on the labels. Verified operable via focus + activate. | `classes.astro` |
| P1-8 | Mobile timetable no longer loads as six bare day names: today expands by default (falling back to the first day), day hours show at every breakpoint, days with matches auto-expand when a filter is applied, and days with none show an explanation instead of an empty container. Headers are keyboard-operable with `aria-expanded`; filter buttons carry `aria-pressed`. | `timetable.astro` |
| P1-11 | Added a branded 404 page with the nav, four signposted routes, a trial CTA, and phone/email fallbacks. | `404.astro` |
| P2-7 | The hero preload was firing on every page against a file the new markup no longer uses. It is now homepage-only and carries `imagesrcset`/`imagesizes` matching the `<img>`, so preload and render resolve to the same asset. | `Layout.astro` |
| P2-11 | The success/error banner now scrolls into view and takes focus, with `role="status"` / `role="alert"`. Submitting from the bottom of a long form previously gave no visible confirmation. | `join.astro` |

### Known limitation

`P1-6` is fixed as far as the available artwork allows. The largest hero asset in the repo
is 1200×1500, so on a 1440px viewport at 2× device-pixel-ratio the image is still scaled
~2.4× (previously ~4.5×). Closing the gap requires the ≥1920px hero listed in Phase 4.


---

## Changelog — Phase 3 (launch readiness)

Verified with a 39-assertion suite that serves the **real** `_headers` CSP, so the policy
is proven not to break the site rather than assumed safe.

### Root-cause fix: one source of truth for business details

`src/data/gym.ts` now holds the name, address, phone, email, socials and opening hours.
The footer, JSON-LD, 404 page and privacy policy all read from it. This is the underlying
cause of P0-9 (two different phone numbers) and P2-4 (self-contradicting opening hours) —
those were symptoms of the same duplication, and the duplication is now gone.

| Item | What changed | Files |
| --- | --- | --- |
| P1-9 | GA4 plus a `generate_lead` conversion event on successful submit. Emitted **only** when `PUBLIC_GA_ID` is set at build time, so the site never ships a tag pointing at a property that does not exist. | `Layout.astro`, `join.astro` |
| P1-10 | Privacy policy at `/privacy/`, linked from the footer on every page and from beside the submit button, plus a parent/guardian note for junior enquiries. Written against what the code actually collects, including the health/child data the message field invites. Marked as needing legal review. | `privacy.astro`, `Footer.astro`, `join.astro` |
| P1-12 | Security headers: `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`, HSTS, and a CSP with `frame-ancestors`, `object-src 'none'` and `form-action 'self'`. Verified across all nine pages with zero violations. | `_headers` |
| P1-13 | `/images/*` dropped from `immutable` for a year (the filenames are not content-hashed, so replacing a photo would not reach returning visitors for 12 months) to daily revalidation with `stale-while-revalidate`. Added a rule for `/videos/*`. Hashed `/_astro/*` and `/fonts/*` stay immutable. HTML now revalidates so deploys are picked up. | `_headers` |
| P2-1 | Sitemap generated by `@astrojs/sitemap` with correct trailing slashes and per-route priorities, replacing the hand-maintained file whose URLs contradicted every canonical. 404 excluded; robots points at the index. Verified: every canonical exactly equals its sitemap entry. | `astro.config.mjs`, `robots.txt` |
| P2-2 | `trailingSlash: 'always'` plus normalised internal links, removing a redirect hop on every internal click. | `astro.config.mjs`, 4 pages |
| P2-3 | Removed the standalone `AggregateRating` node — invalid as a sibling, and the figures were unsubstantiated. **Client decision to re-add.** | `gym.ts` |
| P2-4 | Opening hours emit one entry per day from the shared data. The old markup had a Mon–Thu block *plus* conflicting per-day entries. | `gym.ts` |
| P2-5 | Structured-data `image` is now an absolute URL. | `gym.ts` |
| P2-6 | Generated `og-default.jpg` at 1200×630 (the `summary_large_image` requirement) from the hero art, cropped to the subject. The old default was a 640×800 portrait that every platform cropped badly. | `og-default.jpg`, `Layout.astro` |
| P2-10 | `autocomplete` on name/email/phone and `inputmode` on email/phone, so mobile autofill and keyboards work. | `join.astro` |
| P2-20 | Contrast repaired to WCAG AA: coach credential chips (were 2.32:1), footer copyright and form disclaimer (were `white/20`), mobile menu links, facilities hint. All nine pages now pass at AA with alpha-composited backgrounds. | 5 files |
| P2-21 | Tap targets raised to 44px: timetable filter buttons, program tabs, carousel arrows, footer social and contact links, footer privacy link, class-card and "Get Directions" links. | 6 files |
| — | `lang="en-AU"` to match `og:locale`; added `theme-color`, SVG favicon and `apple-touch-icon` (the files already shipped but were unreferenced). | `Layout.astro` |

### Two test-harness corrections worth recording

Both were faults in my verification, not in the site, and both would have produced false
confidence in the opposite direction if left unexamined:

1. The contrast checker was not alpha-compositing backgrounds, so white text on
   `rgba(255,255,255,0.05)` over a dark hero measured as 1.00:1 when the painted contrast
   is 16.3:1. Five "failures" were false. It now composites the full ancestor chain.
2. The tap-target check flagged the off-screen spam honeypot and inline links inside
   sentences. WCAG 2.5.8 exempts inline targets in a block of text; the honeypot is hidden
   by design. Both are now excluded, and the one genuine finding it was masking
   ("Get Directions") is fixed.


---

## Changelog — Phases 4 and 5 (existing assets only)

The business confirmed no new photography is available, so this pass extracted everything
achievable from the existing library. Verified with a 30-assertion suite plus a full
regression over all previous phases.

### The image library turned out to be heavily aliased

Hashing every file showed that most photos ship under two or three names. Consequences
found and fixed:

- **The facilities strip displayed the same photograph twice** —
  `wp-603801….jpg` and `facility-4.jpg` are byte-identical. Seven other alias groups exist.
- **Five purpose-built class photos were never wired up.** `class-boxing`, `class-thai`,
  `class-jitsu`, `class-strength` and `class-mma` are 700x500 landscape images named after
  the disciplines, sitting unused while the class cards repeated three photos between them.
- **`facility-1.jpg` is the boxing ring** — exactly what the Boxing card needed.

| Item | What changed | Files |
| --- | --- | --- |
| P2-24 | All ten class cards now use a distinct photo, drawn from the unused purpose-built set. Three images were previously each used twice. The homepage program tabs were aligned to the same per-discipline image, so a discipline looks consistent across pages. | `classes.astro`, `index.astro` |
| P2-23 | `bw-training.jpg` (257x325 **portrait**) no longer fills two 16:10 landscape cards, and no longer fills the ~519px-wide homepage program panel. Every card image is landscape. | `classes.astro`, `index.astro` |
| P2-25 | `wp-our-facility.png` — a 1.5 MB PNG panorama cropped into a 500x384 window — removed. The five class PNGs (323–499 KB each) converted to WebP at 11–26 KB. **`public/` went from 16 MB to 9.2 MB**, `public/images` to 3.8 MB. | `public/images` |
| — | **Facilities alt text rewritten.** Most of it described the wrong image: "Strength & Conditioning" was the boxing ring, and three "training session" labels were photographs of empty rooms. Every entry now describes what it actually shows. This was not in the original audit; it surfaced only once the photos were viewed. | `facilities.astro` |
| P2-13 | The timetable — the highest-intent page — ended at the footer. It now closes with a trial CTA and a click-to-call alternative. | `timetable.astro` |
| P2-14 | Videos page gained a trial CTA alongside the Instagram link. | `videos.astro` |
| P2-15 | Class cards deep-link into a pre-filtered timetable (`/timetable/?filter=bjj`), carrying intent through instead of dropping the visitor at the top of an unfiltered page. | `classes.astro`, `timetable.astro` |
| P2-27 | The facilities strip had 12 photos, no arrows and no keyboard access — a desktop mouse user could not scroll it at all. Added arrow controls that disable at each end, plus arrow-key support and a focus ring. | `facilities.astro` |
| P2-28 | The Instagram carousel auto-advanced every 3.5s with no way to stop it (WCAG 2.2.2). Added a pause/play toggle with correct `aria-pressed`, and it now starts paused under `prefers-reduced-motion`. | `index.astro`, `Icon.astro` |
| P2-17 | `ORDER BY day` on a TEXT column returned fri, mon, sat, thu, tue, wed. Replaced with explicit week ordering. Also dropped the wildcard CORS header from the read endpoint and added a short cache. | `functions/api/timetable.ts` |
| P2-18 | Deleted `src/worker/` — a duplicate of both Pages Functions plus a second copy of the schema, which never deployed under `pages_build_output_dir`. | `src/worker/` |
| P2-30 | Removed `loading="lazy"` from `<video>`, which is not a valid attribute there. | `videos.astro` |
| P3 | Added `FAQPage` structured data generated from the same list that renders the questions, so the two cannot drift. | `join.astro` |

### Assets preserved rather than deleted

Unique-but-unused files were moved to `docs/unused-assets/` instead of being destroyed:
`dion-douglas-c.jpg` (a coach headshot for someone who appears nowhere on the site — worth
checking whether a profile is missing), `gym-action.jpg/.webp`, `xfc-banner-logo.png/.webp`
(700x700, larger than the 96x96 logo the nav uses, which is why the nav logo is soft on
high-density screens), and `footer-bg.jpg`. Only byte-identical duplicates and
WebP-superseded PNGs were hard-deleted.

`docs/source-timetables/` holds the two timetable **screenshots** that were shipping as web
assets in `public/images/`. They are the business's source of truth for class times and are
worth checking the hardcoded timetable against — that has never been done.

### A near-miss worth recording

The first pruning pass deleted `instagram/01.jpg`–`23.jpg`, which the homepage carousel
does need: it builds paths from a template literal (`` `/images/instagram/${img}` ``), so a
plain search for literal `/images/...` strings found no reference to them. The files were
restored from git and the scan was rewritten to resolve template-literal prefixes against
nearby filename arrays. A "no broken images" assertion across all nine pages now guards it.

Three assertions in this suite also had to be corrected before they could be trusted:
lazy-loaded images report an empty `currentSrc` (read as duplicates), Adults Sparring
legitimately carries the `bjj` category so it *should* appear under that filter, and an
upscale is only actionable when a larger copy actually exists in the repo — otherwise it is
an asset ceiling, which is now reported separately as information rather than failure.


---

## Changelog — CRM contact form adoption (29 Jul 2026)

At the business's direction, lead capture moved to the gym's CRM-hosted form
(GoHighLevel, white-labelled as `links.xfcgymcarrumdowns.com`, form
`HnwaMqL7BCifiD79Dfj4`), so enquiries land directly in the CRM pipeline.

| Change | Detail |
| --- | --- |
| `ContactForm.astro` | Reusable wrapper around the vendor embed. Keeps the exact snippet attributes the resize script keys off, adds a 640px min-height so the form never renders collapsed before the resizer runs, and a phone/email fallback line beneath it. |
| `/join/` | The native booking form (fields, honeypot, submit handler, success/error banners, `generate_lead` event) replaced by the embed. Hero, pricing cards, FAQ and FAQ schema unchanged. |
| `/contact/` | New page: the form beside address/phone/hours cards, plus a trial CTA. Added to the nav (desktop + mobile), the 404 quick links (with Videos, keeping the grid even) and the generated sitemap. |
| CSP | `frame-src` and `script-src` now allow `links.xfcgymcarrumdowns.com`. Verified: zero CSP violations with the real header applied. `form_embed.js` was inspected — it is a postMessage iframe resizer with no network calls of its own. |
| Privacy policy | "How it is stored" and "Embedded content" rewritten: submissions go to the CRM platform, not D1/email. New TO CONFIRM: CRM retention period and whether automated SMS/email follow-ups fire (they must be disclosed if so). |
| Native pipeline | `/api/booking` + D1 + Resend stays deployed as a documented fallback but is no longer in the submission path. The Resend domain-verification task now only matters if that fallback is ever reactivated. |

**Verification (18 assertions):** exact embed markup on both pages, resizer script present,
no-collapse fallback holds, CSP clean, endpoints live (HTTP 200), nav/404/sitemap updated,
native form fully removed, FAQ schema intact, no JS errors. **One environment limit:** the
sandbox proxy resets Chromium's connections to the CRM domain (curl reaches it fine), so
the remote form document could not be rendered here — confirm visually on the deployed
site that the form loads and a test submission reaches the CRM.


---

## Changelog — full image/label sweep (29 Jul 2026)

The business flagged that class-card photos still didn't match their labels (adult
fighters under "Ages 7–9", a lone coach under "Ages 2–4"). The Phase 4 relabel had fixed
the facilities strip but trusted filenames elsewhere — and the filenames lie
(`team-floor-training.jpg` is a fight-night crowd; `class-strength.webp` is a grappling
class). This pass reviewed **every image on the site by eye** via labelled contact sheets,
then re-verified the rebuilt pages visually.

### Key constraint discovered

**The library contains no photographs of children**, while four cards advertise ages 2–13.
One partial exception: `kick-technique.jpg` shows junior students in class uniforms
watching a demonstration. Junior cards therefore use coach/venue/demo imagery with alt
text that describes the actual photo instead of claiming it shows toddlers.

### New defect found: the three "videos" were never playable

`13/15/21.mp4` are fragmented-MP4 media segments with no initialisation header (they begin
with a `moof` box; no `ftyp`/`moov`). No browser can play such files — every visitor to
/videos/ saw three dead players. The page now presents link tiles to the gym's Instagram
and YouTube (where the videos actually live), the broken files moved to
`docs/unused-assets/` with a forensic note, and the now-pointless `/videos/*` cache rule
was dropped.

### Reassignments

| Slot | Was | Now |
| --- | --- | --- |
| Little Warriors (2–4) | lone adult coach | bright junior training floor (venue) |
| Junior Warriors (5–6) | overhead adult sparring | coach introducing the program |
| Rising Warriors (7–9) | fight-night crowd | class watching a striking demo (juniors visible) |
| Elite Warriors (10–13) | adult in cage | supervised headgear sparring, overhead (faces hidden) |
| KB Advanced | near-duplicate of KB Beginner | cage sparring |
| Adults Sparring | grappling close-up (kept) | unchanged, alt corrected |
| Home "Kids" tab | lone adult coach | class demo with juniors visible |

### Other corrections

- **Class cards now carry `imageAlt`** describing the photo; previously `alt={cls.name}`
  claimed "Junior MMA — Little Warriors" over a photo of an adult.
- **Instagram carousel curated 23 → 13 slides**: removed two timetable screenshots
  shipping as "posts" (05, 15), a logo graphic (22), and seven duplicates
  (14/16/17/19/20/21/23 duplicate 02/07/08/11/10/03/13). Every remaining slide has
  descriptive alt text instead of "Instagram post N".
- **Facilities strip**: `team-floor-training.jpg` ("Team training session") is actually a
  fight-night crowd — replaced with a real mat-drilling photo; `facility-6` alt corrected
  (no heavy bags in shot).

Verified by rebuilding and visually reviewing /classes/, /videos/, /facilities/ and the
homepage Kids tab, plus reference integrity (35/35 image refs resolve) and a clean build.


---

## Changelog — final 2024 logo applied (7 Aug 2026)

The business supplied the master logo as an Illustrator file
(`docs/brand/xfc-logo-2024-v3-FINAL.ai`, PDF-compatible stream). It is the 2024 roundel —
ring text "KICKBOXING · MMA · BJJ · BOXING" — replacing the retired "Australian Top Team ·
Mixed Martial Arts" mark that the site had carried, which also resolves the "logo is wrong
colours" report (the old asset was a muddy 96px re-compression of the retired mark).

All logo assets are now rendered from the master at 2048px:

- `/images/xfc-logo.png` — 512px transparent PNG for the nav and footer. This also closes
  P2-22 (the nav logo was a 96px source painted at 160+ device px, blurry on every phone).
- `favicon.ico` — multi-size (16/32/48) PNG-in-ICO container.
- `favicon.png` — 180px apple-touch-icon with the site background baked in (iOS composites
  transparency onto black).
- `favicon.svg` — wrapper embedding a 128px render (no vector converter in this
  environment; indistinguishable at favicon sizes).

Verified in the built nav at 2x on desktop and mobile: crisp, correct colours, white
keyline separating the roundel from the dark background.

## Changelog — real class photography applied (19 Aug 2026)

The business supplied six genuine photos from the gym, each tied to a named class. These
replace the stock/adjacent imagery that the earlier sweep could only approximate from an
aliased library, so every class card now shows that actual class.

| Card | Was | Now |
| --- | --- | --- |
| Junior Warriors (5-6) | `instagram/coach-joey-intro.jpg` | `junior-warriors.webp` |
| Rising Warriors (7-9) | `instagram/kick-technique.jpg` | `rising-warriors.webp` |
| Kickboxing / Muay Thai Advanced | `instagram/sparring-cage.jpg` | `kickboxing-advanced.webp` |
| Mixed Martial Arts | `class-strength.webp` | `mma-cage.webp` |
| Boxing | `facility-1.jpg` (empty ring) | `boxing-pads.webp` |
| Adults Sparring | `class-mma.webp` | `adults-sparring.webp` |

Each source was cropped to the card's exact 16:10 box rather than left to `object-cover`,
so the framing is chosen deliberately instead of by the browser. Alt text was rewritten
from what is actually visible in each frame.

### Two things worth recording

The uploads arrived faster than they could be applied, so they were mapped to classes by
upload timestamp and then **confirmed by viewing each image** before use — filename and
arrival order have both misled this project before.

The first Junior Warriors crop was centred on the action and clipped the children's heads
at the top edge. Caught by looking at the rendered card, not the crop preview: the preview
had headroom that the card did not. Re-cut top-anchored, sacrificing a strip of mat at the
bottom instead.

### Retired

`class-mma.webp`, `instagram/coach-joey-intro.jpg`, and `instagram/sparring-cage.jpg` were
left unreferenced by these swaps and moved to `docs/unused-assets/` so they stop shipping.
`facility-1.jpg`, `class-strength.webp`, and `instagram/kick-technique.jpg` are still used
elsewhere (facilities page and homepage) and stay in `public/`.

Verified with a browser pass over the built site: all 10 cards map to the intended file,
every image loads and is unique, no alt text carries an HTML entity, no image is upscaled
past its intrinsic width, and all 10 routes are free of broken images — 26 assertions, all
passing.
