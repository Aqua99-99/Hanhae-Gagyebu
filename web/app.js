const UA=navigator.userAgent||'';
const IS_KAKAO=/KAKAOTALK/i.test(UA);
const IS_ANDROID=/Android/i.test(UA);
const INAPP=IS_KAKAO||/NAVER\(inapp|Instagram|FBAN|FBAV|FB_IAB|Line\/|DaumApps|everytimeApp|BAND\/|; wv\)/i.test(UA);
const APP_NAME=IS_KAKAO?'카카오톡':/Instagram/i.test(UA)?'인스타그램':/NAVER/i.test(UA)?'네이버 앱':/FBAN|FBAV|FB_IAB/i.test(UA)?'페이스북':/Line\//i.test(UA)?'라인':/BAND\//i.test(UA)?'밴드':'이 앱';

/* ---------- 화이트·블랙 모드 ---------- */
const THEME_KEY='gagyebu.theme';
function currentTheme(){const t=document.documentElement.getAttribute('data-theme');if(t)return t;return window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}
function paintThemeBtns(){const dark=currentTheme()==='dark';
  const sun='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  const moon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>';
  document.querySelectorAll('.theme-btn').forEach(b=>{b.innerHTML=dark?sun:moon;b.title=dark?'화이트 모드로':'블랙 모드로'})}
function applyTheme(t){if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t);else document.documentElement.removeAttribute('data-theme');paintThemeBtns()}
function toggleTheme(){const next=currentTheme()==='dark'?'light':'dark';applyTheme(next);try{localStorage.setItem(THEME_KEY,next)}catch(e){}if(typeof render==='function'&&S.cur)render()}
try{const t=localStorage.getItem(THEME_KEY);if(t)document.documentElement.setAttribute('data-theme',t)}catch(e){}
const PAL=10;
const DEFAULT_CATS={
  out:[{id:'util',name:'공과금',c:0},{id:'food',name:'식비',c:1},{id:'cloth',name:'의류',c:2},{id:'beauty',name:'화장품',c:3},{id:'trans',name:'교통',c:4},{id:'etc',name:'기타',c:5}],
  in:[{id:'salary',name:'월급',c:6},{id:'side',name:'부수입',c:7},{id:'allow',name:'용돈',c:8},{id:'inetc',name:'기타수입',c:5}]
};
const TYPE_NAME={out:'지출',in:'수입',all:'전체'};
const won=n=>(Number(n)||0).toLocaleString('ko-KR')+'원';
const swon=n=>(n<0?'-':'')+won(Math.abs(n));
const compact=n=>n>=10000?(Math.round(n/1000)/10).toLocaleString('ko-KR')+'만':n.toLocaleString('ko-KR');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=id=>document.getElementById(id);
const pad=n=>String(n).padStart(2,'0');
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);

const now=new Date();
const S={cur:null,type:'all',entries:[],cats:JSON.parse(JSON.stringify(DEFAULT_CATS)),year:now.getFullYear(),month:now.getMonth(),cat:null,
  fType:'out',pickCat:'util',cType:'out',settings:null,editId:null,fPay:'cash',fDir:'out'};
