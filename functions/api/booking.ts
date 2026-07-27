export interface Env {
  DB: D1Database;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };
  try {
    const b = await request.json() as any;
    if (!b.name || !b.email) {
      return new Response(JSON.stringify({ success: false, error: 'Name and email required' }), { status: 400, headers: cors });
    }
    await env.DB.prepare(
      'INSERT INTO bookings (name, email, phone, class_interest, preferred_day, message) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(b.name, b.email, b.phone || '', b.class_interest || '', b.preferred_day || '', b.message || '').run();
    return new Response(JSON.stringify({ success: true }), { headers: cors });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: String(e) }), { status: 500, headers: cors });
  }
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
};
