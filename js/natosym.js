/* Delta9 — APP-6 / MIL-STD-2525 symbol engine.
   Composition: frame (affiliation × dimension) + icon + echelon + mobility + capability + text amplifiers.
   Everything is drawn vectorially in a normalised box so it stays crisp at any size and can be
   replaced piece-by-piece by an imported SVG kit (see D9SYM.registerIcon / registerFrame). */
(function () {
  'use strict';
  var TAU = Math.PI * 2;

  /* ---------------------------------------------------------------- affiliation */
  var AFF_ORDER = ['unknown', 'neutral', 'suspect', 'hostile', 'assumed', 'friend'];
  var AFF = {
    unknown: { label: 'Невідомий', short: 'Невідомий', fill: '#FFF07A', line: '#4E4200', sh: 'clover', dash: 0 },
    neutral: { label: 'Нейтральний', short: 'Нейтральний', fill: '#A8F0A8', line: '#0B4413', sh: 'square', dash: 0 },
    suspect: { label: 'Підозрілий', short: 'Підозрілий', fill: '#FF9E9E', line: '#5E0000', sh: 'diamond', dash: 1 },
    hostile: { label: 'Ворожий', short: 'Ворожий', fill: '#FF8080', line: '#5E0000', sh: 'diamond', dash: 0 },
    assumed: { label: 'Очікувано дружній', short: 'Оч. дружній', fill: '#93E4FF', line: '#06364F', sh: 'rect', dash: 1 },
    friend: { label: 'Дружній', short: 'Дружній', fill: '#93E4FF', line: '#06364F', sh: 'rect', dash: 0 }
  };

  /* ----------------------------------------------------------------- dimension */
  var DIM_ORDER = ['air', 'space', 'ground', 'sea', 'sub', 'equip', 'inst', 'act'];
  var DIM = {
    air: { label: 'Повітряний', half: 'top' },
    space: { label: 'Космічний', half: 'top', space: 1 },
    ground: { label: 'Сухопутний', half: 'full' },
    sea: { label: 'Надводний', half: 'full', sea: 1 },
    sub: { label: 'Підводний', half: 'bot' },
    equip: { label: 'Озбр. та техніка', half: 'full', equip: 1 },
    inst: { label: 'Інфраструктура', half: 'full', inst: 1 },
    act: { label: 'Діяльність', half: 'full', act: 1 }
  };

  /* ---------------------------------------------------------------- primitives */
  function mv(c, x, y) { c.moveTo(x, y); }
  function ln(c, x, y) { c.lineTo(x, y); }
  function seg(c, x1, y1, x2, y2) { c.moveTo(x1, y1); c.lineTo(x2, y2); }
  function dot(c, x, y, r) { c.moveTo(x + r, y); c.arc(x, y, r, 0, TAU); }
  function box(c, x, y, w, h) { c.rect(x - w / 2, y - h / 2, w, h); }

  /* ------------------------------------------------------------ frame geometry
     All frames are traced inside x∈[-1,1], y∈[-1,1]. `half` opens the frame
     upward (air/space) or downward (subsurface). */
  function clover(c, half) {
    var R = 0.9, pts = { N: [0, -R], W: [-R, 0], S: [0, R], E: [R, 0] };
    var order = half === 'top' ? ['E', 'N', 'W'] : half === 'bot' ? ['W', 'S', 'E'] : ['N', 'W', 'S', 'E', 'N'];
    var first = pts[order[0]];
    c.moveTo(first[0], first[1]);
    for (var i = 1; i < order.length; i++) {
      var a = pts[order[i - 1]], b = pts[order[i]];
      var cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2;
      var r = Math.hypot(b[0] - a[0], b[1] - a[1]) / 2;
      c.arc(cx, cy, r, Math.atan2(a[1] - cy, a[0] - cx), Math.atan2(b[1] - cy, b[0] - cx), true);
    }
  }
  function framePath(c, sh, half) {
    c.beginPath();
    if (sh === 'clover') { clover(c, half); if (half === 'full') c.closePath(); return; }
    if (sh === 'diamond') {
      var D = 1.02;
      if (half === 'top') { mv(c, -D, 0.26); ln(c, 0, -D + 0.08); ln(c, D, 0.26); return; }
      if (half === 'bot') { mv(c, -D, -0.26); ln(c, 0, D - 0.08); ln(c, D, -0.26); return; }
      mv(c, 0, -D); ln(c, D, 0); ln(c, 0, D); ln(c, -D, 0); c.closePath(); return;
    }
    if (sh === 'square') {
      var S = 0.86;
      if (half === 'top') { mv(c, -S, S); ln(c, -S, -S); ln(c, S, -S); ln(c, S, S); return; }
      if (half === 'bot') { mv(c, -S, -S); ln(c, -S, S); ln(c, S, S); ln(c, S, -S); return; }
      mv(c, -S, -S); ln(c, S, -S); ln(c, S, S); ln(c, -S, S); c.closePath(); return;
    }
    /* rect — friend / assumed friend */
    var W = 1.0, H = 0.74;
    if (half === 'top') { mv(c, -W, H); ln(c, -W, -0.18); c.bezierCurveTo(-W, -1.02, W, -1.02, W, -0.18); ln(c, W, H); return; }
    if (half === 'bot') { mv(c, -W, -H); ln(c, -W, 0.18); c.bezierCurveTo(-W, 1.02, W, 1.02, W, 0.18); ln(c, W, -H); return; }
    mv(c, -W, -H); ln(c, W, -H); ln(c, W, H); ln(c, -W, H); c.closePath();
  }
  /* inner box the icon is allowed to occupy, per frame shape */
  var INNER = { rect: 0.72, square: 0.62, diamond: 0.50, clover: 0.56 };

  /* --------------------------------------------------------------------- icons
     Each icon draws inside x,y ∈ [-1,1] using the caller's stroke settings.
     s = stroke path, f = fill path. */
  function I(label, grp, s, f) { return { label: label, grp: grp, s: s, f: f || null }; }
  var G1 = 'Загальновійськові', G2 = 'Стрілецька зброя, гранатомети, ПТРК', G3 = 'Танки та броньовані машини',
    G4 = 'Артилерія та міномети', G5 = 'Комплекси ППО', G6 = 'Ракети «поверхня–поверхня»',
    G7 = 'Забезпечення та автотранспорт', G8 = 'Залізничні засоби', G9 = 'Розвідка та РЕБ',
    G10 = 'Авіація та флот', G11 = 'Інфраструктура';

  function cross(c) { seg(c, -1, -1, 1, 1); seg(c, 1, -1, -1, 1); }
  function oval(c) { c.moveTo(1, 0); c.ellipse(0, 0, 1, 0.6, 0, 0, TAU); }
  function slash(c) { seg(c, -1, 1, 1, -1); }
  function dome(c) { c.moveTo(-1, 0.7); c.arc(0, 0.7, 1, Math.PI, 0); }
  function chevron(c) { mv(c, -1, 0.5); ln(c, 0, -0.75); ln(c, 1, 0.5); }
  function wheels(c, n, y, r) { var w = 2 / n; for (var i = 0; i < n; i++) dot(c, -1 + w / 2 + i * w, y, r); }

  var ICONS = {
    /* --- combined arms --- */
    inf: I('Піхота', G1, cross),
    inf_mech: I('Механізована піхота', G1, function (c) { cross(c); oval(c); }),
    inf_mot: I('Мотопіхота', G1, function (c) { cross(c); seg(c, 0, -1, 0, 1); }),
    inf_air: I('Аеромобільна піхота', G1, function (c) { cross(c); mv(c, -1, -0.55); ln(c, 0, -1); ln(c, 1, -0.55); }),
    inf_lt: I('Легка піхота', G1, function (c) { cross(c); seg(c, -1, 0, 1, 0); }),
    marine: I('Морська піхота', G1, function (c) { cross(c); c.moveTo(-1, 0.8); c.bezierCurveTo(-0.4, 0.3, 0.4, 1.2, 1, 0.7); }),
    tank_u: I('Танкові війська', G1, oval),
    recon: I('Розвідка', G1, slash),
    recon_arm: I('Броньована розвідка', G1, function (c) { slash(c); oval(c); }),
    hq: I('Штаб / КП', G1, function (c) { seg(c, -0.2, -1, -0.2, 1); mv(c, -0.2, -1); ln(c, 0.9, -1); ln(c, 0.9, -0.3); ln(c, -0.2, -0.3); }),
    /* --- small arms / AT --- */
    rifle: I('Стрілецьке відділення', G2, function (c) { seg(c, 0, 1, 0, -0.9); seg(c, -0.45, -0.55, 0.45, -0.55); }),
    mg: I('Кулемет', G2, function (c) { seg(c, 0, 1, 0, -0.9); seg(c, -0.5, -0.5, 0.5, -0.5); seg(c, -0.5, -0.1, 0.5, -0.1); }),
    mg_hv: I('Великокаліберний кулемет', G2, function (c) { seg(c, 0, 1, 0, -0.9); seg(c, -0.55, -0.55, 0.55, -0.55); seg(c, -0.55, -0.15, 0.55, -0.15); seg(c, -0.55, 0.25, 0.55, 0.25); }),
    gl: I('Гранатомет', G2, function (c) { seg(c, 0, 1, 0, -0.6); }, function (c) { dot(c, 0, -0.75, 0.28); }),
    agl: I('Автоматичний гранатомет', G2, function (c) { seg(c, 0, 1, 0, -0.5); seg(c, -0.45, 0.15, 0.45, 0.15); }, function (c) { dot(c, 0, -0.72, 0.3); }),
    atgm: I('ПТРК', G2, function (c) { mv(c, -0.95, 0.85); ln(c, 0, -0.9); ln(c, 0.95, 0.85); }),
    atgm_veh: I('ПТРК на шасі', G2, function (c) { mv(c, -0.95, 0.55); ln(c, 0, -0.9); ln(c, 0.95, 0.55); oval(c); }),
    rpg: I('РПГ / гранатометник', G2, function (c) { seg(c, -0.9, 0.7, 0.7, -0.7); mv(c, 0.2, -0.85); ln(c, 0.9, -0.9); ln(c, 0.85, -0.2); }),
    /* --- armour --- */
    tank: I('Танк', G3, function (c) { box(c, 0, 0, 1.8, 1.05); }),
    tank_lt: I('Легкий танк', G3, function (c) { box(c, 0, 0, 1.8, 1.05); seg(c, -0.35, -0.52, -0.35, 0.52); }),
    tank_md: I('Середній танк', G3, function (c) { box(c, 0, 0, 1.8, 1.05); seg(c, -0.35, -0.52, -0.35, 0.52); seg(c, 0.35, -0.52, 0.35, 0.52); }),
    tank_hv: I('Важкий танк', G3, function (c) { box(c, 0, 0, 1.8, 1.05); seg(c, -0.5, -0.52, -0.5, 0.52); seg(c, 0, -0.52, 0, 0.52); seg(c, 0.5, -0.52, 0.5, 0.52); }),
    ifv: I('БМП', G3, function (c) { box(c, 0, 0, 1.8, 1.05); cross2(c); }),
    apc: I('БТР (гусеничний)', G3, function (c) { box(c, 0, 0, 1.8, 1.05); seg(c, -0.9, 0, 0.9, 0); }),
    apc_wh: I('БТР (колісний)', G3, function (c) { box(c, 0, -0.15, 1.7, 0.85); wheels(c, 3, 0.62, 0.22); }),
    armcar: I('Бронеавтомобіль', G3, function (c) { box(c, 0, -0.15, 1.5, 0.85); wheels(c, 2, 0.6, 0.24); }),
    mrap: I('MRAP', G3, function (c) { mv(c, -0.85, 0.28); ln(c, -0.6, -0.6); ln(c, 0.6, -0.6); ln(c, 0.85, 0.28); c.closePath(); wheels(c, 2, 0.62, 0.24); }),
    engveh: I('Інженерна машина', G3, function (c) { box(c, 0, -0.1, 1.7, 0.95); seg(c, -0.95, 0.7, 0.95, 0.7); seg(c, -0.6, 0.7, -0.6, 0.38); }),
    /* --- artillery --- */
    arty: I('Артилерія', G4, null, function (c) { dot(c, 0, 0, 0.46); }),
    arty_towed: I('Причіпна артилерія', G4, function (c) { seg(c, -0.9, 0.75, 0.9, 0.75); seg(c, -0.55, 0.75, -0.55, 1.0); seg(c, 0.55, 0.75, 0.55, 1.0); }, function (c) { dot(c, 0, -0.1, 0.44); }),
    arty_sp: I('Самохідна артилерія', G4, function (c) { box(c, 0, 0.35, 1.8, 0.85); }, function (c) { dot(c, 0, -0.5, 0.4); }),
    mortar: I('Міномет', G4, function (c) { seg(c, 0, 1, 0, -0.5); }, function (c) { dot(c, 0, -0.72, 0.3); }),
    mortar_sp: I('Самохідний міномет', G4, function (c) { seg(c, 0, 0.15, 0, -0.5); box(c, 0, 0.6, 1.7, 0.7); }, function (c) { dot(c, 0, -0.72, 0.3); }),
    mlrs: I('РСЗВ', G4, function (c) { mv(c, -0.55, 0.35); ln(c, 0, -0.95); ln(c, 0.55, 0.35); }, function (c) { dot(c, 0, 0.68, 0.32); }),
    mlrs_hv: I('Важка РСЗВ', G4, function (c) { mv(c, -0.7, 0.3); ln(c, 0, -0.95); ln(c, 0.7, 0.3); seg(c, -0.45, -0.1, 0.45, -0.1); }, function (c) { dot(c, 0, 0.7, 0.3); }),
    counterbat: I('Контрбатарейна боротьба', G4, function (c) { c.moveTo(-0.9, 0.6); c.arc(0, 0.6, 0.9, Math.PI, 0); seg(c, 0, 0.6, 0, -0.9); }, function (c) { dot(c, 0, -0.9, 0.22); }),
    /* --- air defence --- */
    ad: I('ППО (загальне)', G5, dome),
    ad_gun: I('Зенітна артилерія', G5, dome, function (c) { dot(c, 0, 0.15, 0.34); }),
    ad_missile: I('ЗРК', G5, function (c) { dome(c); mv(c, -0.42, 0.3); ln(c, 0, -0.35); ln(c, 0.42, 0.3); }),
    ad_short: I('ЗРК малої дальності', G5, function (c) { dome(c); seg(c, -0.5, 0.15, 0.5, 0.15); }),
    manpads: I('ПЗРК', G5, function (c) { c.moveTo(-0.7, 0.7); c.arc(0, 0.7, 0.7, Math.PI, 0); seg(c, 0, 0.7, 0, -0.9); }),
    ad_radar: I('РЛС ППО', G5, function (c) { dome(c); c.moveTo(-0.45, 0.65); c.arc(0, 0.65, 0.45, Math.PI, 0); }),
    /* --- surface-to-surface missiles --- */
    ssm: I('ОТРК «поверхня–поверхня»', G6, function (c) { seg(c, 0, 1, 0, -0.55); mv(c, -0.35, -0.2); ln(c, 0, -0.95); ln(c, 0.35, -0.2); seg(c, -0.7, 1, 0.7, 1); }),
    ssm_tac: I('Тактичний ракетний комплекс', G6, function (c) { seg(c, -0.4, 1, -0.4, -0.4); seg(c, 0.4, 1, 0.4, -0.4); mv(c, -0.72, -0.1); ln(c, -0.4, -0.85); ln(c, -0.08, -0.1); mv(c, 0.08, -0.1); ln(c, 0.4, -0.85); ln(c, 0.72, -0.1); }),
    ssm_op: I('Оперативно-тактичний комплекс', G6, function (c) { seg(c, 0, 1, 0, -0.5); mv(c, -0.4, -0.15); ln(c, 0, -0.95); ln(c, 0.4, -0.15); seg(c, -0.8, 1, 0.8, 1); seg(c, -0.5, 0.45, 0.5, 0.45); }),
    cruise: I('Крилата ракета', G6, function (c) { mv(c, -0.95, 0.2); ln(c, 0.6, 0.2); ln(c, 0.95, 0); ln(c, 0.6, -0.2); ln(c, -0.95, -0.2); c.closePath(); seg(c, -0.3, -0.2, -0.6, -0.75); seg(c, -0.3, 0.2, -0.6, 0.75); }),
    /* --- support / transport --- */
    supply: I('Постачання', G7, function (c) { box(c, 0, 0, 1.5, 1.2); seg(c, -0.75, -0.25, 0.75, -0.25); }),
    transport: I('Транспорт', G7, function (c) { mv(c, -0.95, 0.3); ln(c, -0.95, -0.45); ln(c, 0.2, -0.45); ln(c, 0.2, 0.3); c.closePath(); mv(c, 0.2, 0.3); ln(c, 0.2, -0.1); ln(c, 0.7, -0.1); ln(c, 0.95, 0.3); c.closePath(); wheels(c, 3, 0.62, 0.22); }),
    fuel: I('Пальне', G7, function (c) { mv(c, 0, -0.95); c.bezierCurveTo(0.85, -0.1, 0.72, 0.85, 0, 0.85); c.bezierCurveTo(-0.72, 0.85, -0.85, -0.1, 0, -0.95); }),
    ammo: I('Боєприпаси', G7, function (c) { mv(c, -0.45, 0.9); ln(c, -0.45, -0.25); ln(c, 0, -0.9); ln(c, 0.45, -0.25); ln(c, 0.45, 0.9); c.closePath(); seg(c, -0.45, 0.3, 0.45, 0.3); }),
    maint: I('Ремонт / евакуація', G7, function (c) { seg(c, -0.85, 0.85, 0.35, -0.35); mv(c, 0.2, -0.5); ln(c, 0.55, -0.9); ln(c, 0.95, -0.5); ln(c, 0.55, -0.15); c.closePath(); }),
    med: I('Медична', G7, function (c) { seg(c, 0, -0.9, 0, 0.9); seg(c, -0.9, 0, 0.9, 0); }),
    engineer: I('Інженерні', G7, function (c) { mv(c, 0.85, -0.75); ln(c, -0.85, -0.75); ln(c, -0.85, 0.75); ln(c, 0.85, 0.75); mv(c, -0.85, 0); ln(c, 0.35, 0); }),
    signal: I('Звʼязок', G7, function (c) { mv(c, -0.75, -0.8); ln(c, 0.75, -0.8); ln(c, -0.75, 0.8); ln(c, 0.75, 0.8); }),
    cbrn: I('РХБ захист', G7, function (c) { c.moveTo(0.55, 0); c.arc(0, 0, 0.55, 0, TAU); seg(c, -0.95, -0.75, 0.95, -0.75); seg(c, 0, -0.75, 0, -0.55); }),
    /* --- rail --- */
    rail: I('Залізничний транспорт', G8, function (c) { box(c, 0, -0.2, 1.8, 0.8); wheels(c, 4, 0.55, 0.22); }),
    rail_arm: I('Бронепоїзд', G8, function (c) { box(c, 0, -0.25, 1.8, 0.8); seg(c, -0.9, -0.25, 0.9, -0.25); wheels(c, 4, 0.55, 0.22); }),
    rail_head: I('Залізнична станція вивантаження', G8, function (c) { seg(c, -0.95, 0.55, 0.95, 0.55); wheels(c, 4, 0.1, 0.2); seg(c, -0.6, -0.85, 0.6, -0.85); }),
    /* --- ISR / EW --- */
    recon_tech: I('Технічні засоби розвідки', G9, function (c) { seg(c, 0, 0.9, 0, -0.2); c.moveTo(-0.8, -0.2); c.arc(0, -0.2, 0.8, Math.PI, 0); seg(c, -0.45, 0.9, 0.45, 0.9); }),
    radar: I('РЛС', G9, function (c) { seg(c, 0, 0.9, 0, 0.1); c.moveTo(-0.85, 0.1); c.arc(0, 0.1, 0.85, Math.PI, 0); c.moveTo(-0.45, 0.1); c.arc(0, 0.1, 0.45, Math.PI, 0); }),
    sigint: I('Радіотехнічна розвідка', G9, function (c) { seg(c, 0, 0.9, 0, -0.9); c.moveTo(-0.4, 0); c.arc(0, 0, 0.4, -Math.PI / 2, Math.PI / 2); c.moveTo(-0.75, 0); c.arc(0, 0, 0.75, -Math.PI / 2, Math.PI / 2); }),
    ew: I('РЕБ', G9, function (c) { c.moveTo(-0.95, 0.1); c.bezierCurveTo(-0.5, -1.1, 0.5, 1.1, 0.95, -0.1); seg(c, -0.7, 0.9, 0.7, -0.9); }),
    uav: I('БпЛА', G9, function (c) { seg(c, -0.95, -0.3, 0.95, -0.3); seg(c, 0, -0.3, 0, 0.7); seg(c, -0.4, 0.7, 0.4, 0.7); }),
    uav_recon: I('Розвідувальний БпЛА', G9, function (c) { seg(c, -0.95, -0.35, 0.95, -0.35); seg(c, 0, -0.35, 0, 0.5); }, function (c) { dot(c, 0, 0.72, 0.26); }),
    uav_strike: I('Ударний БпЛА', G9, function (c) { seg(c, -0.95, -0.35, 0.95, -0.35); seg(c, 0, -0.35, 0, 0.45); mv(c, -0.35, 0.9); ln(c, 0, 0.4); ln(c, 0.35, 0.9); }),
    fpv: I('FPV-розрахунок', G9, function (c) { seg(c, -0.75, -0.75, 0.75, 0.75); seg(c, 0.75, -0.75, -0.75, 0.75); }, function (c) { dot(c, -0.75, -0.75, 0.2); dot(c, 0.75, -0.75, 0.2); dot(c, -0.75, 0.75, 0.2); dot(c, 0.75, 0.75, 0.2); }),
    /* --- air / naval --- */
    plane: I('Літак', G10, function (c) { seg(c, 0, -0.9, 0, 0.9); seg(c, -0.95, 0, 0.95, 0); seg(c, -0.4, 0.7, 0.4, 0.7); }),
    helo: I('Гелікоптер', G10, function (c) { seg(c, -0.95, -0.7, 0.95, -0.7); seg(c, 0, -0.7, 0, 0.5); c.moveTo(-0.55, 0.5); c.ellipse(0, 0.5, 0.55, 0.4, 0, 0, TAU); }),
    ship: I('Корабель', G10, function (c) { mv(c, -0.95, -0.15); ln(c, 0.95, -0.15); ln(c, 0.55, 0.65); ln(c, -0.55, 0.65); c.closePath(); seg(c, 0, -0.15, 0, -0.9); }),
    boat: I('Катер', G10, function (c) { mv(c, -0.85, 0.1); ln(c, 0.85, 0.1); ln(c, 0.45, 0.7); ln(c, -0.55, 0.7); c.closePath(); }),
    submarine: I('Підводний човен', G10, function (c) { c.moveTo(-0.95, 0.2); c.ellipse(0, 0.2, 0.95, 0.4, 0, 0, TAU); box(c, 0, -0.45, 0.4, 0.55); }),
    /* --- installations --- */
    power: I('Енергетичний обʼєкт', G11, function (c) { mv(c, 0.25, -0.9); ln(c, -0.5, 0.1); ln(c, 0.05, 0.1); ln(c, -0.25, 0.9); ln(c, 0.5, -0.15); ln(c, -0.05, -0.15); c.closePath(); }),
    bridge: I('Міст / переправа', G11, function (c) { c.moveTo(-0.95, 0.5); c.bezierCurveTo(-0.5, -0.7, 0.5, -0.7, 0.95, 0.5); seg(c, -0.95, 0.5, -0.95, 0.9); seg(c, 0.95, 0.5, 0.95, 0.9); }),
    depot: I('Склад', G11, function (c) { mv(c, -0.9, 0.75); ln(c, -0.9, -0.2); ln(c, 0, -0.85); ln(c, 0.9, -0.2); ln(c, 0.9, 0.75); c.closePath(); }),
    cp: I('Командний пункт', G11, function (c) { seg(c, -0.75, -0.9, -0.75, 0.9); mv(c, -0.75, -0.9); ln(c, 0.75, -0.55); ln(c, -0.75, -0.2); }),
    airfield: I('Аеродром', G11, function (c) { seg(c, -0.9, 0.7, 0.9, -0.7); seg(c, -0.55, -0.85, 0.85, 0.2); }),
    port: I('Порт', G11, function (c) { seg(c, 0, -0.9, 0, 0.5); seg(c, -0.5, -0.55, 0.5, -0.55); c.moveTo(-0.75, 0.1); c.arc(0, 0.1, 0.75, 0, Math.PI); })
  };
  function cross2(c) { seg(c, -0.55, -0.4, 0.55, 0.4); seg(c, 0.55, -0.4, -0.55, 0.4); }

  /* ------------------------------------------------------------------ echelon */
  var ECH_ORDER = ['none', 'team', 'squad', 'section', 'platoon', 'company', 'battalion', 'regiment', 'brigade', 'division', 'corps', 'army'];
  var ECH = {
    none: { label: '—', w: 0 },
    team: { label: 'Ланка / екіпаж', w: 1 },
    squad: { label: 'Відділення', w: 1 },
    section: { label: 'Секція', w: 2 },
    platoon: { label: 'Взвод', w: 3 },
    company: { label: 'Рота / батарея', w: 1 },
    battalion: { label: 'Батальйон / дивізіон', w: 2 },
    regiment: { label: 'Полк', w: 3 },
    brigade: { label: 'Бригада', w: 1 },
    division: { label: 'Дивізія', w: 2 },
    corps: { label: 'Корпус', w: 3 },
    army: { label: 'Армія', w: 4 }
  };
  function drawEch(c, k, cx, topY, u) {
    if (!k || k === 'none') return;
    var g = u * 0.32, r = u * 0.10, y = topY - u * 0.42, i, x0;
    c.lineWidth = Math.max(1, u * 0.09); c.lineCap = 'round';
    if (k === 'team') { c.beginPath(); c.arc(cx, y, r * 1.5, 0, TAU); c.moveTo(cx - r, y + r); c.lineTo(cx + r, y - r); c.stroke(); return; }
    if (k === 'squad' || k === 'section' || k === 'platoon') {
      var n = k === 'squad' ? 1 : k === 'section' ? 2 : 3;
      c.beginPath(); x0 = cx - (n - 1) * g / 2;
      for (i = 0; i < n; i++) { c.moveTo(x0 + i * g + r, y); c.arc(x0 + i * g, y, r, 0, TAU); }
      c.fill(); return;
    }
    if (k === 'company' || k === 'battalion' || k === 'regiment') {
      var m = ECH[k].w; c.beginPath(); x0 = cx - (m - 1) * g / 2;
      for (i = 0; i < m; i++) { c.moveTo(x0 + i * g, y - u * 0.20); c.lineTo(x0 + i * g, y + u * 0.20); }
      c.stroke(); return;
    }
    var q = ECH[k].w, s = u * 0.19; c.beginPath(); x0 = cx - (q - 1) * g / 2;
    for (i = 0; i < q; i++) {
      var X = x0 + i * g;
      c.moveTo(X - s, y - s); c.lineTo(X + s, y + s); c.moveTo(X + s, y - s); c.lineTo(X - s, y + s);
    }
    c.stroke();
  }

  /* ----------------------------------------------------------------- mobility */
  var MOB_ORDER = ['none', 'wheeled', 'wheeled_x', 'tracked', 'halftrack', 'towed', 'rail', 'oversnow', 'sled', 'pack', 'barge', 'amphib'];
  var MOB = {
    none: 'Без ампліфікатора', wheeled: 'Колісна', wheeled_x: 'Колісна підвищеної прохідності',
    tracked: 'Гусенична', halftrack: 'Напівгусенична', towed: 'Причіпна / буксирувана',
    rail: 'Залізнична', oversnow: 'Снігохідна', sled: 'Волокуша / сани', pack: 'Вʼючна',
    barge: 'Баржа / понтон', amphib: 'Амфібійна'
  };
  function drawMob(c, k, cx, botY, u) {
    if (!k || k === 'none') return;
    var y = botY + u * 0.40, hw = u * 0.62, r = u * 0.11, i, n, w;
    c.lineWidth = Math.max(1, u * 0.085); c.lineCap = 'round';
    function bar() { c.beginPath(); c.moveTo(cx - hw, y); c.lineTo(cx + hw, y); c.stroke(); }
    function wh(cnt, yy) { c.beginPath(); n = cnt; w = (hw * 2) / n; for (i = 0; i < n; i++) { var X = cx - hw + w / 2 + i * w; c.moveTo(X + r, yy); c.arc(X, yy, r, 0, TAU); } c.fill(); }
    if (k === 'wheeled') { bar(); wh(2, y + r + u * 0.02); return; }
    if (k === 'wheeled_x') { bar(); wh(3, y + r + u * 0.02); return; }
    if (k === 'rail') { bar(); wh(4, y + r + u * 0.02); return; }
    if (k === 'tracked') {
      c.beginPath(); var h = u * 0.20;
      c.moveTo(cx - hw + h, y - h / 2); c.lineTo(cx + hw - h, y - h / 2);
      c.arc(cx + hw - h, y + h / 2, h, -Math.PI / 2, Math.PI / 2);
      c.lineTo(cx - hw + h, y + h + h / 2 - h); c.arc(cx - hw + h, y + h / 2, h, Math.PI / 2, -Math.PI / 2);
      c.closePath(); c.stroke(); return;
    }
    if (k === 'halftrack') {
      c.beginPath(); c.arc(cx - hw * 0.55, y + r, r * 1.15, 0, TAU); c.fill();
      c.beginPath(); c.moveTo(cx - hw * 0.1, y); c.lineTo(cx + hw, y); c.lineTo(cx + hw, y + r * 2); c.lineTo(cx - hw * 0.1, y + r * 2); c.closePath(); c.stroke(); return;
    }
    if (k === 'towed') { bar(); c.beginPath(); c.moveTo(cx - hw * 0.55, y); c.lineTo(cx - hw * 0.55, y + u * 0.2); c.moveTo(cx + hw * 0.55, y); c.lineTo(cx + hw * 0.55, y + u * 0.2); c.stroke(); wh(2, y + u * 0.28); return; }
    if (k === 'oversnow' || k === 'sled') {
      c.beginPath(); c.moveTo(cx + hw, y); c.lineTo(cx - hw * 0.6, y); c.quadraticCurveTo(cx - hw, y, cx - hw, y - u * 0.2); c.stroke();
      if (k === 'sled') { c.beginPath(); c.moveTo(cx + hw, y - u * 0.22); c.lineTo(cx - hw * 0.6, y - u * 0.22); c.stroke(); } return;
    }
    if (k === 'pack') { c.beginPath(); c.moveTo(cx - hw, y + u * 0.2); c.quadraticCurveTo(cx - hw * 0.5, y - u * 0.24, cx, y + u * 0.2); c.quadraticCurveTo(cx + hw * 0.5, y - u * 0.24, cx + hw, y + u * 0.2); c.stroke(); return; }
    if (k === 'barge' || k === 'amphib') {
      c.beginPath(); c.moveTo(cx - hw, y); c.lineTo(cx + hw, y); c.lineTo(cx + hw * 0.6, y + u * 0.24); c.lineTo(cx - hw * 0.6, y + u * 0.24); c.closePath(); c.stroke();
      if (k === 'amphib') wh(3, y + u * 0.38); return;
    }
  }

  /* ------------------------------------------------------------- capability */
  var CAP_ORDER = ['full', 'limited', 'unable', 'destroyed'];
  var CAP = {
    full: { label: 'Повна боєздатність', color: null },
    limited: { label: 'Обмежена боєздатність', color: '#FFB020' },
    unable: { label: 'Небоєздатний', color: '#FF4A3D' },
    destroyed: { label: 'Знищений', color: '#FF2D20' }
  };

  /* ----------------------------------------------------------- main renderer */
  function frameBox(u, half) {
    /* half-extents of the frame in px for a given unit-scale u */
    return { hw: u * 1.02, hh: half === 'full' ? u * 0.9 : u * 0.9 };
  }

  function drawSymbol(c, cx, cy, sym, size, opt) {
    opt = opt || {};
    var aff = AFF[sym.aff] || AFF.friend, dm = DIM[sym.dim] || DIM.ground;
    var u = size / 2;                       // unit scale: frame half-width ≈ u
    var sh = aff.sh, half = dm.half;
    var ic = ICONS[sym.icon];
    var lw = Math.max(1.1, u * 0.11);
    var sel = !!opt.selected, ghost = !!opt.ghost;

    c.save();
    c.translate(cx, cy);
    if (ghost) c.globalAlpha = 0.55;

    /* selection halo */
    if (sel) {
      c.save(); c.scale(u, u); framePath(c, sh, half); c.restore();
      c.strokeStyle = 'rgba(142,233,163,.95)'; c.lineWidth = lw + 5; c.lineJoin = 'round';
      c.setLineDash([]); c.stroke();
    }

    /* frame */
    c.save(); c.scale(u, u); framePath(c, sh, half); c.restore();
    c.fillStyle = opt.flat ? 'rgba(0,0,0,.55)' : aff.fill;
    if (half === 'full') c.fill();
    else { c.save(); c.globalAlpha *= 0.92; c.fill(); c.restore(); }
    c.strokeStyle = opt.flat ? aff.fill : aff.line;
    c.lineWidth = lw; c.lineJoin = 'round'; c.lineCap = 'round';
    c.setLineDash(aff.dash ? [u * 0.28, u * 0.20] : []);
    c.stroke();
    c.setLineDash([]);

    /* space bar / installation cap / activity marker */
    if (dm.space) { c.beginPath(); c.moveTo(-u * 0.5, -u * 0.86); c.lineTo(u * 0.5, -u * 0.86); c.lineWidth = lw * 1.1; c.stroke(); }
    if (dm.inst) { c.fillStyle = aff.line; c.fillRect(-u * 0.30, -u * 0.98, u * 0.60, u * 0.22); }
    if (dm.act) { c.fillStyle = aff.line; c.fillRect(-u * 0.92, -u * 0.86, u * 0.20, u * 0.20); c.fillRect(u * 0.72, -u * 0.86, u * 0.20, u * 0.20); }

    /* icon */
    if (ic) {
      var k = (INNER[sh] || 0.6) * u;
      var yoff = half === 'top' ? -u * 0.16 : half === 'bot' ? u * 0.16 : 0;
      if (sh === 'diamond') yoff *= 0.6;
      c.save();
      c.translate(0, yoff); c.scale(k, k);
      c.lineWidth = Math.max(0.055, lw / k * 0.92);
      c.strokeStyle = opt.flat ? aff.fill : aff.line;
      c.fillStyle = opt.flat ? aff.fill : aff.line;
      c.lineJoin = 'round'; c.lineCap = 'round';
      if (ic.s) { c.beginPath(); ic.s(c); c.stroke(); }
      if (ic.f) { c.beginPath(); ic.f(c); c.fill(); }
      c.restore();
    }

    /* echelon + mobility — drawn OUTSIDE the frame, so they use the light
       affiliation tint plus a dark halo to stay legible over map imagery */
    c.strokeStyle = opt.onLight ? aff.line : aff.fill;
    c.fillStyle = opt.onLight ? aff.line : aff.fill;
    c.shadowColor = opt.onLight ? 'rgba(255,255,255,.9)' : 'rgba(0,0,0,.9)';
    c.shadowBlur = Math.max(2, u * 0.22);
    var top = -u * (sh === 'diamond' ? 1.02 : sh === 'clover' ? 0.9 : sh === 'square' ? 0.86 : 0.74);
    var bot = u * (sh === 'diamond' ? 1.02 : sh === 'clover' ? 0.9 : sh === 'square' ? 0.86 : 0.74);
    if (opt.amplifiers !== false) {
      drawEch(c, sym.ech, 0, top, u);
      drawMob(c, sym.mob, 0, bot, u);
    }
    c.shadowBlur = 0;

    /* capability overlay */
    var cap = CAP[sym.cap];
    if (cap && cap.color) {
      c.strokeStyle = cap.color; c.lineWidth = Math.max(1.6, u * 0.15); c.lineCap = 'round';
      c.beginPath();
      if (sym.cap === 'limited') { c.moveTo(-u * 0.85, u * 0.7); c.lineTo(u * 0.85, -u * 0.7); }
      else { c.moveTo(-u * 0.85, u * 0.7); c.lineTo(u * 0.85, -u * 0.7); c.moveTo(-u * 0.85, -u * 0.7); c.lineTo(u * 0.85, u * 0.7); }
      c.stroke();
      if (sym.cap === 'destroyed') {
        c.save(); c.scale(u, u); framePath(c, sh, half); c.restore();
        c.fillStyle = 'rgba(24,26,25,.55)'; c.fill();
      }
    }

    c.restore();
    return { hw: u * 1.06, hh: u * 1.06, top: cy + top, bot: cy + bot };
  }

  /* ----------------------------------------------------- text amplifiers */
  function drawAmplifiers(c, cx, cy, sym, size, opt) {
    opt = opt || {};
    var u = size / 2, fs = Math.max(8, Math.round(u * 0.46));
    var x = cx + u * 1.20, lines = [], i;
    if (sym.desig) lines.push(sym.desig);
    if (sym.note) lines.push(sym.note);
    c.save();
    c.font = '700 ' + fs + 'px ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif';
    c.textAlign = 'left'; c.textBaseline = 'middle';
    c.shadowColor = 'rgba(0,0,0,.85)'; c.shadowBlur = 3;
    c.fillStyle = '#EAF5EE';
    for (i = 0; i < lines.length; i++) c.fillText(lines[i], x, cy - u * 0.34 + i * (fs + 2));
    if (sym.reinf) { c.textAlign = 'center'; c.fillStyle = '#FFD23F'; c.fillText(sym.reinf, cx + u * 0.78, cy - u * 1.10); }
    if (sym.higher || sym.dtg) {
      c.textAlign = 'center'; c.font = '600 ' + Math.max(7, fs - 1) + 'px ui-sans-serif,system-ui,sans-serif';
      c.fillStyle = '#9FD9B4';
      var y = cy + u * 1.28 + (sym.mob && sym.mob !== 'none' ? u * 0.34 : 0);
      if (sym.higher) { c.fillText(sym.higher, cx, y); y += fs + 1; }
      if (sym.dtg) { c.fillStyle = '#7F978A'; c.fillText(sym.dtg, cx, y); }
    }
    c.restore();
  }

  /* ---------------------------------------------------------- palette raster */
  var _cache = {};
  function dataURL(sym, px, opt) {
    var key = [sym.aff, sym.dim, sym.icon, sym.ech, sym.mob, sym.cap, px, opt && opt.amplifiers].join('|');
    if (_cache[key]) return _cache[key];
    var dpr = Math.min(2, (window.devicePixelRatio || 1));
    var cv = document.createElement('canvas');
    cv.width = Math.round(px * dpr); cv.height = Math.round(px * dpr);
    var c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    var size = px * (opt && opt.amplifiers === false ? 0.78 : 0.60);
    drawSymbol(c, px / 2, px / 2, sym, size, opt || {});
    var url = cv.toDataURL('image/png');
    _cache[key] = url;
    return url;
  }

  /* ------------------------------------------------------------- extensibility
     Drop-in replacement points for the user's own SVG kit:
       D9SYM.registerIcon('tank', {label, grp, s(ctx), f(ctx)})
       D9SYM.registerIconImage('tank', {label, grp, img})  — HTMLImageElement / bitmap  */
  function registerIcon(key, def) { ICONS[key] = def; _cache = {}; }
  function registerIconImage(key, def) {
    ICONS[key] = {
      label: def.label, grp: def.grp,
      s: function (c) { try { c.drawImage(def.img, -1, -1, 2, 2); } catch (e) { } }
    };
    _cache = {};
  }

  function iconGroups() {
    var out = [], seen = {};
    Object.keys(ICONS).forEach(function (k) {
      var g = ICONS[k].grp || 'Інше';
      if (!seen[g]) { seen[g] = { grp: g, items: [] }; out.push(seen[g]); }
      seen[g].items.push({ k: k, label: ICONS[k].label });
    });
    return out;
  }

  window.D9SYM = {
    AFF: AFF, AFF_ORDER: AFF_ORDER, DIM: DIM, DIM_ORDER: DIM_ORDER,
    ICONS: ICONS, ECH: ECH, ECH_ORDER: ECH_ORDER, MOB: MOB, MOB_ORDER: MOB_ORDER,
    CAP: CAP, CAP_ORDER: CAP_ORDER,
    draw: drawSymbol, amplifiers: drawAmplifiers, dataURL: dataURL,
    iconGroups: iconGroups, registerIcon: registerIcon, registerIconImage: registerIconImage,
    frameBox: frameBox
  };
})();