const DEFAULT_SETTINGS={openBal:null,openDate:'',cardDay:14,basis:'use'};
const PAY_NAME={cash:'현금·계좌',debit:'체크',credit:'신용'};
const LS='gagyebu.v1';
let CATMAP={};
function rebuildMap(){CATMAP={};for(const t of ['out','in'])for(const c of S.cats[t])CATMAP[c.id]={...c,type:t}}
const col=id=>{const k=CATMAP[id];if(!k)return 'var(--p5)';return (typeof k.hex==='string'&&/^#[0-9a-fA-F]{6}$/.test(k.hex))?k.hex:`var(--p${(Number(k.c)||0)%PAL})`};
const palHex=i=>(getComputedStyle(document.documentElement).getPropertyValue('--p'+(i%PAL)).trim()||'#8f97a8');
const hexOf=k=>/^#[0-9a-f]{6}$/i.test(k.hex||'')?k.hex:palHex(k.c);
function nextPal(cats){const used=new Set(cats.map(x=>x.c%PAL));for(let i=0;i<PAL;i++)if(!used.has(i))return i;return cats.length%PAL}
const cname=id=>CATMAP[id]?CATMAP[id].name:'미분류';
const curCats=()=>S.type==='all'?[...S.cats.in,...S.cats.out]:S.cats[S.type];
const rateOf=(i,o)=>i>0?Math.round((i-o)/i*1000)/10:null;
const rateTxt=r=>r===null?'–':r.toLocaleString('ko-KR')+'%';
const rateCls=r=>r===null?'':(r>=0?'pos':'neg');
const scompact=n=>(n<0?'-':'')+compact(Math.abs(n));

/* ---------- storage (여러 가계부) ---------- */
let LS2='gagyebu.v2';
let IDX=[], LEDGERS={}, DB=null, BASE=null;
const timers={};
/* ---------- 불러온 데이터 검증 (OWASP A05/A08) ----------
   로컬 저장소, 서버, 백업 파일에서 들어오는 값은 모두 여기서 허용된 모양으로만 통과시켜요. */
const ID_RE=/^[A-Za-z0-9_-]{1,64}$/,DATE_RE=/^\d{4}-\d{2}-\d{2}$/,YM_RE=/^\d{4}-\d{2}$/,HEX_RE=/^#[0-9a-fA-F]{6}$/;
const sid=v=>typeof v==='string'&&ID_RE.test(v)?v:null;
const sstr=(v,n)=>(typeof v==='string'?v:(typeof v==='number'?String(v):'')).slice(0,n);
const sint=(v,lo,hi)=>{const n=Math.round(Number(v));return Number.isFinite(n)&&n>=lo&&n<=hi?n:null};
const oneOf=(v,list,d)=>list.includes(v)?v:d;
function cleanEntry(e){
  if(!e||typeof e!=='object')return null;
  const date=typeof e.date==='string'&&DATE_RE.test(e.date)?e.date:null;
  const amount=sint(e.amount,1,1e11);
  if(!date||!amount)return null;
  const type=oneOf(e.type,['in','out','xfer'],'out');
  const o={id:sid(e.id)||uid(),type,date,amount,memo:sstr(e.memo,60)};
  if(type==='xfer'){o.dir=oneOf(e.dir,['in','out'],'out');o.peer=sid(e.peer)||'';o.xid=sid(e.xid)||uid()}
  else o.cat=sid(e.cat)||'';
  if(type==='out'){o.pay=oneOf(e.pay,['cash','debit','credit'],'cash');const n=sint(e.inst,2,60);if(n&&o.pay==='credit')o.inst=n}
  const f=sid(e.fid);if(f)o.fid=f;
  const u=sint(e.u,0,9e15);if(u)o.u=u;
  return o;
}
function cleanCats(c){
  const out={};
  for(const t of ['out','in']){
    const seen=new Set();
    out[t]=(c&&Array.isArray(c[t])?c[t]:[]).slice(0,40).map(k=>{
      const id=sid(k&&k.id);if(!id||seen.has(id))return null;seen.add(id);
      const o={id,name:sstr(k.name,20).trim()||'카테고리',c:sint(k.c,0,9)??0};
      if(typeof k.hex==='string'&&HEX_RE.test(k.hex))o.hex=k.hex;
      return o;
    }).filter(Boolean);
    if(!out[t].length)out[t]=JSON.parse(JSON.stringify(DEFAULT_CATS[t]));
  }
  return out;
}
function cleanSettings(st){
  const o={...DEFAULT_SETTINGS};
  if(!st||typeof st!=='object')return o;
  const ob=sint(st.openBal,-1e12,1e12);o.openBal=(st.openBal===null||st.openBal===undefined||st.openBal==='')?null:ob;
  o.openDate=typeof st.openDate==='string'&&DATE_RE.test(st.openDate)?st.openDate:'';
  o.cardDay=sint(st.cardDay,1,28)??14;
  o.basis=oneOf(st.basis,['use','pay'],'use');
  if(st.budgets&&typeof st.budgets==='object'){const b={};for(const [k,v] of Object.entries(st.budgets).slice(0,40)){const id=sid(k),n=sint(v,1,1e11);if(id&&n)b[id]=n}o.budgets=b}
  if(Array.isArray(st.fixed)){
    o.fixed=st.fixed.slice(0,50).map(f=>{
      if(!f||typeof f!=='object')return null;
      const amount=sint(f.amount,1,1e11),start=typeof f.start==='string'&&YM_RE.test(f.start)?f.start:null;
      if(!amount||!start)return null;
      const type=oneOf(f.type,['in','out','xfer'],'out');
      const x={id:sid(f.id)||'f'+uid(),type,day:sint(f.day,1,31)??1,amount,memo:sstr(f.memo,60),start,last:typeof f.last==='string'&&YM_RE.test(f.last)?f.last:''};
      if(typeof f.end==='string'&&YM_RE.test(f.end))x.end=f.end;
      if(type==='xfer'){x.dir=oneOf(f.dir,['in','out'],'out');x.peer=sid(f.peer)||''}else x.cat=sid(f.cat)||'';
      if(type==='out'){x.pay=oneOf(f.pay,['cash','debit','credit'],'cash');const n=sint(f.inst,2,60);if(n&&x.pay==='credit')x.inst=n}
      return x;
    }).filter(Boolean);
  }
  if(st.rules&&typeof st.rules==='object'){const r={};for(const [k,v] of Object.entries(st.rules).slice(-400)){if(typeof k==='string'&&k.length<=80&&/^(in|out)\|/.test(k)&&sid(v))r[k]=v}o.rules=r}
  return o;
}
function cleanIndex(list){
  const seen=new Set();
  return (Array.isArray(list)?list:[]).slice(0,30).map(it=>{const id=sid(it&&it.id);if(!id||seen.has(id))return null;seen.add(id);return {id,name:sstr(it.name,30).trim()||'가계부'}}).filter(Boolean);
}
function normLedger(o){
  const out={entries:[],cats:JSON.parse(JSON.stringify(DEFAULT_CATS)),settings:{...DEFAULT_SETTINGS}};
  if(!o||typeof o!=='object')return out;
  out.settings=cleanSettings(o.settings);
  if(Array.isArray(o.entries))out.entries=o.entries.slice(0,20000).map(cleanEntry).filter(Boolean);
  if(o.cats&&typeof o.cats==='object')out.cats=cleanCats(o.cats);
  out.tomb=cleanTomb(o.tomb);out.mu=sint(o.mu,0,9e15)||0;
  return out;
}
function cleanTomb(t){
  const o={};if(!t||typeof t!=='object')return o;
  const cut=Date.now()-180*864e5;
  const arr=Object.entries(t).filter(([k,v])=>sid(k)&&sint(v,cut,9e15)).sort((a,b)=>b[1]-a[1]).slice(0,3000);
  for(const [k,v] of arr)o[k]=Math.round(Number(v));
  return o;
}
function syncCur(){if(S.cur&&LEDGERS[S.cur]){const L=LEDGERS[S.cur];L.entries=S.entries;L.cats=S.cats;L.settings=S.settings}}
function loadLocal(){
  try{
    const r=localStorage.getItem(LS2);
    if(r){const o=JSON.parse(r);IDX=cleanIndex(o.index);IU=sint(o.iu,0,9e15)||0;DELL=cleanTomb(o.del);LEDGERS={};
      for(const it of IDX)LEDGERS[it.id]=initKnown(normLedger(o.ledgers&&o.ledgers[it.id]));return}
  }catch(e){}
}
let IU=0,DELL={}; // 가계부 목록을 마지막으로 바꾼 시각, 지운 가계부
const noPriv=(k,v)=>(typeof k==='string'&&k.startsWith('_'))?undefined:v;
function saveLocal(){syncCur();try{localStorage.setItem(LS2,JSON.stringify({index:IDX,iu:IU,del:DELL,ledgers:LEDGERS},noPriv))}catch(e){}}
function setSync(t){document.querySelectorAll('.sync').forEach(n=>n.textContent=t)}
const savedJSON={};
function writeDoc(docId,data){
  if(!DB){setSync('이 기기에 저장됨');return}
  const js=JSON.stringify(data);
  if(savedJSON[docId]===js)return;
  savedJSON[docId]=js;
  clearTimeout(timers[docId]);setSync('저장 중…');
  timers[docId]=setTimeout(async()=>{
    const ref=DB.doc(BASE+'/'+docId);
    const w=()=>ref.set({...data,updated:Date.now()});
    try{await w();setSync('저장됨')}
    catch(e){
      if(e&&e.code==='unavailable')setTimeout(()=>w().then(()=>setSync('저장됨')).catch(()=>{delete savedJSON[docId];setSync('이 기기에 저장됨')}),800+Math.random()*800);
      else{delete savedJSON[docId];setSync('이 기기에 저장됨');
        if(e&&e.code==='limit'&&!writeDoc._warned){writeDoc._warned=true;toast('저장 공간 한도를 넘어서 서버에 저장하지 못했어요. 오래된 기록을 백업 후 정리해 주세요.')}}
    }
  },400);
}
/* 가계부 하나 = 기본 정보 문서 1개 + 연도별 기록 문서 (연도마다 용량이 따로라 오래 써도 안 차요) */
const yDoc=(id,y)=>`${id}__y${y}`;
function splitYears(entries){const g={};for(const e of entries){const y=e.date.slice(0,4);(g[y]=g[y]||[]).push(e)}return g}
/* ---------- 동기화 ----------
   기록마다 마지막으로 바꾼 시각(u)을, 지운 기록은 '지운 시각'(tomb)을 남겨요.
   서버와 이 기기의 내용을 기록 하나하나 비교해서 더 최근 것을 남기기 때문에,
   인터넷이 끊긴 동안 쓴 기록이나 다른 기기에서 쓴 기록이 서로 덮어써지지 않아요. */
function stampLedger(L){
  if(!L)return;const now=Date.now();
  L.tomb=L.tomb||{};
  const ids=new Set();
  for(const e of L.entries){ids.add(e.id);if(!e.u)e.u=now;if(L.tomb[e.id])delete L.tomb[e.id]}
  if(L._known)for(const id of L._known)if(!ids.has(id))L.tomb[id]=now;
  L._known=ids;
  const mj=JSON.stringify({c:L.cats,s:L.settings});
  if(L._metaJSON!==undefined&&L._metaJSON!==mj)L.mu=now;
  if(!L.mu)L.mu=now;
  L._metaJSON=mj;
  L.tomb=cleanTomb(L.tomb);
}
function initKnown(L){if(!L)return L;L._known=new Set(L.entries.map(e=>e.id));L._metaJSON=JSON.stringify({c:L.cats,s:L.settings});return L}
function writeLedger(id){
  const L=LEDGERS[id];if(!L)return;
  stampLedger(L);
  const g=splitYears(L.entries),years=Object.keys(g).sort();
  const prevYears=L._years||[];
  for(const y of years)writeDoc(yDoc(id,y),{entries:g[y]});
  for(const y of prevYears)if(!g[y])writeDoc(yDoc(id,y),{entries:[]});
  L._years=Array.from(new Set([...prevYears,...years])).sort();
  writeDoc(id,{cats:L.cats,settings:L.settings,years:L._years,tomb:L.tomb,mu:L.mu,v:3});
}
async function loadLedger(id){
  const snap=await DB.doc(BASE+'/'+id).get();
  if(!snap.exists)return null;
  const m=snap.data()||{};
  if(Array.isArray(m.entries)){const L=normLedger(m);L._years=[];return L} // 예전 한 문서 방식
  const years=Array.isArray(m.years)?m.years.filter(y=>/^\d{4}$/.test(y)):[];
  const ys=await Promise.all(years.map(y=>DB.doc(BASE+'/'+yDoc(id,y)).get()));
  const entries=[];ys.forEach(sn=>{if(sn.exists){const d=sn.data()||{};if(Array.isArray(d.entries))entries.push(...d.entries)}});
  const L=normLedger({entries,cats:m.cats,settings:m.settings,tomb:m.tomb,mu:m.mu});L._years=years;
  return L;
}
function mergeLedger(a,b){ // a: 이 기기, b: 서버
  if(!a&&!b)return normLedger(null);
  if(!a)return initKnown(b);
  if(!b)return a;
  const tomb={...b.tomb};for(const [k,v] of Object.entries(a.tomb||{}))if(!tomb[k]||v>tomb[k])tomb[k]=v;
  const map=new Map();
  for(const e of b.entries)map.set(e.id,e);
  for(const e of a.entries){const o=map.get(e.id);if(!o||(e.u||0)>=(o.u||0))map.set(e.id,e)}
  const entries=[...map.values()].filter(e=>!(tomb[e.id]&&tomb[e.id]>=(e.u||0)));
  const metaA=(a.mu||0)>(b.mu||0);
  const L={entries,cats:metaA?a.cats:b.cats,settings:metaA?a.settings:b.settings,tomb:cleanTomb(tomb),mu:Math.max(a.mu||0,b.mu||0)};
  L._years=b._years||[];
  return initKnown(L);
}
const sameLedger=(x,y)=>{if(!x||!y)return false;
  const ids=l=>l.entries.map(e=>e.id+':'+(e.u||0)).sort().join(',');
  return ids(x)===ids(y)&&JSON.stringify([x.cats,x.settings])===JSON.stringify([y.cats,y.settings])&&JSON.stringify(x.tomb||{})===JSON.stringify(y.tomb||{})};
function persist(){syncCur();if(S.cur)writeLedger(S.cur);saveLocal()}
function persistIndex(){IU=Date.now();saveLocal();writeDoc('index',{list:IDX,iu:IU,del:DELL})}
/* Supabase 저장소: docs 테이블 (user_id, doc_id, data). 행 수준 보안(RLS)으로 본인 행만 읽고 쓸 수 있어요. */
function makeDB(userId){
  const idOf=path=>String(path).split('/').pop();
  return {doc(path){const docId=idOf(path);return {
    async get(){const {data,error}=await sb.from('docs').select('data').eq('user_id',userId).eq('doc_id',docId).maybeSingle();
      if(error)throw Object.assign(new Error('db'),{code:'unavailable'});return {exists:!!data,data:()=>data?data.data:undefined}},
    async set(obj){const {error}=await sb.from('docs').upsert({user_id:userId,doc_id:docId,data:obj,updated_at:new Date().toISOString()},{onConflict:'user_id,doc_id'});
      if(error)throw Object.assign(new Error('db'),{code:/limit reached/.test(error.message||'')?'limit':'unavailable'})},
    async delete(){const {error}=await sb.from('docs').delete().eq('user_id',userId).eq('doc_id',docId);if(error)throw error}
  }}};
}
let syncing=false,lastSync=0;
async function syncAll(){
  if(!DB||syncing)return;syncing=true;
  try{
    syncCur();
    for(const id of Object.keys(LEDGERS))stampLedger(LEDGERS[id]); // 이 기기의 변경을 먼저 기록
    const idx=await DB.doc(BASE+'/index').get();
    let serverList=null,serverIU=0,serverDel={};
    if(idx.exists&&Array.isArray((idx.data()||{}).list)){const d=idx.data();serverList=cleanIndex(d.list);serverIU=sint(d.iu,0,9e15)||0;serverDel=cleanTomb(d.del)}
    else{const old=await DB.doc(BASE+'/ledger').get();if(old.exists)serverList=[{id:'ledger',name:'내 가계부'}]}
    // 가계부 목록: 양쪽을 합치고, 어느 쪽에서든 지운 가계부는 빼요. 이름이 다르면 더 최근에 바꾼 쪽을 따라요.
    const del={...serverDel};for(const [k,v] of Object.entries(DELL))if(!del[k]||v>del[k])del[k]=v;
    const sl=serverList||[];
    const primary=IU>serverIU?IDX:sl,secondary=IU>serverIU?sl:IDX;
    let finalList=primary.slice();
    for(const it of secondary)if(!finalList.some(x=>x.id===it.id))finalList.push(it);
    finalList=finalList.filter(it=>!del[it.id]);
    DELL=cleanTomb(del);
    const pushIndex=!serverList||JSON.stringify(finalList)!==JSON.stringify(sl)||JSON.stringify(DELL)!==JSON.stringify(serverDel);
    IU=Math.max(IU,serverIU);
    const servers=await Promise.all(finalList.map(it=>loadLedger(it.id).catch(()=>undefined)));
    const next={};
    finalList.forEach((it,i)=>{
      const srv=servers[i];if(srv===undefined){next[it.id]=LEDGERS[it.id]||normLedger(null);return}
      const merged=mergeLedger(LEDGERS[it.id],srv);
      next[it.id]=merged;
      if(!sameLedger(merged,srv)){ // 서버가 뒤처져 있으면 합친 내용을 올려요
        for(const k of Object.keys(savedJSON))if(k===it.id||k.startsWith(it.id+'__'))delete savedJSON[k];
        LEDGERS[it.id]=merged;writeLedgerTo(next,it.id);
      }else{
        // 서버와 같으면 다시 올리지 않도록 기억해 둬요
        const g=splitYears(merged.entries);for(const y of Object.keys(g))savedJSON[yDoc(it.id,y)]=JSON.stringify({entries:g[y]});
        savedJSON[it.id]=JSON.stringify({cats:merged.cats,settings:merged.settings,years:merged._years,tomb:merged.tomb,mu:merged.mu,v:3});
      }
    });
    IDX=finalList;LEDGERS=next;
    if(pushIndex){IU=Math.max(IU,Date.now());delete savedJSON.index;writeDoc('index',{list:IDX,iu:IU,del:DELL})}
    IDX.forEach(it=>runFixedFor(it.id));
    saveLocal();
    if(S.cur&&LEDGERS[S.cur]){S.entries=LEDGERS[S.cur].entries;S.cats=LEDGERS[S.cur].cats;S.settings=LEDGERS[S.cur].settings;render()}
    else if(S.cur){goHome()}
    else renderHome();
    lastSync=Date.now();setSync('저장됨');
  }finally{syncing=false}
}
function writeLedgerTo(store,id){const keep=LEDGERS;LEDGERS=store;try{writeLedger(id)}finally{LEDGERS=keep}}
async function connect(user){
  try{
    DB=makeDB(user.id);BASE='u';
    await syncAll();
  }catch(e){DB=null;setSync('오프라인 · 이 기기에만 저장 중')}
}
// 인터넷이 다시 연결되거나 앱으로 돌아오면 서버와 맞춰요 (열려 있는 창이 있으면 기다려요)
function trySync(force){
  if(!ME||document.querySelector('dialog[open]'))return;
  if(!force&&Date.now()-lastSync<20000)return;
  if(!DB)connect(ME);else syncAll().catch(()=>setSync('오프라인 · 이 기기에만 저장 중'));
}
window.addEventListener('online',()=>trySync(true));
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')trySync(false)});

/* ---------- 가계부 목록 ---------- */
function goHome(){syncCur();S.cur=null;$('ledgerView').hidden=true;$('home').hidden=false;renderHome();window.scrollTo(0,0)}
function openLedger(id){
  if(!LEDGERS[id])LEDGERS[id]=normLedger(null);
  runFixedFor(id);
  S.cur=id;S.entries=LEDGERS[id].entries;S.cats=LEDGERS[id].cats;S.settings=LEDGERS[id].settings;S.cat=null;S.day=null;S.type='all';
  $('home').hidden=true;$('ledgerView').hidden=false;render();window.scrollTo(0,0);
}
function renderHome(){
  renderCombined();
  const y=now.getFullYear();
  $('lgrid').innerHTML=IDX.length?IDX.map(it=>{
    const L=LEDGERS[it.id]||normLedger(null);
    let inn=0,out=0,n=0;
    for(const e of expand(L.entries,L.settings)){if(e.date.slice(0,4)===String(y)){n++;if(e.type==='in')inn+=e.amount;else if(e.type==='out')out+=e.amount}}
    const bal=inn-out,cb=currentBalance(L);
    return `<div class="lcard">
      <button class="lopen" data-open="${esc(it.id)}">
        <span class="lname">${esc(it.name)}</span>
        <span class="lmeta">${y}년 기록 ${n}건</span>
        ${cb!==null?`<span class="balbox"><span>현재 잔액</span><b>${swon(cb)}</b></span>`:''}
        <dl class="ysum"><dt>수입</dt><dd class="pos">${won(inn)}</dd><dt>지출</dt><dd class="neg">${won(out)}</dd><dt>총 금액</dt><dd>${won(inn+out)}</dd><dt class="bal">남은 돈</dt><dd class="bal">${swon(bal)}</dd><dt>저축률</dt><dd class="${rateCls(rateOf(inn,out))}">${rateTxt(rateOf(inn,out))}</dd></dl>
      </button>
      <div class="lact"><button class="x" data-lren="${esc(it.id)}">이름 변경</button><button class="x" data-ldel="${esc(it.id)}">삭제</button></div>
    </div>`;}).join('')
  :`<div class="empty" style="grid-column:1/-1"><p>아직 가계부가 없어요. 통장이나 용도별로 이름을 정해서 첫 가계부를 만들어 보세요.</p><div class="row"><button class="btn-add" data-act="newlg">+ 새 가계부</button></div></div>`;
}
const lgdlg=()=>$('lgdlg');
let lgEditing=null;
function openLgDialog(id){
  lgEditing=id;
  $('lgTitle').textContent=id?'가계부 이름 변경':'새 가계부';
  $('lgName').value=id?(IDX.find(x=>x.id===id)||{}).name||'':'';
  $('lgErr').textContent='';
  lgdlg().showModal?lgdlg().showModal():lgdlg().setAttribute('open','');
  setTimeout(()=>$('lgName').focus(),50);
}
function saveLg(){
  const v=$('lgName').value.trim();
  if(!v){$('lgErr').textContent='이름을 입력해 주세요.';return}
  if(IDX.some(x=>x.name===v&&x.id!==lgEditing)){$('lgErr').textContent='같은 이름의 가계부가 이미 있어요.';return}
  if(lgEditing){const it=IDX.find(x=>x.id===lgEditing);if(it)it.name=v;persistIndex();lgdlg().close();
    if(S.cur===lgEditing)$('lgTitleH').textContent=v;else renderHome();return}
  const id='lg'+uid();
  IDX.push({id,name:v});LEDGERS[id]=normLedger(null);
  persistIndex();writeLedger(id);
  lgdlg().close();openLedger(id);
}
function deleteLedger(id){
  const L=LEDGERS[id];const years=L?Array.from(new Set([...(L._years||[]),...Object.keys(splitYears(L.entries))])):[];
  IDX=IDX.filter(x=>x.id!==id);delete LEDGERS[id];DELL[id]=Date.now();
  clearTimeout(timers[id]);
  if(DB){DB.doc(BASE+'/'+id).delete().catch(()=>{});years.forEach(y=>{clearTimeout(timers[yDoc(id,y)]);DB.doc(BASE+'/'+yDoc(id,y)).delete().catch(()=>{})})}
  persistIndex();renderHome();
}

/* ---------- data helpers ---------- */
function addMonths(date,k,day){
  const [y,m,d]=date.split('-').map(Number);const t=new Date(y,m-1+k,1);
  const last=new Date(t.getFullYear(),t.getMonth()+1,0).getDate();
  return `${t.getFullYear()}-${pad(t.getMonth()+1)}-${pad(Math.min(day||d,last))}`;
}
function expand(entries,settings,forceBasis){
  const st=settings||DEFAULT_SETTINGS,basis=forceBasis||st.basis,out=[];
  for(const e of entries){
    if(e.type==='out'&&e.pay==='credit'&&basis==='pay'){
      const n=Math.max(1,e.inst||1),part=Math.floor(e.amount/n);
      for(let i=0;i<n;i++){
        const amt=i===n-1?e.amount-part*(n-1):part;
        out.push({...e,date:addMonths(e.date,1+i,st.cardDay||14),amount:amt,part:n>1?i+1:0,parts:n,useDate:e.date});
      }
    }else out.push(e);
  }
  return out;
}
function currentBalance(L){
  const st=L.settings||DEFAULT_SETTINGS;
  if(st.openBal===null||st.openBal===undefined||st.openBal==='')return null;
  const today=`${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
  let b=Number(st.openBal)||0;
  for(const e of expand(L.entries,st,'pay')){
    if(e.date>today||(st.openDate&&e.date<st.openDate))continue;
    if(e.type==='in'||(e.type==='xfer'&&e.dir==='in'))b+=e.amount;
    else if(e.type==='out'||(e.type==='xfer'&&e.dir==='out'))b-=e.amount;
  }
  return b;
}
const peerName=id=>id?((IDX.find(x=>x.id===id)||{}).name||'삭제된 가계부'):'외부 계좌';
function yearEntries(){const p=String(S.year);return expand(S.entries,S.settings).filter(e=>e.date.slice(0,4)===p)}
function entryRow(e,withDate){
  const d=withDate?`<span class="d">${+e.date.slice(8,10)}일</span>`:'';
  const del=`<button class="x" data-del="${esc(e.id)}" aria-label="삭제">✕</button>`;
  if(e.type==='xfer'){
    const lbl=e.memo||(e.dir==='out'?`${peerName(e.peer)}(으)로 이체`:`${peerName(e.peer)}에서 이체`);
    return `<div class="entry" data-edit="${esc(e.id)}" tabindex="0" role="button">${d}<i class="edot xfd"></i><span class="m">${esc(lbl)}<span class="tag">이체 ${e.dir==='out'?'보냄':'받음'}</span></span><span class="a xf">${e.dir==='out'?'-':'+'}${won(e.amount)}</span>${del}</div>`;
  }
  let tags='';
  if(e.type==='out'&&e.pay&&e.pay!=='cash')tags+=`<span class="tag">${PAY_NAME[e.pay]}${e.inst>1?` ${e.inst}개월`:''}</span>`;
  if(e.part)tags+=`<span class="tag">할부 ${e.part}/${e.parts}</span>`;
  if(e.fid)tags+=`<span class="tag">고정</span>`;
  return `<div class="entry" data-edit="${esc(e.id)}" tabindex="0" role="button">${d}<i class="edot" style="background:${col(e.cat)}"></i><span class="m">${esc(e.memo||cname(e.cat))}${withDate?'':` <small>${esc(cname(e.cat))}</small>`}${tags}</span><span class="a ${e.type==='in'?'pos':'neg'}">${e.type==='in'?'+':'-'}${won(e.amount)}</span>${del}</div>`;
}
function monthTotals(list,type){
  const cats=type==='all'?[...S.cats.in,...S.cats.out]:S.cats[type];
  const m=Array.from({length:12},()=>Object.fromEntries(cats.map(c=>[c.id,0])));
  for(const e of list){if(type!=='all'&&e.type!==type)continue;const mi=+e.date.slice(5,7)-1;if(m[mi]&&m[mi][e.cat]!==undefined)m[mi][e.cat]+=e.amount}
  return m;
}
function flowByMonth(list){
  const f=Array.from({length:12},()=>({in:0,out:0}));
  for(const e of list){if(e.type==='in'||e.type==='out')f[+e.date.slice(5,7)-1][e.type]+=e.amount}
  return f;
}
const sum=o=>Object.values(o).reduce((a,b)=>a+b,0);
function fixSelections(){
  if(S.cat&&(!CATMAP[S.cat]||(S.type!=='all'&&CATMAP[S.cat].type!==S.type)))S.cat=null;
}

/* ---------- donut ---------- */
function ring(tot,cats,r,thick,cx,denom){
  const c=2*Math.PI*r,present=cats.filter(k=>tot[k.id]>0);
  const gap=present.length>1?Math.min(2.5,c*0.01):0;
  let segs=`<circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="var(--empty)" stroke-width="${thick}"/>`,off=0;
  if(!denom)return segs;
  for(const k of present){
    const len=tot[k.id]/denom*c,dash=Math.max(len-gap,0.6);
    segs+=`<circle class="seg${S.cat===k.id?' on':''}" data-cat="${k.id}" cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="${col(k.id)}" stroke-width="${thick}" stroke-dasharray="${dash} ${c-dash}" stroke-dashoffset="${-off}" transform="rotate(-90 ${cx} ${cx})"><title>${esc(k.name)} ${won(tot[k.id])}</title></circle>`;
    off+=len;
  }
  return segs;
}
function donutAll(tot,label,size,thick){
  const cx=size/2,t2=Math.round(thick*.62),r1=(size-t2)/2-2,r2=r1-t2-4;
  const inT=S.cats.in.reduce((a,k)=>a+(tot[k.id]||0),0),outT=S.cats.out.reduce((a,k)=>a+(tot[k.id]||0),0);
  const denom=Math.max(inT,outT),big=size>200,bal=inT-outT;
  let mainTxt,fill='var(--ink)',sub;
  if(S.cat){const v=tot[S.cat]||0;mainTxt=big?won(v):compact(v);sub=' · '+esc(cname(S.cat))}
  else if(!denom){mainTxt='–';sub=''}
  else{mainTxt=big?swon(bal):scompact(bal);fill=bal>=0?'var(--in)':'var(--out)';sub=' 남은 돈'}
  return `<svg viewBox="0 0 ${size} ${size}" role="img" aria-label="${label} 수입 ${won(inT)}, 지출 ${won(outT)}, 남은 돈 ${swon(bal)}" class="${S.cat?'dim':''}">
    ${ring(tot,S.cats.in,r1,t2,cx,denom)}${ring(tot,S.cats.out,r2,t2,cx,denom)}
    <text x="${cx}" y="${cx-(big?10:6)}" text-anchor="middle" font-size="${big?15:11}" fill="var(--muted)">${label}${sub}</text>
    <text x="${cx}" y="${cx+(big?18:12)}" text-anchor="middle" font-size="${big?22:15}" font-weight="700" fill="${fill}">${mainTxt}</text>
  </svg>`;
}
function donut(tot,label,size,thick){
  if(S.type==='all')return donutAll(tot,label,size,thick);
  const r=(size-thick)/2-2,c=2*Math.PI*r,cx=size/2,total=sum(tot);
  let segs='',off=0;
  const present=curCats().filter(k=>tot[k.id]>0);
  const gap=present.length>1?Math.min(2.5,c*0.01):0;
  if(total===0){
    segs=`<circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="var(--empty)" stroke-width="${thick}"/>`;
  }else{
    for(const k of present){
      const len=tot[k.id]/total*c,dash=Math.max(len-gap,0.6);
      segs+=`<circle class="seg${S.cat===k.id?' on':''}" data-cat="${k.id}" cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="${col(k.id)}" stroke-width="${thick}" stroke-dasharray="${dash} ${c-dash}" stroke-dashoffset="${-off}" transform="rotate(-90 ${cx} ${cx})"><title>${esc(k.name)} ${won(tot[k.id])}</title></circle>`;
      off+=len;
    }
  }
  const big=size>200, shown=S.cat?(tot[S.cat]||0):total;
  const mainTxt=total===0?'–':(big?won(shown):compact(shown));
  const sub=S.cat&&total?' · '+esc(cname(S.cat)):'';
  return `<svg viewBox="0 0 ${size} ${size}" role="img" aria-label="${label} ${TYPE_NAME[S.type]} ${total?won(total):'기록 없음'}" class="${S.cat?'dim':''}">
    ${segs}
    <text x="${cx}" y="${cx-(big?10:6)}" text-anchor="middle" font-size="${big?15:12}" fill="var(--muted)">${label}${sub}</text>
    <text x="${cx}" y="${cx+(big?18:13)}" text-anchor="middle" font-size="${big?22:16}" font-weight="700" fill="var(--ink)">${mainTxt}</text>
  </svg>`;
}

/* ---------- render ---------- */
function render(){
  rebuildMap();fixSelections();
  $('yLabel').textContent=S.year;
  const it=IDX.find(x=>x.id===S.cur);$('lgTitleH').textContent=it?it.name:'가계부';
  $('typeSeg').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.type===S.type));
  const list=yearEntries(),mt=monthTotals(list,S.type),flow=flowByMonth(list);
  const AV=avgInfo(list);
  $('avgBar').innerHTML=AV?`<span>${S.year}년 1~${AV.lastM+1}월 월평균 ${esc(AV.label)} <b>${won(AV.avg)}</b></span><span class="avg-legend">평균보다 많으면 <span class="lg-up">${ARROW(true)}</span> 적으면 <span class="lg-down">${ARROW(false)}</span></span>`:'';
  $('avgBar').hidden=!AV;

  $('emptyBox').innerHTML=list.length?'':`<div class="empty"><p>${S.year}년에 기록이 없어요. 첫 수입이나 지출을 기록하거나 예시 데이터로 둘러보세요.</p>
    <div class="row"><button class="btn-add" data-act="add">+ 기록</button><button class="btn-ghost" data-act="sample">예시 데이터 넣기</button></div></div>`;

  $('legend').innerHTML=curCats().map(k=>`<button class="chip" data-cat="${k.id}" aria-pressed="${S.cat===k.id}"><i style="background:${col(k.id)}"></i>${esc(k.name)}</button>`).join('')+
    `<button class="chip edit" data-act="cats">+ 카테고리 편집</button>`;

  $('grid12').innerHTML=mt.map((t,i)=>{
    const f=flow[i],bal=f.in-f.out,has=f.in||f.out;
    const subTxt=!has?'기록 없음':(S.type==='all'?`수입 <b class="pos">${compact(f.in)}</b> · 지출 <b class="neg">${compact(f.out)}</b><br>총 <b>${compact(f.in+f.out)}</b> · 저축률 <b class="${rateCls(rateOf(f.in,f.out))}">${rateTxt(rateOf(f.in,f.out))}</b>`:`남은 돈 <b class="${bal>=0?'pos':'neg'}">${swon(bal)}</b><br>총 <b>${compact(f.in+f.out)}</b> · 저축률 <b class="${rateCls(rateOf(f.in,f.out))}">${rateTxt(rateOf(f.in,f.out))}</b>`);
    return `<div class="mcard">${avgBadge(AV,i)}${donut(t,(i+1)+'월',180,26)}<div class="sub">${subTxt}</div><button class="mlink" data-month="${i}" data-scroll="1">캘린더 보기</button></div>`;
  }).join('');

  $('tabs').innerHTML=mt.map((t,i)=>`<button role="tab" data-month="${i}" aria-selected="${S.month===i}">${i+1}월</button>`).join('');
  const t=mt[S.month],tt=sum(t),f=flow[S.month],bal=f.in-f.out;
  const rows=curCats().filter(k=>t[k.id]>0).sort((a,b)=>(CATMAP[a.id].type===CATMAP[b.id].type?0:(CATMAP[a.id].type==='in'?-1:1))||t[b.id]-t[a.id]);
  const typeTot=ty=>ty==='in'?f.in:f.out;
  $('bigcard').innerHTML=(AV&&avgBadge(AV,S.month)?`<div class="bigbadge">${avgBadge(AV,S.month)}<span>1~${AV.lastM+1}월 평균 ${won(AV.avg)} 대비</span></div>`:'')+donut(t,(S.month+1)+'월',280,34)+
    `<div class="flow"><div><span>수입</span><b class="pos">${won(f.in)}</b></div><div><span>지출</span><b class="neg">${won(f.out)}</b></div><div><span>남은 돈</span><b>${swon(bal)}</b></div><div><span>저축률</span><b class="${rateCls(rateOf(f.in,f.out))}">${rateTxt(rateOf(f.in,f.out))}</b></div><div class="span2"><span>총 금액 (수입+지출)</span><b>${won(f.in+f.out)}</b></div></div>`+
    (tt?`<ul class="mlist">${rows.map(k=>`<li><button data-cat="${k.id}" aria-pressed="${S.cat===k.id}"><i style="background:${col(k.id)}"></i><span class="nm">${esc(k.name)}</span><span class="pc">${Math.round(t[k.id]/Math.max(1,typeTot(CATMAP[k.id].type))*100)}%</span><span class="am ${S.type==='all'?(CATMAP[k.id].type==='in'?'pos':'neg'):''}">${S.type==='all'?(CATMAP[k.id].type==='in'?'+':'-'):''}${won(t[k.id])}</span></button></li>`).join('')}</ul>`
        :`<p class="hint" style="text-align:center">${S.month+1}월 ${TYPE_NAME[S.type]} 기록이 아직 없어요.</p>`);
  const selTab=$('tabs').querySelector('[aria-selected="true"]');
  if(selTab&&selTab.scrollIntoView)selTab.scrollIntoView({block:'nearest',inline:'center'});

  renderCal(list);
  renderPanel(list,mt,flow);
  if(typeof runSearch==='function'&&$('fsdlg')&&$('fsdlg').open)runSearch();
}

function renderCal(list){
  const y=S.year,m=S.month,mm=pad(m+1),prefix=`${y}-${mm}-`;
  const days=new Date(y,m+1,0).getDate(),first=new Date(y,m,1).getDay();
  const pass=e=>e.type==='xfer'?(S.type==='all'&&!S.cat):((S.type==='all'||e.type===S.type)&&(!S.cat||e.cat===S.cat));
  const byDay=Array.from({length:days+1},()=>({in:0,out:0,items:[]}));
  for(const e of list){if(!e.date.startsWith(prefix)||!pass(e))continue;const d=+e.date.slice(8,10);if(!byDay[d])continue;if(e.type!=='xfer')byDay[d][e.type]+=e.amount;byDay[d].items.push(e)}
  const maxOut=Math.max(1,...byDay.map(d=>d.out));
  const maxGain=Math.max(1,...byDay.map(d=>d.in-d.out));
  const isThisMonth=y===now.getFullYear()&&m===now.getMonth();
  if(S.day&&S.day>days)S.day=null;
  let cells='';
  for(let i=0;i<first;i++)cells+='<div class="cd blank"></div>';
  for(let d=1;d<=days;d++){
    const b=byDay[d],dow=(first+d-1)%7,has=b.items.length;
    const gain=b.in>b.out;
    const heat=gain?Math.round(10+(b.in-b.out)/maxGain*26):(b.out?Math.round(6+b.out/maxOut*30):0);
    cells+=`<button class="cd${S.day===d?' sel':''}${isThisMonth&&now.getDate()===d?' today':''}${dow===0?' sun':dow===6?' sat':''}" data-day="${d}" ${heat?`style="--heat:${heat}%;--heatc:var(${gain?'--in':'--out'})"`:''} aria-label="${m+1}월 ${d}일${has?` 수입 ${won(b.in)} 지출 ${won(b.out)}`:' 기록 없음'}">
      <span class="dn">${d}</span>
      ${b.in?`<span class="dv pos"><span class="dvf">${won(b.in)}</span><span class="dvs">${compact(b.in)}</span></span>`:''}
      ${b.out?`<span class="dv neg"><span class="dvf">${won(b.out)}</span><span class="dvs">${compact(b.out)}</span></span>`:''}
    </button>`;
  }
  const mIn=byDay.reduce((a,b)=>a+b.in,0),mOut=byDay.reduce((a,b)=>a+b.out,0);
  const filt=(S.type==='all'?'':TYPE_NAME[S.type])+(S.cat?` · ${esc(cname(S.cat))}`:'');
  let detail='';
  if(S.day){
    const b=byDay[S.day];
    const ord={in:0,out:1,xfer:2};
    const items=b.items.slice().sort((a,c)=>a.type===c.type?c.amount-a.amount:ord[a.type]-ord[c.type]);
    detail=`<div class="dday"><div class="dday-h"><h3>${m+1}월 ${S.day}일</h3>
      <span>${b.in?`<b class="pos">+${won(b.in)}</b> `:''}${b.out?`<b class="neg">-${won(b.out)}</b>`:''}</span></div>
      ${items.length?items.map(e=>entryRow(e,false)).join('')
        :`<p class="hint" style="margin:6px 0">이 날은 기록이 없어요.</p>`}
      <button class="btn-ghost addday" data-act="addday">+ ${m+1}월 ${S.day}일에 기록</button></div>`;
  }
  $('cal').innerHTML=`<div class="cal-h">
      <button class="calnav" data-calm="-1" aria-label="이전 달">‹</button>
      <h2>${y}년 ${m+1}월 캘린더${filt?` <small>${filt}</small>`:''}</h2>
      <button class="calnav" data-calm="1" aria-label="다음 달">›</button>
      <span class="cal-sum"><span class="cs-i">수입 : <b>${won(mIn)}</b></span><span class="cs-sep" aria-hidden="true"></span><span class="cs-o">지출 : <b>${won(mOut)}</b></span>${AI_ON?`<button class="btn-rp" data-act="report">✨ ${m+1}월 리포트</button>`:''}</span>
    </div>
    <div class="cgrid">${['일','월','화','수','목','금','토'].map((w,i)=>`<div class="cw${i===0?' sun':i===6?' sat':''}">${w}</div>`).join('')}${cells}</div>
    ${detail||'<p class="hint">날짜를 누르면 그날 내역이 나오고, 내역을 누르면 수정할 수 있어요.</p>'}`;
}

function avgInfo(list){
  const cy=now.getFullYear();
  const lastM=S.month;
  const k=S.cat&&CATMAP[S.cat]?CATMAP[S.cat]:null;
  const isIn=k?k.type==='in':false;
  const vals=Array(12).fill(0);
  for(const e of list){
    const ok=k?e.cat===k.id:e.type==='out';
    if(ok)vals[+e.date.slice(5,7)-1]+=e.amount;
  }
  const used=vals.slice(0,lastM+1).filter(v=>v>0);
  if(!used.length)return null;
  const avg=Math.round(used.reduce((a,b)=>a+b,0)/used.length);
  return {avg,lastM,vals,isIn,label:k?`${k.name}`:'지출'};
}
const ARROW=up=>`<svg class="arr" viewBox="0 0 12 12" aria-hidden="true"><path d="${up?'M6 10V2.5M2.5 6L6 2.5 9.5 6':'M6 2v7.5M2.5 6L6 9.5 9.5 6'}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
function avgBadge(AV,i){
  if(!AV||i>AV.lastM||!AV.vals[i])return '';
  const d=Math.round((AV.vals[i]-AV.avg)/AV.avg*100);
  if(d===0)return `<span class="abadge eq" title="평균과 같아요">평균</span>`;
  const up=d>0;
  return `<span class="abadge ${up?'good':'bad'}" title="평균 대비 ${up?'+':''}${d}%">${ARROW(up)}${Math.abs(d)}%</span>`;
}
function rateChart(flow){
  const rs=flow.map(f=>rateOf(f.in,f.out));
  if(rs.every(r=>r===null))return '';
  const W=300,H=120,top=14,bot=18,mid=top+(H-top-bot)/2,half=(H-top-bot)/2,step=W/12,bw=14;
  let g=`<line x1="0" x2="${W}" y1="${mid}" y2="${mid}" stroke="var(--line)"/>`;
  rs.forEach((r,i)=>{
    const x=i*step+(step-bw)/2,cur=i===S.month;
    if(r!==null){const v=Math.max(-100,Math.min(100,r)),h=Math.max(2,Math.abs(v)/100*half);
      g+=`<rect x="${x}" y="${v>=0?mid-h:mid}" width="${bw}" height="${h}" rx="3" fill="${v>=0?'var(--in)':'var(--out)'}" opacity="${cur?1:.6}"><title>${i+1}월 저축률 ${rateTxt(r)}</title></rect>`;}
    g+=`<text x="${x+bw/2}" y="${H-4}" text-anchor="middle" font-size="10" fill="var(--muted)" font-weight="${cur?700:400}">${i+1}</text>`;
  });
  g+=`<text x="0" y="10" font-size="10" fill="var(--muted)">+100%</text><text x="0" y="${H-bot-2}" font-size="10" fill="var(--muted)">-100%</text>`;
  return `<p class="sec-title">월별 저축률</p><svg class="bars" viewBox="0 0 ${W} ${H}" role="img" aria-label="월별 저축률">${g}</svg>`;
}
function renderPanel(list,mt,flow){
  const P=$('panel');
  if(!S.cat){
    const yin=flow.reduce((a,f)=>a+f.in,0),yout=flow.reduce((a,f)=>a+f.out,0),bal=yin-yout;
    const ct=Object.fromEntries(curCats().map(k=>[k.id,mt.reduce((a,m)=>a+m[k.id],0)]));
    const types=S.type==='all'?['in','out']:[S.type];
    const section=ty=>{const cs=S.cats[ty],max=Math.max(1,...cs.map(k=>ct[k.id]||0));
      return `<p class="sec-title">${TYPE_NAME[ty]} 카테고리별</p><ul class="cat-rows" style="margin-bottom:14px">${cs.map(k=>`<li><button data-cat="${k.id}">
        <div class="r1"><i style="background:${col(k.id)}"></i><span class="nm">${esc(k.name)}</span><span class="am">${won(ct[k.id]||0)}</span></div>
        <div class="track"><b style="width:${(ct[k.id]||0)/max*100}%;background:${col(k.id)}"></b></div></button></li>`).join('')}</ul>`};
    const cb=currentBalance({entries:S.entries,settings:S.settings});
    let xo=0,xi=0;for(const e of list)if(e.type==='xfer'){if(e.dir==='out')xo+=e.amount;else xi+=e.amount}
    const hasCredit=S.entries.some(e=>e.pay==='credit');
    P.innerHTML=`${cb!==null?`<div class="balbox"><span>현재 잔액 (오늘 기준)</span><b>${swon(cb)}</b></div>`:''}
      <div class="p-head"><h2>${S.year}년 전체</h2></div>
      <dl class="ysum"><dt>수입</dt><dd class="pos">${won(yin)}</dd><dt>지출</dt><dd class="neg">${won(yout)}</dd>
        <dt>총 금액 (수입+지출)</dt><dd>${won(yin+yout)}</dd>
        <dt class="bal">남은 돈</dt><dd class="bal">${swon(bal)}</dd>
        <dt>수입 대비 저축률</dt><dd class="${rateCls(rateOf(yin,yout))}">${rateTxt(rateOf(yin,yout))}</dd>
        ${xo||xi?`<dt>이체 보냄 / 받음</dt><dd class="xf">${won(xo)} / ${won(xi)}</dd>`:''}</dl>
      ${hasCredit?`<p class="p-note">신용카드는 ${S.settings.basis==='pay'?'결제일':'사용일'} 기준으로 계산 중이에요. 설정에서 바꿀 수 있어요.</p>`:''}
      ${budgetBlock(list)}
      ${rateChart(flow)}
      <p class="p-note">카테고리를 누르면 1~12월 내역이 나와요.</p>
      ${types.map(section).join('')}
      ${S.type!=='in'?payBlock():''}
      ${fixedLine()}`;
    return;
  }
  const vals=mt.map(m=>m[S.cat]||0),catTot=vals.reduce((a,b)=>a+b,0);
  const active=vals.filter(v=>v>0),avg=active.length?Math.round(catTot/active.length):0;
  const W=300,H=110,bw=16,step=W/12,max=Math.max(1,...vals);
  let bars='';
  vals.forEach((v,i)=>{
    const h=v?Math.max(3,v/max*(H-30)):0,x=i*step+(step-bw)/2,y=H-18-h,cur=i===S.month;
    bars+=`<rect x="${x}" y="${y}" width="${bw}" height="${h}" rx="3" fill="${col(S.cat)}" opacity="${cur?1:.55}"><title>${i+1}월 ${won(v)}</title></rect>
      <text x="${x+bw/2}" y="${H-4}" text-anchor="middle" font-size="10" fill="var(--muted)" font-weight="${cur?700:400}">${i+1}</text>`;
  });
  const byMonth=Array.from({length:12},()=>[]);
  list.filter(e=>e.cat===S.cat).sort((a,b)=>a.date<b.date?-1:1).forEach(e=>byMonth[+e.date.slice(5,7)-1].push(e));
  const nm=esc(cname(S.cat));
  P.innerHTML=`<button class="p-back" data-act="all">‹ 전체 보기</button>
    <div class="p-head"><span class="dot" style="background:${col(S.cat)}"></span><h2>${nm}</h2></div>
    <div class="p-total ${CATMAP[S.cat].type==='in'?'pos':''}">${won(catTot)}</div>
    <p class="p-note">${S.year}년 ${TYPE_NAME[CATMAP[S.cat].type]} 합계${avg?` · 기록된 달 평균 ${won(avg)}`:''}</p>
    <svg class="bars" viewBox="0 0 ${W} ${H}" role="img" aria-label="${nm} 월별 금액">${bars}</svg>
    ${byMonth.map((arr,i)=>{
      const st=arr.reduce((a,e)=>a+e.amount,0);
      return `<div class="month-group${arr.length?'':' none'}${i===S.month?' cur':''}"><h3><span>${i+1}월</span><span>${arr.length?won(st):'내역 없음'}</span></h3>
        ${arr.map(e=>entryRow(e,true)).join('')}
      </div>`;}).join('')}`;
}

/* ---------- two-tap confirm ---------- */
function arm(btn,label,orig,fn){
  if(btn.classList.contains('arm')){fn();return}
  btn.classList.add('arm');btn.textContent=label;
  setTimeout(()=>{if(btn.isConnected){btn.classList.remove('arm');btn.textContent=orig}},3500);
}

/* ---------- interactions ---------- */
function selectCat(id){S.cat=(S.cat===id)?null:id;render();
  if(window.matchMedia('(max-width:820px)').matches&&S.cat)$('panel').scrollIntoView({behavior:'smooth',block:'start'})}
document.addEventListener('click',e=>{
  if(e.target.closest('dialog'))return;
  const op=e.target.closest('[data-open]');
  if(op){openLedger(op.dataset.open);return}
  const lr=e.target.closest('[data-lren]');
  if(lr){openLgDialog(lr.dataset.lren);return}
  const ld=e.target.closest('[data-ldel]');
  if(ld){const L=LEDGERS[ld.dataset.ldel];const n=L?L.entries.length:0;
    arm(ld,n?`삭제 · 기록 ${n}건도 지워져요`:'정말 삭제','삭제',()=>deleteLedger(ld.dataset.ldel));return}
  const del=e.target.closest('[data-del]');
  if(del){arm(del,'삭제','✕',()=>deleteEntry(del.dataset.del));return}
  const ed=e.target.closest('[data-edit]');
  if(ed){openEdit(ed.dataset.edit);return}
  const ty=e.target.closest('[data-type]');
  if(ty){S.type=ty.dataset.type;S.cat=null;render();return}
  const c=e.target.closest('[data-cat]');
  if(c){selectCat(c.dataset.cat);return}
  const m=e.target.closest('[data-month]');
  if(m){S.month=+m.dataset.month;S.day=null;render();if(m.dataset.scroll)$('cal').scrollIntoView({behavior:'smooth',block:'start'});return}
  const cm=e.target.closest('[data-calm]');
  if(cm){let nm=S.month+ +cm.dataset.calm;if(nm<0){nm=11;S.year--}if(nm>11){nm=0;S.year++}S.month=nm;S.day=null;render();return}
  const dy=e.target.closest('[data-day]');
  if(dy){const d=+dy.dataset.day;S.day=S.day===d?null:d;render();return}
  const a=e.target.closest('[data-act]');
  if(a){
    const act=a.dataset.act;
    if(act==='all'){S.cat=null;render()}
    if(act==='add')openAdd();
    if(act==='addday')openAdd(`${S.year}-${pad(S.month+1)}-${pad(S.day)}`);
    if(act==='sample')addSample();
    if(act==='cats')openCats();
    if(act==='home')goHome();
    if(act==='newlg')openLgDialog(null);
    if(act==='settings')openSettings();
    if(act==='export')exportXlsx();
    if(act==='import')openImport();
    if(act==='search')openSearch();
    if(act==='fixed')openFixed();
    if(act==='theme')toggleTheme();
    if(act==='logout')logout();
    if(act==='delacct')arm(a,'한 번 더 누르면 계정과 모든 가계부가 영구 삭제돼요','계정과 모든 데이터 삭제',deleteAccount);
    if(act==='combined')openCombined();
    if(act==='report')openReport();
    if(act==='backup')backupXlsx();
    if(act==='restore')$('restoreFile').click();
    if(act==='undo')undo();
  }
});
document.addEventListener('click',e=>{
  const tb=e.target.closest('#toolBtn'),m=$('toolMenu');
  if(tb){const open=m.hidden;m.hidden=!open;$('menuBack').hidden=!open;tb.setAttribute('aria-expanded',String(open));return}
  if(!m.hidden){m.hidden=true;$('menuBack').hidden=true;$('toolBtn').setAttribute('aria-expanded','false')}
},true);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('toolMenu').hidden){$('toolMenu').hidden=true;$('menuBack').hidden=true;$('toolBtn').setAttribute('aria-expanded','false')}});
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.matches&&e.target.matches('[data-edit]')){openEdit(e.target.dataset.edit)}});
$('yPrev').onclick=()=>{S.year--;S.day=null;render()};
$('yNext').onclick=()=>{S.year++;S.day=null;render()};

