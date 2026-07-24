// Delta9 air-defense simulation engine — ported from index (deterministic buildRun/stateAt).
(function(){
  // ---- weapon profiles ----
  var WP = {
    fpvk:{uk:"FPV камікадзе",cat:"drone",speed:120,apo:600,altMin:20,altMax:600,profile:"low",plat:"ground",maxRange:20,strike:1,cheap:1,dmode:"kamikaze",mName:"БЧ 1–3 кг"},
    dbomber:{uk:"Бомбер (важкий дрон)",cat:"drone",speed:90,apo:500,altMin:50,altMax:500,profile:"low",plat:"ground",maxRange:30,strike:1,cheap:1,ret:true,dmode:"bomber",mName:"скид ВОГ/мін"},
    drecon:{uk:"Розвідник (Mavic)",cat:"drone",speed:65,apo:1500,altMin:100,altMax:1500,profile:"low",plat:"ground",maxRange:20,strike:0,cheap:1,ret:true,dmode:"recon",mName:"розвідка"},
    shahed:{uk:"Shahed-136/131",cat:"drone",speed:185,apo:1500,altMin:50,altMax:2000,profile:"low",plat:"ground",maxRange:1500,strike:1,cheap:1,mName:"БЧ ~50 кг"},
    gerbera:{uk:"Гербера (приманка)",cat:"drone",speed:160,apo:1400,altMin:50,altMax:1400,profile:"low",plat:"ground",maxRange:800,strike:0,decoy:1,cheap:1,mName:"приманка / розвідка"},
    shahed238:{uk:"Shahed-238",cat:"drone",speed:550,apo:2600,altMin:60,altMax:2600,profile:"low",plat:"ground",maxRange:1000,strike:1,cheap:1,mName:"БЧ ~50 кг (турбореакт.)"},
    orlan:{uk:"Орлан-10 (розвідка)",cat:"drone",speed:150,apo:5000,altMin:500,altMax:5000,profile:"low",plat:"ground",maxRange:600,strike:0,cheap:1,mName:"розвідка / коригування"},
    supercam:{uk:"Supercam S350",cat:"drone",speed:120,apo:4000,altMin:1000,altMax:4000,profile:"low",plat:"ground",maxRange:200,strike:0,cheap:1,mName:"розвідка"},
    zala:{uk:"ZALA",cat:"drone",speed:110,apo:3500,altMin:800,altMax:3500,profile:"low",plat:"ground",maxRange:150,strike:0,cheap:1,mName:"розвідка"},
    recon:{uk:"БпЛА-розвідник",cat:"drone",speed:130,apo:3200,altMin:500,altMax:3200,profile:"low",plat:"ground",maxRange:300,strike:0,cheap:1,mName:"розвідка"},
    kh101:{uk:"КР Х-101",cat:"cruise",speed:720,apo:900,altMin:100,altMax:6000,profile:"low",plat:"air",maxRange:2800,strike:1,mName:"БЧ ~400 кг"},
    kh55:{uk:"КР Х-55СМ",cat:"cruise",speed:830,apo:900,altMin:100,altMax:6000,profile:"low",plat:"air",maxRange:2500,strike:1,mName:"БЧ ~400 кг"},
    kalibr:{uk:"КР «Калібр»",cat:"cruise",speed:890,apo:500,altMin:50,altMax:500,profile:"low",plat:"sea",maxRange:1500,strike:1,mName:"БЧ ~450 кг"},
    oniks:{uk:"КР «Онікс»",cat:"cruise",speed:2800,apo:14000,altMin:50,altMax:14000,profile:"low",plat:"coast",maxRange:600,strike:1,mName:"БЧ ~250 кг (надзвук.)"},
    x59:{uk:"КР Х-59МК2",cat:"cruise",speed:1050,apo:700,altMin:100,altMax:1200,profile:"low",plat:"air",maxRange:290,strike:1,mName:"БЧ ~320 кг"},
    x69:{uk:"КР Х-69 (стелс)",cat:"cruise",speed:1000,apo:400,altMin:20,altMax:400,profile:"low",plat:"air",maxRange:400,strike:1,mName:"БЧ ~310 кг (стелс)"},
    x22:{uk:"Х-22 «Буря»",cat:"cruise",speed:3600,apo:24000,altMin:12000,altMax:24000,profile:"arc",plat:"air",maxRange:600,strike:1,mName:"БЧ ~900 кг"},
    kab:{uk:"КАБ/ФАБ з УМПК",cat:"cruise",speed:700,apo:9000,altMin:100,altMax:9000,profile:"low",plat:"air",maxRange:80,strike:1,mName:"ФАБ 250–1500 + УМПК"},
    tochka:{uk:"БР «Точка-У»",cat:"ballistic",speed:4200,apo:26000,altMin:10000,altMax:26000,profile:"arc",plat:"ground",maxRange:120,strike:1,mName:"БЧ ~480 кг"},
    iskm:{uk:"БР Іскандер-М",cat:"ballistic",speed:5600,apo:50000,altMin:20000,altMax:50000,profile:"arc",plat:"ground",maxRange:500,strike:1,mName:"БЧ 480–700 кг"},
    kn23:{uk:"БР KN-23",cat:"ballistic",speed:5400,apo:50000,altMin:20000,altMax:50000,profile:"arc",plat:"ground",maxRange:450,strike:1,mName:"БЧ ~500 кг"},
    zircon:{uk:"ГЗР «Циркон»",cat:"hyper",speed:9000,apo:35000,altMin:28000,altMax:40000,profile:"arc",plat:"coast",maxRange:800,strike:1,mName:"БЧ 300–400 кг"},
    kinzhal:{uk:"ГЗР «Кинджал»",cat:"hyper",speed:10500,apo:50000,altMin:30000,altMax:80000,profile:"arc",plat:"mig",maxRange:1500,strike:1,mName:"БЧ ~480 кг"},
    geran3:{uk:"«Герань-3» (реактивна)",cat:"drone",speed:340,apo:2000,altMin:60,altMax:2000,profile:"low",plat:"ground",maxRange:950,strike:1,cheap:1,mName:"TBBCh-50 ~50 кг"},
    lancet:{uk:"«Ланцет» Изд.52",cat:"drone",speed:220,apo:3000,altMin:50,altMax:3000,profile:"low",plat:"ground",maxRange:70,strike:1,cheap:1,mName:"БЧ 3–5 кг"},
    lutyi:{uk:"«Лютий» (OWA)",cat:"drone",speed:180,apo:2000,altMin:100,altMax:2000,profile:"low",plat:"ground",maxRange:1000,strike:1,cheap:1,mName:"БЧ ~50–75 кг"},
    fp1:{uk:"FP-1 «Fire Point»",cat:"drone",speed:150,apo:2000,altMin:100,altMax:2000,profile:"low",plat:"ground",maxRange:1000,strike:1,cheap:1,mName:"БЧ ~60–120 кг"},
    bober:{uk:"«Бобер» (OWA)",cat:"drone",speed:150,apo:2500,altMin:100,altMax:2500,profile:"low",plat:"ground",maxRange:900,strike:1,cheap:1,mName:"БЧ ~20–25 кг"},
    banderol:{uk:"С8000 «Бандероль»",cat:"cruise",speed:600,apo:500,altMin:50,altMax:500,profile:"low",plat:"air",maxRange:500,strike:1,mName:"БЧ ~100–150 кг"},
    flamingo:{uk:"FP-5 «Фламінго»",cat:"cruise",speed:900,apo:100,altMin:30,altMax:150,profile:"low",plat:"ground",maxRange:3000,strike:1,mName:"БЧ ~1150 кг"},
    neptunL:{uk:"«Довгий Нептун» R-360Л",cat:"cruise",speed:900,apo:200,altMin:30,altMax:300,profile:"low",plat:"ground",maxRange:1000,strike:1,mName:"БЧ ~260 кг"},
    storm:{uk:"Storm Shadow / SCALP",cat:"cruise",speed:1000,apo:300,altMin:30,altMax:400,profile:"low",plat:"air",maxRange:560,strike:1,mName:"BROACH ~450 кг"},
    palyan:{uk:"«Паляниця»",cat:"cruise",speed:700,apo:1000,altMin:100,altMax:2000,profile:"low",plat:"ground",maxRange:700,strike:1,mName:"БЧ ~100 кг"},
    kh35:{uk:"Х-35 «Уран»",cat:"cruise",speed:970,apo:100,altMin:5,altMax:200,profile:"low",plat:"sea",maxRange:260,strike:1,mName:"БЧ ~145 кг"},
    harpoon:{uk:"Harpoon",cat:"cruise",speed:860,apo:100,altMin:5,altMax:200,profile:"low",plat:"sea",maxRange:240,strike:1,mName:"БЧ ~220 кг"},
    sapsan:{uk:"«Сапсан»/«Грім-2»",cat:"ballistic",speed:6300,apo:50000,altMin:20000,altMax:50000,profile:"arc",plat:"ground",maxRange:500,strike:1,mName:"БЧ ~480 кг"},
    atacms:{uk:"ATACMS (MGM-140)",cat:"ballistic",speed:3700,apo:50000,altMin:15000,altMax:50000,profile:"arc",plat:"ground",maxRange:300,strike:1,mName:"БЧ 227 кг / касетна"},
    oreshnik:{uk:"«Орешник» (IRBM)",cat:"hyper",speed:13000,apo:90000,altMin:40000,altMax:120000,profile:"arc",plat:"ground",maxRange:5000,strike:1,mName:"6 ББ × суббоєприпаси"},
    grad:{uk:"БМ-21 «Град»/«Торнадо-Г»",cat:"artillery",speed:3600,apo:6000,altMin:800,altMax:6000,profile:"arc",plat:"ground",maxRange:40,strike:1,cheap:1,mName:"122 мм ОФ/касетна"},
    uragan:{uk:"БМ-27 «Ураган»",cat:"artillery",speed:3600,apo:8000,altMin:1500,altMax:8000,profile:"arc",plat:"ground",maxRange:35,strike:1,mName:"220 мм ОФ/касетна"},
    smerch:{uk:"БМ-30 «Смерч»/«Торнадо-С»",cat:"artillery",speed:3600,apo:12000,altMin:2000,altMax:12000,profile:"arc",plat:"ground",maxRange:90,strike:1,mName:"300 мм ОФ/касетна"},
    vilkha:{uk:"«Вільха-М»",cat:"artillery",speed:3600,apo:12000,altMin:2000,altMax:12000,profile:"arc",plat:"ground",maxRange:110,strike:1,mName:"300 мм кероване"},
    himars:{uk:"HIMARS/M270 (GMLRS)",cat:"artillery",speed:3600,apo:10000,altMin:2000,altMax:10000,profile:"arc",plat:"ground",maxRange:90,strike:1,mName:"227 мм GMLRS"},
    msta:{uk:"2С19 «Мста»",cat:"artillery",speed:2900,apo:9000,altMin:1500,altMax:9000,profile:"arc",plat:"ground",maxRange:29,strike:1,mName:"152 мм снаряд"},
    pion:{uk:"2С7 «Піон»",cat:"artillery",speed:3100,apo:11000,altMin:2000,altMax:11000,profile:"arc",plat:"ground",maxRange:37,strike:1,mName:"203 мм снаряд"},
    bohdana:{uk:"2С22 «Богдана»",cat:"artillery",speed:3000,apo:10000,altMin:1800,altMax:10000,profile:"arc",plat:"ground",maxRange:50,strike:1,mName:"155 мм снаряд"}
  };
  // ---- air defense systems ----
  var PVO = {
    patriot:{name:"Patriot (PAC-3 + PAC-2)",r:160,mSpeed:6100,ammo:16,cr:1,bal:1,dr:0,ignoreCheap:1,grp:"Далекої дії / ПРО",mName:"PAC-3 MSE / PAC-2 GEM-T"},
    samp:{name:"SAMP/T",r:100,mSpeed:6000,ammo:16,cr:1,bal:1,dr:0,ignoreCheap:1,grp:"Далекої дії / ПРО",mName:"Aster-30"},
    s300:{name:"С-300ПС",r:75,mSpeed:6000,ammo:24,cr:1,bal:1,dr:0,ignoreCheap:1,grp:"Далекої дії / ПРО",mName:"5В55Р"},
    iris:{name:"IRIS-T SLM",r:40,mSpeed:3700,ammo:24,cr:1,bal:0,dr:1,grp:"Середньої дії",mName:"IRIS-T SLM"},
    nasams:{name:"NASAMS",r:25,mSpeed:4100,ammo:18,cr:1,bal:0,dr:1,grp:"Середньої дії",mName:"AIM-120 AMRAAM"},
    buk:{name:"Бук-М1",r:35,mSpeed:3000,ammo:12,cr:1,bal:0,dr:1,grp:"Середньої дії",mName:"9М38"},
    hawk:{name:"MIM-23 Hawk",r:40,mSpeed:3000,ammo:18,cr:1,bal:0,dr:1,grp:"Середньої дії",mName:"MIM-23"},
    skynex:{name:"Skynex",r:4,mSpeed:3200,ammo:60,cr:0,bal:0,dr:1,grp:"Анти-БпЛА / гармати",mName:"35mm AHEAD"},
    gepard:{name:"Gepard",r:5,mSpeed:1200,ammo:40,cr:0,bal:0,dr:1,grp:"Анти-БпЛА / гармати",mName:"35mm APDS"},
    vampire:{name:"Vampire",r:5,mSpeed:2800,ammo:38,cr:0,bal:0,dr:1,grp:"Анти-БпЛА / гармати",mName:"APKWS (лазер)"},
    stinger:{name:"Stinger / «Ігла» (ПЗРК)",r:5,mSpeed:2200,ammo:6,cr:0,bal:0,dr:1,grp:"Анти-БпЛА / гармати",mName:"ІЧ ракета"}
  };
  // ---- UA active assets (aviation / naval / mobile groups) for reference cards ----
  var UA = {
    f16:{name:"F-16V",grp:"Авіація (перехоплення)",speed:1200,mSpeed:4800,ammo:6,r:120,mName:"AIM-120D",icon:"plane"},
    f15:{name:"F-15EX",grp:"Авіація (перехоплення)",speed:1400,mSpeed:5000,ammo:12,r:160,mName:"AIM-120D",icon:"plane"},
    mig29:{name:"МиГ-29МУ2",grp:"Авіація (перехоплення)",speed:1100,mSpeed:4200,ammo:4,r:80,mName:"Р-27ЕР",icon:"plane"},
    mi8:{name:"Мі-8МСБ-В",grp:"Авіація (перехоплення)",speed:250,mSpeed:1000,ammo:2,r:4,mName:"ПКМ / Stinger",icon:"heli",antiDroneOnly:1},
    mi24:{name:"Мі-24П",grp:"Авіація (перехоплення)",speed:310,mSpeed:1100,ammo:4,r:5,mName:"ГШ-30-2",icon:"heli",antiDroneOnly:1},
    island:{name:"Island class",grp:"Кораблі",speed:55,mSpeed:900,ammo:2,r:100,mName:"Harpoon / Нептун",icon:"ship"},
    hetman:{name:"Гетьман Іван Мазепа",grp:"Кораблі",speed:45,mSpeed:1200,ammo:8,r:180,mName:"NSM",icon:"ship"},
    mrg:{name:"МРГ ППО",grp:"Мобільні вогневі групи",speed:75,mSpeed:1200,ammo:200,r:3.5,mName:"Browning / Stinger",icon:"truck"}
  };
  var CITIES = [["Київ",30.52,50.45],["Запоріжжя",35.14,47.84],["Дніпро",35.04,48.46],["Енергодар",34.66,47.50],["Нікополь",34.40,47.57]];
  var AGILE = {shahed238:0.05,kalibr:0.1,x59:0.15,x69:0.2,x22:0.3,kab:0.05,tochka:0.1,iskm:0.2,kn23:0.25,zircon:0.5,kinzhal:0.45};
  var PVO_CEIL = {"Далекої дії / ПРО":120000,"Середньої дії":20000,"Ближньої дії":10000,"Анти-БпЛА / гармати":4500};
  var CAP = 60, DT = 2, SP = [1,5,10,30];
  var R2 = Math.PI/180;
  var CATCOL = {drone:"#f2f2f7",cruise:"#ff3b30",ballistic:"#af52de",hyper:"#ff2d55",artillery:"#ffb02e"};
  var CATUK = {drone:"БпЛА / дрони",cruise:"Крилаті / КР",ballistic:"Балістичні",hyper:"Гіперзвук",artillery:"Артилерія / РСЗВ"};

  function hav(a,b){var dLat=(b[1]-a[1])*R2,dLng=(b[0]-a[0])*R2,s=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(a[1]*R2)*Math.cos(b[1]*R2)*Math.sin(dLng/2)*Math.sin(dLng/2);return 6371*2*Math.asin(Math.min(1,Math.sqrt(s)));}
  function bearing(a,b){var y=Math.sin((b[0]-a[0])*R2)*Math.cos(b[1]*R2),x=Math.cos(a[1]*R2)*Math.sin(b[1]*R2)-Math.sin(a[1]*R2)*Math.cos(b[1]*R2)*Math.cos((b[0]-a[0])*R2);return (Math.atan2(y,x)/R2+360)%360;}
  function pathLen(p){var d=0;for(var i=1;i<p.length;i++)d+=hav(p[i-1],p[i]);return d;}
  function posOnPath(p,total,fr){fr=Math.max(0,Math.min(0.999,fr));var d=fr*total;
    for(var i=1;i<p.length;i++){var seg=hav(p[i-1],p[i]);if(d<=seg||i===p.length-1){var f=seg?d/seg:0;
      return {pos:[p[i-1][0]+(p[i][0]-p[i-1][0])*f,p[i-1][1]+(p[i][1]-p[i-1][1])*f],hdg:bearing(p[i-1],p[i])};}d-=seg;}
    return {pos:p[p.length-1].slice(),hdg:bearing(p[0],p[p.length-1])};}
  function altAt(profile,apo,p){p=Math.max(0,Math.min(0.999,p));
    if(profile==="arc")return apo*Math.pow(Math.sin(Math.PI*p),0.72)+600;
    var a=apo*Math.min(1,p/0.07);if(p>0.93)a*=1-(p-0.93)/0.07*0.8;return Math.max(a,40);}
  function nearestCity(pt){var best=CITIES[0][0],bd=1e9;for(var i=0;i<CITIES.length;i++){var c=CITIES[i];var d=hav(pt,[c[1],c[2]]);if(d<bd){bd=d;best=c[0];}}return best;}
  function leadSolve(sPos,tPos,tSpdKmh,hdg,mSpdKmh){
    var lat0=sPos[1],kx=111.32*Math.cos(lat0*R2),ky=110.57;
    var rx=(tPos[0]-sPos[0])*kx,ry=(tPos[1]-sPos[1])*ky;
    var v=tSpdKmh/3600,vx=Math.sin(hdg*R2)*v,vy=Math.cos(hdg*R2)*v,vi=mSpdKmh/3600;
    var a=vx*vx+vy*vy-vi*vi,b=2*(rx*vx+ry*vy),c=rx*rx+ry*ry,tau=null;
    if(Math.abs(a)<1e-6){if(Math.abs(b)>1e-9){var t0=-c/b;if(t0>0.4)tau=t0;}}
    else{var disc=b*b-4*a*c;if(disc>=0){var sq=Math.sqrt(disc),t1=(-b-sq)/(2*a),t2=(-b+sq)/(2*a);var arr=[t1,t2].filter(function(x){return x>0.4;}).sort(function(p,q){return p-q;});if(arr.length)tau=arr[0];}}
    if(tau==null||tau>900)return null;return tau;}
  function roleOK(s,cat){if(cat==="drone")return s.dr&&!s.ignoreCheap;if(cat==="cruise")return !!s.cr;if(cat==="artillery")return false;return !!s.bal;}
  function pkOf(s,th){var base,c=th.cat;
    if(c==="drone")base=s.gun?0.60:0.85;else if(c==="cruise")base=0.80;else if(c==="ballistic")base=0.65;else base=0.30;
    var ag=AGILE[th.model]||0;base*=(1-0.55*ag);return Math.max(0.03,base);}
  function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
  function lerp(a,b,f){return [a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f];}
  // Phased ballistic profile: boost (slow climb) -> midcourse/apogee (coast, stage separation) -> terminal descent (fastest).
  function speedAt(w,p){
    if(w.profile==="arc"){
      if(p<0.12) return w.speed*(0.26+(0.60-0.26)*(p/0.12));        // boost / розгін
      if(p<0.60) return w.speed*(0.60+(0.78-0.60)*((p-0.12)/0.48)); // midcourse / apogee (відділення ступені)
      return w.speed*(0.78+(1.22-0.78)*((p-0.60)/0.40));            // terminal descent / спуск (найшвидше)
    }
    return w.speed*(0.85+0.30*p);
  }
  // flight phase label for a ballistic/arc target at progress p
  function phaseAt(w,p){ if(w.profile!=="arc") return "cruise"; if(p<0.12) return "boost"; if(p<0.60) return "midcourse"; return "terminal"; }
  function buildTT(w,total){ var N=48, tt=[{p:0,t:0}], t=0; for(var i=1;i<=N;i++){ var p0=(i-1)/N,p1=i/N,pm=(p0+p1)/2; var v=speedAt(w,pm)/3600; var ds=(p1-p0)*total; t += v>0? ds/v : 0; tt.push({p:p1,t:t}); } return tt; }
  function pAtTime(tt,el){ if(el<=0) return 0; var last=tt[tt.length-1]; if(el>=last.t) return 0.999; for(var i=1;i<tt.length;i++){ if(el<=tt[i].t){ var f=(el-tt[i-1].t)/((tt[i].t-tt[i-1].t)||1); return Math.min(0.999, tt[i-1].p+(tt[i].p-tt[i-1].p)*f); } } return 0.999; }

  var REB = { bukovel:{name:"Буковель-AD",r:20}, pole21:{name:"Поле-21",r:25}, nota:{name:"Нота",r:18}, kvertus:{name:"Квертус AD",r:12}, anklav:{name:"Анклав",r:15} };
  function buildDrift(w,tt,WIND){ var sens=(WIND.sens&&WIND.sens[w.cat]!=null)?WIND.sens[w.cat]:0; var dr=[{e:0,n:0}],ce=0,cn=0; for(var i=1;i<tt.length;i++){ if(sens>0){ var pm=(tt[i-1].p+tt[i].p)/2, alt=altAt(w.profile,w.apo,pm), wv=WIND.windAt(alt), dt=tt[i].t-tt[i-1].t; ce+=sens*wv.u*dt; cn+=sens*wv.v*dt; } dr.push({e:ce,n:cn}); } return dr; }
  function driftDeg(th,el,atLat){ if(!th.drift) return [0,0]; var tt=th.tt,dr=th.drift,ce=null,cn=null; if(el<=0) return [0,0]; if(el>=tt[tt.length-1].t){ ce=dr[dr.length-1].e; cn=dr[dr.length-1].n; } else { for(var i=1;i<tt.length;i++){ if(el<=tt[i].t){ var f=(el-tt[i-1].t)/((tt[i].t-tt[i-1].t)||1); ce=dr[i-1].e+(dr[i].e-dr[i-1].e)*f; cn=dr[i-1].n+(dr[i].n-dr[i-1].n)*f; break; } } } if(ce==null) return [0,0]; var la=(atLat==null?49:atLat); return [ ce/(111320*Math.cos(la*R2)), cn/110540 ]; }
  function threatPosAt(th,el){ var p=pAtTime(th.tt,el),c=posOnPath(th.path,th.total,p); if(th.drift){ var d=driftDeg(th,el,c.pos[1]); return { pos:[c.pos[0]+d[0],c.pos[1]+d[1]], hdg:c.hdg, p:p }; } return { pos:c.pos, hdg:c.hdg, p:p }; }
  function buildDPath(pth,total,tt,drift){ var out=[]; for(var i=0;i<tt.length;i++){ var g=posOnPath(pth,total,tt[i].p), la=g.pos[1], de=drift[i].e/(111320*Math.cos(la*R2)), dn=drift[i].n/110540; out.push([g.pos[0]+de, g.pos[1]+dn]); } return out; }
  function assetHpAt(a,t){ if(!a.dmgLog||!a.dmgLog.length) return (a.hp!=null?a.hp:1); var s=0; for(var i=0;i<a.dmgLog.length;i++){ if(a.dmgLog[i].t<=t) s+=a.dmgLog[i].dmg; } return Math.max(0,1-s); }
  function buildRun(SETUP,seed,opts){
    opts=opts||{};var LOS=opts.los||null,WIND=opts.wind||null;
    var RND=mulberry32(seed>>>0);var threats=[];
    var jz=(SETUP.reb||[]).filter(function(r){return r.side!=="enemy";}).map(function(r){var s=REB[r.key]||{r:15};return {pos:r.pos,r:s.r};});
    SETUP.threats.slice(0,CAP).forEach(function(st){var w=WP[st.model];if(!w)return; var far=st.path[st.path.length-1]; var pth=(w.ret&&st.path.length>=2)?st.path.concat(st.path.slice(0,-1).reverse()):st.path; var total=pathLen(pth);
      if(pth.length<2||total<2)return;
      var tt=buildTT(w,total), dur=tt[tt.length-1].t;
      var drift=WIND?buildDrift(w,tt,WIND):null; var dpath=(WIND&&drift)?buildDPath(pth,total,tt,drift):null;
      threats.push({id:st.id,model:st.model,w:w,cat:w.cat,path:pth,total:total,tt:tt,dur:dur,drift:drift,dpath:dpath,launchT:st.launchT||0,ret:!!w.ret,carrier:st.carrier||null,targetName:nearestCity(far),outcome:null});});
    var sams=SETUP.pvo.map(function(pv){var s=PVO[pv.key]||pv.spec||{};var kind=pv.kind||"sam";
      return {id:pv.id,key:pv.key,name:s.name||pv.key,pos:pv.pos,r:s.r||10,mSpeed:s.mSpeed||3000,ammo:s.ammo||10,
        cr:(s.cr!=null?s.cr:1),bal:(s.bal!=null?s.bal:0),dr:(s.dr!=null?s.dr:1),
        ignoreCheap:s.ignoreCheap||0,ceil:PVO_CEIL[s.grp]||1e9,gun:(kind==="mobile"||(s.r||10)<=5),ammoLeft:s.ammo||10,engaged:new Set(),pac3:pv.key==="patriot"?6:0,pac2:pv.key==="patriot"?10:0,
        kind:kind,path:pv.path||null,zoneR:pv.zoneR||(kind==="air"?350:null),grp:s.grp||null};});
    var inters=[],events=[],horizon=0;threats.forEach(function(th){horizon=Math.max(horizon,th.launchT+th.dur);});
    for(var t=0;t<=horizon+4;t+=DT){
      for(var i=0;i<threats.length;i++){var th=threats[i];
        if(th.outcome||t<th.launchT)continue;var el=t-th.launchT;
        if(el>=th.dur){var _ip=threatPosAt(th,th.dur);th.outcome={kind:"impact",t:th.launchT+th.dur,pos:_ip.pos};continue;}
        var _at=threatPosAt(th,el);var p=_at.p;
        var cur={pos:_at.pos,hdg:_at.hdg};
        if(th.cat==="drone"&&jz.length){var jd=false;for(var z=0;z<jz.length;z++){if(hav(jz[z].pos,cur.pos)<=jz[z].r){th.outcome={kind:"jam",t:t,pos:cur.pos};events.push({kind:"jam",t:t,pos:cur.pos});jd=true;break;}}if(jd)continue;}
        for(var j=0;j<sams.length;j++){var s=sams[j];
          if(s.engaged.has(th.id)||!roleOK(s,th.cat))continue;
          var isBal=th.cat==="ballistic"||th.cat==="hyper";var pool=s.key==="patriot"?(isBal?"pac3":"pac2"):"ammoLeft";
          if(s[pool]<=0)continue;if(hav(s.pos,cur.pos)>s.r)continue;
          if(altAt(th.w.profile,th.w.apo,p)>s.ceil)continue;
          if(LOS){var _dl=LOS(s,cur.pos,altAt(th.w.profile,th.w.apo,p),s.grp);if(_dl&&_dl.blocked)continue;}
          var tau=leadSolve(s.pos,cur.pos,th.w.speed,cur.hdg,s.mSpeed);if(tau==null)continue;
          if(s.mSpeed/3600*tau>s.r*1.3)continue;
          var arriveT=t+tau,_atk=threatPosAt(th,arriveT-th.launchT),pp=_atk.p,kp={pos:_atk.pos},kalt=altAt(th.w.profile,th.w.apo,pp);
          var expo=1;if(LOS){var _kl=LOS(s,kp.pos,kalt,s.grp);if(_kl&&_kl.blocked)continue;expo=_kl?_kl.exposure:1;}
          s.engaged.add(th.id);s[pool]--;
          var hit=RND()<pkOf(s,th)*expo;
          inters.push({samId:s.id,from:s.pos,to:kp.pos,launchT:t,arriveT:arriveT,hit:hit,gun:s.gun,toAlt:kalt});
          events.push({kind:"samfire",t:t,pos:s.pos});
          if(hit){th.outcome={kind:"kill",t:arriveT,pos:kp.pos,samId:s.id};events.push({kind:"kill",t:arriveT,pos:kp.pos});}
          break;
        }
      }
    }
    threats.forEach(function(th){
      if(!th.outcome){var _fp=threatPosAt(th,th.dur);th.outcome={kind:"impact",t:th.launchT+th.dur,pos:_fp.pos};}
      events.push({kind:"launch",t:th.launchT,pos:th.path[0]});
      if(th.outcome.kind==="impact"&&th.w.strike)events.push({kind:"impact",t:th.outcome.t,pos:th.outcome.pos});});
    var assets=(opts.assets||[]).map(function(a){return {id:a.id,osmId:a.osmId,type:a.type,name:a.name,pos:a.pos,value:a.value,radius_m:a.radius_m,hp:1,dmgLog:[]};});
    if(assets.length){ var sevOf=function(th){var c=th.cat;return c==="ballistic"?1.0:c==="hyper"?1.0:c==="cruise"?0.7:c==="artillery"?0.3:0.35;};
      threats.forEach(function(th){var o=th.outcome;if(!o||o.kind!=="impact"||!th.w.strike)return;var sev=sevOf(th);for(var ai=0;ai<assets.length;ai++){var a=assets[ai];var dm=hav(o.pos,a.pos)*1000;if(dm<a.radius_m){var dmg=sev*(1-dm/a.radius_m);if(dmg>0)a.dmgLog.push({t:o.t,dmg:dmg});}}});
      assets.forEach(function(a){var s=0;a.dmgLog.forEach(function(d){s+=d.dmg;});a.hp=Math.max(0,1-s);}); }
    var assetValueTotal=0,assetLoss=0,assetsHit=0,assetsDestroyed=0;
    assets.forEach(function(a){assetValueTotal+=a.value;assetLoss+=a.value*(1-a.hp);if(a.hp<1)assetsHit++;if(a.hp<=0)assetsDestroyed++;});
    var total=threats.length,killed=threats.filter(function(t){return t.outcome.kind==="kill";}).length,impacted=threats.filter(function(t){return t.outcome.kind==="impact"&&t.w.strike;}).length;
    var endT=6;threats.forEach(function(th){endT=Math.max(endT,th.outcome.t+6);});
    return {seed:seed,threats:threats,sams:sams,inters:inters,events:events,endT:endT,weatherHash:WIND?(WIND.hash||'calm'):'calm',assets:assets,stat:{total:total,killed:killed,impacted:impacted,eff:total?Math.round(killed/total*100):0,assetsTotal:assets.length,assetsHit:assetsHit,assetsDestroyed:assetsDestroyed,assetLoss:Math.round(assetLoss),assetValueTotal:assetValueTotal}};
  }
  function stateAt(RUN,t){
    var counts={drone:0,cruise:0,ballistic:0,hyper:0},nK=0,nI=0,nJ=0,air=[],fly=[],fx=[];
    RUN.threats.forEach(function(th){var res=th.outcome;
      if(t>=res.t){if(res.kind==="kill")nK++;else if(res.kind==="impact"&&th.w.strike)nI++;else if(res.kind==="jam")nJ++;return;}
      if(t>=th.launchT){var el=t-th.launchT;if(el<th.dur){var _a=threatPosAt(th,el);counts[th.cat]++;
        air.push({th:th,pos:_a.pos,p:_a.p,hdg:_a.hdg});}}});
    RUN.inters.forEach(function(it){if(t>=it.launchT&&t<it.arriveT){var f=(it.arriveT-it.launchT)?(t-it.launchT)/(it.arriveT-it.launchT):1;
      fly.push({from:it.from,to:it.to,cur:lerp(it.from,it.to,f),f:f,gun:it.gun,toAlt:it.toAlt});}});
    RUN.events.forEach(function(ev){if((ev.kind==="kill"||ev.kind==="impact"||ev.kind==="jam")&&Math.abs(t-ev.t)<0.8&&ev.pos)fx.push({kind:ev.kind,pos:ev.pos,a:1-Math.abs(t-ev.t)/0.8});});
    var assetSt=(RUN.assets||[]).map(function(a){return {a:a,hp:assetHpAt(a,t)};});
    return {counts:counts,nK:nK,nI:nI,nJ:nJ,air:air,fly:fly,fx:fx,assets:assetSt};
  }
  // demo scenario over ZNPP / Enerhodar
  function demoZNPP(){
    var plant=[34.585,47.507], ener=[34.66,47.50];
    return {
      pvo:[
        {id:'s1',key:'s300',pos:[34.60,47.452]},
        {id:'s2',key:'iris',pos:[34.665,47.535]},
        {id:'s3',key:'buk',pos:[34.505,47.552]}
      ],
      threats:[
        {id:'t1',model:'shahed',launchT:0,path:[[34.94,47.40],[34.80,47.45],[34.68,47.48],plant]},
        {id:'t2',model:'shahed',launchT:8,path:[[34.97,47.55],[34.83,47.53],[34.71,47.515],ener]},
        {id:'t3',model:'shahed238',launchT:4,path:[[34.82,47.635],[34.72,47.585],[34.64,47.545],plant]},
        {id:'t4',model:'kh101',launchT:12,path:[[35.08,47.575],[34.92,47.555],[34.75,47.53],plant]},
        {id:'t5',model:'iskm',launchT:30,path:[[35.45,47.18],[35.05,47.33],[34.78,47.44],plant]}
      ]
    };
  }
  function catColor(cat){return CATCOL[cat]||"#f2f2f7";}

  window.Delta9Sim = { WP:WP, PVO:PVO, UA:UA, REB:REB, SP:SP, CATUK:CATUK, buildRun:buildRun, stateAt:stateAt, demoZNPP:demoZNPP, catColor:catColor, hav:hav, pathLen:pathLen, posOnPath:posOnPath, altAt:altAt, phaseAt:phaseAt, assetHpAt:assetHpAt };
})();
