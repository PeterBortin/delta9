// delta9 — weather module (Open-Meteo wind snapshot -> altitude-resolved drift).
// Self-contained. Exposes window.Delta9Weather. Deterministic: fixed snapshot -> fixed drift.
// Degraded (no network) -> calm (wind=0) -> identical to v1 straight trajectories.
(function(){
  'use strict';
  var LEVELS = [1000,925,850,700,600,500,400,300]; // hPa
  var CFG = {
    provider:'open-meteo', sampling:'centroid', validTime:'now', levels:LEVELS,
    // driftSensitivity by class (multiplier on raw wind displacement). §B.2
    sens:{ drone:0.3, cruise:0.15, ballistic:0.02, hyper:0.0, artillery:0.08, interceptor:0.0 },
    timeout_ms: 8000
  };
  var cache = {};

  function metToUV(spd, dir){ var r=Math.PI/180; return { u:-spd*Math.sin(dir*r), v:-spd*Math.cos(dir*r) }; } // motion vector (m/s)

  function buildProfile(rows){
    var lv = rows.filter(function(x){ return isFinite(x.gph)&&isFinite(x.spd)&&isFinite(x.dir); }).sort(function(a,b){ return a.gph-b.gph; });
    if(!lv.length) return function(){ return {u:0,v:0}; };
    return function(alt){
      if(alt<=lv[0].gph) return metToUV(lv[0].spd, lv[0].dir);
      if(alt>=lv[lv.length-1].gph) return metToUV(lv[lv.length-1].spd, lv[lv.length-1].dir);
      for(var i=1;i<lv.length;i++){ if(alt<=lv[i].gph){
        var f=(alt-lv[i-1].gph)/((lv[i].gph-lv[i-1].gph)||1);
        var a=metToUV(lv[i-1].spd,lv[i-1].dir), b=metToUV(lv[i].spd,lv[i].dir);
        return { u:a.u+(b.u-a.u)*f, v:a.v+(b.v-a.v)*f };
      } }
      return metToUV(lv[lv.length-1].spd, lv[lv.length-1].dir);
    };
  }

  function fnv(s){ var h=0x811c9dc5; for(var i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,0x01000193); } return 'w'+((h>>>0).toString(16)); }

  function calm(){ return { windAt:function(){ return {u:0,v:0}; }, levels:[], hash:'calm', degraded:true, clouds:null, visibility:null, sens:CFG.sens }; }

  function fetchSnapshot(lat, lng){
    var W = window.Delta9Weather;
    var k = lat.toFixed(2)+','+lng.toFixed(2)+'@'+new Date().getUTCHours();
    if(cache[k]) return Promise.resolve(cache[k]);
    var hourly = ['cloud_cover','visibility'];
    LEVELS.forEach(function(L){ hourly.push('wind_speed_'+L+'hPa','wind_direction_'+L+'hPa','geopotential_height_'+L+'hPa'); });
    var url = 'https://api.open-meteo.com/v1/forecast?latitude='+lat.toFixed(3)+'&longitude='+lng.toFixed(3)
      +'&hourly='+hourly.join(',')+'&wind_speed_unit=ms&forecast_days=1&timezone=UTC';
    var ctl = new AbortController(); var to = setTimeout(function(){ ctl.abort(); }, CFG.timeout_ms);
    return fetch(url, { signal: ctl.signal }).then(function(r){ clearTimeout(to); if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); }).then(function(j){
      var H = j.hourly||{}; var idx = 0;
      if(H.time && H.time.length){ var nowH = new Date().toISOString().slice(0,13); for(var i=0;i<H.time.length;i++){ if((H.time[i]||'').slice(0,13)===nowH){ idx=i; break; } } }
      var rows = LEVELS.map(function(L){ return { hPa:L, gph:(H['geopotential_height_'+L+'hPa']||[])[idx], spd:(H['wind_speed_'+L+'hPa']||[])[idx], dir:(H['wind_direction_'+L+'hPa']||[])[idx] }; });
      var windAt = buildProfile(rows);
      var sig = rows.map(function(x){ return Math.round(x.gph||0)+':'+Math.round(x.spd||0)+':'+Math.round(x.dir||0); }).join('|');
      var snap = { windAt:windAt, levels:rows, hash:fnv(sig), degraded:false,
        clouds:((H.cloud_cover||[])[idx]), visibility:((H.visibility||[])[idx]), sens:CFG.sens };
      cache[k] = snap; return snap;
    }).catch(function(){ clearTimeout(to); return calm(); });
  }

  window.Delta9Weather = { CFG:CFG, LEVELS:LEVELS, fetchSnapshot:fetchSnapshot, calm:calm };
})();
