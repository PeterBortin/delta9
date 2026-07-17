// delta9 — OSM protected-assets module (Overpass). Exposes window.Delta9OSM.
// Assets are passive protected points with a value weight; breakthrough impacts
// damage them (scored in sim.buildRun). They do NOT affect threat targeting.
(function(){
  'use strict';
  var CFG = {
    endpoint: 'https://overpass-api.de/api/interpreter',
    mirrors: [],            // only CORS-confirmed mirrors; empty by default (§A.2)
    timeout_s: 60,
    maxRetries: 3,
    assetMargin_km: 40,
    // class -> { type, value, radius_m }   (§A.3, all tunable)
    classes: {
      'power=plant':                 { type:'power_plant',  value:100, radius:900 },
      'power=substation':            { type:'substation',   value:70,  radius:500 },
      'power=generator':             { type:'generator',    value:40,  radius:350 },
      'aeroway=aerodrome':           { type:'aerodrome',    value:90,  radius:1600 },
      'railway=station':             { type:'railway',      value:50,  radius:400 },
      'bridge=yes':                  { type:'bridge',       value:55,  radius:250 },
      'man_made=water_works':        { type:'water_works',  value:60,  radius:400 },
      'man_made=water_tower':        { type:'water_tower',  value:30,  radius:250 },
      'man_made=communications_tower':{type:'comms_tower',  value:45,  radius:300 },
      'place=city':                  { type:'city',         value:80,  radius:1200 },
      'place=town':                  { type:'town',         value:40,  radius:700 }
    },
    colors: { power_plant:'#ff5a3c', substation:'#ffb02e', generator:'#ffb02e', aerodrome:'#4db8ff',
      railway:'#c58cff', bridge:'#8ee9a3', water_works:'#4db8ff', water_tower:'#4db8ff',
      comms_tower:'#e0e0e0', city:'#ff9500', town:'#ffd23f' }
  };
  var cache = {};

  // Embedded fallback: major UA critical infrastructure (approx), used when Overpass is unreachable.
  var EMBEDDED = [
    {type:'power_plant',name:'ЗАЕС (Енергодар)',pos:[34.585,47.512],value:150,radius_m:1400},
    {type:'power_plant',name:'Південноукр. АЕС',pos:[31.22,47.81],value:140,radius_m:1300},
    {type:'power_plant',name:'Рівненська АЕС',pos:[26.24,51.33],value:140,radius_m:1300},
    {type:'power_plant',name:'Хмельницька АЕС',pos:[26.65,50.30],value:140,radius_m:1300},
    {type:'power_plant',name:'Бурштинська ТЕС',pos:[24.63,49.19],value:100,radius_m:900},
    {type:'power_plant',name:'Трипільська ТЕС',pos:[30.75,50.13],value:100,radius_m:900},
    {type:'power_plant',name:'Зміївська ТЕС',pos:[36.48,49.62],value:100,radius_m:900},
    {type:'power_plant',name:'ДніпроГЕС',pos:[35.08,47.87],value:110,radius_m:1000},
    {type:'power_plant',name:'Кременчуцька ГЕС',pos:[33.43,49.08],value:90,radius_m:800},
    {type:'aerodrome',name:'Аеропорт «Бориспіль»',pos:[30.90,50.34],value:90,radius_m:1600},
    {type:'aerodrome',name:'Аеропорт «Жуляни»',pos:[30.45,50.40],value:70,radius_m:1200},
    {type:'aerodrome',name:'Аеропорт «Львів»',pos:[23.96,49.81],value:75,radius_m:1300},
    {type:'aerodrome',name:'Аеропорт «Одеса»',pos:[30.68,46.43],value:75,radius_m:1300},
    {type:'aerodrome',name:'Аеропорт «Дніпро»',pos:[35.10,48.36],value:70,radius_m:1200},
    {type:'substation',name:'ПС «Київська» 750кВ',pos:[30.30,50.60],value:80,radius_m:600},
    {type:'substation',name:'ПС «Дніпровська» 750кВ',pos:[35.20,48.40],value:80,radius_m:600},
    {type:'substation',name:'ПС «Західноукр.» 750кВ',pos:[24.90,49.60],value:75,radius_m:550},
    {type:'city',name:'Київ',pos:[30.52,50.45],value:130,radius_m:1600},
    {type:'city',name:'Харків',pos:[36.23,49.99],value:110,radius_m:1400},
    {type:'city',name:'Одеса',pos:[30.74,46.48],value:105,radius_m:1400},
    {type:'city',name:'Дніпро',pos:[35.04,48.46],value:105,radius_m:1400},
    {type:'city',name:'Львів',pos:[24.03,49.84],value:100,radius_m:1300},
    {type:'city',name:'Запоріжжя',pos:[35.14,47.84],value:95,radius_m:1300},
    {type:'city',name:'Миколаїв',pos:[31.99,46.97],value:85,radius_m:1100},
    {type:'city',name:'Кривий Ріг',pos:[33.39,47.91],value:85,radius_m:1100},
    {type:'city',name:'Вінниця',pos:[28.48,49.23],value:80,radius_m:1000},
    {type:'city',name:'Полтава',pos:[34.55,49.59],value:80,radius_m:1000}
  ];

  function fnv(s){ var h=0x811c9dc5; for(var i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,0x01000193); } return 'osm'+((h>>>0).toString(16)); }
  function sleep(ms){ return new Promise(function(r){ setTimeout(r,ms); }); }

  // bbox = [west, south, east, north] -> Overpass (south,west,north,east)
  function buildQuery(bbox, opts){
    var geom = opts && opts.geom;
    var b = bbox[1].toFixed(4)+','+bbox[0].toFixed(4)+','+bbox[3].toFixed(4)+','+bbox[2].toFixed(4);
    var sel = [
      'nwr["power"~"^(substation|plant|generator)$"]('+b+');',
      'nwr["aeroway"="aerodrome"]('+b+');',
      'node["railway"="station"]('+b+');way["railway"="station"]('+b+');',
      'way["bridge"="yes"]["highway"]('+b+');',
      'nwr["man_made"~"^(water_works|water_tower|communications_tower)$"]('+b+');',
      'node["place"~"^(city|town)$"]('+b+');',
      geom ? 'relation["boundary"="administrative"]["admin_level"~"^(7|8)$"]('+b+');' : ''
    ].join('');
    return '[out:json][timeout:'+CFG.timeout_s+'];('+sel+');out tags '+(geom?'geom':'center')+';';
  }

  function classify(tags){
    if(!tags) return null;
    if(tags.power && CFG.classes['power='+tags.power]) return CFG.classes['power='+tags.power];
    if(tags.aeroway==='aerodrome') return CFG.classes['aeroway=aerodrome'];
    if(tags.railway==='station') return CFG.classes['railway=station'];
    if(tags.bridge==='yes') return CFG.classes['bridge=yes'];
    if(tags.man_made && CFG.classes['man_made='+tags.man_made]) return CFG.classes['man_made='+tags.man_made];
    if(tags.place && CFG.classes['place='+tags.place]) return CFG.classes['place='+tags.place];
    if(tags.boundary==='administrative' && (tags.admin_level==='8'||tags.admin_level==='7')) return CFG.classes['place=city'];
    return null;
  }
  function closeRing(r){ if(r.length<2) return r; var f=r[0],l=r[r.length-1]; if(f[0]!==l[0]||f[1]!==l[1]) r.push([f[0],f[1]]); return r; }
  function centroidRing(r){ var sx=0,sy=0,n=0; for(var i=0;i<r.length;i++){ sx+=r[i][0]; sy+=r[i][1]; n++; } return n?[sx/n,sy/n]:[0,0]; }
  function heightM(t){ if(!t) return null; var h; if(t.height){ h=parseFloat(String(t.height).replace(',','.')); if(isFinite(h)) return h; } if(t['building:height']){ h=parseFloat(t['building:height']); if(isFinite(h)) return h; } if(t['building:levels']){ h=parseFloat(t['building:levels']); if(isFinite(h)) return h*3.2; } return null; }

  function parse(json){
    var els = (json && json.elements) || [];
    var byKey = {}, order = [];
    for(var i=0;i<els.length;i++){
      var e = els[i]; var cls = classify(e.tags); if(!cls) continue;
      var geom=null, lat=null, lng=null;
      if(e.type==='node'){ lat=e.lat; lng=e.lon; }
      else if(e.type==='way' && e.geometry && e.geometry.length>=3){
        var ring=closeRing(e.geometry.map(function(g){return [g.lon,g.lat];})); geom={type:'Polygon',coordinates:[ring]}; var c=centroidRing(ring); lng=c[0]; lat=c[1];
      } else if(e.type==='relation' && e.members){
        var polys=[]; e.members.forEach(function(m){ if(m.type==='way' && m.geometry && m.geometry.length>=3 && (m.role==='outer'||!m.role)){ polys.push([closeRing(m.geometry.map(function(g){return [g.lon,g.lat];}))]); } });
        if(polys.length){ geom={type:'MultiPolygon',coordinates:polys}; var c2=centroidRing(polys[0][0]); lng=c2[0]; lat=c2[1]; }
        else if(e.center){ lat=e.center.lat; lng=e.center.lon; }
      } else if(e.center){ lat=e.center.lat; lng=e.center.lon; }
      if(lat==null||lng==null) continue;
      var value = cls.value, radius = cls.radius;
      if((cls.type==='city'||cls.type==='town') && e.tags && e.tags.population){
        var pop = parseInt(String(e.tags.population).replace(/[^0-9]/g,''),10);
        if(isFinite(pop) && pop>0){ value = Math.round(cls.value + Math.min(160, Math.log10(pop)*22)); radius = Math.round(cls.radius * Math.min(2.2, 0.7+Math.log10(pop)/5)); }
      }
      var name=(e.tags && (e.tags['name:uk']||e.tags.name)) || cls.type;
      var uniqKey = (cls.type==='city'||cls.type==='town') ? (cls.type+':'+name) : (cls.type+':'+lat.toFixed(4)+','+lng.toFixed(4));
      var asset={ id:'a'+(e.type[0])+e.id, osmId:e.type+'/'+e.id, type:cls.type, name:name, pos:[lng,lat], geom:geom, h_m:heightM(e.tags), value:value, radius_m:radius, hp:1 };
      var ex=byKey[uniqKey];
      if(!ex){ byKey[uniqKey]=asset; order.push(uniqKey); }
      else if(!ex.geom && asset.geom){ asset.id=ex.id; byKey[uniqKey]=asset; }  // prefer real contour over point
    }
    return order.map(function(k){ return byKey[k]; });
  }

  // fetch with backoff over endpoint (+ CORS-confirmed mirrors only). §A.2
  function fetchAssets(bbox, opts){
    opts = opts || {}; var geom = !!opts.geom;
    var key = bbox.map(function(n){return n.toFixed(2);}).join(',')+'@'+(geom?'g':'c')+'@'+new Date().toISOString().slice(0,10);
    if(cache[key]) return Promise.resolve(cache[key]);
    var ql = buildQuery(bbox, {geom:geom});
    var eps = [CFG.endpoint].concat(CFG.mirrors||[]);
    function tryOnce(attempt){
      var ep = eps[Math.min(attempt, eps.length-1)];
      var ctl = new AbortController(); var to = setTimeout(function(){ ctl.abort(); }, (CFG.timeout_s+5)*1000);
      return fetch(ep, { method:'POST', body:'data='+encodeURIComponent(ql), signal:ctl.signal,
        headers:{ 'Content-Type':'application/x-www-form-urlencoded' } })
        .then(function(r){ clearTimeout(to);
          if(r.status===429||r.status===504||r.status===503){ throw { retry:true, status:r.status }; }
          if(!r.ok) throw { retry:false, status:r.status };
          return r.json();
        });
    }
    function attemptChain(n){
      return tryOnce(n).catch(function(err){
        if(n < CFG.maxRetries && err && err.retry===true){ return sleep(Math.pow(2,n)*1200).then(function(){ return attemptChain(n+1); }); }
        throw err;
      });
    }
    return attemptChain(0).then(function(json){
      var assets = parse(json);
      var snap = { assets:assets, bbox:bbox.slice(), hash:fnv(assets.map(function(a){return a.osmId;}).sort().join('|')), degraded:false };
      cache[key] = snap; return snap;
    }).catch(function(){
      var inb=EMBEDDED.filter(function(a){ return a.pos[0]>=bbox[0]&&a.pos[0]<=bbox[2]&&a.pos[1]>=bbox[1]&&a.pos[1]<=bbox[3]; })
        .map(function(a,i){ return {id:'e'+i,osmId:'embed/'+i,type:a.type,name:a.name,pos:a.pos.slice(),value:a.value,radius_m:a.radius_m,hp:1}; });
      return { assets:inb, bbox:bbox.slice(), hash:'osm-embed', degraded:(inb.length===0), fallback:true };
    });
  }

  window.Delta9OSM = { CFG:CFG, fetchAssets:fetchAssets, classify:classify, colorFor:function(t){ return CFG.colors[t]||'#ffb02e'; } };
})();
