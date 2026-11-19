let wordNotes={};
const $=id=>document.getElementById(id),R=Repetition;let state,revision=0,ready=false,busy=false,pending=false,page='today',current=null,queue=[],mode='lookup',revealed=false,month=new Date(),elapsed=0,lastTick=performance.now(),interaction=Date.now(),searchToken=0;month.setDate(1);
const n=x=>Number(x||0).toLocaleString('en-GB');function note(s){$('notice').textContent=s}function status(s){$('saveStatus').textContent=s}function normalize(s){s.savedWords=s.savedWords||{};s.learningCards=s.learningCards||{};s.events=s.events||[];R.ensureBooks(s);return s}
async function init(){try{const res=await fetch('/api/study');if(!res.ok)throw Error('Storage unavailable');const data=await res.json();try{const notes=await fetch('/api/word-notes');if(notes.ok)wordNotes=(await notes.json()).entries||{}}catch{}revision=data.revision;state=normalize(data.state||{cards:{},log:[],settings:{newLimit:20,reviewLimit:40,accent:'en-US',autoSpeak:false}});const accentMigrated=!state.settings.pronunciationVersion;if(accentMigrated){state.settings.accent='en-US';state.settings.pronunciationVersion=1}ready=true;syncAccent();status('Connected. Records are saved in this browser.');for(const key of ['newLimit','reviewLimit','accent','autoSpeak']){const el=$(key);if(el.type==='checkbox')el.checked=state.settings[key];else el.value=state.settings[key]}const recovery=localStorage.getItem('kimi-pending');const migrated=R.migrateDaily(state);update();if((migrated||accentMigrated)&&!recovery)await persist();if(localStorage.getItem('kimi-pending'))note('An unsaved recovery copy exists in this browser. Download it in Settings before restoring or reloading.')}catch(e){note('Could not load records: '+e.message+'. Allow browser storage and reload the page.')}}
async function persist(){if(busy)return false;busy=true;pending=true;status('Saving…');try{localStorage.setItem('kimi-pending',JSON.stringify(state))}catch{}try{const res=await fetch('/api/study',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision,state})});const data=await res.json();if(!res.ok)throw Error(data.error);revision=data.revision;pending=false;try{localStorage.removeItem('kimi-pending')}catch{}status('Saved at '+new Date().toLocaleTimeString('en-GB'));return true}catch(e){status('Not saved: '+e.message);note('Save failed. Your changes remain in this page. Retry saving or download a backup.');return false}finally{busy=false;update()}}
function view(name){if(window.speechSynthesis)speechSynthesis.cancel();if(name!=='study')searchToken++;page=name;for(const id of ['today','words','records','settings','study'])$(id).hidden=id!==name;document.querySelectorAll('[data-page]').forEach(b=>b.classList.toggle('selected',b.dataset.page===name));note('');if(ready)update();window.scrollTo(0,0)}
function update(){if(!ready)return;renderCheckIn();const q=R.queues(state);$('learnCount').textContent=groupWords('learn').length;$('reviewCount').textContent=groupWords('review').length;renderBookSelectors();const studied=new Set(state.events.map(e=>e.word)),saved=Object.keys(R.selectedWords(state)),graduated=saved.filter(w=>studied.has(w)).length;$('newProgressWrap').hidden=!saved.length;$('newProgress').max=Math.max(1,saved.length);$('newProgress').value=graduated;$('newProgressLabel').textContent=graduated+' / '+saved.length;const h=state.historical||{};$('progress').max=h.collectionTotal||1;$('progress').value=h.collectionLearned||0;$('progressLabel').textContent=n(h.collectionLearned)+' / '+n(h.collectionTotal)+' · '+((h.collectionLearned||0)/(h.collectionTotal||1)*100).toFixed(1)+'%';$('migrationNote').textContent=state.books?.ielts?'IELTS vocabulary imported from a public word list; original Bubei book membership and review dates are not yet reconciled.':state.importInfo?n(state.importInfo.unique)+' Bubei words imported. IELTS-only words and original review dates are still pending.':'Imported collection progress · '+n(h.newRemaining)+' new and '+n(h.reviewPending)+' review word identities still awaiting migration.';const future=Object.keys(R.selectedWords(state)).map(w=>state.learningCards[w]?.due).filter(Number.isFinite).filter(t=>t>Date.now()).sort((a,b)=>a-b)[0];$('nextDue').textContent=future?'Next review: '+new Date(future).toLocaleString('en-GB'):Object.keys(R.selectedWords(state)).length?'Your selected words are ready to learn.':'Your wordbook is empty. Search above and star a word to begin.';if(page==='words')renderWords();if(page==='records')records()}
async function lookup(word){if(!ready)return;word=word.trim();if(!word)return;const token=++searchToken;mode='lookup';current=null;$('definitionActions').hidden=true;$('nextGroup').hidden=true;view('study');$('card').hidden=true;$('studyEmpty').hidden=false;$('studyEmpty').textContent='Searching for “'+word+'”…';$('sessionCount').textContent='Search results';$('groupProgress').hidden=true;$('resultQuery').value=word;$('resultSearch').hidden=false;try{let entry=state.savedWords[word]||state.savedWords[word.toLowerCase()];if(!entry?.m&&!entry?.zh){const res=await fetch('/api/word?q='+encodeURIComponent(word),{signal:AbortSignal.timeout(5000)});entry=await res.json();if(!res.ok)throw Error(entry.error)}if(token!==searchToken||page!=='study')return;current=entry;revealed=true;showCard()}catch(e){if(token===searchToken&&page==='study'){$('studyEmpty').textContent=e.message;$('card').hidden=true}}}
function showCard(){if(!current)return;current={...current,...(wordNotes[current.w]||{})};if(/Word-part analysis imported|No verified word-part/.test(current.o||'')&&!current.etymologySource)current={...current,p:[],o:''};if(window.speechSynthesis)speechSynthesis.cancel();$('nextGroup').hidden=true;$('studyEmpty').hidden=true;$('card').hidden=false;$('word').textContent=current.w;$('phonetic').textContent=current.phonetic||'';$('meaning').textContent=current.m;$('chineseMeaning').textContent=current.zh||'Chinese definitions are not available for this entry yet.';$('chineseMeaning').hidden=true;$('toggleChinese').textContent='Show Chinese';$('toggleChinese').setAttribute('aria-expanded','false');const originText=/Word-part analysis imported|No verified word-part|has not been added/.test(current.o||'')?'':current.o||'';$('origin').textContent=originText;$('origin').hidden=!originText;$('originTitle').hidden=!originText;$('partsLegend').hidden=!current.p?.length;$('etymologySource').hidden=!current.etymologySource;$('etymologySource').href=current.etymologySource||'';$('example').textContent=current.example||'';$('exampleSense').textContent=current.exampleSense||'';$('exampleSense').hidden=!current.exampleSense;$('exampleSource').hidden=!current.exampleSource;$('exampleSource').href=current.exampleSource||'';$('exampleRow').hidden=!current.example?.trim();syncAccent();$('parts').replaceChildren();for(const [part,meaning,color] of current.p||[]){const div=document.createElement('div');div.className='part '+(['pink','blue','green'].includes(color)?color:'blue');const b=document.createElement('b');b.textContent=part;const p=document.createElement('p');p.textContent=meaning;div.append(b,p);$('parts').append(div)}$('parts').hidden=!current.p?.length&&!current.structure;if(!current.p?.length)$('parts').textContent=current.structure||'';updateStar();$('answer').hidden=!revealed;$('reveal').hidden=revealed;$('ratings').hidden=mode==='lookup'||!revealed;$('resultSearch').hidden=mode!=='lookup';updateGroupProgress();$('studyHint').textContent=mode==='lookup'?'Select ☆ to save this word and include it in your learning plan.':'Choose a rating to save your answer and continue.';elapsed=0;interaction=Date.now();if(state.settings.autoSpeak&&mode!=='lookup')speak()}
function isPersonal(word){return !!state.books?.personal?.words.includes(word)}
function wordBooks(word){return Object.keys(state.books).filter(id=>state.books[id].words.includes(word))}
function updateStar(){if(!current)return;const ids=wordBooks(current.w);$('star').textContent=ids.length?'★':'☆';$('star').setAttribute('aria-pressed',String(!!ids.length));$('star').setAttribute('aria-label','Choose wordbooks for '+current.w);$('star').title=ids.length?'Saved in '+ids.map(bookLabel).join(', '):'Save to wordbooks'}
let savingWord=null,bookChoices=[];
function openSaveBooks(word=current){
 if(!ready||busy||pending||!word)return;savingWord=word;bookChoices=[];
 $('saveBookWord').textContent=word.w;$('saveBookOptions').replaceChildren();$('saveBookStatus').textContent='';
 for(const id of Object.keys(state.books)){const label=document.createElement('label'),input=document.createElement('input'),span=document.createElement('span');input.type='checkbox';input.checked=state.books[id].words.includes(word.w);span.textContent=bookLabel(id);label.append(input,span);$('saveBookOptions').append(label);bookChoices.push({id,input})}
 $('saveBookDialog').showModal();
}
$('closeSaveBooks').onclick=()=>$('saveBookDialog').close();
$('saveBookConfirm').onclick=async()=>{
 if(!savingWord||busy||pending)return;const word=savingWord,key=word.w;
 const chosen=bookChoices.filter(x=>x.input.checked).map(x=>x.id);
 if(chosen.length&&!state.savedWords[key]&&!word.canStudy){$('saveBookStatus').textContent='A definition is required before saving this word.';return}
 if(chosen.length)state.savedWords[key]||={...word,addedAt:Date.now()};
 for(const [id,book] of Object.entries(state.books)){book.words=book.words.filter(w=>w!==key);if(chosen.includes(id))book.words.push(key)}
 $('saveBookConfirm').disabled=true;const ok=await persist();$('saveBookConfirm').disabled=false;updateStar();
 if(ok){$('saveBookDialog').close();note(chosen.length?'Saved to '+chosen.map(bookLabel).join(', ')+'.':'Removed from wordbooks. Learning history retained.')}else{$('saveBookStatus').textContent='Not saved. Retry saving in Settings.'}
};
function bookLabel(id){return ({personal:'Personal Wordbook',ielts:'IELTS Vocabulary'})[id]||state.books[id].name}
function renderBookSelectors(){
 const missing=(state.definitionCache?.missing||[]).filter(w=>!state.savedWords[w]?.m&&!state.savedWords[w]?.zh);$('offlineStatus').textContent=missing.length?missing.length+' entries still need definitions and are temporarily excluded from study groups. They remain in your wordbooks.': 'Wordbook definitions are stored locally.';$('offlineMissing').textContent=missing.join(' · ');
 const select=$('importBook'),keys=Object.keys(state.books),keySignature=JSON.stringify(keys);
 if(select.bookSignature!==keySignature){const previous=select.value;select.replaceChildren();for(const id of keys){const option=document.createElement('option');option.value=id;option.textContent=bookLabel(id);select.append(option)}select.value=keys.includes(previous)?previous:'personal';select.bookSignature=keySignature;}
 for(const hostId of ['wordBooks']){
  const host=$(hostId);const signature=JSON.stringify([state.selectedBookIds,Object.entries(state.books).map(([id,b])=>[id,b.words.length])]);
  if(host.bookSignature===signature)continue;host.bookSignature=signature;host.replaceChildren();
  for(const [id,book] of Object.entries(state.books)){
   const label=document.createElement('label'),input=document.createElement('input'),text=document.createElement('span');const bookName=bookLabel(id);
   input.type='checkbox';input.checked=state.selectedBookIds.includes(id);input.setAttribute('aria-label',bookName);
   input.onchange=async()=>{if(busy||pending){input.checked=state.selectedBookIds.includes(id);return}state.selectedBookIds=input.checked?[...new Set([...state.selectedBookIds,id])]:state.selectedBookIds.filter(x=>x!==id);wordPage=0;await persist()};
   text.textContent=bookName+' · '+n(book.words.length);label.append(input,text);host.append(label);
  }
  const count=document.createElement('small');count.textContent='Selected: '+n(Object.keys(R.selectedWords(state)).length)+' unique words';host.append(count);
 }
}

