/**
 * Delta9 · alerts.in.ua CORS proxy (Cloudflare Worker)
 *
 * Навіщо: alerts.in.ua не дозволяє запити з браузера (CORS) і вимагає токен,
 * який не можна тримати у клієнтському коді. Цей воркер тримає токен у себе,
 * кешує відповідь на 15 с (щоб не впертись у ліміт 8–12 запитів/хв) і віддає
 * дані з відкритим CORS.
 *
 * ── Розгортання (5 хвилин) ────────────────────────────────────────────────
 * 1. Токен: https://alerts.in.ua/api-request — заповнити форму, вкажи що це
 *    некомерційна мапа. Токен приходить на пошту (зазвичай 1–3 дні).
 * 2. dash.cloudflare.com → Workers & Pages → Create → Worker → Deploy.
 * 3. Edit code → вставити цей файл повністю → Deploy.
 * 4. Settings → Variables and Secrets → Add → Secret →
 *      Name: ALERTS_TOKEN     Value: <твій токен>   → Deploy.
 * 5. Скопіювати URL воркера (https://<name>.<subdomain>.workers.dev)
 *    і вставити в Delta9 → панель «Загрози» → вкладка «Тривоги» → Проксі.
 *
 * Ендпоінти:
 *   GET /active   → повний список активних тривог (alerts[])
 *   GET /oblasts  → компактний рядок статусів по 27 областях ("ANN…")
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400'
};

const ROUTES = {
  '': '/v1/alerts/active.json',
  'active': '/v1/alerts/active.json',
  'oblasts': '/v1/iot/active_air_raid_alerts_by_oblast.json'
};

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (request.method !== 'GET') return json({ error: 'method not allowed' }, 405);

    const path = new URL(request.url).pathname.replace(/^\/+|\/+$/g, '');
    const upstream = ROUTES[path];
    if (!upstream) return json({ error: 'unknown path', known: Object.keys(ROUTES) }, 404);
    if (!env.ALERTS_TOKEN) return json({ error: 'ALERTS_TOKEN secret is not set on the worker' }, 500);

    const cache = caches.default;
    const key = new Request('https://d9-alerts-cache' + upstream);
    let hit = await cache.match(key);

    if (!hit) {
      let res;
      try {
        res = await fetch('https://api.alerts.in.ua' + upstream, {
          headers: { Authorization: 'Bearer ' + env.ALERTS_TOKEN, 'User-Agent': 'delta9-map/1.0' }
        });
      } catch (e) {
        return json({ error: 'upstream unreachable', detail: String(e) }, 502);
      }
      const body = await res.text();
      if (!res.ok) return json({ error: 'upstream ' + res.status, body: body.slice(0, 400) }, res.status);
      hit = new Response(body, {
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=15' }
      });
      ctx.waitUntil(cache.put(key, hit.clone()));
    }

    const out = new Response(hit.body, hit);
    Object.entries(CORS).forEach(([k, v]) => out.headers.set(k, v));
    out.headers.set('X-D9-Source', 'alerts.in.ua');
    return out;
  }
};

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, CORS)
  });
}
