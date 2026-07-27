export interface Env {
  DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  // `day` is TEXT ('mon', 'tue', ...), so a plain ORDER BY returns alphabetical
  // order — fri, mon, sat, thu, tue, wed — not week order.
  const { results } = await env.DB.prepare(
    `SELECT * FROM classes
       WHERE active = 1
       ORDER BY CASE day
                  WHEN 'mon' THEN 1 WHEN 'tue' THEN 2 WHEN 'wed' THEN 3
                  WHEN 'thu' THEN 4 WHEN 'fri' THEN 5 WHEN 'sat' THEN 6
                  WHEN 'sun' THEN 7 ELSE 8
                END,
                time_start`,
  ).all();
  return new Response(JSON.stringify(results), {
    headers: {
      'Content-Type': 'application/json',
      // Read-only public data; a short cache keeps D1 reads down.
      'Cache-Control': 'public, max-age=300',
    },
  });
};