/* ---------- entry dialog (추가·수정) ---------- */
const dlg=$('dlg');
function toast(t,withUndo){const n=$('toast');n.innerHTML='';const sp=document.createElement('span');sp.textContent=t;n.appendChild(sp);
  if(withUndo&&UNDO.length){const b=document.createElement('button');b.className='tbtn';b.textContent='되돌리기';b.onclick=()=>{n.classList.remove('show');undo()};n.appendChild(b)}
  n.classList.add('show');clearTimeout(toast._t);toast._t=setTimeout(()=>n.classList.remove('show'),withUndo?6000:2600)}
/* ---------- 되돌리기 ---------- */
const UNDO=[];
function checkpoint(label){
  syncCur();
  const snap={};for(const [k,L] of Object.entries(LEDGERS))snap[k]={entries:L.entries,cats:L.cats,settings:L.settings};
  UNDO.push({label,snap:JSON.stringify(snap)});if(UNDO.length>15)UNDO.shift();
}
function undo(){
  const u=UNDO.pop();if(!u){toast('되돌릴 작업이 없어요');return}
  const d=JSON.parse(u.snap);
  for(const k in d){if(!LEDGERS[k])continue;const L=LEDGERS[k];L.entries=d[k].entries;L.cats=d[k].cats;L.settings={...DEFAULT_SETTINGS,...d[k].settings}}
  if(S.cur&&LEDGERS[S.cur]){S.entries=LEDGERS[S.cur].entries;S.cats=LEDGERS[S.cur].cats;S.settings=LEDGERS[S.cur].settings}
  saveLocal();for(const k in d)if(LEDGERS[k])writeLedger(k);
  if(S.cur)render();else renderHome();
  toast(`'${u.label}'을(를) 되돌렸어요`);
}
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&!e.shiftKey&&e.key.toLowerCase()==='z'&&!e.target.closest('input,textarea,select')&&S.cur&&!document.querySelector('dialog[open]')){e.preventDefault();undo()}});
function renderPick(){
  const ft=S.fType,isX=ft==='xfer';
  $('fType').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.ftype===ft));
  $('fCatField').hidden=isX;$('fXferField').hidden=!isX;$('fPayField').hidden=ft!=='out';
  if(!isX){
    const cats=S.cats[ft];
    if(!cats.some(k=>k.id===S.pickCat))S.pickCat=cats[0].id;
    $('fCats').innerHTML=cats.map(k=>`<button type="button" role="radio" aria-checked="${S.pickCat===k.id}" data-pick="${k.id}"><i style="background:${col(k.id)}"></i>${esc(k.name)}</button>`).join('');
  }
  $('fDir').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.fdir===S.fDir));
  $('fPay').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.fpay===S.fPay));
  $('fInstWrap').hidden=S.fPay!=='credit';
  $('fMemo').placeholder=isX?'예: 적금 자동이체':(ft==='in'?'예: 9월 월급':'예: 전기요금');
  $('fRepeatWrap').hidden=!!S.editId;
}
function fillPeer(sel){
  $('fPeer').innerHTML=IDX.filter(x=>x.id!==S.cur).map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('')+'<option value="">외부 계좌 (적금·투자 등)</option>';
  $('fPeer').value=sel||'';
}
(function(){let o='<option value="1">일시불</option>';for(let i=2;i<=24;i++)o+=`<option value="${i}">${i}개월</option>`;$('fInst').innerHTML=o;
  let d='';for(let i=1;i<=28;i++)d+=`<option value="${i}">매월 ${i}일</option>`;$('sCardDay').innerHTML=d;})();
