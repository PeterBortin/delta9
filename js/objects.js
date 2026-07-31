/* Delta9 · растрові іконки обʼєктів (нарізка uploads/objects.png)
   window.Delta9Objects — спрайт-атлас + малювання з поворотом за курсом.
   Повітряні спрайти нормалізовані носом угору (0° = північ).
   Наземні / морські — вид збоку: дзеркаляться ліворуч-праворуч за курсом.
   Якщо спрайт не завантажився — draw() повертає false і викликач малює старий вектор-гліф. */
(function () {
  'use strict';
  var BASE = window.D9OBJ_BASE || 'icons/objects/';

  /* ---- метадані нарізки (синхронні, щоб мапінг працював до завантаження картинки) ---- */
  var META = {
    shahed:      { g: 'Загрози', l: 'Shahed-136 / «Герань-2»', r: 'heading', w: 120, h: 120 },
    gerbera:     { g: 'Загрози', l: '«Гербера» (приманка)',    r: 'heading', w: 112, h: 96 },
    shahed_jet:  { g: 'Загрози', l: 'Shahed-238 / «Герань-3»', r: 'heading', w: 120, h: 120 },
    fpv:         { g: 'Загрози', l: 'FPV / малий БпЛА',        r: 'heading', w: 100, h: 92 },
    recon_uav:   { g: 'Загрози', l: 'Розвідувальний БпЛА',     r: 'heading', w: 124, h: 104 },
    cruise:      { g: 'Загрози', l: 'Крилата ракета',          r: 'heading', w: 116, h: 128 },
    cruise_alt:  { g: 'Загрози', l: 'Крилата ракета (варіант)', r: 'heading', w: 116, h: 124 },
    ballistic:   { g: 'Загрози', l: 'Балістична ракета',       r: 'heading', w: 92,  h: 136 },
    hyper:       { g: 'Загрози', l: 'Гіперзвукова ракета',     r: 'heading', w: 80,  h: 148 },
    kab:         { g: 'Загрози', l: 'КАБ / ФАБ з УМПК',        r: 'heading', w: 76,  h: 148 },
    unknown:     { g: 'Загрози', l: 'Невідомий тип',           r: 'none',    w: 120, h: 112 },
    locked:      { g: 'Стани',   l: 'Взято на супровід',       r: 'none',    w: 132, h: 132 },
    impact:      { g: 'Стани',   l: 'Влучання',                r: 'none',    w: 120, h: 128 },
    interceptor: { g: 'ППО',     l: 'Зенітна ракета',          r: 'heading', w: 60,  h: 152 },
    f16:         { g: 'ППО',     l: 'F-16',                    r: 'heading', w: 124, h: 116 },
    f15:         { g: 'ППО',     l: 'F-15',                    r: 'heading', w: 128, h: 116 },
    mig29:       { g: 'ППО',     l: 'МіГ-29',                  r: 'heading', w: 128, h: 120 },
    heli:        { g: 'ППО',     l: 'Гелікоптер (Мі-8 / Мі-24)', r: 'heading', w: 132, h: 132 },
    tu95:        { g: 'Носії',   l: 'Ту-95',                   r: 'heading', w: 140, h: 128 },
    su34:        { g: 'Носії',   l: 'Су-34',                   r: 'heading', w: 128, h: 116 },
    mig31:       { g: 'Носії',   l: 'МіГ-31К («Кинджал»)',     r: 'heading', w: 120, h: 128 },
    su35:        { g: 'Носії',   l: 'Су-35',                   r: 'heading', w: 128, h: 120 },
    tu160:       { g: 'Носії',   l: 'Ту-160',                  r: 'heading', w: 112, h: 128 },
    airliner:    { g: 'Авіатрафік', l: 'Цивільний борт',       r: 'heading', w: 140, h: 128 },
    airliner_alt:{ g: 'Авіатрафік', l: 'Цивільний борт (варіант)', r: 'heading', w: 140, h: 128 },
    transport:   { g: 'Авіатрафік', l: 'Транспортний літак',   r: 'heading', w: 140, h: 128 },
    sam:         { g: 'ППО',     l: 'ЗРК (самохідний)',        r: 'mirror', f: 'left',  w: 148, h: 72 },
    radar:       { g: 'ППО',     l: 'РЛС на шасі',             r: 'mirror', f: 'left',  w: 148, h: 84 },
    tel_up:      { g: 'Носії',   l: 'ПУ (бойове положення)',   r: 'mirror', f: 'left',  w: 148, h: 80 },
    tel_load:    { g: 'Носії',   l: 'ТЗМ з ракетою',           r: 'mirror', f: 'left',  w: 152, h: 68 },
    truck:       { g: 'ППО',     l: 'Вантажівка / ТЗМ',        r: 'mirror', f: 'left',  w: 152, h: 60 },
    tank:        { g: 'Юніти',   l: 'Танк',                    r: 'mirror', f: 'right', w: 148, h: 76 },
    ship_ru:     { g: 'Носії',   l: 'Корабель (ворожий)',      r: 'mirror', f: 'right', w: 152, h: 56 },
    ship_ua:     { g: 'ППО',     l: 'Корабель (наш)',          r: 'mirror', f: 'right', w: 152, h: 56 },
    usv:         { g: 'Юніти',   l: 'БЕК',                     r: 'mirror', f: 'right', w: 144, h: 52 },
    bigdrone:    { g: 'Юніти',   l: 'Великий БпЛА',            r: 'mirror', f: 'left',  w: 148, h: 64 }
  };
  var ORDER = Object.keys(META);

  /* нормалізація масштабу: дуже дрібні спрайти трохи підростають, дуже великі трохи меншають */
  var GAIN = {};
  ORDER.forEach(function (k) {
    var m = META[k], g = 150 / Math.max(m.w, m.h);
    GAIN[k] = Math.max(0.85, Math.min(1.6, g));
  });

  /* ---------------------------------------------------------------- мапінг типів */
  var MAPA_KIND = {
    drone_piston: 'shahed', drone_jet: 'shahed_jet', missile_cruise: 'cruise',
    missile_ballistic: 'ballistic', bomb: 'kab', drone_fpv: 'fpv'
  };
  /* моделі симуляції ППО (sim.js WP) */
  var SIM_MODEL = {
    shahed: 'shahed', gerbera: 'gerbera', shahed238: 'shahed_jet', geran3: 'shahed_jet',
    lancet: 'fpv', fpvk: 'fpv', dbomber: 'fpv', drecon: 'recon_uav', orlan: 'recon_uav', supercam: 'recon_uav',
    zala: 'recon_uav', recon: 'recon_uav', lutyi: 'gerbera', fp1: 'shahed', bober: 'shahed', banderol: 'cruise_alt',
    kab: 'kab', zircon: 'hyper', kinzhal: 'hyper',
    tochka: 'ballistic', iskm: 'ballistic', kn23: 'ballistic',
    kh101: 'cruise', kh55: 'cruise', kalibr: 'cruise', x59: 'cruise_alt', x69: 'cruise_alt', x22: 'cruise_alt',
    atacms: 'ballistic', oreshnik: 'hyper',
    grad: 'tel_up', uragan: 'tel_up', smerch: 'tel_up', vilkha: 'tel_up', himars: 'tel_up',
    msta: 'tank', pion: 'tank', bohdana: 'tank'
  };
  var SIM_CAT = { drone: 'shahed', cruise: 'cruise', ballistic: 'ballistic', hyper: 'hyper', artillery: 'tel_up' };
  /* платформи-носії / пускові */
  var LAUNCHER = { plane: 'tu95', mig: 'mig31', ship: 'ship_ru', coast: 'tel_up', ground: 'tel_up', truck: 'tel_load', car: 'truck', person: null };
  /* наші засоби (sim.js UA.icon) */
  var UA_ASSET = { plane: 'f16', heli: 'heli', ship: 'ship_ua', truck: 'truck' };
  var UA_MODEL = { f16: 'f16', f15: 'f15', mig29: 'mig29', mi8: 'heli', mi24: 'heli', island: 'ship_ua', hetman: 'ship_ua', mrg: 'truck' };
  /* APP-6 → спрайт (для палітри «Юніти»); ключі — наявні іконки natosym.js */
  var SYM = { tank: 'tank', ad_missile: 'sam', ad_radar: 'radar', radar: 'radar', ssm: 'tel_up',
              uav: 'recon_uav', uav_recon: 'recon_uav', uav_strike: 'shahed',
              plane: 'f16', helo: 'heli', ship: 'ship_ua', boat: 'usv', supply: 'truck' };

  /* назва цілі важливіша за грубий тип mapa.ua: якщо в титулі «Shahed» — малюємо Shahed */
  var TITLE_RULES = [
    [/герань[\s\-–—]*3|geran[\s\-–—]*3|shahed[\s\-–—]*238|шахед[\s\-–—]*238|реактивн/i, 'shahed_jet'],
    [/shahed|шахед|герань|geran|136|131/i, 'shahed'],
    [/гербер|gerbera|приманк|decoy/i, 'gerbera'],
    [/ланцет|lancet|молні|molniya|\bfpv\b/i, 'fpv'],
    [/орлан|orlan|supercam|zala|суперкам|розвід|recon|mavic|мавік/i, 'recon_uav'],
    [/кинджал|kinzhal|циркон|zircon|гіперзвук|х-?47|х-?32\b/i, 'hyper'],
    [/іскандер|iskander|іскм|kn-?23|kn-?24|точка|tochka|балістич|отрк/i, 'ballistic'],
    [/каб\b|фаб\b|умпк|\bkab\b|\bfab\b|umpk|авіабомб/i, 'kab'],
    [/х-?101|х-?555|х-?55|х-?59|х-?69|х-?35|х-?22|kh-?\d|калібр|kalibr|онікс|oniks|крилат/i, 'cruise']
  ];
  function kindKey(kind, title, subkind) {
    var t = title || '';
    if (subkind && subkind !== kind) t += ' ' + subkind;
    t = t.trim();
    if (t) for (var i = 0; i < TITLE_RULES.length; i++) if (TITLE_RULES[i][0].test(t)) return TITLE_RULES[i][1];
    return MAPA_KIND[kind] || 'unknown';
  }
  function modelKey(model, cat) { return SIM_MODEL[model] || SIM_CAT[cat] || 'unknown'; }
  function launcherKey(k) { return LAUNCHER[k] || null; }
  function assetKey(model, icon) { return UA_MODEL[model] || UA_ASSET[icon] || null; }
  function adsbKey(mil, heli) { return heli ? 'heli' : (mil ? 'transport' : 'airliner'); }

  /* ------------------------------------------------------------------ атлас */
  var CELL = 128, COLS = 6;
  var sheet = null, ok = false, failed = false;
  var frames = {};
  ORDER.forEach(function (k, i) { frames[k] = { x: (i % COLS) * CELL, y: Math.floor(i / COLS) * CELL }; });

  var ready = new Promise(function (res) {
    var im = new Image();
    im.onload = function () { sheet = im; ok = true; res(true); };
    im.onerror = function () { failed = true; res(false); };
    im.src = BASE + 'sheet.png';
  });

  /* кеш плиток потрібного розміру (у девайс-пікселях) */
  var tiles = {};
  function tile(key, px) {
    px = Math.max(8, Math.min(512, Math.round(px)));
    var id = key + '@' + px;
    if (tiles[id]) return tiles[id];
    if (!ok || !frames[key]) return null;
    var f = frames[key];
    /* покрокове зменшення — менше «каші» на дрібних розмірах */
    var src = document.createElement('canvas'); src.width = src.height = CELL;
    var sc = src.getContext('2d'); sc.drawImage(sheet, f.x, f.y, CELL, CELL, 0, 0, CELL, CELL);
    var cur = src, size = CELL;
    while (size > px * 2) {
      var half = Math.max(px, Math.round(size / 2));
      var nx = document.createElement('canvas'); nx.width = nx.height = half;
      var nc = nx.getContext('2d'); nc.imageSmoothingEnabled = true; nc.imageSmoothingQuality = 'high';
      nc.drawImage(cur, 0, 0, size, size, 0, 0, half, half);
      cur = nx; size = half;
    }
    var out = document.createElement('canvas'); out.width = out.height = px;
    var oc = out.getContext('2d');
    oc.imageSmoothingEnabled = true; oc.imageSmoothingQuality = 'high';
    oc.drawImage(cur, 0, 0, size, size, 0, 0, px, px);
    tiles[id] = out;
    return out;
  }

  var dpr = function () { return Delta9Objects.dpr || Math.min(3, window.devicePixelRatio || 1); };

  /* size = висота іконки в CSS-пікселях; hdg — курс у градусах (0 = північ) */
  function draw(ctx, key, x, y, size, hdg, opt) {
    if (!ok || !META[key]) return false;
    opt = opt || {};
    var box = size * (GAIN[key] || 1);
    var t = tile(key, box * dpr());
    if (!t) return false;
    var m = META[key];
    ctx.save();
    ctx.translate(x, y);
    if (m.r === 'heading') ctx.rotate((hdg || 0) * Math.PI / 180);
    else if (m.r === 'mirror') {
      /* курс строго на північ/південь (або відсутній) — лишаємо як намальовано */
      var s = Math.sin((hdg || 0) * Math.PI / 180);
      if (Math.abs(s) > 1e-6 && ((s > 0) ? m.f === 'left' : m.f === 'right')) ctx.scale(-1, 1);
    }
    if (opt.alpha != null) ctx.globalAlpha = opt.alpha;
    if (opt.shadow !== false) { ctx.shadowColor = opt.shadowColor || 'rgba(0,0,0,.75)'; ctx.shadowBlur = opt.shadowBlur || 3; }
    ctx.drawImage(t, -box / 2, -box / 2, box, box);
    ctx.restore();
    return true;
  }

  /* готовий канвас (для DOM-іконок і MapLibre) */
  function canvas(key, size, hdg, opt) {
    var r = dpr(), c = document.createElement('canvas');
    var box = Math.round(size * r);
    c.width = c.height = box;
    var ctx = c.getContext('2d');
    ctx.scale(r, r);
    draw(ctx, key, size / 2, size / 2, size * 0.92, hdg || 0, opt || { shadow: false });
    return c;
  }
  function imageData(key, size, hdg) {
    var c = canvas(key, size, hdg, { shadow: true, shadowBlur: 2 });
    var d = c.getContext('2d').getImageData(0, 0, c.width, c.height);
    return { width: c.width, height: c.height, data: d.data };
  }

  /* <canvas data-d9obj="shahed" data-d9hdg="45"> у панелях і списках */
  function paintDom(root) {
    if (!ok) return;
    var list = (root || document).querySelectorAll('canvas[data-d9obj]');
    for (var i = 0; i < list.length; i++) {
      var el = list[i], key = el.getAttribute('data-d9obj');
      if (!META[key]) continue;
      var css = el.clientWidth || parseFloat(el.getAttribute('data-d9size')) || 28;
      var r = dpr(), px = Math.round(css * r);
      if (el.width !== px) { el.width = px; el.height = px; }
      else if (el.getAttribute('data-d9done') === key) continue;
      var ctx = el.getContext('2d');
      ctx.setTransform(r, 0, 0, r, 0, 0);
      ctx.clearRect(0, 0, css, css);
      draw(ctx, key, css / 2, css / 2, css * 0.94, parseFloat(el.getAttribute('data-d9hdg')) || 0, { shadow: false });
      el.setAttribute('data-d9done', key);
    }
  }

  /* APP-6: підміняє векторні іконки юнітів растровими */
  function registerWithD9SYM() {
    if (!ok || !window.D9SYM || !window.D9SYM.registerIconImage) return;
    Object.keys(SYM).forEach(function (symKey) {
      var prev = window.D9SYM.ICONS[symKey];
      if (!prev) return;                       // не додаємо нових пунктів у палітру
      var k = SYM[symKey], im = tile(k, 128);
      if (!im) return;
      window.D9SYM.registerIconImage(symKey, { label: prev.label, grp: prev.grp, img: im });
    });
  }

  window.Delta9Objects = {
    BASE: BASE, META: META, ORDER: ORDER, GAIN: GAIN,
    MAPA_KIND: MAPA_KIND, SIM_MODEL: SIM_MODEL, LAUNCHER: LAUNCHER, SYM: SYM, TITLE_RULES: TITLE_RULES,
    ready: ready, dpr: null,
    get loaded() { return ok; },
    get failed() { return failed; },
    has: function (k) { return !!(ok && META[k]); },
    kindKey: kindKey, modelKey: modelKey, launcherKey: launcherKey, assetKey: assetKey, adsbKey: adsbKey,
    draw: draw, canvas: canvas, imageData: imageData, tile: tile, paintDom: paintDom,
    registerWithD9SYM: registerWithD9SYM
  };
  ready.then(function (v) { if (v) registerWithD9SYM(); });
})();
