export interface Env {
  DB: D1Database;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (url.pathname === '/api/booking' && request.method === 'POST') {
      try {
        const body = await request.json() as any;
        await env.DB.prepare(
          'INSERT INTO bookings (name, email, phone, class_interest, preferred_day, message) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(body.name, body.email, body.phone || '', body.class_interest || '', body.preferred_day || '', body.message || '').run();
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: String(e) }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    if (url.pathname === '/api/timetable' && request.method === 'GET') {
      const { results } = await env.DB.prepare('SELECT * FROM classes WHERE active=1 ORDER BY day, time_start').all();
      return new Response(JSON.stringify(results), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response('Not found', { status: 404 });
  }
};