$('fType').addEventListener('click',e=>{const b=e.target.closest('[data-ftype]');if(b){S.fType=b.dataset.ftype;renderPick()}});
$('fCats').addEventListener('click',e=>{const b=e.target.closest('[data-pick]');if(b){S.pickCat=b.dataset.pick;renderPick()}});
$('fDir').addEventListener('click',e=>{const b=e.target.closest('[data-fdir]');if(b){S.fDir=b.dataset.fdir;renderPick()}});
$('fPay').addEventListener('click',e=>{const b=e.target.closest('[data-fpay]');if(b){S.fPay=b.dataset.fpay;renderPick()}});
function showDlg(){dlg.showModal?dlg.showModal():dlg.setAttribute('open','');setTimeout(()=>$('fAmt').focus(),50)}
function openAdd(dateStr){
  S.editId=null;$('fTitle').textContent='기록 추가';$('fDelete').hidden=true;
  const y=S.year,m=S.month,isNow=y===now.getFullYear()&&m===now.getMonth();
  $('fDate').value=typeof dateStr==='string'?dateStr:`${y}-${pad(m+1)}-${pad(isNow?now.getDate():1)}`;
  S.fType=S.type==='all'?(S.cat&&CATMAP[S.cat]?CATMAP[S.cat].type:'out'):S.type;
  if(S.cat)S.pickCat=S.cat;
  S.fPay='cash';S.fDir='out';$('fInst').value='1';fillPeer('');
  $('fAmt').value='';$('fMemo').value='';$('fRepeat').checked=false;$('fErr').textContent='';
  renderPick();showDlg();
}
function openEdit(id){
  const e=S.entries.find(x=>x.id===id);if(!e)return;
  S.editId=id;$('fTitle').textContent='기록 수정';$('fDelete').hidden=false;
  $('fDelete').classList.remove('arm');$('fDelete').textContent='삭제';
  S.fType=e.type;$('fDate').value=e.date;$('fAmt').value=e.amount;$('fMemo').value=e.memo||'';
  if(e.type!=='xfer')S.pickCat=e.cat;
  S.fPay=e.pay||'cash';$('fInst').value=String(e.inst||1);
  S.fDir=e.dir||'out';fillPeer(e.peer||'');
  $('fRepeat').checked=false;$('fErr').textContent='';
  renderPick();showDlg();
}
function removeMirror(e){
  if(e&&e.type==='xfer'&&e.peer&&LEDGERS[e.peer]&&e.xid){
    const L=LEDGERS[e.peer];L.entries=L.entries.filter(x=>x.xid!==e.xid);writeLedger(e.peer);saveLocal();
  }
}
function addMirror(e,fromId){
  const from=fromId||S.cur;
  if(e.type==='xfer'&&e.peer&&LEDGERS[e.peer]&&e.peer!==from){
    const L=LEDGERS[e.peer];
    L.entries.push({id:('m'+e.xid).slice(0,64),type:'xfer',dir:e.dir==='out'?'in':'out',peer:from,date:e.date,amount:e.amount,memo:e.memo,xid:e.xid});
    writeLedger(e.peer);saveLocal();
  }
}
function deleteEntry(id){
  const e=S.entries.find(x=>x.id===id);if(!e)return;
  checkpoint('삭제');
  removeMirror(e);
  S.entries=S.entries.filter(x=>x.id!==id);persist();render();toast('삭제했어요',true);
}
$('fDelete').onclick=()=>arm($('fDelete'),'한 번 더 누르면 삭제','삭제',()=>{const id=S.editId;dlg.close();deleteEntry(id)});
$('fCancel').onclick=()=>dlg.close();
$('form').addEventListener('submit',e=>{
  e.preventDefault();
  const date=$('fDate').value,amt=Math.round(Number($('fAmt').value));
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)){$('fErr').textContent='날짜를 입력해 주세요.';return}
  if(!amt||amt<=0){$('fErr').textContent='금액을 1원 이상으로 입력해 주세요.';return}
  const memo=$('fMemo').value.trim(),ft=S.fType;
  const build=d=>{
    const o={type:ft,date:d,amount:amt,memo};
    if(ft==='xfer'){o.dir=S.fDir;o.peer=$('fPeer').value||'';}
    else o.cat=S.pickCat;
    if(ft==='out'){o.pay=S.fPay;if(S.fPay==='credit'){const n=+$('fInst').value;if(n>1)o.inst=n}}
    return o;
  };
  const [y,mo,d]=date.split('-').map(Number);
  checkpoint(S.editId?'수정':'추가');
  if(S.editId){
    const idx=S.entries.findIndex(x=>x.id===S.editId);
    if(idx<0){dlg.close();return}
    const old=S.entries[idx];
    removeMirror(old);
    const ne={id:old.id,...build(date)};
    if(ft==='xfer')ne.xid=old.xid||uid();
    S.entries[idx]=ne;
    addMirror(ne);
    toast('수정했어요',true);
  }else{
    const ne={id:uid(),...build(date)};
    if(ft==='xfer')ne.xid=uid();
    if($('fRepeat').checked){
      const fx={id:'f'+uid(),...build(date),day:d,start:date.slice(0,7),last:date.slice(0,7)};delete fx.date;
      S.settings.fixed=[...(S.settings.fixed||[]),fx];ne.fid=fx.id;
    }
    S.entries.push(ne);addMirror(ne);
    if($('fRepeat').checked)runFixedFor(S.cur);
    toast($('fRepeat').checked?'추가하고 고정으로 등록했어요':'추가했어요',true);
  }
  S.year=y;S.month=mo-1;S.day=d;if(S.type!=='all'&&ft!=='xfer')S.type=ft;
  dlg.close();persist();render();
});

/* ---------- 가계부 설정 ---------- */
const sdlg=$('sdlg');let sBasis='use';
function basisNote(){$('sBasisNote').textContent=sBasis==='use'
  ?'카드를 긁은 날짜에 전액을 지출로 잡아요. 소비 습관을 보기 좋아요.'
  :'다음 달 결제일에 지출로 잡고, 할부는 개월 수만큼 나눠서 잡아요. 통장에서 실제로 돈이 나가는 흐름과 같아요.';
  $('sBasis').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.basis===sBasis))}
function openSettings(){
  const st=S.settings;
  $('sOpen').value=st.openBal===null||st.openBal===undefined?'':st.openBal;
  $('sOpenDate').value=st.openDate||`${now.getFullYear()}-01-01`;
  $('sCardDay').value=String(st.cardDay||14);
  sBasis=st.basis||'use';basisNote();
  sdlg.showModal?sdlg.showModal():sdlg.setAttribute('open','');
}
$('sBasis').addEventListener('click',e=>{const b=e.target.closest('[data-basis]');if(b){sBasis=b.dataset.basis;basisNote()}});
$('sCancel').onclick=()=>sdlg.close();
$('sForm').addEventListener('submit',e=>{
  e.preventDefault();
  const v=$('sOpen').value.trim();
  S.settings.openBal=v===''?null:Math.round(Number(v));
  S.settings.openDate=$('sOpenDate').value||'';
  S.settings.cardDay=+$('sCardDay').value||14;
  S.settings.basis=sBasis;
  sdlg.close();persist();render();toast('설정을 저장했어요');
});

/* ---------- 가져오기 ---------- */
const idlg=$('idlg');
const IM={rows:[],hdr:0,map:{},sign:'out',pay:'cash',skipCancel:true,items:[],wb:null,sheet:'',fname:''};
const ROLES=[
  ['date','날짜',true],['memo','내용',true],['amount','금액',false],['out','출금액',false],['in','입금액',false],
  ['kind','입출금 구분',false],['cat','카테고리',false],['inst','할부',false]];
const KW={
  date:['거래일시','거래일자','이용일시','이용일자','승인일시','승인일자','사용일자','사용일','거래일','이용일','매출일','일자','날짜','일시','date'],
  memo:['가맹점명','가맹점','이용하신곳','이용처','사용처','기재내용','거래내용','거래처','받는분','보낸분','상호','통장표시','내용','적요','description','memo','메모','비고'],
  out:['출금액','출금금액','찾으신금액','출금','인출','지출액','지출','withdrawal'],
  in:['입금액','입금금액','맡기신금액','입금','수입액','수입','deposit'],
  amount:['이용금액','승인금액','결제금액','거래금액','사용금액','청구금액','금액','amount','원금'],
  kind:['입출금구분','거래구분','승인구분','구분','유형','종류','type'],
  cat:['카테고리','분류','category','항목','업종'],
  inst:['할부개월','할부기간','할부','개월']
};
const CAT_KW={
  out:{
    '식비':['점심','저녁','아침','밥','간식','야식','회식','술','맥주','스타벅스','카페','커피','배달의민족','배민','요기요','쿠팡이츠','편의점','gs25','cu','세븐일레븐','이마트24','미니스톱','마트','이마트','홈플러스','롯데마트','코스트코','식당','치킨','피자','버거','맥도날드','롯데리아','버거킹','베이커리','파리바게뜨','뚜레쥬르','김밥','투썸','이디야','메가커피','메가mgc','컴포즈','빽다방','할리스','음식','푸드','분식','국밥','반찬','정육','하나로','마켓컬리','컬리'],
    '공과금':['한국전력','한전','전기요금','도시가스','가스','수도','관리비','skt','sk텔레콤','kt','lg유플러스','lgu+','통신','휴대폰','인터넷','아파트','보험료'],
    '교통':['택시','카카오t','카카오모빌리티','버스','지하철','교통','티머니','코레일','ktx','srt','주유','gs칼텍스','sk에너지','s-oil','에쓰오일','현대오일','오일뱅크','주차','하이패스','톨게이트','쏘카','타다'],
    '의류':['무신사','유니클로','자라','zara','h&m','나이키','아디다스','의류','스파오','탑텐','29cm','w컨셉','에이블리','지그재그','뉴발란스'],
    '화장품':['올리브영','화장품','시코르','아모레','이니스프리','뷰티','세포라','롭스','닥터자르트']
  },
  in:{'월급':['급여','월급','상여','보너스','salary'],'용돈':['용돈'],'부수입':['당근','중고','외주','부업'],'기타수입':['이자','환급','캐시백','환불']}
};
const norm=v=>String(v==null?'':v).replace(/\s+/g,'').toLowerCase();
function parseNum(v){
  if(typeof v==='number')return isFinite(v)?v:null;
  let t=String(v==null?'':v).trim();if(!t||t==='-')return null;
  let neg=false;if(/^\(.*\)$/.test(t)){neg=true;t=t.slice(1,-1)}
  t=t.replace(/[,원₩\s]/g,'').replace(/^\+/,'');
  if(/^-/.test(t)){neg=!neg;t=t.slice(1)}
  if(!/^\d+(\.\d+)?$/.test(t))return null;
  const n=parseFloat(t);return neg?-n:n;
}
function parseDate(v){
  let y,m,d;
  if(typeof v==='number'&&v>20000&&v<80000){const dt=new Date(Math.round((v-25569)*864e5));y=dt.getUTCFullYear();m=dt.getUTCMonth()+1;d=dt.getUTCDate()}
  else if(v instanceof Date&&!isNaN(v)){y=v.getFullYear();m=v.getMonth()+1;d=v.getDate()}
  else{
    const t=String(v==null?'':v).trim();if(!t)return null;let r;
    if((r=t.match(/(\d{4})\s*[-./년]\s*(\d{1,2})\s*[-./월]\s*(\d{1,2})/)))[y,m,d]=[+r[1],+r[2],+r[3]];
    else if((r=t.match(/^(\d{4})(\d{2})(\d{2})/)))[y,m,d]=[+r[1],+r[2],+r[3]];
    else if((r=t.match(/^(\d{2})[-./](\d{1,2})[-./](\d{1,2})/)))[y,m,d]=[2000+ +r[1],+r[2],+r[3]];
    else if((r=t.match(/^(\d{1,2})\s*[-./월]\s*(\d{1,2})/)))[y,m,d]=[S.year,+r[1],+r[2]];
    else return null;
  }
  if(!(y>1990&&y<2100&&m>=1&&m<=12&&d>=1&&d<=31))return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}
function detectHeader(rows){
  let best=-1,bi=0;
  const all=Object.values(KW).flat();
  for(let i=0;i<Math.min(rows.length,30);i++){
    const sc=rows[i].filter(c=>{const n=norm(c);return n&&n.length<20&&all.some(k=>n.includes(k))}).length;
    if(sc>best){best=sc;bi=i}
  }
  return best>=2?bi:-1;
}
function autoMap(){
  const map={};ROLES.forEach(r=>map[r[0]]=-1);
  const ncol=Math.max(0,...IM.rows.slice(0,50).map(r=>r.length));
  const used=new Set();
  if(IM.hdr>=0){
    const h=(IM.rows[IM.hdr]||[]).map(norm);
    for(const role of ['date','out','in','amount','memo','kind','cat','inst']){
      outer:for(const k of KW[role]){
        for(let c=0;c<h.length;c++){if(used.has(c)||!h[c])continue;if(h[c]===k){map[role]=c;used.add(c);break outer}}
        for(let c=0;c<h.length;c++){if(used.has(c)||!h[c])continue;if(h[c].includes(k)){map[role]=c;used.add(c);break outer}}
      }
    }
    if((map.out>=0)!==(map.in>=0)&&map.amount<0){const c=map.out>=0?map.out:map.in;map.amount=c;map.out=-1;map.in=-1}
  }
  const body=IM.rows.slice(IM.hdr+1,IM.hdr+41);
  const score=(c,fn)=>body.filter(r=>fn(r[c])).length;
  if(map.date<0){let b=0;for(let c=0;c<ncol;c++){if(used.has(c))continue;const s=score(c,v=>parseDate(v));if(s>b){b=s;map.date=c}}if(map.date>=0)used.add(map.date)}
  if(map.amount<0&&map.out<0&&map.in<0){let b=0;for(let c=0;c<ncol;c++){if(used.has(c))continue;const s=score(c,v=>{const n=parseNum(v);return n!==null&&Math.abs(n)>=100&&!parseDate(v)});if(s>b){b=s;map.amount=c}}if(map.amount>=0)used.add(map.amount)}
  if(map.memo<0){let b=0;for(let c=0;c<ncol;c++){if(used.has(c))continue;const s=score(c,v=>{const t=String(v==null?'':v).trim();return t&&parseNum(t)===null&&!parseDate(t)});if(s>b){b=s;map.memo=c}}}
  IM.map=map;
}
function findCat(type,name){return S.cats[type].find(c=>c.name===name)}
function fallbackCat(type){const cs=S.cats[type];return (findCat(type,type==='in'?'기타수입':'기타')||cs[cs.length-1]).id}
function suggestCat(type,memo,catTxt){
  if(catTxt){const n=norm(catTxt);const c=S.cats[type].find(k=>norm(k.name)===n)||S.cats[type].find(k=>n.includes(norm(k.name))||norm(k.name).includes(n));if(c)return c.id}
  const m=norm(memo),rules=(S.settings.rules||{});
  if(m){
    if(rules[type+'|'+m]&&CATMAP[rules[type+'|'+m]])return rules[type+'|'+m];
    for(const k in rules){const i=k.indexOf('|'),t=k.slice(0,i),key=k.slice(i+1);if(t===type&&key&&m.includes(key)&&CATMAP[rules[k]])return rules[k]}
    for(const [nm,kws] of Object.entries(CAT_KW[type]||{})){const c=findCat(type,nm);if(c&&kws.some(w=>m.includes(w)))return c.id}
  }
  return fallbackCat(type);
}
function buildItems(){
  const M=IM.map,rows=IM.rows.slice(IM.hdr+1),items=[];
  const exist=new Set(S.entries.map(e=>`${e.date}|${e.type}|${e.amount}|${norm(e.memo)}`));
  const get=(r,c)=>c>=0?r[c]:'';
  rows.forEach((r,ri)=>{
    const date=parseDate(get(r,M.date));if(!date)return;
    let type,amt,cancel=false;
    const kind=norm(get(r,M.kind));
    if(M.out>=0||M.in>=0){
      const o=parseNum(get(r,M.out))||0,i=parseNum(get(r,M.in))||0;
      if(o>0){type='out';amt=o}else if(i>0){type='in';amt=i}else if(o<0){type='in';amt=-o}else if(i<0){type='out';amt=-i}else return;
    }else if(M.amount>=0){
      const v=parseNum(get(r,M.amount));if(v===null||v===0)return;
      amt=Math.abs(v);
      if(kind==='이체')return;
      if(/취소|환불|반품/.test(kind))cancel=true;
      if(/입금|수입|환급|받음|deposit/.test(kind))type='in';
      else if(/출금|지출|결제|승인|사용|보냄|이체|withdraw/.test(kind))type='out';
      else if(IM.sign==='out'){type='out';if(v<0)cancel=true}
      else type=v<0?'out':'in';
    }else return;
    amt=Math.round(amt);
    const memo=String(get(r,M.memo)??'').trim().slice(0,40);
    let inst=0;if(M.inst>=0){const n=parseInt(String(get(r,M.inst)).replace(/[^\d]/g,''),10);if(n>1&&n<=60)inst=n}
    const dup=exist.has(`${date}|${type}|${amt}|${norm(memo)}`);
    items.push({ri,date,type,amount:amt,memo,inst,cancel,dup,cat:suggestCat(type,memo,get(r,M.cat)),manual:false,include:!dup&&!(cancel&&IM.skipCancel)});
  });
  IM.items=items;
}
function colName(c){const h=IM.hdr>=0?String((IM.rows[IM.hdr]||[])[c]??'').trim():'';let L='',n=c;do{L=String.fromCharCode(65+n%26)+L;n=Math.floor(n/26)-1}while(n>=0);return h?`${h} (${L}열)`:`${L}열`}
function renderImport(){
  const ncol=Math.max(0,...IM.rows.slice(0,80).map(r=>r.length));
  const sheets=IM.wb?IM.wb.SheetNames:[];
  $('imFileInfo').innerHTML=`<b>${esc(IM.fname)}</b>${sheets.length>1?`<label>시트 <select class="inp" id="imSheet">${sheets.map(n=>`<option ${n===IM.sheet?'selected':''}>${esc(n)}</option>`).join('')}</select></label>`:''}
    <label>머리글 행 <select class="inp" id="imHdr"><option value="-1" ${IM.hdr<0?'selected':''}>없음</option>${IM.rows.slice(0,30).map((r,i)=>`<option value="${i}" ${IM.hdr===i?'selected':''}>${i+1}행: ${esc(r.filter(x=>String(x).trim()).slice(0,3).join(', ').slice(0,30))}</option>`).join('')}</select></label>
    <button type="button" class="btn-ghost" id="imAgain" style="padding:5px 10px;font-size:13px">다른 파일</button>`;
  const opts=c=>`<option value="-1">(없음)</option>`+Array.from({length:ncol},(_,i)=>`<option value="${i}" ${c===i?'selected':''}>${esc(colName(i))}</option>`).join('');
  $('imMap').innerHTML=ROLES.map(([k,label,req])=>`<div class="${req?'req':''}"><label for="im_${k}">${label}</label><select class="inp" id="im_${k}" data-role="${k}">${opts(IM.map[k])}</select></div>`).join('');
  const segB=(attr,cur,list)=>`<div class="seg2">${list.map(([v,t])=>`<button type="button" ${attr}="${v}" aria-pressed="${cur===v}">${t}</button>`).join('')}</div>`;
  const singleAmt=IM.map.amount>=0&&IM.map.out<0&&IM.map.in<0;
  $('imOpts').innerHTML=(singleAmt?`<div class="row"><span>금액이 한 열일 때</span>${segB('data-imsign',IM.sign,[['out','모두 지출 (카드 명세서)'],['bank','+는 수입, −는 지출']])}</div>`:'')+
    `<div class="row"><span>지출 결제수단</span>${segB('data-impay',IM.pay,[['cash','현금·계좌'],['debit','체크카드'],['credit','신용카드']])}</div>
     <label class="chk"><input type="checkbox" id="imSkipC" ${IM.skipCancel?'checked':''}> <span>취소·환불 내역은 빼고 가져오기</span></label>`;
  renderImTable();
}
function catOpts(type,sel){return S.cats[type].map(k=>`<option value="${k.id}" ${k.id===sel?'selected':''}>${esc(k.name)}</option>`).join('')}
function renderImTable(){
  const it=IM.items,on=it.filter(x=>x.include);
  const so=on.filter(x=>x.type==='out').reduce((a,x)=>a+x.amount,0),si=on.filter(x=>x.type==='in').reduce((a,x)=>a+x.amount,0);
  const nd=it.filter(x=>x.dup).length,nc=it.filter(x=>x.cancel).length;
  const miss=IM.map.date<0||(IM.map.amount<0&&IM.map.out<0&&IM.map.in<0);
  $('imSum').innerHTML=miss?`<span class="neg">날짜와 금액(또는 출금·입금) 열을 골라주세요.</span>`:
    `<span>읽은 내역 <b>${it.length}건</b></span><span>가져올 내역 <b>${on.length}건</b></span><span class="neg">지출 ${won(so)}</span><span class="pos">수입 ${won(si)}</span>${nd?`<span>이미 있는 내역 ${nd}건</span>`:''}${nc?`<span>취소·환불 ${nc}건</span>`:''}
     <button type="button" class="lnk" data-imall="1">전체 선택</button><button type="button" class="lnk" data-imall="0">전체 해제</button>`;
  $('imTable').innerHTML=`<thead><tr><th></th><th>날짜</th><th>구분</th><th>카테고리</th><th>내용</th><th style="text-align:right">금액</th><th>상태</th></tr></thead><tbody>${
    it.map((x,i)=>`<tr class="${x.include?'':'off'}"><td><input type="checkbox" data-iinc="${i}" ${x.include?'checked':''} aria-label="가져오기 선택"></td>
      <td>${x.date}</td>
      <td><select data-itype="${i}"><option value="out" ${x.type==='out'?'selected':''}>지출</option><option value="in" ${x.type==='in'?'selected':''}>수입</option></select></td>
      <td><select data-icat="${i}">${catOpts(x.type,x.cat)}</select></td>
      <td class="memo" title="${esc(x.memo)}">${esc(x.memo)||'<span style="color:var(--muted)">(내용 없음)</span>'}</td>
      <td class="am ${x.type==='in'?'pos':'neg'}">${won(x.amount)}${x.inst?` <span class="st">${x.inst}개월</span>`:''}</td>
      <td>${x.dup?'<span class="st dup">이미 있음</span>':''}${x.cancel?'<span class="st cc">취소·환불</span>':''}</td></tr>`).join('')}</tbody>`;
  $('imGo').disabled=miss||!on.length;
  $('imGo').textContent=on.length?`${on.length}건 가져오기`:'가져오기';
}
function loadRows(rows,fname,wb,sheet){
  IM.rows=rows.map(r=>Array.isArray(r)?r:[]).filter(r=>r.some(c=>String(c??'').trim()!==''));
  if(!IM.rows.length){$('imErr').textContent='파일에서 표를 찾지 못했어요. 다른 시트나 파일을 골라주세요.';return}
  IM.fname=fname;IM.wb=wb||null;IM.sheet=sheet||'';IM.hdr=detectHeader(IM.rows);IM.sign='out';
  autoMap();buildItems();
  $('imErr').textContent='';$('imStep1').hidden=true;$('imStep2').hidden=false;renderImport();
}
function sheetRows(X,wb,name){return X.utils.sheet_to_json(wb.Sheets[name],{header:1,raw:true,defval:''})}
async function handleFile(f){
  if(!f)return;
  $('imErr').textContent='불러오는 중…';
  let X;try{X=await loadXLSX()}catch(e){$('imErr').textContent='파일 읽기 도구를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.';return}
  try{
    const buf=await f.arrayBuffer();
    let wb;
    if(/\.(csv|tsv|txt)$/i.test(f.name)){
      let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(buf)}catch(e){text=new TextDecoder('euc-kr').decode(buf)}
      text=text.replace(/^\uFEFF/,'');
      if(/\t/.test(text.split('\n')[0]||'')||/\.tsv$/i.test(f.name)){loadRows(text.split(/\r?\n/).map(l=>l.split('\t')),f.name);return}
      wb=X.read(text,{type:'string',raw:true});
    }else wb=X.read(buf,{type:'array'});
    const best=wb.SheetNames.map(n=>[n,sheetRows(X,wb,n).length]).sort((a,b)=>b[1]-a[1])[0][0];
    loadRows(sheetRows(X,wb,best),f.name,wb,best);
  }catch(e){$('imErr').textContent='이 파일은 읽을 수 없어요. 엑셀(xlsx, xls)이나 CSV 파일인지 확인해 주세요. 암호가 걸린 파일이면 암호를 풀고 저장해 주세요.'}
}
function openImport(){
  IM.items=[];IM.rows=[];$('imStep1').hidden=false;$('imStep2').hidden=true;$('imErr').textContent='';
  $('imFile').value='';$('imPaste').value='';$('imGo').disabled=true;$('imGo').textContent='가져오기';
  idlg.showModal?idlg.showModal():idlg.setAttribute('open','');
}
$('imFile').addEventListener('change',e=>handleFile(e.target.files[0]));
const drop=$('imDrop');
['dragenter','dragover'].forEach(t=>drop.addEventListener(t,e=>{e.preventDefault();drop.classList.add('over')}));
['dragleave','drop'].forEach(t=>drop.addEventListener(t,e=>{e.preventDefault();drop.classList.remove('over')}));
drop.addEventListener('drop',e=>{const f=e.dataTransfer&&e.dataTransfer.files[0];if(f)handleFile(f)});
$('imPasteBtn').onclick=async()=>{
  const t=$('imPaste').value.replace(/^\uFEFF/,'');if(!t.trim()){$('imErr').textContent='붙여넣은 내용이 없어요.';return}
  if(/\t/.test(t)){loadRows(t.split(/\r?\n/).map(l=>l.split('\t')),'붙여넣은 표');return}
  try{const X=await loadXLSX();const wb=X.read(t,{type:'string',raw:true});loadRows(sheetRows(X,wb,wb.SheetNames[0]),'붙여넣은 표')}
  catch(e){$('imErr').textContent='붙여넣은 내용을 표로 읽지 못했어요.'}
};
$('imClose').onclick=()=>idlg.close();
idlg.addEventListener('change',async e=>{
  const t=e.target;
  if(t.id==='imSheet'){const X=await loadXLSX();loadRows(sheetRows(X,IM.wb,t.value),IM.fname,IM.wb,t.value);return}
  if(t.id==='imHdr'){IM.hdr=+t.value;autoMap();buildItems();renderImport();return}
  if(t.dataset.role){IM.map[t.dataset.role]=+t.value;buildItems();renderImport();return}
  if(t.id==='imSkipC'){IM.skipCancel=t.checked;IM.items.forEach(x=>{if(x.cancel)x.include=!t.checked&&!x.dup});renderImTable();return}
  if(t.dataset.iinc!==undefined){IM.items[+t.dataset.iinc].include=t.checked;renderImTable();return}
  if(t.dataset.itype!==undefined){const x=IM.items[+t.dataset.itype];x.type=t.value;x.cat=suggestCat(x.type,x.memo,'');x.manual=false;renderImTable();return}
  if(t.dataset.icat!==undefined){
    const x=IM.items[+t.dataset.icat];x.cat=t.value;x.manual=true;
    const k=norm(x.memo);
    if(k)IM.items.forEach(y=>{if(y!==x&&!y.manual&&y.type===x.type&&norm(y.memo)===k)y.cat=t.value});
    renderImTable();return;
  }
});
idlg.addEventListener('click',e=>{
  const b=e.target.closest('[data-imsign],[data-impay],[data-imall],#imAgain');if(!b)return;
  if(b.id==='imAgain'){openImport();return}
  if(b.dataset.imsign){IM.sign=b.dataset.imsign;buildItems();renderImport();return}
  if(b.dataset.impay){IM.pay=b.dataset.impay;renderImport();return}
  if(b.dataset.imall){const v=b.dataset.imall==='1';IM.items.forEach(x=>x.include=v);renderImTable()}
});
$('imGo').onclick=()=>{
  const on=IM.items.filter(x=>x.include);if(!on.length)return;
  const add=on.map(x=>{const e={id:uid(),type:x.type,date:x.date,amount:x.amount,memo:x.memo,cat:x.cat};
    if(x.type==='out'){e.pay=x.inst>1?'credit':IM.pay;if(x.inst>1)e.inst=x.inst}return e});
  const rules={...(S.settings.rules||{})};
  for(const x of IM.items)if(x.manual&&x.include&&norm(x.memo))rules[x.type+'|'+norm(x.memo)]=x.cat;
  const keys=Object.keys(rules);if(keys.length>400)keys.slice(0,keys.length-400).forEach(k=>delete rules[k]);
  const g=splitYears([...S.entries,...add]);
  const big=Object.entries(g).find(([y,arr])=>JSON.stringify({entries:arr}).length>240000);
  if(big){$('imErr').textContent=`${big[0]}년 기록이 한 해에 담을 수 있는 양(약 1,500건)을 넘어요. 가져올 내역을 줄이거나 새 가계부에 나눠 담아주세요.`;return}
  checkpoint('가져오기');
  S.entries.push(...add);S.settings.rules=rules;
  const latest=add.map(e=>e.date).sort().pop();
  S.year=+latest.slice(0,4);S.month=+latest.slice(5,7)-1;S.day=null;
  idlg.close();persist();render();toast(`${add.length}건을 가져왔어요`,true);
};