let groupNumber=1, groupTotal=0;
function groupWords(kind){return R.sessionWords(state,kind)}
function updateGroupProgress(){
  $('sessionCount').textContent=mode==='lookup'?'Search results':
    (mode==='learn'?'Learn':'Review')+' · Group '+groupNumber+' · '+(groupTotal-queue.length)+' / '+groupTotal+' completed';
  $('groupProgress').hidden=mode==='lookup'||groupTotal===0;
  $('groupProgress').max=Math.max(1,groupTotal);
  $('groupProgress').value=groupTotal-queue.length;
}
async function start(kind){
 if(!ready||pending||busy){note('Wait for records to finish saving.');return}
 const token=++searchToken;const session=R.beginSession(state,kind);groupNumber=session.number;groupTotal=session.total;queue=[...session.remaining];mode=kind;
 if(!await persist()||token!==searchToken)return;
 view('study');$('resultSearch').hidden=true;updateGroupProgress();next();
}
async function next(){const token=++searchToken;revealed=false;$('definitionActions').hidden=true;$('nextGroup').hidden=true;if(!queue.length){const remaining=groupWords(mode).length;
$('nextGroup').hidden=remaining===0;
$('nextGroup').textContent='Continue next group · '+remaining+' words';
$('card').hidden=true;$('studyEmpty').hidden=false;
const nextTime=Object.keys(R.selectedWords(state)).map(w=>state.learningCards[w]?.due).filter(x=>x>Date.now()).sort((a,b)=>a-b)[0];
$('studyEmpty').textContent=(groupTotal?'Group '+groupNumber+' complete. ':'')+(remaining?'Ready for another group.':mode==='review'?'All due reviews are finished.':'No new words available in the selected wordbooks.')+(nextTime?' Next review: '+new Date(nextTime).toLocaleString('en-GB')+'.':'');
if(state.skippedWords?.day===R.dayKey()&&state.skippedWords.words.length)$('studyEmpty').textContent+=' Words skipped for missing definitions will be available tomorrow.';updateGroupProgress();return}current=state.savedWords[queue[0]];if(!current){queue.shift();next();return}if(!current.m&&!current.zh){$('card').hidden=true;$('studyEmpty').hidden=false;$('studyEmpty').textContent='Loading definition for '+current.w+'…';const key=current.w;try{const res=await fetch('/api/word?q='+encodeURIComponent(key),{signal:AbortSignal.timeout(5000)});const entry=await res.json();if(!res.ok||!entry.canStudy)throw Error(entry.error||'Definition unavailable. Please retry when the dictionary is connected.');if(token!==searchToken||page!=='study'||queue[0]!==key||mode==='lookup')return;current={...current,...entry,w:key};state.savedWords[key]=current;}catch(e){if(token!==searchToken||page!=='study'||mode==='lookup')return;$('studyEmpty').textContent=key+' · '+e.message;$('definitionActions').hidden=false;return}}revealed=!state.learningCards[current.w];showCard()}
async function grade(g){
 if(!ready||busy||pending||mode==='lookup'||!revealed||!queue.length||current?.w!==queue[0]||!['again','hard','good'].includes(g))return;
 const key=current.w,old=state.learningCards[key],now=Date.now(),card=R.schedule(old,g,now),token=searchToken,kind=mode;
 state.learningCards[key]=card;state.events.push({id:crypto.randomUUID(),word:key,grade:g,kind,first:!old,graduated:card.stage==='review'&&old?.stage!=='review',time:now,day:R.dayKey(new Date(now)),seconds:Math.round(elapsed)});
 queue.shift();const session=state.studySessions?.[kind];if(session){session.remaining=[...queue];session.completed++;}
 revealed=false;$('ratings').hidden=true;
 const ok=await persist();if(token!==searchToken||page!=='study'||mode!==kind)return;
 if(ok)next();else $('studyHint').textContent='Answer retained but not saved. Open Settings and retry saving before continuing.';
}
async function skipDefinition(){
 if(busy||pending||!queue.length)return;const key=queue.shift(),day=R.dayKey();
 if(state.skippedWords?.day!==day)state.skippedWords={day,words:[]};state.skippedWords.words.push(key);groupTotal--;
 const session=state.studySessions?.[mode];if(session){session.remaining=[...queue];session.total=groupTotal;}
 const token=searchToken;if(await persist()&&token===searchToken&&page==='study')next();
}
function syncAccent(){for(const id of ['accent','wordAccent'])$(id).value=state.settings.accent}
async function changeAccent(id){
 if(!ready)return;
 if(pending||busy){syncAccent();note('Please wait for storage.');return}
 const value=$(id).value;if(!['en-US','en-GB'].includes(value))return;
 if(window.speechSynthesis)speechSynthesis.cancel();
 state.settings.accent=value;syncAccent();await persist();
}
function speak(text=current?.w){
 if(typeof text!=='string'||!text.trim())return;
 if(!window.speechSynthesis){note('Speech playback is unavailable in this browser.');return}
 speechSynthesis.cancel();
 const speech=new SpeechSynthesisUtterance(text);
 speech.lang=state.settings.accent;speech.rate=.85;
 const voices=speechSynthesis.getVoices();
 const matches=voices.filter(v=>v.lang.replace('_','-').toLowerCase()===speech.lang.toLowerCase());
 speech.voice=matches.find(v=>v.localService)||matches[0]||null;
 speech.onerror=e=>{if(!['canceled','interrupted'].includes(e.error))note('Audio could not play. Check your browser voice settings and try again.')};
 speechSynthesis.speak(speech);
}
function spellingDistance(a,b){
 const d=Array.from({length:a.length+1},(_,i)=>Array.from({length:b.length+1},(_,j)=>i===0?j:j===0?i:0));
 for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++){
  d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
  if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])d[i][j]=Math.min(d[i][j],d[i-2][j-2]+1);
 }return d[a.length][b.length];
}
function renderWordSuggestions(q,count){
 const host=$('wordSuggestions');host.replaceChildren();if(count||q.length<3||q.length>40)return;
 const active=R.selectedWords(state);
 const members=new Set(Object.values(state.books).flatMap(b=>b.words));const candidates=Object.values(state.savedWords).filter(w=>members.has(w.w)).map(w=>{const text=w.w.toLowerCase();return {w:w.w,score:Math.min(spellingDistance(q,text),spellingDistance(q,text.slice(0,q.length)))}}).filter(x=>x.score<=(q.length>5?2:1)).sort((a,b)=>a.score-b.score||a.w.length-b.w.length).slice(0,5);
 if(!candidates.length)return;const label=document.createElement('span');label.textContent='Did you mean: ';host.append(label);
 for(const {w} of candidates){const button=document.createElement('button');button.type='button';button.textContent=w+(active[w]?'':' · in another wordbook');button.onclick=()=>{if(active[w]){$('wordFilter').value=w;wordPage=0;renderWords()}else lookup(w)};host.append(button)}
}
let wordPageSize=20,wordPage=0;
function renderWords(){
 const q=$('wordFilter').value.trim().toLowerCase();
 const words=Object.values(R.selectedWords(state)).filter(w=>(w.w+' '+(w.m||'')).toLowerCase().includes(q));
 renderWordSuggestions(q,words.length);const pages=Math.max(1,Math.ceil(words.length/wordPageSize));
 wordPage=Math.max(0,Math.min(wordPage,pages-1));
 $('wordList').replaceChildren();
 for(const word of words.slice(wordPage*wordPageSize,(wordPage+1)*wordPageSize)){const row=document.createElement('div');row.className='wordrow';const name=document.createElement('button');name.className='name';name.textContent=word.w;name.onclick=()=>lookup(word.w);const small=document.createElement('small');const card=state.learningCards[word.w];small.textContent=card?'Next review: '+new Date(card.due).toLocaleString('en-GB'):word.imported?'Imported · Previous learning status unavailable':'New · Not learned yet';name.append(small);const star=document.createElement('button');star.className='star';star.textContent=wordBooks(word.w).length?'★':'☆';star.setAttribute('aria-label','Choose wordbooks for '+word.w);star.title=wordBooks(word.w).map(bookLabel).join(', ');star.onclick=()=>openSaveBooks(word);row.append(name,star);$('wordList').append(row)}
 if(!words.length)$('wordList').textContent=q?'No matching saved words.':'No saved words yet. Search on Today and select ☆.';
 const pager=$('wordPagination');pager.replaceChildren();pager.hidden=!words.length;
 $('wordRange').textContent=words.length?`${wordPage*wordPageSize+1}–${Math.min((wordPage+1)*wordPageSize,words.length)} of ${n(words.length)} words`:'0 words';
 function button(label,target,disabled=false){const b=document.createElement('button');b.type='button';b.textContent=label;b.disabled=disabled;if(label===String(wordPage+1))b.setAttribute('aria-current','page');b.onclick=()=>{wordPage=target;renderWords();$('wordFilter').scrollIntoView({block:'start'});};pager.append(b);}
 button('Back',wordPage-1,wordPage===0);
 const visible=[...new Set([0,wordPage-1,wordPage,wordPage+1,pages-1])].filter(p=>p>=0&&p<pages).sort((a,b)=>a-b);
 let previous=-1;for(const p of visible){if(previous>=0&&p-previous>1){const gap=document.createElement('span');gap.textContent='…';pager.append(gap);}button(String(p+1),p);previous=p;}
 button('Next',wordPage+1,wordPage===pages-1);
}

