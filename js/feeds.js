/* Delta9 · додаткові відкриті джерела повітряної обстановки — window.Delta9Feeds
   ─────────────────────────────────────────────────────────────────────────────
   NEPTUN         https://neptun.in.ua/developers   (CORS *, без ключа, GET)
                  /api/v1/threats   живі цілі (точка, курс, швидкість, достовірність)
                  /api/v1/alerts    офіційні тривоги: області + райони
                  /api/v1/messages  стрічка Telegram-каналів
                  Умова використання: видиме посилання на NEPTUN поруч із даними.
   Київ Цифровий  airAlertState через Портал даних Києва (CKAN datastore)
                  state 0/1 · cause missile | massive-drone | drone
   mapa.ua        лишається в mapa.js — тут лише зведення з ним.

   Записи нормалізуються у ТУ САМУ форму, що Delta9Mapa.norm(), тому вся
   наявна візуалізація (гліфи, сліди, дуги, ETA, тривога) працює без змін.
   Поле .src каже, звідки запис; .srcs — усі джерела, що дали цю ціль. */
(function () {
  const NEP = 'https://neptun.in.ua';
  const KYIV_RES = 'e1216fe6-7cbd-41ad-b478-85983a2e2669';
  const KYIV_CKAN = 'https://data.kyivcity.gov.ua/api/action/datastore_search';

  const NEP_KIND = { uav: 'drone_piston', recon: 'drone_piston', missile: 'missile_cruise',
    ballistic: 'missile_ballistic', kab: 'bomb', mig31k: 'mig31k', unknown: 'unknown' };
  const NEP_TITLE = { uav: 'Shahed / БпЛА', recon: 'Розвідувальний БпЛА', missile: 'Крилата ракета',
    ballistic: 'Балістична ракета', kab: 'КАБ / УМПК', mig31k: 'МіГ-31К у повітрі', unknown: 'Невідома ціль' };
  const SPEED = { drone_piston: 165, drone_jet: 450, missile_cruise: 800, missile_ballistic: 7500,
    bomb: 750, drone_fpv: 120, mig31k: 900, unknown: 300 };
  /* грубий клас цілі для зведення: дрон з одного джерела не має злитися з ракетою з іншого */
  const CAT = { drone_piston: 'drone', drone_jet: 'drone', drone_fpv: 'drone',
    missile_cruise: 'cruise', missile_ballistic: 'ballistic', bomb: 'bomb' };
  const PRI = { mapa: 0, neptun: 1, kyiv: 2 };

  const SRC = {
    mapa:   { label: 'mapa.ua',        note: 'цілі, атаки, архів',            href: 'https://mapa.ua/' },
    neptun: { label: 'NEPTUN',         note: 'цілі + офіційні тривоги',       href: 'https://neptun.in.ua/' },
    kyiv:   { label: 'Київ Цифровий',  note: 'тривога в м. Києві',            href: 'https://data.kyivcity.gov.ua/dataset/statystyka-povitrianykh-tryvoh-u-misti-kyievi-dep-municipal' }
  };

  async function getJSON(url) {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error(r.status + '');
    return r.json();
  }

  /* ---------- назви областей у вигляді, яким користується мапа (Delta9Mapa.OBLASTS[].n) ---------- */
  function oblName(s) {
    if (!s) return '';
    let n = String(s).trim().replace(/^м\.\s*/i, '').replace(/\s*область$/i, '').replace(/\s*обл\.?$/i, '');
    if (/^(ар\s*)?крим$/i.test(n) || /криму?$/i.test(n)) return 'АР Крим';
    if (/^київ$/i.test(n)) return 'Київ';
    if (/^севастополь/i.test(n)) return 'Севастополь';
    return n;
  }

  /* ---------- NEPTUN → цілі ---------- */
  function normNeptun(t, t0) {
    const kind = NEP_KIND[t.type] || 'unknown';
    const v = t.velocity || {};
    let hdg = (t.heading != null ? t.heading : v.bearingDeg);
    const last = Date.parse(t.updatedAt || '') || t0;
    const first = Date.parse(t.confirmedAt || '') || last;
    return {
      id: 'np:' + t.id, kind: kind, subkind: t.type || kind, amount: Math.max(1, t.count || 1),
      title: t.title || NEP_TITLE[t.type] || 'Ціль',
      status: (t.status === 'active' ? 'active' : 'lost'),
      lat: t.lat, lon: t.lon, hdg: (hdg == null ? 0 : hdg),
      speed: v.speedKmh || SPEED[kind] || 300,
      zone: 'unknown', city: t.locality || t.district || t.region || '',
      first: first, last: last, pred: null, trail: [], t0: t0, off: null, offT: 0,
      src: 'neptun', srcs: ['neptun'], srcN: t.sourceCount || 1,
      conf: t.confidenceLevel || '', region: t.region || '', district: t.district || '',
      advisory: !!t.advisory, areaOnly: !!t.areaOnly,
      uncertKm: t.uncertaintyKm || 0, note: t.explanationShort || ''
    };
  }

  /* areaOnly:true — точки НЕМАЄ, названо лише область. Такі записи не малюємо
     як ціль (це була б вигадана позиція) — вони йдуть у підсвітку області. */
  async function neptunThreats() {
    const j = await getJSON(NEP + '/api/v1/threats');
    const t0 = Date.now();
    const objs = [], areas = [];
    (j.threats || []).forEach(t => {
      if (!isFinite(t.lat) || !isFinite(t.lon)) return;
      const o = normNeptun(t, t0);
      (o.areaOnly ? areas : objs).push(o);
    });
    return { objs: objs, areas: areas, serverTime: Date.parse(j.serverTime || '') || t0, ts: t0 };
  }

  async function neptunAlerts() {
    const j = await getJSON(NEP + '/api/v1/alerts');
    const obl = new Set(), list = [];
    (j.oblasts || []).forEach(o => {
      const n = oblName(o.name || o.oblast || o.key); if (n) obl.add(n);
      list.push({ t: o.name || n, sub: 'вся область', since: Date.parse(o.since || '') || 0, lvl: 'oblast' });
    });
    (j.raions || []).forEach(o => {
      const n = oblName(o.oblast || ''); if (n) obl.add(n);
      list.push({ t: o.name || '', sub: o.oblast || '', since: Date.parse(o.since || '') || 0, lvl: 'raion' });
    });
    list.sort((a, b) => (b.since || 0) - (a.since || 0));
    return { oblasts: Array.from(obl), list: list, ts: Date.now() };
  }

  async function neptunMessages() {
    const j = await getJSON(NEP + '/api/v1/messages');
    return (j.messages || []).map(m => ({ chan: m.channel || '', text: m.text || '', t: Date.parse(m.date || '') || 0 }));
  }

  /* ---------- Київ Цифровий → тривога в м. Києві ---------- */
  const KY_CAUSE = { missile: 'ракетна загроза', 'massive-drone': 'масована дронова', drone: 'дронова загроза' };
  /* Портал даних Києва не віддає CORS — напряму з браузера не читається.
     Тому джерело працює через власний воркер (kyiv-proxy.worker.js); без нього
     офіційний статус тривоги в Києві однаково приходить з NEPTUN. */
  async function kyivAlert(proxy) {
    let j = null;
    if (proxy) j = await getJSON(String(proxy).replace(/\/+$/, ''));
    else {
      const q = KYIV_CKAN + '?resource_id=' + KYIV_RES + '&limit=5&sort=' + encodeURIComponent('_id desc');
      try { j = await getJSON(q); }
      catch (e) { j = await getJSON(KYIV_CKAN + '?resource_id=' + KYIV_RES + '&limit=5'); }
    }
    if (j && j.error) throw new Error(String(j.error));
    let recs = (j && j.result && j.result.records) || (Array.isArray(j) ? j : (j && j.state != null ? [j] : []));
    if (!recs.length) throw new Error('порожня відповідь');
    let rec = recs[0];
    recs.forEach(r => { if ((Date.parse(r.created_at || '') || 0) > (Date.parse(rec.created_at || '') || 0)) rec = r; });
    const st = String(rec.state != null ? rec.state : (rec.State != null ? rec.State : ''));
    const cause = String(rec.cause || '').toLowerCase();
    return {
      on: st === '1', cause: cause, causeLabel: KY_CAUSE[cause] || cause,
      red: cause === 'missile' || cause === 'massive-drone',
      since: Date.parse(rec.created_at || '') || 0,
      total: Number(rec.total_alerts || 0) || 0, ts: Date.now()
    };
  }

  /* ---------- зведення джерел ----------
     Одна ціль = той самий клас + ≤ radiusKm, причому позиції обох записів
     спершу зводяться числення шляху на ОДИН момент часу (now): різні джерела
     фіксують ту саму ціль у різні секунди, тому «сира» відстань бреше.
     Порівнюються лише свіжі записи (opts.fresh) — mapa.ua тримає статус active
     годинами після останньої фіксації, і зливати такий «хвіст» зі свіжою
     ціллю з іншого джерела означало б вигадати позицію.
     Геометрія — з найсвіжішого джерела, кількість — максимум (а не сума),
     id — від джерела з вищим пріоритетом (mapa.ua), щоб трек не перестрибував. */
  function kmBetween(a, b) {
    const M = window.Delta9Mapa;
    if (M && M.km) return M.km([a.lon, a.lat], [b.lon, b.lat]);
    const T = Math.PI / 180, dla = (b.lat - a.lat) * T, dlo = (b.lon - a.lon) * T;
    const s = Math.sin(dla / 2) ** 2 + Math.cos(a.lat * T) * Math.cos(b.lat * T) * Math.sin(dlo / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
  }

  /* позиція, зведена числення шляху на момент now */
  function posAt(rec, now) {
    const M = window.Delta9Mapa;
    if (rec.status !== 'active' || !rec.speed || !M || !M.dest) return [rec.lon, rec.lat];
    const dt = Math.max(0, Math.min(1800, (now - (rec.last || now)) / 1000));
    if (dt < 1) return [rec.lon, rec.lat];
    return M.dest(rec.lon, rec.lat, rec.hdg || 0, rec.speed * dt / 3600);
  }

  function merge(lists, opts) {
    const o = opts || {}, radius = o.radiusKm || 20, win = (o.windowMin || 5) * 60000;
    const now = o.now || Date.now(), isFresh = o.fresh || null;
    const all = [];
    (lists || []).forEach(l => (l || []).forEach(x => { if (x && isFinite(x.lat) && isFinite(x.lon)) all.push(x); }));
    all.sort((a, b) => (b.last || 0) - (a.last || 0));   // найсвіжіший стає носієм геометрії
    const out = [], dropped = {}, bySrc = {};
    const P = new WeakMap();
    const pos = (r) => { let p = P.get(r); if (!p) { p = posAt(r, now); P.set(r, p); } return p; };
    all.forEach(rec => {
      const src = rec.src || 'mapa';
      bySrc[src] = (bySrc[src] || 0) + 1;
      const cat = CAT[rec.kind] || 'other';
      const recFresh = isFresh ? !!isFresh(rec) : true;
      let host = null;
      for (let i = 0; i < out.length; i++) {
        const h = out[i];
        if ((CAT[h.kind] || 'other') !== cat) continue;
        if (h.status !== rec.status) continue;
        if (isFresh) { if (!recFresh || !h._fresh) continue; }
        else if (Math.abs((h.last || 0) - (rec.last || 0)) > win) continue;
        const a = pos(h._geo || h), b = pos(rec);
        if (kmBetween({ lon: a[0], lat: a[1] }, { lon: b[0], lat: b[1] }) > radius) continue;
        host = h; break;
      }
      if (!host) { const c = Object.assign({}, rec); c._mem = [rec]; c._geo = rec; c._fresh = recFresh; c.srcs = [src]; out.push(c); return; }
      if (host._mem.some(m => (m.src || 'mapa') === src)) { dropped[src] = (dropped[src] || 0) + 1; return; }
      host._mem.push(rec);
      dropped[src] = (dropped[src] || 0) + 1;
      host.amount = Math.max(host.amount || 1, rec.amount || 1);
      host.srcN = Math.max(host.srcN || 1, rec.srcN || 1);
      if ((!host.trail || !host.trail.length) && rec.trail && rec.trail.length) host.trail = rec.trail;
      if (!host.pred && rec.pred) host.pred = rec.pred;
      if (!host.city && rec.city) host.city = rec.city;
      if (!host.note && rec.note) host.note = rec.note;
      if (!host.region && rec.region) host.region = rec.region;
      if ((!host.zone || host.zone === 'unknown') && rec.zone && rec.zone !== 'unknown') host.zone = rec.zone;
      if (host.advisory && !rec.advisory) host.advisory = false;   // підтверджено іншим джерелом
    });
    out.forEach(c => {
      let best = c._mem[0];
      c._mem.forEach(m => { if (PRI[m.src || 'mapa'] < PRI[best.src || 'mapa']) best = m; });
      c.id = best.id;
      c.srcs = c._mem.map(m => m.src || 'mapa').filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => PRI[a] - PRI[b]);
      c.fused = c.srcs.length > 1;
      delete c._mem; delete c._geo; delete c._fresh;
    });
    return { objs: out, dropped: dropped, input: bySrc };
  }

  /* скільки зведених цілей має внесок кожного джерела */
  function countBySource(objs) {
    const n = {};
    (objs || []).forEach(o => (o.srcs || [o.src || 'mapa']).forEach(s => { n[s] = (n[s] || 0) + 1; }));
    return n;
  }

  window.Delta9Feeds = {
    NEP: NEP, SRC: SRC, NEP_KIND: NEP_KIND, CAT: CAT, PRI: PRI,
    oblName: oblName, normNeptun: normNeptun,
    neptunThreats: neptunThreats, neptunAlerts: neptunAlerts, neptunMessages: neptunMessages,
    kyivAlert: kyivAlert, kyivNeedsProxy: true, merge: merge, posAt: posAt, countBySource: countBySource, kmBetween: kmBetween
  };
})();