/* ---------- 검색 ---------- */
const fsdlg=$('fsdlg');
const WD=['일','월','화','수','목','금','토'];
function fullDate(d){const [y,m,dd]=d.split('-').map(Number);return `${y}.${pad(m)}.${pad(dd)} (${WD[new Date(y,m-1,dd).getDay()]})`}
function openSearch(){
  $('fsCat').innerHTML='<option value="">카테고리 전체</option>'+['out','in'].map(t=>`<optgroup label="${TYPE_NAME[t]}">${S.cats[t].map(k=>`<option value="${k.id}">${esc(k.name)}</option>`).join('')}</optgroup>`).join('');
  $('fsFrom').value=`${S.year}-01-01`;$('fsTo').value=`${S.year}-12-31`;
  fsdlg.showModal?fsdlg.showModal():fsdlg.setAttribute('open','');
  runSearch();setTimeout(()=>$('fsQ').focus(),50);
}
function runSearch(){
  if(!fsdlg.open)return;
  const per=$('fsPeriod').value;
  $('fsRange').hidden=per!=='range';
  let from='0000',to='9999';
  if(per==='year'){from=`${S.year}-01-01`;to=`${S.year}-12-31`}
  if(per==='range'){from=$('fsFrom').value||'0000';to=$('fsTo').value||'9999'}
  const ty=$('fsType').value,cat=$('fsCat').value;
  const toks=$('fsQ').value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const res=S.entries.filter(e=>{
    if(e.date<from||e.date>to)return false;
    if(ty&&e.type!==ty)return false;
    if(cat&&e.cat!==cat)return false;
    if(!toks.length)return true;
    const hay=[e.memo||'',e.type==='xfer'?peerName(e.peer)+' 이체':cname(e.cat),TYPE_NAME[e.type]||'',e.pay?PAY_NAME[e.pay]:'',String(e.amount)].join(' ').toLowerCase();
    return toks.every(t=>{const dg=t.replace(/[,원]/g,'');return /^\d+$/.test(dg)?String(e.amount).includes(dg)||hay.includes(t):hay.includes(t)});
  }).sort((a,b)=>a.date<b.date?1:-1);
  let so=0,si=0,sx=0;for(const e of res){if(e.type==='out')so+=e.amount;else if(e.type==='in')si+=e.amount;else sx+=e.amount}
  $('fsSum').innerHTML=`<span><b>${res.length}건</b></span>${so?`<span class="neg">지출 ${won(so)}</span>`:''}${si?`<span class="pos">수입 ${won(si)}</span>`:''}${sx?`<span class="xf">이체 ${won(sx)}</span>`:''}`;
  const shown=res.slice(0,300);
  $('fsList').innerHTML=shown.length?shown.map(e=>{
    const row=entryRow(e,false).replace(/<button class="x"[^>]*>✕<\/button>/,'');
    return `<div class="fs-item"><span class="fs-d">${fullDate(e.date)}</span>${row}</div>`;
  }).join('')+(res.length>300?`<p class="hint">최근 300건만 보여줘요. 검색어나 기간을 좁혀보세요.</p>`:'')
  :'<p class="hint" style="text-align:center;padding:20px 0">찾는 내역이 없어요.</p>';
}
let fsT=null;
$('fsQ').addEventListener('input',()=>{clearTimeout(fsT);fsT=setTimeout(runSearch,150)});
['fsPeriod','fsType','fsCat','fsFrom','fsTo'].forEach(id=>$(id).addEventListener('change',runSearch));
$('fsClose').onclick=()=>fsdlg.close();
fsdlg.addEventListener('click',e=>{const r=e.target.closest('[data-edit]');if(r)openEdit(r.dataset.edit)});
fsdlg.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.matches('[data-edit]'))openEdit(e.target.dataset.edit)});

/* ---------- 말로 입력 (자연어) ---------- */
const QK={
  inRe:/(들어[옴왔오온]|받[음았아은]|입금|월급|급여|용돈|수입|환급|이자|상여|보너스|벌[었음])/,
  xferRe:/(이체|송금|옮[김겼기]|적금|저축)/
};
function todayStr(off){const d=new Date(now.getFullYear(),now.getMonth(),now.getDate()+(off||0));return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`}
function nlDate(t){
  let r;
  if(/그저께|그제/.test(t))return todayStr(-2);
  if(/어제/.test(t))return todayStr(-1);
  if(/내일/.test(t))return todayStr(1);
  if((r=t.match(/(\d{4})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/)))return parseDate(`${r[1]}-${r[2]}-${r[3]}`);
  if((r=t.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/)))return parseDate(`${now.getFullYear()}-${r[1]}-${r[2]}`);
  if((r=t.match(/(?:^|\s)(\d{1,2})[./](\d{1,2})(?:\s|$)/)))return parseDate(`${now.getFullYear()}-${r[1]}-${r[2]}`);
  if((r=t.match(/지난\s*달\s*(\d{1,2})\s*일/))){const d=new Date(now.getFullYear(),now.getMonth()-1,+r[1]);return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`}
  if((r=t.match(/(\d{1,2})\s*일(?!\s*[치분])/)))return parseDate(`${now.getFullYear()}-${now.getMonth()+1}-${r[1]}`);
  if((r=t.match(/(지난\s*주\s*)?([월화수목금토일])요일/))){
    const target=WD.indexOf(r[2]),cur=now.getDay();
    let diff=(cur-target+7)%7;
    if(r[1]){const monCur=(cur+6)%7,monT=(target+6)%7;diff=monCur+7-monT}
    return todayStr(-diff);
  }
  return todayStr(0);
}
function nlAmount(t){
  const s=t.replace(/(\d),(?=\d{3})/g,'$1');
  const re=/(\d+(?:\.\d+)?)\s*(억|만|천|원|개월|일|월|시|분|번|개|명|살|%|년)?/g;
  let m,best=null,chain=0,chainHasUnit=false,lastEnd=-1,chains=[];
  const flush=()=>{if(chain>0)chains.push({v:chain,unit:chainHasUnit});chain=0;chainHasUnit=false};
  while((m=re.exec(s))){
    const v=parseFloat(m[1]),u=m[2]||'';
    if(['개월','일','월','시','분','번','개','명','살','%','년'].includes(u)){flush();continue}
    if(lastEnd>=0&&s.slice(lastEnd,m.index).trim()!=='')flush();
    if(u==='억'){chain+=v*1e8;chainHasUnit=true}
    else if(u==='만'){chain+=v*1e4;chainHasUnit=true}
    else if(u==='천'){chain+=v*1e3;chainHasUnit=true}
    else if(u==='원'){chain+=v;chainHasUnit=true;lastEnd=m.index+m[0].length;flush();continue}
    else chain+=v;
    lastEnd=m.index+m[0].length;
  }
  flush();
  if(!chains.length){if(/(^|[^\d])만\s*원/.test(s))return 10000;if(/(^|[^\d])천\s*원/.test(s))return 1000;return null}
  best=chains.find(c=>c.unit)||chains.sort((a,b)=>b.v-a.v)[0];
  return Math.round(best.v)||null;
}
function nlParseOne(t){
  const amount=nlAmount(t);if(!amount)return null;
  let type=QK.inRe.test(t)?'in':'out';
  let dir='out',peer='';
  const lg=IDX.find(x=>x.id!==S.cur&&t.includes(x.name));
  if(QK.xferRe.test(t)||lg){type='xfer';peer=lg?lg.id:'';dir=/받|들어/.test(t)?'in':'out'}
  let pay='cash';
  if(/체크/.test(t))pay='debit';else if(/신용|카드|할부/.test(t))pay='credit';
  let inst=1;const im=t.match(/(\d{1,2})\s*개월/);if(im&&+im[1]>1)inst=+im[1];
  let memo=t
    .replace(/\d{4}\s*[.\-/년]\s*\d{1,2}\s*[.\-/월]\s*\d{1,2}\s*일?/g,' ')
    .replace(/(오늘|어제|그저께|그제|내일|지난\s*주|이번\s*주|지난\s*달|이번\s*달|[월화수목금토일]요일)/g,' ')
    .replace(/\d+\s*(개월|월|일)/g,' ')
    .replace(/\d+(?:[.,]\d+)*\s*(억|만|천)?\s*(\d+\s*(천)?\s*)?원?/g,' ')
    .replace(/(^|\s)(만|천)\s*원/g,' ')
    .replace(/(신용\s*카드|체크\s*카드|카드|현금|계좌|할부|일시불)(로|으로)?/g,' ')
    .replace(/(결제|계산|지출|사용)(했[어음다]?|함|됨)?/g,' ')
    .replace(/(썼[어음다]?|씀|샀[어음다]?|삼|냈[어음다]?|줬\S*|줌|먹[었음]\S*|했[어음다]?|함|들어[옴왔오온]\S*|받[음았아은]\S*|입금\S*|송금\S*|이체\S*|옮[김겼기]\S*|보냄|보냈\S*)/g,' ')
    .replace(/(^|\s)(에서|으로|로|에|을|를|이|가|은|는|의|도|만|좀)(?=\s|$)/g,' ')
    .replace(/([가-힣A-Za-z0-9])(에서|으로|에)(?=\s|$)/g,'$1')
    .replace(/[~!?.,·]+/g,' ').replace(/\s+/g,' ').trim();
  if(lg)memo=memo.replace(lg.name,'').trim();
  memo=memo.slice(0,40);
  let cat='';
  if(type!=='xfer'){
    cat=suggestCat(type,memo,'');
    if(cat===fallbackCat(type)){const c2=suggestCat(type,t,'');if(c2)cat=c2}
  }
  return {date:nlDate(t),type,amount,memo,cat,pay:type==='out'?pay:'',inst:type==='out'&&pay==='credit'?inst:1,dir,peer};
}
function nlLocal(text){
  const parts=text.split(/\n|,(?!\d{3})|，|그리고/).map(x=>x.trim()).filter(Boolean);
  const out=[];for(const p of parts){const r=nlParseOne(p);if(!r)return null;out.push(r)}
  return out.length?out:null;
}
const AI_ON=!!(window.APP_CONFIG&&APP_CONFIG.AI_ENABLED!==false);
async function callAI(payload){
  if(!AI_ON||!sb)return {err:'none'};
  try{
    const {data,error}=await sb.functions.invoke('claude',{body:payload});
    if(error){const st=error.context&&error.context.status;return {err:st===429?'rate_limited':st===401?'auth':'fail'}}
    return data||{err:'fail'};
  }catch(e){return {err:'fail'}}
}
async function nlAI(text){
  const res=await callAI({task:'parse',text:text.slice(0,500),today:todayStr(0),
    cats:{out:S.cats.out.map(k=>k.name),in:S.cats.in.map(k=>k.name)},
    ledgers:IDX.filter(x=>x.id!==S.cur).map(x=>x.name)});
  if(res.err)return res;
  const arr=Array.isArray(res.items)?res.items:[];
  const items=[];
  for(const r of arr.slice(0,20)){
    const amount=Math.round(Number(r&&r.amount));const date=parseDate(r&&r.date);
    if(!amount||amount<=0||amount>1e11||!date)continue;
    const type=['out','in','xfer'].includes(r.type)?r.type:'out';
    const memo=String(r.memo||'').slice(0,40);
    let cat='';
    if(type!=='xfer'){const c=findCat(type,String(r.category||''));cat=c?c.id:suggestCat(type,memo,'')}
    const peerL=IDX.find(x=>x.id!==S.cur&&x.name===r.peer);
    const pay=type==='out'&&['cash','debit','credit'].includes(r.pay)?r.pay:(type==='out'?'cash':'');
    items.push({date,type,amount,memo,cat,pay,inst:pay==='credit'&&+r.inst>1?Math.min(60,+r.inst):1,dir:r.dir==='in'?'in':'out',peer:peerL?peerL.id:''});
  }
  return items.length?{items}:{err:'empty'};
}
let QITEMS=[],qBusy=false;
function renderQ(msg,src){
  const box=$('qOut');
  if(msg){box.innerHTML=`<p class="q-msg">${msg}</p>`;return}
  if(!QITEMS.length){box.innerHTML='';return}
  const peerOpts=sel=>IDX.filter(x=>x.id!==S.cur).map(x=>`<option value="${esc(x.id)}" ${x.id===sel?'selected':''}>${esc(x.name)}</option>`).join('')+`<option value="" ${!sel?'selected':''}>외부 계좌</option>`;
  box.innerHTML=`<div class="q-list">${QITEMS.map((q,i)=>`<div class="q-item">
      <input type="date" class="inp" data-q="date" data-i="${i}" value="${q.date}">
      <select class="inp" data-q="type" data-i="${i}"><option value="out" ${q.type==='out'?'selected':''}>지출</option><option value="in" ${q.type==='in'?'selected':''}>수입</option><option value="xfer" ${q.type==='xfer'?'selected':''}>이체</option></select>
      ${q.type==='xfer'?`<select class="inp" data-q="dir" data-i="${i}"><option value="out" ${q.dir==='out'?'selected':''}>보냄</option><option value="in" ${q.dir==='in'?'selected':''}>받음</option></select><select class="inp" data-q="peer" data-i="${i}">${peerOpts(q.peer)}</select>`
        :`<select class="inp" data-q="cat" data-i="${i}">${catOpts(q.type,q.cat)}</select>`}
      <input type="text" class="inp q-memo" data-q="memo" data-i="${i}" value="${esc(q.memo)}" placeholder="내용">
      ${q.type==='out'?`<select class="inp" data-q="pay" data-i="${i}"><option value="cash" ${q.pay==='cash'?'selected':''}>현금·계좌</option><option value="debit" ${q.pay==='debit'?'selected':''}>체크</option><option value="credit" ${q.pay==='credit'?'selected':''}>신용${q.inst>1?` ${q.inst}개월`:''}</option></select>`:''}
      <input type="number" class="inp q-amt" data-q="amount" data-i="${i}" value="${q.amount}" inputmode="numeric" aria-label="금액">
      <button type="button" class="x" data-qdel="${i}" aria-label="빼기">✕</button>
    </div>`).join('')}</div>
    ${src==='receipt'&&RC_RAW?`<details class="rc-raw"><summary>영수증에서 읽은 글자 보기</summary><pre>${esc(RC_RAW)}</pre></details>`:''}
    <div class="q-act"><span class="small">${src==='ai'?'Claude가 정리했어요.':src==='receipt'?'영수증에서 읽었어요. 금액과 가게 이름을 꼭 확인해 주세요.':'이렇게 이해했어요.'} 맞는지 확인하고 추가해 주세요.</span>
      ${src==='local'&&AI_ON?'<button type="button" class="lnk" id="qAI">Claude에게 다시 맡기기</button>':''}
      <span class="spacer"></span><button type="button" class="btn-ghost" id="qCancel">취소</button><button type="button" class="btn-add" id="qAdd">${QITEMS.length}건 추가</button></div>`;
}
async function runAI(text){
  qBusy=true;renderQ('Claude가 문장을 정리하고 있어요…');
  const r=await nlAI(text);qBusy=false;
  if(r.items){QITEMS=r.items;renderQ(null,'ai');return}
  const msg={none:'문장을 이해하지 못했어요. "어제 스타벅스 5600원"처럼 금액을 넣어 적어주세요.',auth:'로그인이 만료됐어요. 다시 로그인해 주세요.',rate_limited:'오늘 쓸 수 있는 AI 정리 횟수를 다 썼어요. 금액을 넣어 짧게 적으면 바로 인식돼요.',empty:'기록으로 만들 금액을 찾지 못했어요.'}[r.err]||'정리하지 못했어요. 금액을 넣어 짧게 다시 적어주세요.';
  renderQ(msg);
}
$('qForm').addEventListener('submit',async e=>{
  e.preventDefault();if(qBusy)return;
  const text=$('qText').value.trim();if(!text)return;
  const loc=nlLocal(text);
  if(loc){QITEMS=loc;renderQ(null,'local');return}
  await runAI(text);
});
$('qOut').addEventListener('change',e=>{
  const t=e.target,i=+t.dataset.i,k=t.dataset.q;if(!k||!QITEMS[i])return;
  const q=QITEMS[i];
  if(k==='amount')q.amount=Math.round(Number(t.value))||0;
  else if(k==='type'){q.type=t.value;q.cat=t.value==='xfer'?'':suggestCat(t.value,q.memo,'');if(t.value==='out'&&!q.pay)q.pay='cash';renderQ(null,'local')}
  else if(k==='pay'){q.pay=t.value;if(t.value!=='credit')q.inst=1}
  else q[k]=t.value;
});
$('qOut').addEventListener('click',e=>{
  const d=e.target.closest('[data-qdel]');
  if(d){QITEMS.splice(+d.dataset.qdel,1);renderQ(null,'local');return}
  if(e.target.id==='qCancel'){QITEMS=[];renderQ()}
  if(e.target.id==='qAI'){runAI($('qText').value.trim())}
  if(e.target.id==='qAdd'){
    const ok=QITEMS.filter(q=>q.amount>0&&parseDate(q.date));
    if(!ok.length){renderQ('금액과 날짜를 확인해 주세요.');return}
    checkpoint('말로 입력');
    for(const q of ok){
      const ne={id:uid(),type:q.type,date:parseDate(q.date),amount:q.amount,memo:q.memo.trim()};
      if(q.type==='xfer'){ne.dir=q.dir;ne.peer=q.peer||'';ne.xid=uid()}else ne.cat=q.cat||fallbackCat(q.type);
      if(q.type==='out'){ne.pay=q.pay||'cash';if(ne.pay==='credit'&&q.inst>1)ne.inst=q.inst}
      S.entries.push(ne);addMirror(ne);
    }
    const last=ok[ok.length-1].date;S.year=+last.slice(0,4);S.month=+last.slice(5,7)-1;S.day=+last.slice(8,10);
    QITEMS=[];$('qText').value='';renderQ();persist();render();toast(`${ok.length}건 추가했어요`,true);
  }
});


