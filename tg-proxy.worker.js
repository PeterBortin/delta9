/**
 * Delta9 · Telegram monitoring proxy (Cloudflare Worker)
 *
 * Тягне публічні веб-стрічки каналів (https://t.me/s/<канал>) без токенів,
 * парсить останні повідомлення і віддає JSON з відкритим CORS + кеш 30 с.
 *
 * ── Розгортання (3 хвилини) ────────────────────────────────────────────────
 * 1. dash.cloudflare.com → Workers & Pages → Create → Worker → Deploy.
 * 2. Edit code → вставити цей файл повністю → Deploy.
 * 3. Скопіювати URL воркера і вставити в Delta9 → «Загрози» → вкладка «Курси»
 *    → блок «Канали моніторингу».
 *
 * Запит:     GET https://<worker>/?ch=kpszsu,інший_канал   (до 6 каналів)
 * Відповідь: { ts, msgs: [{ ch, id, t(ms), text }] }  — новіші першими
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400'
};
const json = (o, s) => new Response(JSON.stringify(o), {
  status: s || 200,
  headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, CORS)
});

function decode(s) {
  return s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#0?39;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ')
    .trim();
}

/* Витягає повідомлення зі сторінки t.me/s/<канал> */
function parse(ch, html) {
  const out = [];
  const re = /data-post="[^"]+\/(\d+)"[\s\S]*?(?:<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>[\s\S]*?)?<time[^>]*datetime="([^"]+)"/g;
  let m;
  while ((m = re.exec(html)) && out.length < 30) {
    const text = m[2] ? decode(m[2]) : '';
    if (!text) continue;
    out.push({ ch, id: +m[1], t: Date.parse(m[3]) || Date.now(), text: text.slice(0, 500) });
  }
  return out;
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (request.method !== 'GET') return json({ error: 'method not allowed' }, 405);

    const u = new URL(request.url);
    const chans = (u.searchParams.get('ch') || '').toLowerCase()
      .split(',').map(s => s.trim().replace(/^@/, ''))
      .filter(s => /^[a-z0-9_]{4,32}$/.test(s)).slice(0, 6);
    if (!chans.length) return json({ error: 'вкажи ?ch=kanal1,kanal2' }, 400);

    const cache = caches.default;
    const key = new Request('https://d9-tg-cache/' + chans.join(','));
    const hit = await cache.match(key);
    if (hit) return new Response(hit.body, { headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, CORS) });

    const results = await Promise.all(chans.map(async ch => {
      try {
        const r = await fetch('https://t.me/s/' + ch, { headers: { 'User-Agent': 'Mozilla/5.0 (delta9-map)' } });
        if (!r.ok) return [];
        return parse(ch, await r.text());
      } catch (e) { return []; }
    }));

    const msgs = [].concat(...results).sort((a, b) => b.t - a.t).slice(0, 80);
    const body = JSON.stringify({ ts: Date.now(), msgs });
    const res = new Response(body, { headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 's-maxage=30' }, CORS) });
    try { await cache.put(key, new Response(body, { headers: { 'Cache-Control': 's-maxage=30', 'Content-Type': 'application/json' } })); } catch (e) {}
    return res;
  }
};
