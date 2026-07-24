/* delta9 // TG client — GramJS in the browser (MTProto over WebSocket).
   Loaded lazily via import() so the rest of the app works with no Telegram at all.
   No secrets here: apiId/apiHash/session come from the caller (localStorage). */

let TelegramClient, StringSession, NewMessage;

async function lib(){
  if(TelegramClient) return;
  let err;
  for(const base of ['https://esm.sh/telegram@2.26.22','https://esm.sh/telegram@2']){
    try{
      const core = await import(/* @vite-ignore */ base);
      const sess = await import(/* @vite-ignore */ base+'/sessions');
      const evs  = await import(/* @vite-ignore */ base+'/events');
      TelegramClient = core.TelegramClient;
      StringSession  = sess.StringSession;
      NewMessage     = evs.NewMessage;
      if(TelegramClient && StringSession && NewMessage) return;
    }catch(e){ err = e; }
  }
  throw new Error('GramJS не завантажився з esm.sh: '+(err&&err.message||'невідома помилка'));
}

export const SESSION_KEY = 'd9tg.session';
export const CRED_KEY    = 'd9tg.cred';

export function savedCred(){
  try{ return JSON.parse(localStorage.getItem(CRED_KEY)||'null'); }catch(e){ return null; }
}
export function saveCred(apiId, apiHash){
  try{ localStorage.setItem(CRED_KEY, JSON.stringify({ apiId:Number(apiId), apiHash:String(apiHash) })); }catch(e){}
}
export function savedSession(){ try{ return localStorage.getItem(SESSION_KEY)||''; }catch(e){ return ''; } }
export function clearAll(){
  try{ localStorage.removeItem(SESSION_KEY); localStorage.removeItem(CRED_KEY); }catch(e){}
}

/* Create + connect a client. Returns the live client.
   hooks: { onStatus(state,detail), onCode()->Promise<string>, onPassword()->Promise<string>, onFlood(sec) } */
export async function connect({ apiId, apiHash, phone, session, hooks }){
  await lib();
  const h = hooks || {};
  const st = (s,d)=>{ try{ h.onStatus && h.onStatus(s,d); }catch(e){} };
  st('connecting');

  const client = new TelegramClient(new StringSession(session||''), Number(apiId), String(apiHash), {
    connectionRetries: 5,
    retryDelay: 1500,
    autoReconnect: true,
    useWSS: true,
    maxConcurrentDownloads: 1
  });

  const hadSession = !!(session && session.length > 10);
  if(hadSession){
    await client.connect();
    if(!(await client.isUserAuthorized())){
      await doLogin(client, phone, h);
    }
  } else {
    await doLogin(client, phone, h);
  }

  try{ localStorage.setItem(SESSION_KEY, client.session.save()); }catch(e){}
  st('live');

  client.addEventHandler(async (upd)=>{
    try{
      const m = upd.message;
      if(!m || !m.message) return;
      let chan = '';
      try{
        const ch = await m.getChat();
        chan = ch && (ch.username ? '@'+ch.username : (ch.title||''));
      }catch(e){}
      h.onMessage && h.onMessage({ msgId: m.id, channel: chan, ts: (m.date?m.date*1000:Date.now()), text: m.message });
    }catch(e){}
  }, new NewMessage({}));

  return client;
}

async function doLogin(client, phone, h){
  const st = (s,d)=>{ try{ h.onStatus && h.onStatus(s,d); }catch(e){} };
  st('auth');
  await client.start({
    phoneNumber: async () => phone,
    phoneCode:   async () => { st('code'); return await h.onCode(); },
    password:    async () => { st('password'); return await h.onPassword(); },
    onError:     (e) => {
      const msg = String(e && e.message || e);
      const fw = msg.match(/FLOOD_WAIT_(\d+)/);
      if(fw && h.onFlood) h.onFlood(parseInt(fw[1],10));
      st('error', msg);
      throw e;
    }
  });
}

/* Resolve + backfill channels. Returns [{username, ok, error, count}] */
export async function subscribe(client, usernames, onBatch){
  const out = [];
  for(const u of usernames){
    const name = u.replace(/^@/,'').trim();
    if(!name) continue;
    try{
      const ent = await client.getEntity(name);
      let n = 0;
      try{
        const msgs = await client.getMessages(ent, { limit: 20 });
        const batch = msgs.filter(m=>m && m.message).map(m=>({
          msgId: m.id, channel: '@'+name,
          ts: (m.date? m.date*1000 : Date.now()), text: m.message
        })).reverse();
        n = batch.length;
        if(onBatch && n) onBatch(batch);
      }catch(e){}
      out.push({ username:'@'+name, ok:true, count:n });
    }catch(e){
      out.push({ username:'@'+name, ok:false, error:String(e&&e.message||e) });
    }
  }
  return out;
}

export async function disconnect(client){
  try{ await client.disconnect(); }catch(e){}
  try{ await client.destroy(); }catch(e){}
}
