/**
 * Trial booking intake.
 *
 * Writes the enquiry to D1 and then notifies the gym. The write is the source of
 * truth: notification failures are logged but never fail the request, so a lead is
 * never lost to a mail outage.
 *
 * Environment (all optional except DB — the endpoint degrades rather than breaks):
 *   DB                     D1 binding (required)
 *   ALLOWED_ORIGIN         Exact origin allowed to POST. Defaults to this request's own
 *                          origin, which is what a same-origin form submit sends.
 *   RESEND_API_KEY         Enables notification + autoresponder email.
 *   BOOKING_NOTIFY_TO      Gym inbox for new leads. Defaults to jamie@xfcgym.com.au.
 *   BOOKING_FROM           Verified sender, e.g. "XFC Carrum Downs <noreply@xfcgym.com.au>".
 *   TURNSTILE_SECRET_KEY   Enables Cloudflare Turnstile verification when set.
 */

export interface Env {
  DB: D1Database;
  ALLOWED_ORIGIN?: string;
  RESEND_API_KEY?: string;
  BOOKING_NOTIFY_TO?: string;
  BOOKING_FROM?: string;
  TURNSTILE_SECRET_KEY?: string;
}

/** Field length caps, so a hostile payload cannot bloat the database. */
const LIMITS = {
  name: 120,
  email: 254,
  phone: 40,
  class_interest: 60,
  preferred_day: 20,
  message: 2000,
} as const;

const CLASS_LABELS: Record<string, string> = {
  'junior-little-warriors': 'Junior MMA — Little Warriors (Ages 2–4)',
  'junior-junior-warriors': 'Junior MMA — Junior Warriors (Ages 5–6)',
  'junior-rising-warriors': 'Junior MMA — Rising Warriors (Ages 7–9)',
  'junior-elite-warriors': 'Junior MMA — Elite Warriors (Ages 10–13)',
  'kickboxing-beginner': 'Kickboxing / Muay Thai — Beginner',
  'kickboxing-advanced': 'Kickboxing / Muay Thai — Advanced',
  'mma-adults': 'Adult MMA',
  bjj: 'Brazilian Jiu Jitsu',
  boxing: 'Boxing',
  'not-sure': 'Not sure yet',
};

// Deliberately permissive: the goal is to reject obvious typos, not to police
// exotic-but-valid addresses.
const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

const clean = (v: unknown, max: number): string =>
  typeof v === 'string' ? v.trim().slice(0, max) : '';

const escapeHtml = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

function corsHeaders(request: Request, env: Env): Record<string, string> {
  const allowed = env.ALLOWED_ORIGIN || new URL(request.url).origin;
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': allowed,
    Vary: 'Origin',
  };
}

const json = (body: unknown, status: number, headers: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers });

async function verifyTurnstile(token: string, secret: string, ip: string | null): Promise<boolean> {
  try {
    const form = new FormData();
    form.append('secret', secret);
    form.append('response', token);
    if (ip) form.append('remoteip', ip);
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: form,
    });
    const out = (await res.json()) as { success?: boolean };
    return out.success === true;
  } catch (err) {
    console.error('turnstile verification failed', err);
    return false;
  }
}

interface Lead {
  name: string;
  email: string;
  phone: string;
  class_interest: string;
  preferred_day: string;
  message: string;
}

async function sendEmail(env: Env, payload: Record<string, unknown>): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`resend ${res.status}: ${await res.text()}`);
}