let selectedRecordDay=R.dayKey();
function checkInStats(now=new Date()){
 const dates=new Set((state.checkIns||[]).map(c=>c.day));let d=new Date(now),streak=0;
 if(!dates.has(R.dayKey(d)))d.setDate(d.getDate()-1);
 while(dates.has(R.dayKey(d))){streak++;d.setDate(d.getDate()-1)}
 let longest=0,run=0,previous=null;
 for(const day of [...dates].sort()){const date=new Date(day+'T12:00:00');date.setDate(date.getDate()-1);run=previous===R.dayKey(date)?run+1:1;longest=Math.max(longest,run);previous=day}
 return {total:dates.size,streak,longest,seconds:state.events.reduce((n,e)=>n+e.seconds,0)};
}
function formatDuration(seconds){const h=Math.floor(seconds/3600),m=Math.floor(seconds%3600/60),s=Math.floor(seconds%60);return h?h+'h '+m+'m':m?m+'m '+s+'s':s+'s'}
function renderCheckIn(){const checked=(state.checkIns||[]).some(c=>c.day===R.dayKey());$('dailyCheckIn').textContent=checked?'✓ Checked in':'Daily check-in';$('dailyCheckIn').disabled=checked||busy||pending;const stats=checkInStats();$('checkInSummary').textContent=stats.total+' days · '+stats.streak+' day streak';}
async function checkIn(){
 if(!ready||pending||busy)return;
 const day=R.dayKey();state.checkIns||=[];if(state.checkIns.some(c=>c.day===day))return;
 state.checkIns.push({day,time:Date.now(),secondsAtCheckIn:state.events.filter(e=>e.day===day).reduce((n,e)=>n+e.seconds,0)});
 renderCheckIn();if(await persist())note('Checked in for today.');
}
$('dailyCheckIn').onclick=checkIn;
function records(){const checkStats=checkInStats();$('checkInTotal').textContent=checkStats.total+' days';$('checkInStreak').textContent=checkStats.streak+' days';$('checkInBest').textContent=checkStats.longest+' days';$('localStudyTime').textContent=formatDuration(checkStats.seconds);const h=state.historical||{},events=state.events;const secs=events.reduce((a,e)=>a+e.seconds,0);$('lifetimeWords').textContent=new Set(events.map(e=>e.word)).size;$('lifetimeTime').textContent=n(Math.floor(((h.cumulativeSeconds||0)+secs)/60))+' min';$('newLearned').textContent=new Set(events.map(e=>e.word)).size;const dates=new Set(events.map(e=>e.day));let d=new Date(),streak=0;if(!dates.has(R.dayKey(d)))d.setDate(d.getDate()-1);while(dates.has(R.dayKey(d))&&R.dayKey(d)!==h.capturedDate){streak++;d.setDate(d.getDate()-1)}if(h.reportedStreak&&R.dayKey(d)===h.capturedDate)streak+=h.reportedStreak;$('streak').textContent=streak+' days';$('historical').textContent=`Saved on ${h.capturedDate}: ${n(h.cumulativeWords)} cumulative words; ${n(h.cumulativeSeconds/60)} minutes; ${n(h.collectionLearned)} / ${n(h.collectionTotal)} collection progress; ${n(h.personalWordbook)} saved words; reported streak ${h.reportedStreak||0} days.`;$('month').textContent=month.toLocaleDateString('en-GB',{month:'long',year:'numeric'});$('calendar').replaceChildren();for(const label of ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']){const span=document.createElement('span');span.textContent=label;$('calendar').append(span)}for(let i=0;i<(month.getDay()+6)%7;i++)$('calendar').append(document.createElement('span'));const days=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();for(let i=1;i<=days;i++){const key=R.dayKey(new Date(month.getFullYear(),month.getMonth(),i));const b=document.createElement('button');b.textContent=i;b.classList.toggle('studied',dates.has(key));const checked=(state.checkIns||[]).some(c=>c.day===key);b.classList.toggle('checked-in',checked);b.setAttribute('aria-label',key+(checked?' · Checked in':''));if(checked)b.textContent=i+' ✓';b.classList.toggle('current-day',key===R.dayKey());b.onclick=()=>dayDetail(key);$('calendar').append(b)}dayDetail(selectedRecordDay)}
function dayDetail(day){selectedRecordDay=day;const events=state.events.filter(e=>e.day===day);$('dayDetail').replaceChildren();const p=document.createElement('p');p.textContent=day+' · '+events.length+' attempts · '+events.reduce((a,e)=>a+e.seconds,0)+' seconds';$('dayDetail').append(p);const check=(state.checkIns||[]).find(c=>c.day===day);if(check){const line=document.createElement('p');line.textContent='✓ Checked in at '+new Date(check.time).toLocaleTimeString('en-GB')+' · '+formatDuration(check.secondsAtCheckIn)+' studied at check-in';$('dayDetail').append(line)}for(const e of events){const row=document.createElement('p');row.textContent=e.word+' · '+e.grade+' · '+new Date(e.time).toLocaleTimeString('en-GB');$('dayDetail').append(row)}}
function download(data,name){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
$('toggleChinese').onclick=()=>{const hidden=!$('chineseMeaning').hidden;$('chineseMeaning').hidden=hidden;$('toggleChinese').textContent=hidden?'Show Chinese':'Hide Chinese';$('toggleChinese').setAttribute('aria-expanded',String(!hidden))};$('resultSearch').onsubmit=e=>{e.preventDefault();lookup($('resultQuery').value)};$('home').onclick=()=>view('today');for(const id of ['closeWordbooks','closeRecords','closeSettings'])$(id).onclick=()=>{view('today');$('home').focus()};document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>view(b.dataset.page));$('searchForm').onsubmit=e=>{e.preventDefault();if(ready)lookup($('query').value.trim())};let debounce;$('query').oninput=()=>{clearTimeout(debounce);const q=$('query').value.trim();if(q.length<2){$('suggestions').replaceChildren();return}debounce=setTimeout(async()=>{try{const res=await fetch('/api/search?q='+encodeURIComponent(q)),list=await res.json();if($('query').value.trim()!==q)return;$('suggestions').replaceChildren();for(const item of list.slice(0,6)){const b=document.createElement('button');b.textContent=item.w;b.onclick=()=>lookup(item.w);$('suggestions').append(b)}}catch{}},250)};
$('retryDefinition').onclick=()=>next();$('skipDefinition').onclick=skipDefinition;$('nextGroup').onclick=()=>start(mode,true);$('learn').onclick=()=>start('learn');$('review').onclick=()=>start('review');$('exit').onclick=()=>{mode='lookup';view('today')};$('reveal').onclick=()=>{revealed=true;$('answer').hidden=false;$('reveal').hidden=true;$('ratings').hidden=false};$('star').onclick=()=>openSaveBooks();$('sound').onclick=()=>speak();$('readExample').onclick=()=>speak(current?.example);$('wordAccent').onchange=()=>changeAccent('wordAccent');$('accent').onchange=()=>changeAccent('accent');document.querySelectorAll('[data-grade]').forEach(b=>b.onclick=()=>grade(b.dataset.grade));$('wordFilter').oninput=()=>{wordPage=0;renderWords()};$('wordPageSize').onchange=()=>{wordPageSize=Number($('wordPageSize').value);wordPage=0;renderWords()};
for(const key of ['newLimit','reviewLimit','autoSpeak'])$(key).onchange=async()=>{if(!ready||pending||busy){note('Please wait for storage.');return}state.settings[key]=$(key).type==='checkbox'?$(key).checked:$(key).value;await persist()};$('retry').onclick=()=>ready?persist():init();$('export').onclick=()=>{if(state)download(state,'kimi.ml-study-backup.json');const recovery=localStorage.getItem('kimi-pending');if(recovery)download(JSON.parse(recovery),'kimi.ml-unsaved-recovery.json')};$('restore').onclick=()=>$('restoreFile').click();$('restoreFile').onchange=async e=>{const file=e.target.files[0];if(!file||!ready||busy)return;try{const restored=JSON.parse(await file.text());if(!confirm('Restore this backup? Your current browser records will be kept as a versioned backup.'))return;const res=await fetch('/api/study',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision,state:restored})});const data=await res.json();if(!res.ok)throw Error(data.error);pending=false;localStorage.removeItem('kimi-pending');location.reload()}catch(e){note('Restore failed: '+e.message)}};
$('prevMonth').onclick=()=>{month.setMonth(month.getMonth()-1);selectedRecordDay=R.dayKey(month);records()};$('nextMonth').onclick=()=>{month.setMonth(month.getMonth()+1);selectedRecordDay=R.dayKey(month);records()};$('importWords').onclick=async()=>{
 if(!ready||busy||pending)return;
 const bookId=$('importBook').value,book=state.books[bookId];if(!book)return;
 const words=[...new Set($('importText').value.split('\n').map(x=>x.trim().normalize('NFC')).filter(Boolean))];
 if(!words.length){$('importStatus').textContent='Enter at least one word.';return}
 $('importWords').disabled=true;$('importBook').disabled=true;
 let added=0,skipped=0,failed=[];
 try{for(const word of words){
  if(book.words.includes(word)){skipped++;continue}
  try{
   let entry=state.savedWords[word];
   if(!entry){const res=await fetch('/api/word?q='+encodeURIComponent(word));entry=await res.json();if(!res.ok||!entry.canStudy)throw Error();}
   const key=state.savedWords[word]?word:entry.w;
   if(book.words.includes(key)){skipped++;continue}
   state.savedWords[key]||={...entry,addedAt:Date.now()};book.words.push(key);
   if(!await persist())break;added++;
  }catch{failed.push(word)}
  $('importStatus').textContent=added+' added to '+bookLabel(bookId)+'; '+skipped+' already present; '+failed.length+' unavailable.';
 }
 $('importStatus').textContent=added+' added to '+bookLabel(bookId)+'; '+skipped+' already present; '+failed.length+' unavailable.'+(failed.length?' Retry: '+failed.join(', '):'')+(pending?' Save incomplete. Retry saving in Settings.':'');
 }finally{$('importWords').disabled=false;$('importBook').disabled=false;update()}
};
function toggleBookPanel(panel,trigger){
 const opening=$(panel).hidden;
 for(const [p,t] of [['createBookForm','openCreateBook'],['wordBooks','openWordbooks']]){$(p).hidden=true;$(t).setAttribute('aria-expanded','false')}
 $(panel).hidden=!opening;$(trigger).setAttribute('aria-expanded',String(opening));
 if(opening&&panel==='createBookForm')$('newBookName').focus();
}
$('openCreateBook').onclick=()=>toggleBookPanel('createBookForm','openCreateBook');
$('openWordbooks').onclick=()=>toggleBookPanel('wordBooks','openWordbooks');
$('createBookForm').onsubmit=async e=>{
 e.preventDefault();if(!ready||busy||pending)return;
 const name=$('newBookName').value.trim().replace(/\s+/g,' ');
 if(!name||name.length>60){$('bookStatus').textContent='Enter a name between 1 and 60 characters.';return}
 if(Object.keys(state.books).some(id=>[state.books[id].name,bookLabel(id)].some(n=>n.toLowerCase()===name.toLowerCase()))){$('bookStatus').textContent='A wordbook with this name already exists.';return}
 const id='custom-'+crypto.randomUUID();state.books[id]={name,words:[],createdAt:Date.now()};state.selectedBookIds.push(id);
 $('createBook').disabled=true;
 const ok=await persist();$('createBook').disabled=false;
 if(ok){$('createBookForm').hidden=true;$('openCreateBook').setAttribute('aria-expanded','false');$('newBookName').value='';$('importBook').value=id;$('addWordsPanel').open=true;$('importText').focus();$('bookStatus').textContent='Created '+name+'. Add words below.'}else{$('bookStatus').textContent='Not saved yet. Retry saving in Settings.'}
};

let lastDashboardMinute=-1;
for(const ev of ['pointerdown','pointermove','keydown'])document.addEventListener(ev,()=>interaction=Date.now(),{passive:true});setInterval(()=>{const now=performance.now();if(page==='study'&&mode!=='lookup'&&queue.length&&!$('card').hidden&&!busy&&!pending&&!$('saveBookDialog').open&&!document.hidden&&Date.now()-interaction<60000)elapsed+=Math.min(2,(now-lastTick)/1000);lastTick=now;if(ready&&page==='today'&&Math.floor(Date.now()/60000)!==lastDashboardMinute){lastDashboardMinute=Math.floor(Date.now()/60000);update()}},1000);window.addEventListener('beforeunload',e=>{if(pending||busy){e.preventDefault();e.returnValue=''}});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('saveBookDialog').open)return;if(e.key==='Escape'&&['words','records','settings'].includes(page)){e.preventDefault();$('closeWordbooks').onclick();return}if(e.key==='Escape'&&page==='study'){e.preventDefault();$('exit').onclick();$('home').focus();return}if(e.code==='Space'&&page==='study'&&!revealed&&!['INPUT','TEXTAREA','BUTTON','SELECT'].includes(e.target.tagName)){e.preventDefault();$('reveal').click()}});init();
