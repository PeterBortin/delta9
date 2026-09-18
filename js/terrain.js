// delta9 — terrain module (DEM pipeline + elevation grid + LOS masking).
// Self-contained, framework-free. Exposes window.Delta9Terrain.
// Backward-compatible: nothing here runs unless explicitly invoked, so the
// existing sim/render paths are untouched until buildRun opts in.
(function(){
  'use strict';

  var R_EARTH = 6371000; // m

  var CFG = {
    // DEM source fallback chain (all terrarium-encoded). §3.1
    sources: [
      { id:'reearth',    url:'https://terrain.reearth.land/terrarium/elevation/{z}/{x}/{y}.png', maxzoom:15 },
      { id:'aws',        url:'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png', maxzoom:15 },
      { id:'openzenith', url:'https://openzenith.cyopsys.com/api/dem-tile/{z}/{x}/{y}', maxzoom:12 }
    ],
    demZoom: 11,             // ~50 m/px @ 49°N — grid resolution for sim
    aoMargin_km: 40,
    refractionK: 4/3,        // shared with radio-horizon; effective earth radius
    exaggeration: 2,         // default vertical exaggeration (Ukraine is flat)
    losSamples: 128,
    grazingHysteresis_m: 15,
    fresnelMargin: 0,        // disabled this iteration
    tileTimeout_ms: 7000,
    // mast (antenna) height by PVO group — spec §13.2, answer: by class 8/15/30
    mastByGroup: {
      'Далекої дії / ПРО': 30,
      'Середньої дії': 15,
      'Ближньої дії': 8,
      'Анти-БпЛА / гармати': 8
    },
    mastDefault: 12
  };

  // ---- terrarium decode ----
  function decodeTerrarium(r,g,b){ return (r*256 + g + b/256) - 32768; }

  // ---- tile caches (session, in-memory only) ----
  var rawCache = {};   // tileKey -> Promise<ArrayBuffer>   (shared by maplibre + sim decode)
  var gridCache = {};  // tileKey -> { data:Float32Array(256*256), size:256 } | null

  function tileKey(z,x,y){ return z+'/'+x+'/'+y; }
  function fillUrl(tpl,z,x,y){ return tpl.replace('{z}',z).replace('{x}',x).replace('{y}',y); }

  function fetchWithTimeout(url, ms, signal){
    var ctl = new AbortController();
    var t = setTimeout(function(){ ctl.abort(); }, ms);
    if(signal){ try{ signal.addEventListener('abort', function(){ ctl.abort(); }); }catch(e){} }
    return fetch(url, { signal: ctl.signal, mode:'cors' })
      .then(function(r){ clearTimeout(t); if(!r.ok) throw new Error('HTTP '+r.status); return r.arrayBuffer(); })
      .catch(function(e){ clearTimeout(t); throw e; });
  }

  // Try A -> B -> C in order; resolve first working raw PNG arraybuffer. §3.2
  function fetchTileRaw(z,x,y,signal){
    var key = tileKey(z,x,y);
    if(rawCache[key]) return rawCache[key];
    var chain = CFG.sources.reduce(function(prev, src){
      return prev.catch(function(){
        if(z > src.maxzoom) throw new Error('zoom>'+src.maxzoom);
        return fetchWithTimeout(fillUrl(src.url,z,x,y), CFG.tileTimeout_ms, signal);
      });
    }, Promise.reject(new Error('init')));
    rawCache[key] = chain;
    // don't poison the cache on total failure — allow retry later
    chain.catch(function(){ if(rawCache[key]===chain) delete rawCache[key]; });
    return chain;
  }

  // ---- MapLibre custom protocol: dem://{z}/{x}/{y}  (visual terrain source) ----
  function registerProtocol(maplibregl){
    if(!maplibregl || !maplibregl.addProtocol || registerProtocol._done) return;
    registerProtocol._done = true;
    maplibregl.addProtocol('dem', function(params, abortController){
      var m = /dem:\/\/(\d+)\/(\d+)\/(\d+)/.exec(params.url);
      if(!m) return Promise.reject(new Error('bad dem url'));
      var z=+m[1], x=+m[2], y=+m[3];
      var sig = abortController && abortController.signal;
      var p = fetchTileRaw(z,x,y,sig).then(function(buf){ return { data: buf }; });
      // legacy callback signature guard (older maplibre)
      if(typeof abortController === 'function'){
        p.then(function(res){ abortController(null, res.data); }, function(err){ abortController(err); });
        return { cancel:function(){} };
      }
      return p;
    });
  }

  // ---- decode one tile to a Float32 elevation grid (256x256) ----
  function decodeTile(z,x,y,signal){
    var key = tileKey(z,x,y);
    if(gridCache[key] !== undefined) return Promise.resolve(gridCache[key]);
    return fetchTileRaw(z,x,y,signal).then(function(buf){
      var blob = new Blob([buf]);
      return createImageBitmap(blob).then(function(bmp){
        var size = 256;
        var cv = (typeof OffscreenCanvas!=='undefined') ? new OffscreenCanvas(size,size) : Object.assign(document.createElement('canvas'),{width:size,height:size});
        var ctx = cv.getContext('2d', { willReadFrequently:true });
        ctx.drawImage(bmp, 0, 0, size, size);
        var id = ctx.getImageData(0,0,size,size).data;
        var data = new Float32Array(size*size);
        for(var i=0,j=0;i<data.length;i++,j+=4){
          var e = decodeTerrarium(id[j],id[j+1],id[j+2]);
          data[i] = (e <= -32000) ? NaN : e; // void/no-data
        }
        try{ bmp.close && bmp.close(); }catch(e){}
        var g = { data:data, size:size };
        gridCache[key] = g;
        return g;
      });
    }).catch(function(){ gridCache[key] = null; return null; });
  }

  // ---- lng/lat -> tile fractional coords (Web Mercator) ----
  function lngToTileX(lng,z){ return (lng+180)/360*Math.pow(2,z); }
  function latToTileY(lat,z){ var s=Math.sin(lat*Math.PI/180); return (0.5 - Math.log((1+s)/(1-s))/(4*Math.PI))*Math.pow(2,z); }

  // ---- ElevationGrid: fetch all tiles covering bbox at demZoom, enable elevAt ----
  // bbox = [west, south, east, north]
  function buildGrid(bbox, zoom){
    zoom = zoom || CFG.demZoom;
    var maxz = CFG.sources[0].maxzoom;
    if(zoom > maxz) zoom = maxz;
    var n = Math.pow(2,zoom);
    var x0 = Math.floor(lngToTileX(bbox[0],zoom)), x1 = Math.floor(lngToTileX(bbox[2],zoom));
    var y0 = Math.floor(latToTileY(bbox[3],zoom)), y1 = Math.floor(latToTileY(bbox[1],zoom)); // north->south
    x0=Math.max(0,x0); y0=Math.max(0,y0); x1=Math.min(n-1,x1); y1=Math.min(n-1,y1);
    var keys=[], jobs=[];
    for(var x=x0;x<=x1;x++) for(var y=y0;y<=y1;y++){ keys.push(tileKey(zoom,x,y)); jobs.push(decodeTile(zoom,x,y)); }
    return Promise.all(jobs).then(function(){
      var grid = { zoom:zoom, bbox:bbox.slice(), tiles:keys, hash:null, ok:false };
      // ok if at least one tile decoded
      grid.ok = keys.some(function(k){ return gridCache[k] && gridCache[k].data; });
      grid.hash = hashGrid(grid);
      return grid;
    });
  }

  // bilinear elevation sample at [lng,lat] using the decoded tile cache. meters MSL.
  function elevAt(lng, lat, zoom){
    zoom = zoom || CFG.demZoom;
    var maxz = CFG.sources[0].maxzoom; if(zoom>maxz) zoom=maxz;
    var fx = lngToTileX(lng,zoom), fy = latToTileY(lat,zoom);
    var tx = Math.floor(fx), ty = Math.floor(fy);
    var g = gridCache[tileKey(zoom,tx,ty)];
    if(!g || !g.data) return null;
    var S = g.size;
    var px = (fx - tx) * S, py = (fy - ty) * S;
    var x0 = Math.min(S-1, Math.max(0, Math.floor(px))), y0 = Math.min(S-1, Math.max(0, Math.floor(py)));
    var x1 = Math.min(S-1, x0+1), y1 = Math.min(S-1, y0+1);
    var dx = px - x0, dy = py - y0;
    function at(ix,iy){ var v=g.data[iy*S+ix]; return isNaN(v)?0:v; }
    var a=at(x0,y0), b=at(x1,y0), c=at(x0,y1), d=at(x1,y1);
    return (a*(1-dx)+b*dx)*(1-dy) + (c*(1-dx)+d*dx)*dy;
  }

  // elevation profile along A->B (linear lng/lat interp, consistent w/ project geodesy). §4.2
  function profileElev(A, B, nSamples, zoom){
    nSamples = nSamples || CFG.losSamples;
    var out = new Float32Array(nSamples+1);
    for(var i=0;i<=nSamples;i++){
      var f=i/nSamples, lng=A[0]+(B[0]-A[0])*f, lat=A[1]+(B[1]-A[1])*f;
      var e = elevAt(lng,lat,zoom); out[i] = (e==null)?0:e;
    }
    return out;
  }

  function haversine_m(a,b){
    var r=Math.PI/180, dLat=(b[1]-a[1])*r, dLng=(b[0]-a[0])*r;
    var s=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(a[1]*r)*Math.cos(b[1]*r)*Math.sin(dLng/2)*Math.sin(dLng/2);
    return R_EARTH*2*Math.asin(Math.min(1,Math.sqrt(s)));
  }

  // ---- LOS / terrain masking. §5 ----
  // A,B = [lng,lat,hMSL_m]. Returns {blocked, minClearance, firstBlockDist}.
  function profileLOS(A, B, opts){
    opts = opts || {};
    var N = opts.losSamples || CFG.losSamples;
    var k = opts.k || CFG.refractionK;
    var zoom = opts.zoom || CFG.demZoom;
    var hyst = (opts.grazingHysteresis_m!=null)?opts.grazingHysteresis_m:CFG.grazingHysteresis_m;
    var Reff = k * R_EARTH;
    var D = haversine_m(A, B);
    var hA = A[2]||0, hB = B[2]||0;
    var minClear = Infinity, firstBlock = null;
    for(var i=1;i<N;i++){          // skip endpoints (antenna & target themselves)
      var f = i/N;
      var lng=A[0]+(B[0]-A[0])*f, lat=A[1]+(B[1]-A[1])*f;
      var d1 = D*f, d2 = D - d1;
      var hLos = hA + (hB-hA)*f;
      var bulge = (d1*d2)/(2*Reff);
      var ground = elevAt(lng,lat,zoom); if(ground==null) ground = 0;
      var clr = hLos - ground - bulge;
      if(clr < minClear) minClear = clr;
      if(clr < 0 && firstBlock==null) firstBlock = d1;
    }
    if(minClear===Infinity) minClear = (hA+hB)/2; // degenerate (N<2)
    return { blocked: minClear < -hyst, minClearance: minClear, firstBlockDist: firstBlock };
  }

  // exposure factor [0..1] from minClearance, for partial-masking Pk. §6.3
  function exposureFactor(minClearance, threshold){
    threshold = threshold || 120; // m — full exposure when clearance >= threshold
    if(minClearance <= 0) return 0;
    if(minClearance >= threshold) return 1;
    return minClearance / threshold;
  }

  function mastForGroup(grp){ return CFG.mastByGroup[grp] != null ? CFG.mastByGroup[grp] : CFG.mastDefault; }

  // ---- FNV-1a hash of grid (downsampled) + bbox + zoom -> demGridHash. §4.3 ----
  function hashGrid(grid){
    var h = 0x811c9dc5;
    function mix(v){ h ^= (v & 0xff); h = Math.imul(h, 0x01000193); }
    (grid.tiles||[]).forEach(function(key){
      var g = gridCache[key]; if(!g || !g.data) { mix(0); return; }
      var step = 17; // downsample for speed
      for(var i=0;i<g.data.length;i+=step){ var v=g.data[i]; mix(isNaN(v)?0:((v+32768)|0)); }
    });
    String(grid.bbox.map(function(n){return n.toFixed(3);}).join(',')+'@'+grid.zoom).split('').forEach(function(ch){ mix(ch.charCodeAt(0)); });
    return 'dem'+((h>>>0).toString(16));
  }

  window.Delta9Terrain = {
    CFG: CFG,
    registerProtocol: registerProtocol,
    buildGrid: buildGrid,
    elevAt: elevAt,
    profileElev: profileElev,
    profileLOS: profileLOS,
    exposureFactor: exposureFactor,
    mastForGroup: mastForGroup,
    decodeTile: decodeTile,
    haversine_m: haversine_m,
    _caches: { raw: rawCache, grid: gridCache }
  };
})();
