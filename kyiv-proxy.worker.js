/* Delta9 · CORS-проксі для airAlertState (Київ Цифровий / Портал даних Києва)
   ─────────────────────────────────────────────────────────────────────────────
   Портал даних Києва не віддає CORS-заголовки, тому браузер не може читати
   airAlertState напряму. Цей воркер робить один GET на сервері й повертає
   JSON вже з дозволом на крос-доменний запит.

   Розгортання
   1. Cloudflare → Workers & Pages → Create Worker → встав цей файл.
   2. Deploy. Токен не потрібен — дані відкриті.
   3. Скопіюй адресу (…workers.dev) і встав у Delta9:
      «Купол» → Проксі · Київ Цифровий.

   Відповідь: { state, cause, created_at, total_alerts, total_lasts_for }
   state 0 — відбій, 1 — тривога; cause: missile | massive-drone | drone. */

const RESOURCE = 'e1216fe6-7cbd-41ad-b478-85983a2e2669';
const SOURCES = [
  'https://data.kyivcity.gov.ua/api/action/datastore_search?resource_id=' + RESOURCE + '&limit=5&sort=_id%20desc',
  'https://data.kyivcity.gov.ua/api/action/datastore_search?resource_id=' + RESOURCE + '&limit=5',
  'https://data.kyivcity.gov.ua/dataset/statystyka-povitrianykh-tryvoh-u-misti-kyievi-dep-municipal/resource/' + RESOURCE + '/data/download'
];

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'content-type',
  'cache-control': 'public, max-age=10'
};

const json = (body, status) => new Response(JSON.stringify(body), {
  status: status || 200,
  headers: Object.assign({ 'content-type': 'application/json; charset=utf-8' }, CORS)
});

function pickLatest(payload) {
  let recs = [];
  if (Array.isArray(payload)) recs = payload;
  else if (payload && payload.result && Array.isArray(payload.result.records)) recs = payload.result.records;
  else if (payload && typeof payload === 'object') recs = [payload];
  if (!recs.length) return null;
  let best = recs[0];
  for (const r of recs) {
    if ((Date.parse(r.created_at || '') || 0) > (Date.parse(best.created_at || '') || 0)) best = r;
  }
  return best;
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (request.method !== 'GET') return json({ error: 'only GET' }, 405);

    let lastErr = '';
    for (const url of SOURCES) {
      try {
        const r = await fetch(url, { cf: { cacheTtl: 10 }, headers: { accept: 'application/json' } });
        if (!r.ok) { lastErr = 'upstream ' + r.status; continue; }
        const rec = pickLatest(await r.json());
        if (!rec) { lastErr = 'порожня відповідь'; continue; }
        return json({
          state: Number(rec.state != null ? rec.state : rec.State) || 0,
          cause: String(rec.cause || ''),
          created_at: rec.created_at || '',
          total_alerts: Number(rec.total_alerts || 0) || 0,
          total_lasts_for: Number(rec.total_lasts_for || 0) || 0,
          source: url
        });
      } catch (e) { lastErr = (e && e.message) || 'fetch failed'; }
    }
    return json({ error: 'Київ Цифровий недоступний · ' + lastErr }, 502);
  }
};
