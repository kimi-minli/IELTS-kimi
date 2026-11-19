/* Static-host adapter: every visitor owns a separate IndexedDB database. */
(() => {
 'use strict';
 const nativeFetch=window.fetch.bind(window),base=new URL('./',document.currentScript.src);
 const json=(status,value)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
 let dictionaryPromise;
 const dictionary=()=>dictionaryPromise||(dictionaryPromise=nativeFetch(new URL('assets/dictionary.json',base)).then(r=>{if(!r.ok)throw Error('Dictionary download failed. Reload to retry.');return r.json()}).catch(e=>{dictionaryPromise=null;throw e}));
 const dbPromise=new Promise((resolve,reject)=>{
  const req=indexedDB.open('ielts-kimi-v1',1);
  req.onupgradeneeded=()=>req.result.createObjectStore('records');
  req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(Error('Browser storage is unavailable.'));
 });
 function initialState(entries){return {cards:{},log:[],savedWords:entries,learningCards:{},events:[],checkIns:[],settings:{newLimit:20,reviewLimit:40,accent:'en-US',autoSpeak:false,pronunciationVersion:1},books:{personal:{name:'Personal Wordbook',words:[]},ielts:{name:'IELTS Vocabulary',words:Object.keys(entries)}},selectedBookIds:['ielts'],historical:{},definitionCache:{total:Object.keys(entries).length,available:Object.values(entries).filter(e=>e.m||e.zh).length,missing:Object.keys(entries).filter(w=>!entries[w].m&&!entries[w].zh)}}}
 const catalog=()=>nativeFetch(new URL('assets/wordbooks.json',base)).then(r=>{if(!r.ok)throw Error('Wordbooks download failed.');return r.json()});
 async function read(){
  const db=await dbPromise;
  const old=await new Promise((resolve,reject)=>{const r=db.transaction('records').objectStore('records').get('main');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
  if(old?.state.publicWordbooksVersion===2)return old;
  const [entries,books]=await Promise.all([dictionary(),catalog()]);
  return new Promise((resolve,reject)=>{const t=db.transaction('records','readwrite'),store=t.objectStore('records');let value;const r=store.get('main');r.onsuccess=()=>{
   value=r.result;
   if(value?.state.publicWordbooksVersion===2)return;
   const fresh=!value;
   value=value||{revision:0,state:initialState(entries)};
   const state=value.state;
   state.savedWords={...entries,...state.savedWords};
   let id='kimi';while(state.books[id])id+='-shared';
   state.books[id]=books.kimi;
   if(fresh){state.books.ielts=books.ielts;state.selectedBookIds=[id,'ielts']}
   else {state.selectedBookIds=[...new Set([...state.selectedBookIds,id])];value.revision++}
   state.publicWordbooksVersion=2;store.put(value,'main');
  };t.oncomplete=()=>resolve(value);t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error)});
 }
 function validate(s){
  if(!s||!s.cards||!Array.isArray(s.log)||!s.settings||!s.savedWords||!Array.isArray(s.events)||!s.books?.personal||!Array.isArray(s.selectedBookIds))throw Error('Invalid study backup');
  if(![10,20,30].includes(Number(s.settings.newLimit))||![20,40,60].includes(Number(s.settings.reviewLimit))||!['en-US','en-GB'].includes(s.settings.accent)||typeof s.settings.autoSpeak!=='boolean')throw Error('Invalid settings');
  for(const [key,w] of Object.entries(s.savedWords))if(!w||w.w!==key||typeof w.m!=='string'||!Array.isArray(w.p))throw Error('Invalid word');
  for(const b of Object.values(s.books))if(typeof b.name!=='string'||!b.name.trim()||b.name.length>60||!Array.isArray(b.words)||b.words.some(w=>!Object.hasOwn(s.savedWords,w))||new Set(b.words).size!==b.words.length)throw Error('Invalid wordbooks');
  if(s.selectedBookIds.some(id=>!Object.hasOwn(s.books,id)))throw Error('Invalid selected wordbooks');
  for(const e of s.events)if(!e||typeof e.word!=='string'||!['again','hard','good'].includes(e.grade)||!Number.isFinite(e.time)||!Number.isFinite(e.seconds)||e.seconds<0||!/^\d{4}-\d{2}-\d{2}$/.test(e.day))throw Error('Invalid study event');
  for(const c of Object.values(s.learningCards||{}))if(!Number.isFinite(c.due)||!Number.isFinite(c.days)||c.days<0)throw Error('Invalid review schedule');
  if(s.checkIns&&(!Array.isArray(s.checkIns)||new Set(s.checkIns.map(c=>c.day)).size!==s.checkIns.length||s.checkIns.some(c=>!/^\d{4}-\d{2}-\d{2}$/.test(c.day)||!Number.isFinite(c.time)||!Number.isFinite(c.secondsAtCheckIn)||c.secondsAtCheckIn<0)))throw Error('Invalid check-ins');
 }
 async function save(body){
  validate(body.state);const db=await dbPromise;
  return new Promise((resolve,reject)=>{const t=db.transaction('records','readwrite'),store=t.objectStore('records');let result;
   const r=store.get('main');r.onsuccess=()=>{const old=r.result;if(!old||old.revision!==body.revision){result=json(409,{error:'Another tab saved newer records. Back up this tab before reloading.'});return}const next={revision:old.revision+1,savedAt:new Date().toISOString(),state:body.state};store.put(old,'backup-last');store.put(next,'main');result=json(200,{revision:next.revision,savedAt:next.savedAt})};
   t.oncomplete=()=>resolve(result);t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error||Error('Save interrupted'));
  });
 }
 window.fetch=async(input,options={})=>{
  const url=new URL(typeof input==='string'?input:input.url,location.href),method=(options.method||'GET').toUpperCase();
  if(url.origin!==location.origin||!url.pathname.startsWith('/api/'))return nativeFetch(input,options);
  try{
   if(url.pathname==='/api/study')return method==='GET'?json(200,await read()):method==='PUT'?await save(JSON.parse(options.body)):json(405,{error:'Method not allowed'});
   if(url.pathname==='/api/word-notes')return nativeFetch(new URL('assets/word-notes.json',base),options);
   if(url.pathname==='/api/search'){const q=(url.searchParams.get('q')||'').trim().toLowerCase(),all=await dictionary();return json(200,Object.keys(all).filter(w=>w.toLowerCase().includes(q)).sort((a,b)=>Number(b.toLowerCase().startsWith(q))-Number(a.toLowerCase().startsWith(q))||a.length-b.length).slice(0,25).map(w=>({w,parts:0})))}
   if(url.pathname==='/api/word'){
    const word=(url.searchParams.get('q')||'').trim();if(!/^[\p{L}][\p{L} .’'…/()-]{0,79}$/u.test(word))return json(400,{error:'Enter an English word'});
    const all=await dictionary(),entry=all[word]||all[word.toLowerCase()];if(entry?.canStudy)return json(200,entry);
    const r=await nativeFetch('https://api.dictionaryapi.dev/api/v2/entries/en/'+encodeURIComponent(word),{signal:options.signal||AbortSignal.timeout(5000)});if(!r.ok)return json(404,{error:'No dictionary entry found. Try another spelling.'});
    const [d]=await r.json();return json(200,{w:word,m:d.meanings.flatMap(m=>m.definitions.map(x=>m.partOfSpeech+'. '+x.definition)).join('\n'),p:[],o:'',phonetic:d.phonetic||'',example:d.meanings.flatMap(m=>m.definitions).find(x=>x.example)?.example||'',canStudy:true,source:'https://dictionaryapi.dev/'});
   }
   return json(404,{error:'Not found'});
  }catch(e){return json(503,{error:e.message||'Browser storage or dictionary is unavailable.'})}
 };
 if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register(new URL('sw.js',base),{scope:base.pathname}).catch(()=>{}));
})();
