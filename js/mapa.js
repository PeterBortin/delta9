/* Delta9 · mapa.ua live threat feed (public API, no auth)
   https://mapa.ua/docs/  —  window.Delta9Mapa */
(function () {
  const BASE = 'https://mapa.ua/api/v1';

  const KINDS = {
    drone_piston:     { label: 'Shahed-136 / «Герань»',  short: 'Shahed',     col: '#ff9f40', w: 1.7, sp: 165,  ico: 'shahed' },
    drone_jet:        { label: 'Shahed-238 (реактивний)', short: 'Реакт. БпЛА', col: '#ff7a2f', w: 2.1, sp: 450,  ico: 'jet' },
    missile_cruise:   { label: 'Крилата ракета',          short: 'Крилата',    col: '#ff5a3c', w: 2.6, sp: 800,  ico: 'cruise' },
    missile_ballistic:{ label: 'Балістична ракета',       short: 'Балістика',  col: '#ff2f6d', w: 3.4, sp: 7500, ico: 'ballistic' },
    bomb:             { label: 'КАБ / УМПК',              short: 'КАБ',        col: '#ffd23f', w: 2.2, sp: 750,  ico: 'bomb' },
    drone_fpv:        { label: 'FPV / малий БпЛА',        short: 'FPV',        col: '#4fc3f7', w: 1.2, sp: 120,  ico: 'fpv' }
  };
  const ORDER = ['drone_piston', 'drone_jet', 'missile_cruise', 'missile_ballistic', 'bomb', 'drone_fpv'];
  const OTHER = { label: 'Невідомий тип', short: 'Ціль', col: '#8899aa', w: 1.4, sp: 300, ico: 'fpv' };

  const STATUS = {
    active:     { label: 'У повітрі',        col: null,      op: 1,   order: 0 },
    eliminated: { label: 'Збито',            col: '#7d8f88', op: .5,  order: 1 },
    hit_target: { label: 'Влучив у ціль',    col: '#c0392f', op: .6,  order: 2 },
    lost:       { label: 'Зник з радарів',   col: '#8a8f9a', op: .38, order: 3 }
  };
  const ST_ORDER = ['active', 'eliminated', 'hit_target', 'lost'];

  /* скільки хвилин після last_seen ціль ще вважається такою, що реально в повітрі */
  const TTL_MIN = {
    missile_ballistic: 8, missile_cruise: 15, bomb: 12,
    drone_jet: 15, drone_piston: 25, drone_fpv: 15
  };
  const TTL_DEFAULT = 20;
  function fresh(o, now) {
    if (o.status !== 'active') return true;
    const seen = o.last || o.first;
    if (!seen) return true;
    const ttl = (TTL_MIN[o.kind] || TTL_DEFAULT) * 60000;
    return (now - seen) <= ttl;
  }
  const ttlLabel = (kind) => (TTL_MIN[kind] || TTL_DEFAULT) + ' хв';

  const ZONES = {
    chauda: 'Мис Чауда, Крим', crimea: 'Крим', sevastopol: 'Севастополь', gvardiiske: 'Гвардійське, Крим',
    black_sea_w: 'Чорне море · захід', black_sea_e: 'Чорне море · схід', novorossiysk: 'Новоросійськ',
    primorsk: 'Приморсько-Ахтарськ', eysk: 'Єйськ', rostov: 'Ростов-на-Дону', millerovo: 'Міллерово',
    morozovsk: 'Морозовськ', kursk: 'Курськ', belgorod: 'Бєлгород', bryansk: 'Брянськ', orel: 'Орел',
    shaykivka: 'Шайківка', baltimor: 'Воронеж · Балтимор', buturlinovka: 'Бутурлинівка', engels: 'Енгельс',
    caspian: 'Каспійське море', mozyr: 'Мозир · кордон РБ', tot_donbas: 'ТОТ Донбасу', tot_zap: 'ТОТ Запоріжжя',
    unknown: 'Напрямок не визначено'
  };

  /* oblast centroids — resolved to map polygons by point-in-polygon, avoids name-matching */
  const OBLASTS = [
    { uid: 3,  n: 'Хмельницька',       ll: [26.99, 49.42] }, { uid: 4,  n: 'Вінницька',        ll: [28.47, 49.23] },
    { uid: 5,  n: 'Рівненська',        ll: [26.25, 50.62] }, { uid: 8,  n: 'Волинська',        ll: [25.33, 50.75] },
    { uid: 9,  n: 'Дніпропетровська',  ll: [35.05, 48.46] }, { uid: 10, n: 'Житомирська',      ll: [28.66, 50.25] },
    { uid: 11, n: 'Закарпатська',      ll: [22.29, 48.62] }, { uid: 12, n: 'Запорізька',       ll: [35.14, 47.84] },
    { uid: 13, n: 'Івано-Франківська', ll: [24.71, 48.92] }, { uid: 14, n: 'Київська',         ll: [30.05, 50.05] },
    { uid: 15, n: 'Кіровоградська',    ll: [32.26, 48.51] }, { uid: 16, n: 'Луганська',        ll: [39.31, 48.57] },
    { uid: 17, n: 'Миколаївська',      ll: [31.99, 46.98] }, { uid: 18, n: 'Одеська',          ll: [30.72, 46.48] },
    { uid: 19, n: 'Полтавська',        ll: [34.55, 49.59] }, { uid: 20, n: 'Сумська',          ll: [34.80, 50.91] },
    { uid: 21, n: 'Тернопільська',     ll: [25.59, 49.55] }, { uid: 22, n: 'Харківська',       ll: [36.23, 49.99] },
    { uid: 23, n: 'Херсонська',        ll: [32.62, 46.64] }, { uid: 24, n: 'Черкаська',        ll: [32.06, 49.44] },
    { uid: 25, n: 'Чернігівська',      ll: [31.29, 51.50] }, { uid: 26, n: 'Чернівецька',      ll: [25.94, 48.29] },
    { uid: 27, n: 'Львівська',         ll: [24.03, 49.84] }, { uid: 28, n: 'Донецька',         ll: [37.80, 48.02] },
    { uid: 29, n: 'АР Крим',           ll: [34.10, 44.95] }, { uid: 30, n: 'Севастополь',      ll: [33.53, 44.60] },
    { uid: 31, n: 'Київ',              ll: [30.52, 50.45] }
  ];
  const BY_UID = {}; OBLASTS.forEach(o => { BY_UID[o.uid] = o; });

  /* ---------- api ---------- */
  async function get(path, params) {
    const u = new URL(BASE + path);
    if (params) Object.keys(params).forEach(k => { if (params[k] != null) u.searchParams.set(k, params[k]); });
    const r = await fetch(u.toString(), { cache: 'no-store' });
    if (!r.ok) throw new Error('mapa.ua ' + r.status);
    return r.json();
  }
  const api = {
    current:  () => get('/current'),
    attacks:  (o) => get('/attacks', o || {}),
    objects:  (id) => get('/objects', { attack_id: id }),
    replay:   (id) => get('/attack_replay', { attack_id: id }),
    calendar: () => get('/calendar'),
    cities:   () => get('/geo/cities'),
    nearby:   (lat, lon, km) => get('/nearby', { lat: lat, lon: lon, radius_km: km })
  };

  /* ---------- geo ---------- */
  const T = Math.PI / 180;
  function dest(lon, lat, hdg, km) {
    const R = 6371, dR = km / R, br = hdg * T, la1 = lat * T, lo1 = lon * T;
    const la2 = Math.asin(Math.sin(la1) * Math.cos(dR) + Math.cos(la1) * Math.sin(dR) * Math.cos(br));
    const lo2 = lo1 + Math.atan2(Math.sin(br) * Math.sin(dR) * Math.cos(la1), Math.cos(dR) - Math.sin(la1) * Math.sin(la2));
    return [lo2 / T, la2 / T];
  }
  function km(a, b) {
    const dla = (b[1] - a[1]) * T, dlo = (b[0] - a[0]) * T;
    const s = Math.sin(dla / 2) ** 2 + Math.cos(a[1] * T) * Math.cos(b[1] * T) * Math.sin(dlo / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
  }
  function bearing(a, b) {
    const y = Math.sin((b[0] - a[0]) * T) * Math.cos(b[1] * T);
    const x = Math.cos(a[1] * T) * Math.sin(b[1] * T) - Math.sin(a[1] * T) * Math.cos(b[1] * T) * Math.cos((b[0] - a[0]) * T);
    return (Math.atan2(y, x) / T + 360) % 360;
  }

  /* ---------- normalisation ---------- */
  const meta = (k) => KINDS[k] || OTHER;
  function norm(o, t0) {
    const M = meta(o.kind);
    const tr = Array.isArray(o.trail) ? o.trail.filter(p => Array.isArray(p) && p.length >= 2 && isFinite(p[0]) && isFinite(p[1])) : [];
    let hdg = o.heading;
    if (hdg == null && tr.length >= 2) hdg = bearing(tr[tr.length - 2], tr[tr.length - 1]);
    return {
      id: String(o.id), kind: o.kind, subkind: o.subkind || o.kind, amount: o.amount || 1,
      title: o.title || M.short, status: STATUS[o.status] ? o.status : 'lost',
      lat: o.lat, lon: o.lon, hdg: (hdg == null ? 0 : hdg), speed: o.speed_kmh || M.sp,
      zone: o.from_zone || 'unknown', city: o.to_city || '',
      first: (o.first_seen || 0) * 1000, last: (o.last_seen || 0) * 1000,
      pred: (o.predicted_lat != null && o.predicted_lon != null) ? [o.predicted_lon, o.predicted_lat] : null,
      trail: tr, t0: t0, off: null, offT: 0
    };
  }

  /* live position: dead-reckoning from the API fix, with a soft catch-up offset */
  function posAt(o, now, maxDr) {
    if (o.status !== 'active') return [o.lon, o.lat];
    const dt = Math.max(0, Math.min(maxDr == null ? 40 : maxDr, (now - o.t0) / 1000));
    let p = dt > 0.2 ? dest(o.lon, o.lat, o.hdg, o.speed * dt / 3600) : [o.lon, o.lat];
    if (o.off && o.offT) {
      const k = 1 - Math.min(1, (now - o.offT) / 1800);
      if (k > 0.002) p = [p[0] + o.off[0] * k * k, p[1] + o.off[1] * k * k];
    }
    return p;
  }

  /* ---------- icons (canvas → map.addImage, one per kind × status) ---------- */
  function glyph(ctx, ico, col, hollow) {
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.fillStyle = hollow ? 'transparent' : col;
    ctx.strokeStyle = col;
    const body = (pts) => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); if (!hollow) ctx.fill(); ctx.lineWidth = hollow ? 1.3 : 1; ctx.stroke(); };
    if (ico === 'shahed') {
      body([[0, -7.5], [2.4, 4], [0, 2.4], [-2.4, 4]]);
      ctx.lineWidth = 1.7; ctx.beginPath();
      ctx.moveTo(-1, -1.5); ctx.lineTo(-7.5, 3); ctx.lineTo(-1, 1.2);
      ctx.moveTo(1, -1.5); ctx.lineTo(7.5, 3); ctx.lineTo(1, 1.2); ctx.stroke();
    } else if (ico === 'jet') {
      body([[0, -8.5], [2, 3], [0, 1.6], [-2, 3]]);
      ctx.lineWidth = 1.8; ctx.beginPath();
      ctx.moveTo(-0.8, -2); ctx.lineTo(-8, 4.5); ctx.moveTo(0.8, -2); ctx.lineTo(8, 4.5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, 3.4); ctx.lineTo(0, 7.5); ctx.lineWidth = 2.2; ctx.stroke();
    } else if (ico === 'cruise') {
      body([[0, -9.5], [1.9, 5], [0, 3.4], [-1.9, 5]]);
      ctx.lineWidth = 1.6; ctx.beginPath();
      ctx.moveTo(-1.3, 0); ctx.lineTo(-6, 2.4); ctx.moveTo(1.3, 0); ctx.lineTo(6, 2.4);
      ctx.moveTo(-1.6, 5); ctx.lineTo(-3.4, 7.6); ctx.moveTo(1.6, 5); ctx.lineTo(3.4, 7.6); ctx.stroke();
    } else if (ico === 'ballistic') {
      body([[0, -11], [2.4, 5.5], [0, 3.6], [-2.4, 5.5]]);
      ctx.lineWidth = 1.8; ctx.beginPath();
      ctx.moveTo(-2.4, 5.5); ctx.lineTo(-5, 9.4); ctx.moveTo(2.4, 5.5); ctx.lineTo(5, 9.4);
      ctx.moveTo(0, 4); ctx.lineTo(0, 9.8); ctx.stroke();
    } else if (ico === 'bomb') {
      body([[0, -7], [3.6, 5], [-3.6, 5]]);
      ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-3.6, 5); ctx.lineTo(3.6, 5); ctx.stroke();
    } else {
      ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, -5.6); ctx.lineTo(4.4, 0); ctx.lineTo(0, 5.6); ctx.lineTo(-4.4, 0); ctx.closePath();
      if (!hollow) ctx.fill(); ctx.stroke();
    }
  }
  function iconData(ico, col, hollow, dpr) {
    const S = 30, c = document.createElement('canvas');
    c.width = c.height = S * dpr;
    const ctx = c.getContext('2d');
    ctx.scale(dpr, dpr); ctx.translate(S / 2, S / 2);
    ctx.shadowColor = 'rgba(3,12,8,.85)'; ctx.shadowBlur = 3;
    glyph(ctx, ico, col, hollow);
    const d = ctx.getImageData(0, 0, c.width, c.height);
    return { width: c.width, height: c.height, data: d.data };
  }
  function addIcons(map) {
    const dpr = 2;
    ORDER.concat(['other']).forEach(k => {
      const M = k === 'other' ? OTHER : KINDS[k];
      ST_ORDER.forEach(s => {
        const S = STATUS[s], name = 'mp-' + k + '-' + s;
        if (map.hasImage && map.hasImage(name)) return;
        try { map.addImage(name, iconData(M.ico, S.col || M.col, s === 'lost', dpr), { pixelRatio: dpr }); } catch (e) {}
      });
    });
  }
  const iconName = (o) => 'mp-' + (KINDS[o.kind] ? o.kind : 'other') + '-' + o.status;

  /* ---------- labels ---------- */
  const OBL_SFX = {
    poltavska:'Полтавщина', kyivska:'Київщина', kharkivska:'Харківщина', sumska:'Сумщина',
    chernihivska:'Чернігівщина', cherkaska:'Черкащина', dnipropetrovska:'Дніпропетровщина',
    zaporizka:'Запоріжжя', mykolaivska:'Миколаївщина', odeska:'Одещина', khersonska:'Херсонщина',
    donetska:'Донеччина', luhanska:'Луганщина', kirovohradska:'Кіровоградщина', vinnytska:'Вінниччина',
    zhytomyrska:'Житомирщина', rivnenska:'Рівненщина', volynska:'Волинь', lvivska:'Львівщина',
    ternopilska:'Тернопільщина', khmelnytska:'Хмельниччина', chernivetska:'Буковина',
    zakarpatska:'Закарпаття', 'ivano-frankivska':'Прикарпаття', krymska:'Крим'
  };

  const CITY_UA = {
    kyiv:'Київ', kiev:'Київ', odesa:'Одеса', odessa:'Одеса', kharkiv:'Харків', dnipro:'Дніпро',
    lviv:'Львів', zaporizhzhia:'Запоріжжя', zaporizhia:'Запоріжжя', mykolaiv:'Миколаїв',
    'kryvyi-rih':'Кривий Ріг', sumy:'Суми', poltava:'Полтава', chernihiv:'Чернігів', cherkasy:'Черкаси',
    zhytomyr:'Житомир', vinnytsia:'Вінниця', khmelnytskyi:'Хмельницький', rivne:'Рівне', lutsk:'Луцьк',
    ternopil:'Тернопіль', 'ivano-frankivsk':'Івано-Франківськ', uzhhorod:'Ужгород', chernivtsi:'Чернівці',
    kropyvnytskyi:'Кропивницький', kherson:'Херсон', donetsk:'Донецьк', luhansk:'Луганськ',
    simferopol:'Сімферополь', sevastopol:'Севастополь', dzhankoi:'Джанкой', kerch:'Керч', yalta:'Ялта',
    mariupol:'Маріуполь', melitopol:'Мелітополь', berdiansk:'Бердянськ', enerhodar:'Енергодар',
    nikopol:'Нікополь', marhanets:'Марганець', pokrov:'Покров', pavlohrad:'Павлоград',
    kamianske:'Камʼянське', novomoskovsk:'Новомосковськ', samar:'Самар', synelnykove:'Синельникове',
    'zhovti-vody':'Жовті Води', kremenchuk:'Кременчук', myrhorod:'Миргород', lubny:'Лубни',
    hadiach:'Гадяч', gadyach:'Гадяч', zavodske:'Заводське', pyriatyn:'Пирятин', karlivka:'Карлівка',
    kobeliaky:'Кобеляки', reshetylivka:'Решетилівка', 'novi-sanzhary':'Нові Санжари',
    oleksandriia:'Олександрія', znamianka:'Знамʼянка', svitlovodsk:'Світловодськ',
    izmail:'Ізмаїл', chornomorsk:'Чорноморськ', yuzhne:'Южне', bilhorod:'Білгород-Дністровський',
    'bila-tserkva':'Біла Церква', brovary:'Бровари', boryspil:'Бориспіль', irpin:'Ірпінь', bucha:'Буча',
    fastiv:'Фастів', obukhiv:'Обухів', vyshhorod:'Вишгород', slavutych:'Славутич', vasylkiv:'Васильків',
    pereyaslav:'Переяслав', pereiaslav:'Переяслав', uman:'Умань', smila:'Сміла', kaniv:'Канів',
    zolotonosha:'Золотоноша', drabiv:'Драбів', konotop:'Конотоп', shostka:'Шостка', okhtyrka:'Охтирка',
    romny:'Ромни', hlukhiv:'Глухів', krolevets:'Кролевець', nizhyn:'Ніжин', pryluky:'Прилуки',
    novhorod:'Новгород-Сіверський', izium:'Ізюм', izjum:'Ізюм', balakliia:'Балаклія', balakliya:'Балаклія',
    lozova:'Лозова', chuhuiv:'Чугуїв', kupiansk:'Куп\u02BCянськ', merefa:'Мерефа', vovchansk:'Вовчанськ',
    pokrovsk:'Покровськ', kramatorsk:'Краматорськ', sloviansk:'Словʼянськ', bakhmut:'Бахмут',
    druzhkivka:'Дружківка', kostiantynivka:'Костянтинівка', myrnohrad:'Мирноград',
    dobropillia:'Добропілля', zelenodolsk:'Зеленодольськ', voznesensk:'Вознесенськ',
    pervomaisk:'Первомайськ', yuzhnoukrainsk:'Южноукраїнськ', ochakiv:'Очаків', snihurivka:'Снігурівка',
    bashtanka:'Баштанка', kazanka:'Казанка', nova:'Нова Каховка', kakhovka:'Каховка',
    berdychiv:'Бердичів', korosten:'Коростень', novohrad:'Звягель', malyn:'Малин',
    kovel:'Ковель', volodymyr:'Володимир', varash:'Вараш', dubno:'Дубно', sarny:'Сарни',
    kamianets:'Камʼянець-Подільський', shepetivka:'Шепетівка', starokostiantyniv:'Старокостянтинів',
    drohobych:'Дрогобич', stryi:'Стрий', chervonohrad:'Червоноград', sambir:'Самбір',
    kalush:'Калуш', kolomyia:'Коломия', mukachevo:'Мукачево', berehove:'Берегове',
    kremenets:'Кременець', chortkiv:'Чортків', mohyliv:'Могилів-Подільський', zhmerynka:'Жмеринка',
    khmilnyk:'Хмільник', huliaipole:'Гуляйполе', 'chasiv-yar':'Часів Яр', 'velykyi-burluk':'Великий Бурлук',
    'bila-krynytsia':'Біла Криниця', 'bila-krynitsia':'Біла Криниця', 'nova-kakhovka':'Нова Каховка',
    'kamianka-dniprovska':'Камʼянка-Дніпровська', 'novhorod-siverskyi':'Новгород-Сіверський',
    'bilhorod-dnistrovskyi':'Білгород-Дністровський', 'kamianets-podilskyi':'Камʼянець-Подільський',
    'mohyliv-podilskyi':'Могилів-Подільський', 'volodymyr-volynskyi':'Володимир-Волинський', koziatyn:'Козятин', haisyn:'Гайсин', ladyzhyn:'Ладижин'
  };

  /* зворотна транслітерація (KMU-2010) — запасний варіант для незнайомих кодів */
  const TRANSLIT = [
    ['shch', 'щ'], ['sch', 'щ'], ['zgh', 'зг'],
    ['kh', 'х'], ['ts', 'ц'], ['ch', 'ч'], ['sh', 'ш'], ['zh', 'ж'],
    ['iya', 'ія'], ['iia', 'ія'],
    ['ya', 'я'], ['yu', 'ю'], ['ye', 'є'], ['yo', 'йо'], ['ja', 'я'], ['ju', 'ю'], ['je', 'є'],
    ['ia', 'я'], ['iu', 'ю'], ['ie', 'є']
  ];
  const SINGLE = { a:'а', b:'б', v:'в', h:'г', g:'г', d:'д', e:'е', z:'з', y:'и', i:'і', k:'к', l:'л',
    m:'м', n:'н', o:'о', p:'п', r:'р', s:'с', t:'т', u:'у', f:'ф', c:'ц', j:'й', q:'к', w:'в', x:'кс' };
  const VOW = 'aeiouy';

  function translit(w) {
    let s = w.toLowerCase();
    if (/[А-Яа-яІіЇїЄєҐґ]/.test(s)) return s;
    s = s.replace(/skyi$|skiy$/, '\u0001')   // -ський
         .replace(/ska$/, '\u0002')           // -ська
         .replace(/ske$/, '\u0003')           // -ське
         .replace(/sk$/, '\u0004');           // -ськ
    s = s.replace(/yi$/, '\u0005').replace(/iy$/, '\u0006'); // -ий / -ій
    TRANSLIT.forEach(([a, b]) => { s = s.split(a).join(b); });
    s = s.replace(/([aeiou])i/g, (m0, v) => v + 'ї');
    s = s.replace(/([aeiou])y/g, (m0, v) => v + 'й');
    s = s.replace(/y([aeiou])/g, (m0, v) => 'й' + v);
    let out = '';
    for (const ch of s) out += (SINGLE[ch] != null ? SINGLE[ch] : ch);
    out = out.replace(/([яюєї])і/g, '$1й');
    return out.replace(/\u0001/g, 'ський').replace(/\u0002/g, 'ська').replace(/\u0003/g, 'ське')
              .replace(/\u0004/g, 'ськ').replace(/\u0005/g, 'ий').replace(/\u0006/g, 'ій');
  }
  const cap = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

  function cityLabel(code, dict) {
    if (!code) return '';
    const raw = String(code).trim();
    const mm = raw.match(/^([^(]+)\(([^)]*)\)\s*$/);
    const base = (mm ? mm[1] : raw).replace(/[_\s]+/g, '-').toLowerCase();
    const obl = mm ? (OBL_SFX[mm[2].toLowerCase()] || cap(translit(mm[2].replace(/ska$/, '')))) : '';
    let name = CITY_UA[base];
    if (!name) {
      const e = dict && (dict[raw] || dict[base]);
      if (e && e.ua && /[А-Яа-яІіЇїЄєҐґ]/.test(e.ua)) name = e.ua;
    }
    if (!name) {
      if (/^\d+$/.test(base)) return obl || base;
      name = base.split('-').map(w => cap(translit(w))).join(' ');
    }
    return obl ? (name + ' (' + obl + ')') : name;
  }

  function ago(ms) {
    if (!ms) return '';
    const s = Math.max(0, (Date.now() - ms) / 1000);
    if (s < 60) return 'щойно';
    const m = Math.round(s / 60);
    if (m < 60) return m + ' хв тому';
    const h = Math.floor(m / 60);
    return h + ' год ' + (m % 60) + ' хв тому';
  }
  const hhmm = (ms) => ms ? new Date(ms).toTimeString().slice(0, 5) : '—';

  window.Delta9Mapa = {
    BASE, KINDS, ORDER, OTHER, STATUS, ST_ORDER, ZONES, OBLASTS, BY_UID,
    api, meta, norm, posAt, dest, km, bearing, addIcons, iconName, cityLabel, ago, hhmm, fresh, ttlLabel, TTL_MIN, TTL_DEFAULT
  };
})();