/* ---------- 예산 ---------- */
function budgetBlock(list){
  const b=S.settings.budgets||{};const ids=S.cats.out.filter(k=>b[k.id]>0);
  if(!ids.length)return '';
  const mt=monthTotals(list,'out')[S.month]||{};
  let tu=0,tb=0;
  const row=(name,color,used,bud)=>{const p=Math.round(used/bud*100),cls=p>100?'over':p>=80?'warn':'';const rest=bud-used;
    return `<div class="bg-row ${cls}"><div class="bg-top">${color?`<i style="background:${color}"></i>`:''}<span class="nm">${name}</span><span class="pc">${p}%</span></div>
      <div class="bg-track"><b style="width:${Math.min(100,p)}%"></b></div>
      <div class="bg-sub"><span>${won(used)} / ${won(bud)}</span><span>${rest>=0?`${won(rest)} 남음`:`${won(-rest)} 초과`}</span></div></div>`};
  const rows=ids.map(k=>{const u=mt[k.id]||0;tu+=u;tb+=b[k.id];return row(esc(k.name),col(k.id),u,b[k.id])}).join('');
  return `<div class="budget"><p class="sec-title">${S.month+1}월 예산</p>${ids.length>1?row('전체 예산','',tu,tb):''}${rows}</div>`;
}
/* ---------- 결제수단별 합계 (연말정산 참고) ---------- */
function payTotals(year,month){
  const t={credit:0,debit:0,cash:0};
  for(const e of S.entries){if(e.type!=='out')continue;if(e.date.slice(0,4)!==String(year))continue;if(month!=null&&+e.date.slice(5,7)!==month+1)continue;t[e.pay||'cash']+=e.amount}
  return t;
}
function payBlock(){
  const t=payTotals(S.year);if(!t.credit&&!t.debit&&!t.cash)return '';
  return `<p class="sec-title">결제수단별 사용액 · 연말정산 참고</p>
    <dl class="paysum"><dt>신용카드</dt><dd>${won(t.credit)}</dd><dt>체크카드</dt><dd>${won(t.debit)}</dd><dt>현금·계좌</dt><dd>${won(t.cash)}</dd></dl>
    <p class="p-note">${S.year}년 사용일 기준 합계예요. 대중교통·전통시장·도서공연 같은 항목별 구분은 들어가 있지 않아요.</p>`;
}
/* ---------- 고정 지출·수입 ---------- */
function ymOf(d){return d.slice(0,7)}
function nextYM(ym){const [y,m]=ym.split('-').map(Number);const t=new Date(y,m,1);return `${t.getFullYear()}-${pad(t.getMonth()+1)}`}
function runFixedFor(id){
  const L=LEDGERS[id];if(!L||!L.settings||!Array.isArray(L.settings.fixed)||!L.settings.fixed.length)return;
  const today=`${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`,curYM=today.slice(0,7);
  let changed=false;
  for(const f of L.settings.fixed){
    let ym=f.last?nextYM(f.last):f.start;let guard=0;
    while(ym<=curYM&&guard++<240){
      if(f.end&&ym>f.end)break;
      const [y,m]=ym.split('-').map(Number);const last=new Date(y,m,0).getDate();
      const date=`${ym}-${pad(Math.min(f.day||1,last))}`;
      if(date>today)break;
      const ne={id:(f.id+'_'+ym.replace('-','')).slice(0,64),type:f.type,date,amount:f.amount,memo:f.memo||'',fid:f.id};
      if(f.type==='xfer'){ne.dir=f.dir||'out';ne.peer=f.peer||'';ne.xid=(f.id+'x'+ym.replace('-','')).slice(0,60)}else ne.cat=f.cat;
      if(f.type==='out'){ne.pay=f.pay||'cash';if(f.pay==='credit'&&f.inst>1)ne.inst=f.inst}
      if(!L.entries.some(x=>x.id===ne.id)&&!(L.tomb&&L.tomb[ne.id])){L.entries.push(ne);addMirror(ne,id)}f.last=ym;changed=true;ym=nextYM(ym);
    }
  }
  if(changed){if(id===S.cur)S.entries=L.entries;writeLedger(id);saveLocal()}
}
function fixedLine(){
  const fx=(S.settings.fixed||[]).filter(f=>!f.end);if(!fx.length)return '';
  const o=fx.filter(f=>f.type==='out').reduce((a,f)=>a+f.amount,0),i=fx.filter(f=>f.type==='in').reduce((a,f)=>a+f.amount,0);
  return `<p class="sec-title" style="margin-top:14px">고정 지출·수입</p><dl class="paysum">${o?`<dt>매달 나가는 돈</dt><dd class="neg">${won(o)}</dd>`:''}${i?`<dt>매달 들어오는 돈</dt><dd class="pos">${won(i)}</dd>`:''}<dt>등록</dt><dd>${fx.length}건</dd></dl>`;
}
const fxdlg=$('fxdlg');let fxT='out';
(function(){let o='';for(let i=1;i<=31;i++)o+=`<option value="${i}">${i===31?'말일 (31일)':i+'일'}</option>`;$('fxDay').innerHTML=o})();
function renderFxForm(){
  $('fxType').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.fxt===fxT));
  $('fxCatL').hidden=fxT==='xfer';$('fxPayL').hidden=fxT!=='out';$('fxDirL').hidden=fxT!=='xfer';$('fxPeerL').hidden=fxT!=='xfer';
  if(fxT!=='xfer')$('fxCat').innerHTML=catOpts(fxT,fxT==='in'?(findCat('in','월급')||{}).id:(findCat('out','공과금')||{}).id);
  $('fxPeer').innerHTML=IDX.filter(x=>x.id!==S.cur).map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('')+'<option value="">외부 계좌 (적금·투자 등)</option>';
  $('fxMemo').placeholder=fxT==='in'?'예: 월급':fxT==='xfer'?'예: 적금':'예: 관리비';
}
function renderFxList(){
  const fx=S.settings.fixed||[];
  const T={out:'지출',in:'수입',xfer:'이체'};
  $('fxList').innerHTML=fx.length?fx.map(f=>`<div class="fx-row ${f.end?'stopped':''}">
      <span class="d">매달 ${f.day>=31?'말일':f.day+'일'}</span>
      <span class="m">${esc(f.memo||(f.type==='xfer'?peerName(f.peer)+' 이체':cname(f.cat)))}<small>${T[f.type]}${f.type!=='xfer'?' · '+esc(cname(f.cat)):''}${f.type==='out'&&f.pay&&f.pay!=='cash'?' · '+PAY_NAME[f.pay]:''}${f.end?' · 중지됨':''}</small></span>
      <input class="inp" type="number" min="1" data-fxamt="${f.id}" value="${f.amount}" aria-label="금액">
      <button type="button" class="btn-ghost" style="padding:6px 10px;font-size:13px" data-fxstop="${f.id}">${f.end?'다시 시작':'중지'}</button>
      <button type="button" class="x" data-fxdel="${f.id}" aria-label="삭제">✕</button></div>`).join('')+
    `<p class="small" style="margin-top:8px">금액을 바꾸면 다음 기록부터 적용돼요. 삭제하거나 중지해도 이미 기록된 내역은 그대로 남아요.</p>`
    :'<p class="hint">아직 등록된 고정 지출·수입이 없어요.</p>';
}
function openFixed(){fxT='out';$('fxAmt').value='';$('fxMemo').value='';$('fxErr').textContent='';
  $('fxDay').value=String(now.getDate());$('fxStart').value=`${now.getFullYear()}-${pad(now.getMonth()+1)}`;
  renderFxForm();renderFxList();fxdlg.showModal?fxdlg.showModal():fxdlg.setAttribute('open','')}
