(function(root){const DAY=86400000,MIN=60000;
// Calendar days: a word studied late at night is available the next morning.
function dueInDays(now,days){const d=new Date(now);d.setHours(0,0,0,0);d.setDate(d.getDate()+days);return d.getTime()}
function schedule(old,grade,now=Date.now()){
 const c={stage:'learning',step:0,reps:0,ease:2.5,days:0,lapses:0,...old};
 let days,ease=c.ease;
 if(grade==='again'){days=1;return {...c,stage:'learning',step:0,reps:0,days,lapses:c.lapses+1,ease:Math.max(1.3,ease-.2),due:dueInDays(now,days),scheduleVersion:2}}
 if(grade==='hard'){days=2;ease=Math.max(1.3,ease-.15);return {...c,days,ease,due:dueInDays(now,days),scheduleVersion:2}}
 days=c.stage==='learning'?3:c.reps===1?6:Math.max(3,Math.ceil(c.days*ease));
 days=Math.min(365,days);
 return {...c,stage:'review',step:0,reps:c.stage==='learning'?1:c.reps+1,days,ease,due:dueInDays(now,days),scheduleVersion:2}
}
function migrateDaily(state){
 let changed=false;const latest={};for(const e of state.events||[]){if(!latest[e.word]||e.time>latest[e.word].time)latest[e.word]=e}
 for(const [word,c] of Object.entries(state.learningCards||{})){
  if(c.scheduleVersion===2)continue;
  const e=latest[word];
  if(c.stage==='learning'&&e){const days=e.grade==='again'?1:e.grade==='hard'?2:3;c.days=days;c.due=dueInDays(e.time,days);if(e.grade==='good'){c.stage='review';c.reps=1;c.step=0}}
  c.scheduleVersion=2;changed=true;
 }
 return changed;
}
function dayKey(d=new Date()){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function ensureBooks(state){
 if(!state.books)state.books={personal:{name:'Personal Wordbook',words:Object.keys(state.savedWords||{})}};
 if(!Array.isArray(state.selectedBookIds))state.selectedBookIds=Object.keys(state.books);
}
function selectedWords(state){
 if(!state.books)return state.savedWords||{};
 const keys=new Set((state.selectedBookIds||Object.keys(state.books)).flatMap(id=>state.books[id]?.words||[]));
 return Object.fromEntries([...keys].filter(w=>state.savedWords[w]).map(w=>[w,state.savedWords[w]]));
}
function sessionWords(state,kind,now=Date.now()){
 const words=selectedWords(state),day=dayKey(new Date(now)),session=state.studySessions?.[kind];
 const valid=w=>words[w]&&(kind==='learn'?!state.learningCards[w]:state.learningCards[w]?.due<=now);
 const skipped=state.skippedWords?.day===day?state.skippedWords.words:[];
 const unresolved=new Set(state.definitionCache?.missing||[]);
 const available=w=>!unresolved.has(w)||!!(words[w]?.m||words[w]?.zh);
 if(session?.day===day&&session.remaining.some(w=>valid(w)&&!skipped.includes(w)&&available(w)))return session.remaining.filter(w=>valid(w)&&!skipped.includes(w)&&available(w));
 const candidates=kind==='review'?queues(state,now).due:Object.keys(words).filter(w=>!state.learningCards[w]).sort((a,b)=>(words[a].addedAt||0)-(words[b].addedAt||0));
 return candidates.filter(w=>!skipped.includes(w)&&available(w)).slice(0,Number(kind==='review'?state.settings.reviewLimit:state.settings.newLimit));
}
function beginSession(state,kind,now=Date.now()){
 const remaining=sessionWords(state,kind,now),day=dayKey(new Date(now));state.studySessions||={};
 const old=state.studySessions[kind];
 if(old?.day===day&&old.remaining.some(w=>remaining.includes(w)))return state.studySessions[kind]={...old,remaining,total:old.completed+remaining.length};
 return state.studySessions[kind]={day,number:old?.day===day?old.number+1:1,completed:0,total:remaining.length,remaining};
}
function queues(state,now=Date.now()){const cards=state.learningCards||{},words=selectedWords(state),events=state.events||[];const used=new Set(events.filter(e=>e.day===dayKey(new Date(now))&&e.first).map(e=>e.word)).size;const due=Object.keys(cards).filter(w=>words[w]&&cards[w].due<=now).sort((a,b)=>(cards[a].stage==='learning'?0:1)-(cards[b].stage==='learning'?0:1)||cards[a].due-cards[b].due);const fresh=Object.keys(words).filter(w=>!cards[w]).sort((a,b)=>words[a].addedAt-words[b].addedAt).slice(0,Math.max(0,Number(state.settings.newLimit)*(1+Number((state.extraGroups||{})[dayKey(new Date(now))]||0))-used));return {due,fresh}}
const api={schedule,dayKey,queues,migrateDaily,dueInDays,ensureBooks,selectedWords,sessionWords,beginSession};if(typeof module!=='undefined')module.exports=api;else root.Repetition=api;})(typeof window!=='undefined'?window:globalThis);