async function notify(env: Env, lead: Lead): Promise<void> {
  if (!env.RESEND_API_KEY || !env.BOOKING_FROM) {
    // Loud enough to find in `wrangler pages deployment tail` if it is ever
    // deployed unconfigured — the lead is still safely in D1.
    console.warn('booking stored but email is not configured (RESEND_API_KEY/BOOKING_FROM unset)');
    return;
  }

  // Default recipient confirmed by the business, 27 Jul 2026. Jamie also owns the
  // Resend account, so this address can receive notifications even while the domain
  // is unverified (with a resend.dev sender).
  const to = env.BOOKING_NOTIFY_TO || 'jamie@xfcgym.com.au';
  const classLabel = CLASS_LABELS[lead.class_interest] || lead.class_interest || 'Not specified';
  const day = lead.preferred_day || 'Not specified';
  const received = new Date().toLocaleString('en-AU', { timeZone: 'Australia/Melbourne' });

  const rows: Array<[string, string]> = [
    ['Name', lead.name],
    ['Email', lead.email],
    ['Phone', lead.phone || 'Not provided'],
    ['Class interest', classLabel],
    ['Preferred day', day],
    ['Message', lead.message || '—'],
    ['Received', `${received} (Melbourne)`],
  ];

  await sendEmail(env, {
    from: env.BOOKING_FROM,
    to: [to],
    reply_to: lead.email,
    subject: `New $39 trial enquiry — ${lead.name}`,
    html:
      `<h2>New $39 trial enquiry</h2><table cellpadding="6">` +
      rows
        .map(([k, v]) => `<tr><td><strong>${escapeHtml(k)}</strong></td><td>${escapeHtml(v)}</td></tr>`)
        .join('') +
      `</table>`,
    text: rows.map(([k, v]) => `${k}: ${v}`).join('\n'),
  });

  // Autoresponder. Sent second and independently so a failure here cannot stop
  // the gym's own notification.
  try {
    await sendEmail(env, {
      from: env.BOOKING_FROM,
      to: [lead.email],
      subject: 'Your $39 two-week trial at XFC Carrum Downs',
      html:
        `<p>Hi ${escapeHtml(lead.name.split(' ')[0] || 'there')},</p>` +
        `<p>Thanks for booking your $39 two-week trial at XFC Carrum Downs. ` +
        `Our team will be in touch shortly to confirm your first session.</p>` +
        `<p><strong>What to bring:</strong> comfortable training clothes and a water bottle. ` +
        `No gear needed for your first sessions.</p>` +
        `<p>We're at 31 Lathams Road, Carrum Downs VIC 3201. ` +
        `If you need us sooner, call (03) 9770 8401.</p>` +
        `<p>See you on the mats.<br>XFC Carrum Downs</p>`,
      text:
        `Hi ${lead.name.split(' ')[0] || 'there'},\n\n` +
        `Thanks for booking your $39 two-week trial at XFC Carrum Downs. Our team will be in touch shortly to confirm your first session.\n\n` +
        `What to bring: comfortable training clothes and a water bottle. No gear needed for your first sessions.\n\n` +
        `We're at 31 Lathams Road, Carrum Downs VIC 3201. If you need us sooner, call (03) 9770 8401.\n\n` +
        `See you on the mats.\nXFC Carrum Downs`,
    });
  } catch (err) {
    console.error('autoresponder failed', err);
  }
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env, waitUntil }) => {
  const headers = corsHeaders(request, env);

  // Reject cross-origin posts outright. CORS alone only stops browsers reading the
  // response; it does not stop the write.
  const origin = request.headers.get('Origin');
  const allowed = env.ALLOWED_ORIGIN || new URL(request.url).origin;
  if (origin && origin !== allowed) {
    return json({ success: false, error: 'Forbidden' }, 403, headers);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ success: false, error: 'Invalid request' }, 400, headers);
  }

  // Honeypot: hidden field that only a bot fills in. Answer 200 so it looks like success.
  if (clean(body.website, 200)) {
    console.warn('booking rejected: honeypot filled');
    return json({ success: true }, 200, headers);
  }

  if (env.TURNSTILE_SECRET_KEY) {
    const token = clean(body['cf-turnstile-response'], 4096);
    const ok =
      !!token &&
      (await verifyTurnstile(
        token,
        env.TURNSTILE_SECRET_KEY,
        request.headers.get('CF-Connecting-IP'),
      ));
    if (!ok) return json({ success: false, error: 'Verification failed' }, 400, headers);
  }

  const lead: Lead = {
    name: clean(body.name, LIMITS.name),
    email: clean(body.email, LIMITS.email).toLowerCase(),
    phone: clean(body.phone, LIMITS.phone),
    class_interest: clean(body.class_interest, LIMITS.class_interest),
    preferred_day: clean(body.preferred_day, LIMITS.preferred_day),
    message: clean(body.message, LIMITS.message),
  };

  if (!lead.name) return json({ success: false, error: 'Please enter your name.' }, 400, headers);
  if (!EMAIL_RE.test(lead.email)) {
    return json({ success: false, error: 'Please enter a valid email address.' }, 400, headers);
  }

  try {
    await env.DB.prepare(
      'INSERT INTO bookings (name, email, phone, class_interest, preferred_day, message) VALUES (?, ?, ?, ?, ?, ?)',
    )
      .bind(lead.name, lead.email, lead.phone, lead.class_interest, lead.preferred_day, lead.message)
      .run();
  } catch (err) {
    // Detail stays server-side; the client gets a generic message.
    console.error('booking insert failed', err);
    return json({ success: false, error: 'Could not save your booking.' }, 500, headers);
  }

  // The lead is stored; email must not delay or fail the response.
  const mail = notify(env, lead).catch((err) => console.error('booking notification failed', err));
  if (typeof waitUntil === 'function') waitUntil(mail);
  else await mail;

  return json({ success: true }, 200, headers);
};

export const onRequestOptions: PagesFunction<Env> = async ({ request, env }) => {
  const allowed = env.ALLOWED_ORIGIN || new URL(request.url).origin;
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': allowed,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    },
  });
};