$('fxType').addEventListener('click',e=>{const b=e.target.closest('[data-fxt]');if(b){fxT=b.dataset.fxt;renderFxForm()}});
$('fxClose').onclick=()=>fxdlg.close();
$('fxAdd').onclick=()=>{
  const amt=Math.round(Number($('fxAmt').value));if(!amt||amt<=0){$('fxErr').textContent='금액을 입력해 주세요.';return}
  const start=$('fxStart').value;if(!/^\d{4}-\d{2}$/.test(start)){$('fxErr').textContent='시작 달을 골라주세요.';return}
  checkpoint('고정 등록');
  const f={id:'f'+uid(),type:fxT,day:+$('fxDay').value,amount:amt,memo:$('fxMemo').value.trim(),start,last:''};
  if(fxT==='xfer'){f.dir=$('fxDir').value;f.peer=$('fxPeer').value||''}else f.cat=$('fxCat').value;
  if(fxT==='out')f.pay=$('fxPay').value;
  S.settings.fixed=[...(S.settings.fixed||[]),f];
  runFixedFor(S.cur);persist();render();renderFxList();
  $('fxAmt').value='';$('fxMemo').value='';$('fxErr').textContent='';toast('고정으로 등록했어요',true);
};
$('fxList').addEventListener('change',e=>{const i=e.target.closest('[data-fxamt]');if(!i)return;const f=(S.settings.fixed||[]).find(x=>x.id===i.dataset.fxamt);const v=Math.round(Number(i.value));if(f&&v>0){f.amount=v;persist();render()}});
$('fxList').addEventListener('click',e=>{
  const st=e.target.closest('[data-fxstop]'),dl=e.target.closest('[data-fxdel]');
  const today=`${now.getFullYear()}-${pad(now.getMonth()+1)}`;
  if(st){const f=S.settings.fixed.find(x=>x.id===st.dataset.fxstop);if(!f)return;
    if(f.end){delete f.end;f.last=f.last&&f.last>today?f.last:today}else f.end=f.last||today;
    persist();render();renderFxList();return}
  if(dl)arm(dl,'삭제','✕',()=>{checkpoint('고정 삭제');S.settings.fixed=S.settings.fixed.filter(x=>x.id!==dl.dataset.fxdel);persist();render();renderFxList();toast('고정 항목을 삭제했어요',true)});
});
/* ---------- 여러 가계부 합산 ---------- */
function renderCombined(){
  const box=$('combined');if(!box)return;
  box.innerHTML=IDX.length<2?'':`<button class="cmb-open" data-act="combined">📊 전체 가계부 합산 보기 <span>${IDX.length}개 가계부</span></button>`;
}
$('cmbClose').addEventListener('click',()=>$('cmbdlg').close());
function openCombined(){
  const box=$('cmbBody');
  const y=now.getFullYear();let inn=0,out=0,bal=0,hasBal=false;const cat={};const mi=Array(12).fill(0),mo=Array(12).fill(0);
  for(const it of IDX){const L=LEDGERS[it.id];if(!L)continue;
    const nm={};for(const t of ['out','in'])for(const c of L.cats[t])nm[c.id]=c.name;
    for(const e of expand(L.entries,L.settings)){if(e.date.slice(0,4)!==String(y))continue;const m=+e.date.slice(5,7)-1;
      if(e.type==='in'){inn+=e.amount;mi[m]+=e.amount}else if(e.type==='out'){out+=e.amount;mo[m]+=e.amount;const n=nm[e.cat]||'기타';cat[n]=(cat[n]||0)+e.amount}}
    const cb=currentBalance(L);if(cb!==null){bal+=cb;hasBal=true}}
  const top=Object.entries(cat).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const W=360,H=120,step=W/12,bw=9,max=Math.max(1,...mi,...mo);
  let bars='';for(let i=0;i<12;i++){const x=i*step+step/2;const hi=mi[i]/max*(H-24),ho=mo[i]/max*(H-24);
    bars+=`<rect x="${x-bw-1}" y="${H-16-hi}" width="${bw}" height="${hi}" rx="2" fill="var(--in)" opacity=".85"><title>${i+1}월 수입 ${won(mi[i])}</title></rect><rect x="${x+1}" y="${H-16-ho}" width="${bw}" height="${ho}" rx="2" fill="var(--out)" opacity=".85"><title>${i+1}월 지출 ${won(mo[i])}</title></rect><text x="${x}" y="${H-3}" text-anchor="middle" font-size="10" fill="var(--muted)">${i+1}</text>`}
  const r=rateOf(inn,out);
  box.innerHTML=`<div class="combined"><div><h2>전체 가계부 합산 · ${y}년</h2><p class="small">가계부 사이 이체는 빼고 계산했어요.</p>
    <dl class="ysum">${hasBal?`<dt>합산 현재 잔액</dt><dd>${swon(bal)}</dd>`:''}<dt>수입</dt><dd class="pos">${won(inn)}</dd><dt>지출</dt><dd class="neg">${won(out)}</dd><dt>총 금액</dt><dd>${won(inn+out)}</dd><dt class="bal">남은 돈</dt><dd class="bal">${swon(inn-out)}</dd><dt>저축률</dt><dd class="${rateCls(r)}">${rateTxt(r)}</dd></dl></div>
    <div><svg class="cmb-bars" viewBox="0 0 ${W} ${H}" role="img" aria-label="월별 수입과 지출">${bars}</svg>
    ${top.length?`<p class="sec-title" style="margin-top:8px">지출이 많은 카테고리</p><ul class="topcats">${top.map(([n,v])=>`<li><span>${esc(n)}</span><b>${won(v)}</b></li>`).join('')}</ul>`:''}</div></div>`;
  const d=$('cmbdlg');d.showModal?d.showModal():d.setAttribute('open','');
}
/* ---------- 월간 리포트 ---------- */
let rpCtl=null;
function reportData(){
  const y=S.year,m=S.month,all=expand(S.entries,S.settings);
  const inMonth=(yy,mm)=>all.filter(e=>e.type!=='xfer'&&+e.date.slice(0,4)===yy&&+e.date.slice(5,7)===mm+1);
  const byCat=arr=>{const o={};for(const e of arr)if(e.type==='out'){const n=cname(e.cat);o[n]=(o[n]||0)+e.amount}return o};
  const cur=inMonth(y,m),pd=new Date(y,m-1,1),prev=inMonth(pd.getFullYear(),pd.getMonth());
  const sum=(a,t)=>a.filter(e=>e.type===t).reduce((x,e)=>x+e.amount,0);
  const merch={};for(const e of cur)if(e.type==='out'&&e.memo){merch[e.memo]=(merch[e.memo]||0)+e.amount}
  const bud=S.settings.budgets||{};const mt=byCat(cur);
  const budTxt=S.cats.out.filter(k=>bud[k.id]).map(k=>`${k.name}: 예산 ${bud[k.id]}원 중 ${mt[k.name]||0}원 사용`).join('\n');
  const days=new Date(y,m+1,0).getDate(),isCur=y===now.getFullYear()&&m===now.getMonth();
  return {y,m,text:`[${y}년 ${m+1}월${isCur?` · 오늘 ${now.getDate()}일까지 (${days}일 중)`:''}]
수입 ${sum(cur,'in')}원, 지출 ${sum(cur,'out')}원
카테고리별 지출: ${JSON.stringify(byCat(cur))}
[지난달 ${pd.getMonth()+1}월] 수입 ${sum(prev,'in')}원, 지출 ${sum(prev,'out')}원
지난달 카테고리별 지출: ${JSON.stringify(byCat(prev))}
이번 달 많이 쓴 곳: ${JSON.stringify(Object.entries(merch).sort((a,b)=>b[1]-a[1]).slice(0,8))}
결제수단: ${JSON.stringify(payTotals(y,m))}
${budTxt?'예산:\n'+budTxt:''}`,has:cur.length>0};
}
async function openReport(){
  const d=reportData();
  $('rpTitle').textContent=`${d.y}년 ${d.m+1}월 리포트`;
  rpdlg.showModal?rpdlg.showModal():rpdlg.setAttribute('open','');
  if(!d.has){$('rpBody').innerHTML='<span class="muted">이 달에는 아직 기록이 없어서 리포트를 만들 수 없어요.</span>';$('rpAgain').hidden=true;return}
  runReport(d);
}
async function runReport(d){
  const body=$('rpBody');body.innerHTML='<span class="muted">Claude가 이번 달 기록을 살펴보고 있어요…</span>';
  $('rpAgain').hidden=true;$('rpStop').hidden=true;
  const res=await callAI({task:'report',summary:d.text.slice(0,4000)});
  if(res&&typeof res.text==='string'){body.textContent=res.text}
  else{const msg={none:'리포트 기능이 꺼져 있어요.',auth:'로그인이 만료됐어요. 다시 로그인해 주세요.',rate_limited:'오늘 쓸 수 있는 리포트 횟수를 다 썼어요. 내일 다시 시도해 주세요.'}[res&&res.err]||'리포트를 만들지 못했어요. 잠시 후 다시 시도해 주세요.';
    body.innerHTML='';const n=document.createElement('p');n.className='hint';n.textContent=msg;body.appendChild(n)}
  $('rpAgain').hidden=false;
}
const rpdlg=$('rpdlg');
$('rpClose').onclick=()=>rpdlg.close();
$('rpAgain').onclick=()=>runReport(reportData());
/* ---------- 백업·복원 ---------- */
async function backupXlsx(){
  let X;try{X=await loadXLSX()}catch(e){toast('도구를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');return}
  syncCur();
  const name=(IDX.find(x=>x.id===S.cur)||{}).name||'가계부';
  const data=JSON.stringify({app:'gagyebu',v:2,name,saved:new Date().toISOString(),cats:S.cats,settings:S.settings,entries:S.entries});
  const chunks=[];for(let i=0;i<data.length;i+=30000)chunks.push([data.slice(i,i+30000)]);
  const T={in:'수입',out:'지출',xfer:'이체'};
  const rows=[['날짜','구분','카테고리','내용','금액','결제수단','할부']].concat(S.entries.slice().sort((a,b)=>a.date<b.date?-1:1).map(e=>[e.date,T[e.type],e.type==='xfer'?peerName(e.peer):cname(e.cat),e.memo||'',e.amount,e.pay?PAY_NAME[e.pay]:'',e.inst>1?e.inst+'개월':'']));
  const wb=X.utils.book_new();
  X.utils.book_append_sheet(wb,X.utils.aoa_to_sheet([['가계부 백업 파일'],[`가계부: ${name}`],[`저장한 때: ${new Date().toLocaleString('ko-KR')}`],[`기록: ${S.entries.length}건`],[''],['이 파일을 가계부의 도구 → 백업에서 복원으로 올리면 그대로 되살아나요.'],['_backup 시트는 수정하지 마세요.']]),'안내');
  X.utils.book_append_sheet(wb,X.utils.aoa_to_sheet(rows),'전체 내역');
  X.utils.book_append_sheet(wb,X.utils.aoa_to_sheet(chunks),'_backup');
  wb.Workbook={Sheets:[{Hidden:0},{Hidden:0},{Hidden:1}]};
  const buf=X.write(wb,{type:'array',bookType:'xlsx'});
  const d=new Date(),fname=`${name}_백업_${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}.xlsx`.replace(/[\\/:*?"<>|]/g,'_');
  saveBlob(fname,buf);toast('백업 파일을 저장했어요');
}
$('restoreFile').addEventListener('change',async e=>{
  const f=e.target.files[0];e.target.value='';if(!f)return;
  let X;try{X=await loadXLSX()}catch(err){toast('도구를 불러오지 못했어요.');return}
  try{
    const wb=X.read(await f.arrayBuffer(),{type:'array'});
    const ws=wb.Sheets['_backup'];if(!ws){toast('가계부 백업 파일이 아니에요. 일반 엑셀은 가져오기를 써주세요.');return}
    const rows=X.utils.sheet_to_json(ws,{header:1,raw:true,defval:''});
    const d=JSON.parse(rows.map(r=>String(r[0]??'')).join(''));
    if(d.app!=='gagyebu'||!Array.isArray(d.entries)){toast('백업 파일을 읽지 못했어요.');return}
    const id='lg'+uid();const dt=new Date();
    let nm=`${sstr(d.name,20).trim()||'가계부'} (복원 ${dt.getMonth()+1}/${dt.getDate()})`;
    IDX.push({id,name:nm});LEDGERS[id]=normLedger({entries:d.entries,cats:d.cats,settings:d.settings});
    persistIndex();writeLedger(id);openLedger(id);
    toast(`'${nm}'(으)로 ${d.entries.length}건을 복원했어요`);
  }catch(err){toast('백업 파일을 읽지 못했어요.')}
});

/* ---------- 엑셀 내보내기 ---------- */
function loadXLSX(){
  if(window.XLSX)return Promise.resolve(window.XLSX);
  return new Promise((res,rej)=>{const sc=document.createElement('script');
    sc.src='vender/xlsx.full.min.js';
    sc.onload=()=>res(window.XLSX);sc.onerror=()=>rej(new Error('load'));document.head.appendChild(sc)});
}
async function exportXlsx(){
  let X;try{X=await loadXLSX()}catch(e){toast('엑셀 도구를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');return}
  const yr=String(S.year),name=(IDX.find(x=>x.id===S.cur)||{}).name||'가계부';
  const raw=S.entries.filter(e=>e.date.slice(0,4)===yr).sort((a,b)=>a.date<b.date?-1:1);
  const T={in:'수입',out:'지출',xfer:'이체'};
  const rows=[['날짜','구분','카테고리','내용','금액','결제수단','할부','이체 방향','이체 상대']];
  for(const e of raw)rows.push([e.date,T[e.type],e.type==='xfer'?'':cname(e.cat),e.memo||'',e.amount,
    e.type==='out'?(e.pay==='credit'?'신용카드':e.pay==='debit'?'체크카드':'현금·계좌'):'',
    e.inst>1?`${e.inst}개월`:'',e.type==='xfer'?(e.dir==='out'?'보냄':'받음'):'',e.type==='xfer'?peerName(e.peer):'']);
  const list=yearEntries(),flow=flowByMonth(list);
  const basisTxt=S.settings.basis==='pay'?'결제일 기준':'사용일 기준';
  const ms=[['월','수입','지출','총 금액(수입+지출)','남은 돈','저축률(%)','이체 보냄','이체 받음']];
  for(let i=0;i<12;i++){
    let xo=0,xi=0;for(const e of list)if(e.type==='xfer'&&+e.date.slice(5,7)===i+1){if(e.dir==='out')xo+=e.amount;else xi+=e.amount}
    const f=flow[i],r=rateOf(f.in,f.out);
    ms.push([`${i+1}월`,f.in,f.out,f.in+f.out,f.in-f.out,r===null?'':r,xo,xi]);
  }
  const ti=flow.reduce((a,f)=>a+f.in,0),to=flow.reduce((a,f)=>a+f.out,0),tr=rateOf(ti,to);
  ms.push(['합계',ti,to,ti+to,ti-to,tr===null?'':tr,'','']);
  ms.push([]);ms.push([`신용카드: ${basisTxt}`]);
  const cs=[['구분','카테고리',...Array.from({length:12},(_,i)=>`${i+1}월`),'합계']];
  for(const ty of ['in','out']){
    const mt=monthTotals(list,ty);
    for(const k of S.cats[ty]){const v=mt.map(m=>m[k.id]||0);cs.push([T[ty],k.name,...v,v.reduce((a,b)=>a+b,0)])}
  }
  const wb=X.utils.book_new();
  const add=(aoa,title,widths)=>{const ws=X.utils.aoa_to_sheet(aoa);ws['!cols']=widths.map(w=>({wch:w}));
    const rg=X.utils.decode_range(ws['!ref']);
    for(let R=1;R<=rg.e.r;R++)for(let C=0;C<=rg.e.c;C++){const c=ws[X.utils.encode_cell({r:R,c:C})];if(c&&c.t==='n'&&!(title==='월별 요약'&&C===5))c.z='#,##0'}
    X.utils.book_append_sheet(wb,ws,title)};
  add(rows,'내역',[12,6,10,24,12,10,8,10,16]);
  add(ms,'월별 요약',[8,14,14,18,14,10,12,12]);
  add(cs,'카테고리별',[6,12,...Array(12).fill(11),13]);
  const ps=[['월','신용카드','체크카드','현금·계좌','합계']];let pc=0,pd=0,pa=0;
  for(let i=0;i<12;i++){const t=payTotals(S.year,i);pc+=t.credit;pd+=t.debit;pa+=t.cash;ps.push([`${i+1}월`,t.credit,t.debit,t.cash,t.credit+t.debit+t.cash])}
  ps.push(['합계',pc,pd,pa,pc+pd+pa]);ps.push([]);ps.push(['사용일 기준 · 연말정산 참고용 (대중교통·전통시장 등 구분 없음)']);
  add(ps,'결제수단별',[8,14,14,14,14]);
  const buf=X.write(wb,{type:'array',bookType:'xlsx'});
  const fname=`${name}_${yr}년_가계부.xlsx`.replace(/[\\/:*?"<>|]/g,'_');
  saveBlob(fname,buf);toast('엑셀 파일을 저장했어요');
}

/* ---------- category dialog ---------- */
const cdlg=$('cdlg');
function openCats(){S.cType=S.type==='all'?'out':S.type;$('cErr').textContent='';$('cNew').value='';renderCats();cdlg.showModal?cdlg.showModal():cdlg.setAttribute('open','')}
function renderCats(){
  $('cType').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.ctype===S.cType));
  const cats=S.cats[S.cType];
  $('clist').innerHTML=cats.map(k=>{
    const n=S.entries.filter(e=>e.cat===k.id).length;
    return `<li><input type="color" class="sw" data-sw="${k.id}" value="${hexOf(k)}" aria-label="${esc(k.name)} 색 고르기">
      <input class="inp" data-rn="${k.id}" value="${esc(k.name)}" maxlength="12" aria-label="카테고리 이름">
      ${S.cType==='out'?`<input class="inp bud" type="number" min="0" step="1000" inputmode="numeric" data-bud="${k.id}" value="${(S.settings.budgets||{})[k.id]||''}" placeholder="월 예산" aria-label="${esc(k.name)} 한 달 예산">`:''}
      <span class="cnt">${n}건</span>
      <button type="button" class="x" data-cdel="${k.id}" ${cats.length<=1?'disabled':''} aria-label="${esc(k.name)} 삭제">✕</button></li>`;
  }).join('');
  $('cNew').placeholder=S.cType==='in'?'예: 이자':'예: 여가';
  if(!$('cNew').value)$('cNewColor').value=palHex(nextPal(cats));
}
$('cType').addEventListener('click',e=>{const b=e.target.closest('[data-ctype]');if(b){S.cType=b.dataset.ctype;$('cErr').textContent='';renderCats()}});
$('clist').addEventListener('click',e=>{
  const d=e.target.closest('[data-cdel]');
  if(d){
    const cats=S.cats[S.cType],id=d.dataset.cdel,rest=cats.filter(x=>x.id!==id);
    if(!rest.length)return;
    const n=S.entries.filter(x=>x.cat===id).length,to=rest[rest.length-1];
    arm(d,n?`삭제 · ${n}건은 ${to.name}(으)로`:'삭제','✕',()=>{
      checkpoint('카테고리 삭제');
      const nowU=Date.now();S.entries.forEach(x=>{if(x.cat===id){x.cat=to.id;x.u=nowU}});
      if(S.settings.budgets)delete S.settings.budgets[id];
      S.cats[S.cType]=rest;
      if(S.cat===id)S.cat=null;
      rebuildMap();renderCats();persist();render();toast('카테고리를 삭제했어요',true);
    });
  }
});
$('clist').addEventListener('input',e=>{
  const sw=e.target.closest('[data-sw]');if(!sw)return;
  const k=S.cats[S.cType].find(x=>x.id===sw.dataset.sw);if(!k)return;
  k.hex=sw.value;rebuildMap();render();persist();
});
$('clist').addEventListener('change',e=>{
  const bd=e.target.closest('[data-bud]');
  if(bd){const v=Math.round(Number(bd.value));const b={...(S.settings.budgets||{})};if(v>0)b[bd.dataset.bud]=v;else delete b[bd.dataset.bud];S.settings.budgets=b;persist();render();return}
  const i=e.target.closest('[data-rn]');if(!i)return;
  const v=i.value.trim(),k=S.cats[S.cType].find(x=>x.id===i.dataset.rn);
  if(!v){i.value=k.name;return}
  if(S.cats[S.cType].some(x=>x.id!==k.id&&x.name===v)){$('cErr').textContent='같은 이름의 카테고리가 이미 있어요.';i.value=k.name;return}
  $('cErr').textContent='';k.name=v;rebuildMap();persist();render();
});
const CAT_COLORS=[
  [['카페','커피','간식','디저트','베이커리'],'#A16207'],
  [['식비','음식','외식','배달','식료품','장보기','마트','식사','밥'],'#F59E0B'],
  [['공과금','관리비','전기','가스','수도','통신','휴대폰','인터넷','월세','주거','집','전세'],'#3B82F6'],
  [['교통','차량','자동차','주유','택시','대중교통','주차'],'#14B8A6'],
  [['의류','패션','옷','신발','가방'],'#8B5CF6'],
  [['화장품','뷰티','미용','헤어','네일'],'#EC4899'],
  [['의료','병원','약','건강','치과'],'#EF4444'],
  [['보험'],'#64748B'],
  [['교육','학원','책','도서','공부','강의','자기계발'],'#6366F1'],
  [['여행','숙소','항공'],'#0EA5E9'],
  [['여가','문화','취미','영화','공연','게임','운동','헬스'],'#06B6D4'],
  [['구독','넷플릭스','유튜브','ott'],'#A855F7'],
  [['쇼핑','생활','생활용품','잡화','온라인'],'#D946EF'],
  [['경조사','선물','모임','회비','축의','부의'],'#F43F5E'],
  [['반려','애완','펫','강아지','고양이'],'#84CC16'],
  [['육아','아이','유아','아기'],'#FB923C'],
  [['세금','공과','과태료'],'#78716C'],
  [['저축','적금','투자','주식','예금'],'#10B981'],
  [['월급','급여','상여','보너스','연봉'],'#22C55E'],
  [['부수입','알바','아르바이트','부업','외주','중고'],'#F97316'],
  [['용돈'],'#38BDF8'],
  [['이자','배당'],'#EAB308'],
  [['환급','환불','캐시백'],'#0EA5E9'],
  [['기타'],'#94A3B8']
];
function suggestColor(name){const n=norm(name);if(!n)return null;for(const [kws,hex] of CAT_COLORS)if(kws.some(k=>n.includes(k)))return hex;return null}
let cColorManual=false;
$('cNew').addEventListener('input',()=>{if(cColorManual)return;const h=suggestColor($('cNew').value);$('cNewColor').value=h||palHex(nextPal(S.cats[S.cType]))});
$('cNewColor').addEventListener('input',()=>{cColorManual=true});
function addCat(){
  const v=$('cNew').value.trim(),cats=S.cats[S.cType];
  if(!v){$('cErr').textContent='이름을 입력해 주세요.';return}
  if(cats.some(x=>x.name===v)){$('cErr').textContent='같은 이름의 카테고리가 이미 있어요.';return}
  const c=nextPal(cats),hex=$('cNewColor').value;
  const nc={id:'c'+uid(),name:v,c};if(/^#[0-9a-f]{6}$/i.test(hex))nc.hex=hex;cats.push(nc);
  $('cNew').value='';$('cErr').textContent='';cColorManual=false;
  rebuildMap();renderCats();persist();render();
}
$('cAdd').onclick=addCat;
$('cNew').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();addCat()}});
$('cDone').onclick=()=>cdlg.close();

/* ---------- sample data ---------- */
function addSample(){
  let seed=S.year*7+3;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647};
  const pick=a=>a[Math.floor(rnd()*a.length)];
  const round=n=>Math.round(n/100)*100;
  const has=id=>!!CATMAP[id];
  const out=S.cats.out,inc=S.cats.in;
  const add=(type,m,d,cat,amount,memo)=>{
    if(!has(cat))cat=(type==='in'?inc:out)[(type==='in'?inc:out).length-1].id;
    S.entries.push({id:uid(),type,date:`${S.year}-${pad(m+1)}-${pad(d)}`,cat,amount:round(amount),memo});
  };
  for(let m=0;m<12;m++){
    const winter=[0,1,11].includes(m)?1:[2,10].includes(m)?.5:0,summer=[6,7].includes(m)?1:0;
    add('in',m,25,'salary',3200000,(m+1)+'월 월급');
    if(rnd()>.55)add('in',m,1+Math.floor(rnd()*27),'side',100000+rnd()*400000,pick(['중고거래','외주 작업','이벤트 당첨']));
    if([0,8].includes(m))add('in',m,10,'allow',300000,'명절 용돈');
    add('out',m,25,'util',38000+summer*52000+rnd()*9000,'전기요금');
    add('out',m,25,'util',9000+winter*78000+rnd()*6000,'도시가스');
    add('out',m,20,'util',55000,'휴대폰 요금');
    add('out',m,15,'util',42000+rnd()*4000,'관리비');
    const nf=6+Math.floor(rnd()*5);
    for(let i=0;i<nf;i++)add('out',m,1+Math.floor(rnd()*27),'food',8000+rnd()*52000,pick(['마트 장보기','점심','배달','카페','저녁 외식','편의점']));
    for(let i=0;i<Math.floor(rnd()*3);i++)add('out',m,1+Math.floor(rnd()*27),'cloth',25000+rnd()*95000,pick(['니트','청바지','운동화','셔츠','외투']));
    for(let i=0;i<Math.floor(rnd()*3);i++)add('out',m,1+Math.floor(rnd()*27),'beauty',12000+rnd()*48000,pick(['선크림','스킨','립스틱','샴푸','마스크팩']));
    add('out',m,1,'trans',50000+rnd()*20000,'교통카드 충전');
    if(rnd()>.4)add('out',m,1+Math.floor(rnd()*27),'trans',9000+rnd()*25000,pick(['택시','주유','KTX']));
    for(let i=0;i<Math.floor(rnd()*3);i++)add('out',m,1+Math.floor(rnd()*27),'etc',6000+rnd()*40000,pick(['병원','선물','구독 서비스','생활용품']));
  }
  S.entries.sort((a,b)=>a.date<b.date?-1:1);
  persist();render();
}

/* ---------- 파일 다운로드 ---------- */
function saveBlob(filename,buf){
  const blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');
  a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),4000);
}
/* ---------- 로그인 ---------- */
let sb=null,ME=null;
function show(id){['auth','home','ledgerView'].forEach(x=>$(x).hidden=x!==id)}
function authUI(){show('auth');$('auErr').textContent='';renderLandingRings();window.scrollTo(0,0)}
async function googleLogin(btn){
  if(INAPP){showInapp(true);return}
  $('auErr').textContent='';document.querySelectorAll('.js-google').forEach(b=>b.disabled=true);
  // 첫 화면을 구글 화면으로 '바꿔치기'해서, 로그인 후 뒤로 가기에 첫 화면이 쌓이지 않게 해요
  const {data,error}=await sb.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.origin+location.pathname,skipBrowserRedirect:true}});
  if(!error&&data&&data.url){location.replace(data.url);return}
  if(error||!data||!data.url){document.querySelectorAll('.js-google').forEach(b=>b.disabled=false);$('auErr').textContent='구글 로그인을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.'}
}
document.querySelectorAll('.js-google').forEach(b=>b.addEventListener('click',()=>googleLogin(b)));
// 구글 화면에서 '뒤로 가기'로 돌아오면 브라우저가 눌린 상태 그대로 페이지를 복원해서, 버튼을 다시 풀어줘요
function resetGoogleButtons(){document.querySelectorAll('.js-google').forEach(b=>b.disabled=false)}
window.addEventListener('pageshow',resetGoogleButtons);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')resetGoogleButtons()});
/* 첫 화면의 열두 달 도넛 (예시 숫자) */
const LN_DEMO=[[350,86],[346,64],[320,63],[367,60],[320,74],[348,58],[320,82],[320,64],[367,77],[320,48],[338,67],[320,85]];
const LN_SPLIT=[['--p0',.27],['--p1',.36],['--p2',.12],['--p3',.1],['--p4',.08],['--p5',.07]];
function renderLandingRings(){
  const box=$('lnRings');if(!box||box.dataset.done)return;box.dataset.done='1';
  const R1=44,R2=31,C1=2*Math.PI*R1,C2=2*Math.PI*R2;
  box.innerHTML=LN_DEMO.map(([inc,out],i)=>{
    const max=Math.max(inc,out);let off=0,segs='';
    for(const [v,f] of LN_SPLIT){const len=out*f/max*C2;segs+=`<circle class="ln-arc" data-len="${(len-1.2).toFixed(1)}" cx="50" cy="50" r="${R2}" fill="none" stroke="var(${v})" stroke-width="9" stroke-dasharray="${(len-1.2).toFixed(1)} ${C2.toFixed(1)}" stroke-dashoffset="${(len).toFixed(1)}" transform="rotate(${-90+off/C2*360} 50 50)" style="transition-delay:${i*70+250}ms"/>`;off+=len}
    const il=inc/max*C1;
    return `<div class="ln-ring"><svg viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="${R1}" fill="none" stroke="var(--empty)" stroke-width="9"/>
      <circle cx="50" cy="50" r="${R2}" fill="none" stroke="var(--empty)" stroke-width="9"/>
      <circle class="ln-arc" cx="50" cy="50" r="${R1}" fill="none" stroke="var(--in)" stroke-width="9" stroke-dasharray="${il.toFixed(1)} ${C1.toFixed(1)}" stroke-dashoffset="${il.toFixed(1)}" transform="rotate(-90 50 50)" style="transition-delay:${i*70}ms"/>
      ${segs}
      <text x="50" y="55" text-anchor="middle" font-size="13" font-weight="700" fill="var(--in)">${Math.round(inc-out)}만</text>
    </svg><span>${i+1}월</span></div>`;
  }).join('');
  requestAnimationFrame(()=>requestAnimationFrame(()=>box.querySelectorAll('.ln-arc').forEach(c=>c.style.strokeDashoffset='0')));
  const mk=$('lnMark');paintMarks();if(false&&mk){let o='',C=2*Math.PI*12;const cols=['--p0','--p1','--p2','--p3','--p4','--p6'];for(let k=0;k<12;k++){o+=`<circle cx="16" cy="16" r="12" fill="none" stroke="var(${cols[k%6]})" stroke-width="6" stroke-dasharray="${(C/12-1.3).toFixed(2)} ${C.toFixed(2)}" transform="rotate(${-90+k*30} 16 16)"/>`}mk.innerHTML=o}
}
function cleanAuthUrl(){
  // 로그인 후 주소창에 남은 일회용 코드(?code=...)나 오류 표시를 지워요
  try{const u=new URL(location.href);let ch=false;
    for(const k of ['code','error','error_code','error_description','state']){if(u.searchParams.has(k)){u.searchParams.delete(k);ch=true}}
    if(u.hash&&/access_token|refresh_token|error/.test(u.hash)){u.hash='';ch=true}
    if(ch)history.replaceState(history.state,'',u.pathname+(u.search?u.search:'')+u.hash);
  }catch(e){}
}
async function startApp(user){
  cleanAuthUrl();
  if(ME&&ME.id===user.id){return}
  ME=user;LS2='gagyebu.v2.'+user.id;IDX=[];LEDGERS={};S.cur=null;
  $('meEmail').textContent=user.email||'';
  loadLocal();IDX.forEach(it=>runFixedFor(it.id));
  show('home');renderHome();
  await connect(user);
}
function clearAuthStorage(){
  try{localStorage.removeItem(LS2)}catch(e){}
  try{Object.keys(localStorage).filter(k=>k.startsWith('sb-')).forEach(k=>localStorage.removeItem(k))}catch(e){}
  try{Object.keys(sessionStorage).filter(k=>k.startsWith('sb-')).forEach(k=>sessionStorage.removeItem(k))}catch(e){}
}
async function logout(){
  // 이 기기의 로그인만 확실히 끊어요. 네트워크가 불안정해도 로그아웃되도록 서버 응답을 기다리지 않아요.
  try{await Promise.race([sb.auth.signOut({scope:'local'}),new Promise(r=>setTimeout(r,1500))])}catch(e){}
  clearAuthStorage();
  location.replace(location.origin+location.pathname);
}
async function deleteAccount(){
  const {error}=await sb.rpc('delete_my_account');
  if(error){toast('계정을 삭제하지 못했어요. 잠시 후 다시 시도해 주세요.');return}
  try{await Promise.race([sb.auth.signOut({scope:'local'}),new Promise(r=>setTimeout(r,1500))])}catch(e){}
  clearAuthStorage();
  alert('계정과 모든 데이터가 삭제됐어요.');location.replace(location.origin+location.pathname);
}
/* 구글 로그인 화면에서 '뒤로 가기'로 되돌아오면, 이미 쓴 로그인 요청이 다시 실행되면서
   주소에 오류(bad_oauth_state 등)가 붙어 돌아와요. 로그인 도구가 이걸 보고 기존 로그인을 지워버리지 않도록,
   도구를 켜기 전에 오류 표시를 먼저 걷어내요. 이미 로그인돼 있으면 그대로 가계부로 들어가요. */
function takeAuthError(){
  try{
    const u=new URL(location.href);
    const hp=new URLSearchParams(u.hash.replace(/^#/,''));
    const code=u.searchParams.get('error_code')||u.searchParams.get('error')||hp.get('error_code')||hp.get('error');
    if(!code)return null;
    for(const k of ['error','error_code','error_description','state'])u.searchParams.delete(k);
    if(hp.has('error'))u.hash='';
    history.replaceState(history.state,'',u.pathname+(u.searchParams.toString()?'?'+u.searchParams:'')+u.hash);
    if(code==='bad_oauth_state'||code==='flow_state_not_found'||code==='flow_state_expired')return null;
    if(code==='access_denied')return '구글 로그인을 취소했어요.';
    return '로그인 중 문제가 생겼어요. 다시 시도해 주세요.';
  }catch(e){return null}
}
async function boot(){
  paintThemeBtns();
  if(!AI_ON)document.querySelectorAll('.menu [data-act="report"]').forEach(b=>b.hidden=true);
  const C=window.APP_CONFIG||{};
  if(!window.supabase||!/^https:\/\//.test(C.SUPABASE_URL||'')||!C.SUPABASE_ANON_KEY||/YOUR_/.test(C.SUPABASE_ANON_KEY)){
    document.querySelector('.wrap').innerHTML='<div class="cfg-err"><b>설정이 필요해요</b><br>config.js에 Supabase 주소와 anon 키를 넣어주세요. 자세한 방법은 README를 확인해 주세요.</div>';return;
  }
  const authNotice=takeAuthError();
  sb=window.supabase.createClient(C.SUPABASE_URL,C.SUPABASE_ANON_KEY,{auth:{flowType:'pkce',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  sb.auth.onAuthStateChange((ev,session)=>{
    if(ev==='SIGNED_IN'&&session)startApp(session.user);
    if(ev==='SIGNED_OUT'){ME=null;authUI()}
  });
  const {data:{session}}=await sb.auth.getSession();
  if(authNotice&&!session)setTimeout(()=>{$('auErr').textContent=authNotice},0);
  if(session)startApp(session.user);else authUI();
}
boot();
$('lgCancel').onclick=()=>lgdlg().close();
$('lgForm').addEventListener('submit',e=>{e.preventDefault();saveLg()});

/* ---------- 앱 설치 (PWA) ---------- */
function paintMarks(){
  const C=2*Math.PI*12,cols=['--p0','--p1','--p2','--p3','--p4','--p6'];let o='';
  for(let k=0;k<12;k++)o+=`<circle cx="16" cy="16" r="12" fill="none" stroke="var(${cols[k%6]})" stroke-width="6" stroke-dasharray="${(C/12-1.3).toFixed(2)} ${C.toFixed(2)}" transform="rotate(${-90+k*30} 16 16)"/>`;
  document.querySelectorAll('#lnMark,.js-mark').forEach(el=>{if(!el.innerHTML)el.innerHTML=o});
}
const isStandalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
const isIOS=()=>/iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
let deferredInstall=null;
function installDismissed(){try{return localStorage.getItem('gagyebu.installHide')==='1'}catch(e){return false}}
function showInstall(mode){
  if(isStandalone()||installDismissed()||INAPP)return;
  const box=$('installBox');if(!box)return;paintMarks();
  if(mode==='ios'){$('installMsg').textContent='Safari 아래 공유 버튼 → "홈 화면에 추가"를 누르면 앱처럼 쓸 수 있어요.';$('installBtn').hidden=true}
  else{$('installMsg').textContent='홈 화면에 추가하면 주소창 없이 앱처럼 열려요.';$('installBtn').hidden=false}
  box.hidden=false;
}
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;showInstall('prompt')});
window.addEventListener('appinstalled',()=>{deferredInstall=null;$('installBox').hidden=true;toast('앱으로 설치했어요')});
$('installBtn').addEventListener('click',async()=>{
  if(!deferredInstall)return;deferredInstall.prompt();
  try{await deferredInstall.userChoice}catch(e){}deferredInstall=null;$('installBox').hidden=true;
});
$('installClose').addEventListener('click',()=>{$('installBox').hidden=true;try{localStorage.setItem('gagyebu.installHide','1')}catch(e){}});
if(isIOS()&&!isStandalone())showInstall('ios');
if('serviceWorker' in navigator&&location.protocol==='https:'){
  window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));
}

/* ---------- 카카오톡 등 앱 안 브라우저 안내 ----------
   구글은 앱 안의 웹 화면에서 로그인을 막고, 이 화면에서는 앱 설치도 안 돼요. */
function cleanUrl(){return location.origin+location.pathname}
function openExternal(){
  const url=cleanUrl();
  if(IS_KAKAO){location.href='kakaotalk://web/openExternal?url='+encodeURIComponent(url);return}
  if(IS_ANDROID){location.href='intent://'+url.replace(/^https?:\/\//,'')+'#Intent;scheme=https;package=com.android.chrome;end';return}
  copyLink(true);
}
async function copyLink(forIOS){
  const url=cleanUrl();let ok=false;
  try{await navigator.clipboard.writeText(url);ok=true}catch(e){
    try{const t=document.createElement('textarea');t.value=url;t.setAttribute('readonly','');t.style.position='fixed';t.style.opacity='0';document.body.appendChild(t);t.select();ok=document.execCommand('copy');t.remove()}catch(e2){}
  }
  toast(ok?(forIOS?'주소를 복사했어요. Safari를 열고 주소창에 붙여넣어 주세요.':'주소를 복사했어요.'):'복사하지 못했어요. 주소창의 주소를 직접 복사해 주세요.');
}
function showInapp(focus){
  const bar=$('inappBar');if(!bar)return;
  $('inappTitle').textContent=`${APP_NAME} 밖에서 열어주세요`;
  $('inappMsg').textContent=IS_KAKAO||IS_ANDROID
    ?`${APP_NAME} 안의 화면에서는 구글 로그인과 앱 설치가 막혀 있어요. 아래 버튼을 누르면 ${IS_ANDROID&&!IS_KAKAO?'크롬':'기본 브라우저'}으로 바로 열려요.`
    :`${APP_NAME} 안의 화면에서는 구글 로그인과 앱 설치가 막혀 있어요. 오른쪽 위 메뉴(··· 또는 공유)에서 "Safari로 열기"를 누르거나, 주소를 복사해 Safari에 붙여넣어 주세요.`;
  $('inappOpen').hidden=!(IS_KAKAO||IS_ANDROID);
  bar.hidden=false;
  const ib=$('installBox');if(ib)ib.hidden=true;
  if(focus){bar.scrollIntoView({behavior:'smooth',block:'start'});bar.animate&&bar.animate([{outline:'2px solid var(--ink)'},{outline:'2px solid transparent'}],{duration:1200})}
}
$('inappOpen').addEventListener('click',openExternal);
$('inappCopy').addEventListener('click',()=>copyLink(!IS_ANDROID&&!IS_KAKAO));
if(INAPP)showInapp(false);

/* ---------- 영수증 사진으로 입력 (폰 안에서 글자 인식, 무료) ----------
   사진은 어디로도 보내지 않고 이 기기에서만 읽어요. 처음 한 번 한국어 인식 데이터를 받아요. */
let RC_RAW='',rcWorker=null,rcIdle=null,rcBusy=false;
function loadTesseract(){
  if(window.Tesseract)return Promise.resolve();
  return new Promise((res,rej)=>{const sc=document.createElement('script');sc.src='vender/tesseract/tesseract.min.js';sc.onload=res;sc.onerror=()=>rej(new Error('load'));document.head.appendChild(sc)});
}
function rcProgress(p,label){
  $('qOut').innerHTML=`<p class="q-msg">${label}</p><div class="rc-prog"><b style="width:${Math.round(p*100)}%"></b></div>`;
}
async function getRcWorker(){
  if(rcWorker)return rcWorker;
  await loadTesseract();
  rcWorker=await Tesseract.createWorker(['kor','eng'],1,{
    workerPath:new URL('vender/tesseract/worker.min.js',location.href).href,
    corePath:new URL('vender/tesseract/core',location.href).href,
    langPath:new URL('vender/tesseract/lang',location.href).href,
    workerBlobURL:false,
    logger:m=>{
      if(m.status==='recognizing text')rcProgress(.35+.65*m.progress,'영수증 글자를 읽고 있어요…');
      else if(/load|initializ/.test(m.status||''))rcProgress(.05+.3*(m.progress||0),'글자 인식 준비 중이에요… (처음 한 번은 조금 걸려요)');
    }
  });
  try{await rcWorker.setParameters({tessedit_pageseg_mode:'6',preserve_interword_spaces:'1'})}catch(e){}
  return rcWorker;
}
function rcScheduleTerminate(){clearTimeout(rcIdle);rcIdle=setTimeout(async()=>{if(rcWorker&&!rcBusy){try{await rcWorker.terminate()}catch(e){}rcWorker=null}},90000)}
// 사진에서 영수증 종이(가장 밝은 부분)만 잘라내고, 글자가 충분히 크게 보이도록 키운 뒤 흑백·대비를 다듬어요
function rcPrepare(file){
  return new Promise((res,rej)=>{
    const img=new Image(),url=URL.createObjectURL(file);
    img.onload=()=>{
      try{
        const W=img.naturalWidth,H=img.naturalHeight;
        // 1) 작은 사본으로 밝은 종이 영역 찾기
        const sw=240,sh=Math.max(1,Math.round(H*sw/W));
        const sc=document.createElement('canvas');sc.width=sw;sc.height=sh;
        const sx=sc.getContext('2d',{willReadFrequently:true});sx.filter='blur(3px)';sx.drawImage(img,0,0,sw,sh);
        const sd=sx.getImageData(0,0,sw,sh).data,lum=new Float32Array(sw*sh);
        for(let k=0;k<sw*sh;k++)lum[k]=.299*sd[k*4]+.587*sd[k*4+1]+.114*sd[k*4+2];
        const sorted=Array.from(lum).sort((a,b)=>a-b),cut=sorted[Math.floor(sorted.length*.55)];
        const xs=[],ys=[];for(let y=0;y<sh;y++)for(let x=0;x<sw;x++)if(lum[y*sw+x]>cut){xs.push(x);ys.push(y)}
        const pct=(arr,q)=>{arr.sort((a,b)=>a-b);return arr[Math.min(arr.length-1,Math.max(0,Math.floor(arr.length*q)))]};
        let x0=0,y0=0,x1=W,y1=H;
        if(xs.length>sw*sh*.15){
          const f=W/sw;x0=Math.max(0,(pct(xs,.01)-2)*f);x1=Math.min(W,(pct(xs,.99)+3)*f);y0=Math.max(0,(pct(ys,.01)-2)*f);y1=Math.min(H,(pct(ys,.99)+3)*f);
          if(x1-x0<W*.25||y1-y0<H*.25){x0=0;y0=0;x1=W;y1=H}
        }
        // 2) 잘라낸 영수증을 가로 1400px 정도로 맞춤 (너무 길면 세로 4200px까지)
        const cw=x1-x0,ch=y1-y0;let s2=1400/cw;if(ch*s2>4200)s2=4200/ch;
        const ow=Math.round(cw*s2),oh=Math.round(ch*s2);
        const c=document.createElement('canvas');c.width=ow;c.height=oh;
        const x=c.getContext('2d',{willReadFrequently:true});x.imageSmoothingQuality='high';
        x.drawImage(img,x0,y0,cw,ch,0,0,ow,oh);
        // 3) 흑백 + 가벼운 대비 (너무 세게 하면 구겨진 그림자가 글자로 읽혀요)
        const d=x.getImageData(0,0,ow,oh),a=d.data;let sum=0;
        for(let k=0;k<a.length;k+=4){const gv=.299*a[k]+.587*a[k+1]+.114*a[k+2];a[k]=a[k+1]=a[k+2]=gv;sum+=gv}
        const mean=sum/(a.length/4);
        for(let k=0;k<a.length;k+=4){let gv=(a[k]-mean)*1.25+mean+10;gv=gv<0?0:gv>255?255:gv;a[k]=a[k+1]=a[k+2]=gv}
        x.putImageData(d,0,0);URL.revokeObjectURL(url);res(c);
      }catch(e){URL.revokeObjectURL(url);rej(e)}
    };
    img.onerror=()=>{URL.revokeObjectURL(url);rej(new Error('img'))};
    img.src=url;
  });
}
// 읽은 글자에서 날짜·가게·합계·결제수단을 골라내요
function parseReceipt(text){
  const raw=String(text||'');
  const lines=raw.split(/\n/).map(l=>l.replace(/\s+/g,' ').trim()).filter(Boolean);
  const flat=lines.join('\n');
  // 금액처럼 생긴 숫자만: 12,880 / 12.880 / 12 880 같은 천 단위 표기, 또는 쉼표 없는 6자리 이하
  const ID_LINE=/(번\s*호|NO\b|No[.:]|무\s*서\s*명|승\s*인\s*번|전\s*표|카\s*드\s*번|거\s*래|사\s*업\s*자|전\s*화|TEL|포\s*인\s*트|고\s*객|바\s*코\s*드|계\s*산\s*대|\*{2,})/i;
  const money=l=>{const out=[];const re=/(\d{1,3}(?:\s?[,.]\s?\d{3})+)(?!\d)|(?<![\d,.])(\d{3,6})(?![\d,.])/g;let m;
    while((m=re.exec(l))){const v=m[1]?+m[1].replace(/[^\d]/g,''):+m[2];if(v>=100&&v<=50000000)out.push({v,comma:!!m[1]})}return out};
  const strong=/(결\s*제\s*금\s*액|승\s*인\s*금\s*액|받\s*을\s*금\s*액|청\s*구\s*금\s*액|카\s*드\s*지\s*불|신\s*용\s*카\s*드\s*지\s*불|지\s*불\s*금\s*액|결\s*제\s*요\s*청)/;
  const mid=/(합\s*[계게]|총\s*액|총\s*금\s*액|판\s*매\s*금\s*액|TOTAL|Total)/;
  const skipLine=/(부\s*가\s*세|과\s*세|면\s*세|봉\s*사\s*료|할\s*인|포\s*인\s*트|VAT)/i;
  const pick=re=>{const found=[];for(let i=0;i<lines.length;i++){if(re.test(lines[i])&&!skipLine.test(lines[i])){let n=money(lines[i]);if(!n.length)n=money(lines[i+1]||'');if(n.length)found.push(Math.max(...n.map(o=>o.v)))}}return found};
  let amount=0;
  const st=pick(strong),md=pick(mid);
  if(st.length)amount=st[0];else if(md.length)amount=md[0];
  if(!amount){
    // 글자가 깨져 단어를 못 찾았을 때: 영수증에 두 번 이상 나온 금액 중 가장 큰 값(합계와 승인금액은 보통 같아요)
    const cands=lines.filter(l=>!ID_LINE.test(l)&&!skipLine.test(l)).flatMap(money).filter(o=>o.comma);
    const cnt={};for(const o of cands)cnt[o.v]=(cnt[o.v]||0)+1;
    const rep=Object.keys(cnt).map(Number).filter(v=>cnt[v]>=2);
    if(rep.length)amount=Math.max(...rep);
    else if(cands.length)amount=Math.max(...cands.map(o=>o.v));
  }
  // 날짜
  let date=null,m;
  if((m=flat.match(/(20\d{2})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/)))date=parseDate(`${m[1]}-${m[2]}-${m[3]}`);
  else if((m=flat.match(/(?:^|[^\d])(\d{2})\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*(\d{1,2})(?!\d)/)))date=parseDate(`20${m[1]}-${m[2]}-${m[3]}`);
  if(date&&date>todayStr(1))date=null;
  if(!date)date=todayStr(0);
  // 가게 이름: '가맹점명/상호' 줄을 먼저, 없으면 위쪽의 한글 줄
  let store='';
  for(const l of lines){const mm=l.match(/(?:상\s*호|가\s*맹\s*점\s*명?|매\s*장\s*명|점\s*포\s*명)\s*[:：;]?\s*(.+)/);if(mm&&/[가-힣]{2,}/.test(mm[1])){store=mm[1];break}}
  if(!store){
    const skip=/(영수증|매출전표|전표|고객용|카드|사업자|등록|대표|주소|전화|TEL|번호|일시|날짜|판매일|금액|합계|부가세|과세|품명|상품명|단가|수량|POS|포스|감사|환영|교환|환불|반품|지참|\d{2,}[-:]\d{2,})/i;
    store=(lines.slice(0,6).find(l=>/[가-힣]{2,}/.test(l)&&!skip.test(l)&&money(l).length===0)||'');
  }
  store=store.replace(/\(\s*주\s*\)|㈜|주식회사/g,'').replace(/[()（）]/g,' ').replace(/[^\w가-힣&\s.-]/g,'').replace(/\s+/g,' ').trim().slice(0,30);
  if(!/[가-힣]{2,}/.test(store))store='';
  // 결제수단·할부
  let pay='cash',inst=1;
  if(/체\s*크/.test(flat))pay='debit';else if(/(신\s*용|카\s*드|승\s*인|일\s*시\s*불|할\s*부)/.test(flat))pay='credit';
  const im=flat.match(/할\s*부\s*(\d{1,2})\s*개?\s*월?/);if(im&&+im[1]>1&&+im[1]<=36)inst=+im[1];
  const memo=store||'영수증';
  let cat=suggestCat('out',memo,'');
  if(cat===fallbackCat('out')){const c2=suggestCat('out',flat.slice(0,400),'');if(c2)cat=c2}
  return amount?{date,type:'out',amount,memo,cat,pay,inst:pay==='credit'?inst:1,dir:'out',peer:''}:null;
}
$('rcFile').addEventListener('change',async e=>{
  const f=e.target.files&&e.target.files[0];e.target.value='';
  if(!f||rcBusy)return;
  if(!/^image\//.test(f.type)){renderQ('사진 파일만 읽을 수 있어요.');return}
  rcBusy=true;clearTimeout(rcIdle);
  try{
    rcProgress(.02,'사진을 준비하고 있어요…');
    const canvas=await rcPrepare(f);
    const w=await getRcWorker();
    const {data}=await w.recognize(canvas);
    RC_RAW=(data&&data.text||'').trim();
    const item=parseReceipt(RC_RAW);
    if(item){QITEMS=[item];renderQ(null,'receipt')}
    else{QITEMS=[];renderQ('영수증에서 금액을 찾지 못했어요. 영수증이 화면에 꽉 차고 밝게 나오도록 다시 찍어보세요.')}
  }catch(err){
    renderQ(err&&err.message==='load'?'글자 인식 도구를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.':'영수증을 읽지 못했어요. 다른 사진으로 다시 시도해 주세요.');
  }finally{rcBusy=false;rcScheduleTerminate()}
});


/* 첫 화면 계절 배경: 지금 계절부터 시작해요 (3~5월 봄, 6~8월 여름, 9~11월 가을, 12~2월 겨울) */
(function(){
  const box=$('seasons');if(!box)return;
  const m=new Date().getMonth()+1,idx=m>=3&&m<=5?0:m>=6&&m<=8?1:m>=9&&m<=11?2:3;
  box.style.setProperty('--st',(-idx*12)+'s');
  box.children[idx]&&box.children[idx].classList.add('now');
})();
document.addEventListener('visibilitychange',()=>document.documentElement.classList.toggle('is-hidden',document.visibilityState!=='visible'));
