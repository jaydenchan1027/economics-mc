/* ECON — responsive multiple-choice practice with saved progress. */
(()=>{'use strict';
const bank=window.ECON_DATA;
if(!bank||!Array.isArray(bank.questions)||!bank.topics){document.getElementById('main').innerHTML='<div class="empty-state"><h1>The question bank could not be loaded.</h1><p>Check your connection and reload the page.</p><a href="./">Reload question bank</a></div>';return;}
const all=bank.questions;
const byId=new Map(all.map(q=>[q.id,q]));
const TOP=bank.topics;
const topics=Object.keys(TOP).map(Number).sort((a,b)=>a-b);
function questionCount(n){return `${n.toLocaleString()} ${n===1?'question':'questions'}`}
function scanLabel(q){return q.scanOptions?'<span class="tag scan-label">Scan-based options</span>':''}
const STORAGE='econ-mc-progress-v1',PREFS='econ-mc-prefs-v1';
function cleanRecords(value){
 const clean={};if(!value||typeof value!=='object'||Array.isArray(value))return clean;
 for(const [id,a] of Object.entries(value))if(byId.has(id)&&a&&typeof a.choice==='string'&&/^[ABCD]$/.test(a.choice)){
  clean[id]={choice:a.choice,time:typeof a.time==='string'&&Number.isFinite(Date.parse(a.time))?a.time:new Date().toISOString()};
 }
 return clean;
}
function storedRecords(){
 try{return cleanRecords(JSON.parse(localStorage.getItem(STORAGE)||'{}'))}
 catch(error){if(error instanceof SyntaxError)return {};throw error}
}
function cleanPrefs(value){return {mode:['CE','AL','Both'].includes(value?.mode)?value.mode:'Both',last:byId.has(value?.last)?value.last:null}}
let records={}, prefs={mode:'Both',last:null}, stored=true;
let pendingReplacement=null;
const pendingEdits=new Map();
function withPendingEdits(latest){
 const merged=pendingReplacement===null?latest:cleanRecords(pendingReplacement);
 for(const [id,value] of pendingEdits){if(value)merged[id]=value;else delete merged[id]}
 return merged;
}
try{records=storedRecords()}catch(e){stored=false}
try{prefs=cleanPrefs(JSON.parse(localStorage.getItem(PREFS)||'{}'))}catch(e){if(!(e instanceof SyntaxError))stored=false}
let state={view:'home',topic:null,set:null,section:null,filter:'all',queue:[],index:0,back:'home',lastSection:null};
const main=document.getElementById('main');
const modalRoot=document.getElementById('modalRoot');
const toastEl=document.getElementById('toast');
let toastTimeout;
function save(change){
 if(change?.replace!==undefined){pendingReplacement=cleanRecords(change.replace);pendingEdits.clear()}
 if(change?.id)pendingEdits.set(change.id,change.value||null);
 // Keep unsaved answers available for practice and export if browser storage fills up.
 records=withPendingEdits(records);
 try{
 // Read the latest answers before applying one edit: another tab may have saved meanwhile.
 records=withPendingEdits(storedRecords());localStorage.setItem(STORAGE,JSON.stringify(records));
 pendingEdits.clear();pendingReplacement=null;
 localStorage.setItem(PREFS,JSON.stringify(prefs));stored=true;
}catch(e){stored=false;notice('Local saving is blocked by this browser. Export your progress regularly.');}}
window.addEventListener('storage',e=>{
 if(e.key!==STORAGE&&e.key!==null)return;
 try{records=withPendingEdits(storedRecords());render()}catch(error){stored=false}
});
function notice(msg){toastEl.textContent=msg;toastEl.classList.add('show');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>toastEl.classList.remove('show'),3500)}
function h(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function pct(a,b){return b?Math.round(a/b*100):0}
function inMode(q){return prefs.mode==='Both'||q.level===prefs.mode}
function subset(qs){return qs.filter(inMode)}
function outcome(q){let a=records[q.id];if(!a)return 'todo';return a.choice===q.answer?'correct':'wrong'}
function stat(qs){let done=qs.filter(q=>records[q.id]);let correct=done.filter(q=>outcome(q)==='correct').length;return {total:qs.length,done:done.length,correct,wrong:done.length-correct,accuracy:pct(correct,done.length),progress:pct(done.length,qs.length)}}
function arrowIcon(){return '<svg class="arrow-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 18L18 6M6 6h12v12"/></svg>'}
function textStat(name,value){return `<div class="stat"><div class="stat-num">${h(value)}</div><div class="stat-lbl">${h(name)}</div></div>`}
function navHome(){state.view='home';render()}
function qTitle(q){return `Topic ${q.topic} · ${q.section} · Q${q.number}`}
function scrollTop(){window.scrollTo(0,0)}
function topicIcon(topic){
 const paths={1:'M4 18h16M6 14l4-4 4 2 4-6M15 6h3v3',2:'M4 20V8l8-4 8 4v12M4 10h16M8 14h2m4 0h2M8 17h2m4 0h2',3:'M4 4v16h16M7 7l10 10M7 17L17 7',4:'M4 20V9h6v11M14 20V4h6v16M2 20h20',5:'M12 3v18M5 21h14M4 7h16M5 7l-3 7h6L5 7m14 0-3 7h6l-3-7',6:'M4 20h16M6 16V9m6 7V4m6 12v-5',7:'M4 5h16v14H4zM4 9h16M8 14h3m4 0h1',8:'M4 20V7l8-4 8 4v13M8 20v-7h8v7M8 8h8',9:'M3 8h16m-4-4 4 4-4 4M21 16H5m4-4-4 4 4 4'};
 return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[topic]}"/></svg>`;
}
function progressValue(done,total){return total?100*done/total:0}
function progressLabel(done,total){
 if(!done||!total)return '0';
 if(done===total)return '100';
 const value=progressValue(done,total);
 return value<1?'<1':String(Math.min(99,Math.round(value)));
}
function renderHome(){
 const eligible=subset(all),s=stat(eligible),savedLast=prefs.last&&byId.get(prefs.last),lastOk=savedLast&&inMode(savedLast),wrong=eligible.filter(q=>outcome(q)==='wrong');
 const next=lastOk?savedLast:eligible.find(q=>outcome(q)==='todo')||eligible[0];
 const milestone=[...[1,10,50,100,250,500,1000].filter(n=>n<s.total),s.total].find(n=>n>s.correct),remaining=milestone-s.correct;
 const milestoneTitle=milestone?(milestone===1?'Your first win':milestone.toLocaleString()+' correct answers'):'Every answer correct!';
 let out=`<section class="hero"><div class="hero-copy"><span class="kicker"><span aria-hidden="true">✦</span> A LITTLE PRACTICE. A BIG DIFFERENCE.</span><svg class="hero-spark" viewBox="0 0 48 48" fill="currentColor" aria-hidden="true"><path d="m24 0 6 17 18 7-18 6-6 18-7-18L0 24l17-7z"/></svg><h1>Big ideas.<br><em>Small wins.</em></h1><p class="subtext">Level up your economics, one question at a time.<br class="desktop-break"> Real past papers. Fresh challenges. You’ve got this.</p><div class="quick-row"><button class="primary-btn" data-action="${lastOk?'resume':'firstTodo'}">${lastOk?'Continue learning':'Start practicing'} ${arrowIcon()}</button><button class="secondary-btn" data-action="reviewWrong" ${wrong.length?'':'disabled'}><span aria-hidden="true">↻</span> Review mistakes (${wrong.length})</button></div>${next?`<p class="next-up"><span>UP NEXT</span> Topic ${next.topic} · ${h(next.sectionTitle)}</p>`:''}</div><aside class="overview-box" aria-label="Your practice progress"><div class="overview-heading"><span class="kicker">YOUR PROGRESS</span><span class="overview-selection">${prefs.mode==='Both'?'CE + AL':prefs.mode}</span></div><div class="overview-body"><div class="progress-ring" style="--progress:${progressValue(s.done,s.total)}%" role="img" aria-label="${h(progressLabel(s.done,s.total))}% of selected questions completed"><div class="overview-total">${h(progressLabel(s.done,s.total))}<span>%</span><small>completed</small></div></div><div class="overview-message"><span class="goal-label"><svg class="goal-star" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m12 1 3.4 7 7.6 1.1-5.5 5.3 1.3 7.6-6.8-3.6-6.8 3.6 1.3-7.6L1 9.1 8.6 8z"/></svg> ${milestone?'NEXT MILESTONE':'MILESTONE REACHED'}</span><strong>${milestoneTitle}</strong><p>${milestone?remaining+' correct '+(remaining===1?'answer':'answers')+' to go.':'You aced this exam selection.'}</p></div></div><div class="stats-grid">${textStat('Completed',`${s.done} / ${s.total}`)}${textStat('Correct',s.correct)}${textStat('Accuracy',s.done?s.accuracy+'%':'—')}</div></aside></section>`;
 out+=`<section class="topic-library" aria-labelledby="topicsTitle"><div class="topics-heading"><div><span class="kicker">CHOOSE YOUR CHALLENGE</span><h2 id="topicsTitle">Where to next?</h2><p class="count-highlight">${questionCount(eligible.length)} available</p></div><div class="exam-selection"><span class="section-label">Exam paper</span><div class="mode-bar" role="group" aria-label="Exam selection">${['CE','AL','Both'].map(m=>`<button class="mode-btn ${m===prefs.mode?'active':''}" data-mode="${m}" aria-pressed="${m===prefs.mode}">${m==='Both'?'CE + AL':m}</button>`).join('')}</div></div></div><div class="topics-grid" aria-label="Topics">`;
 for(const topic of topics){
  const ts=eligible.filter(q=>q.topic===topic),r=stat(ts);
  out+=`<article class="topic-card" role="button" tabindex="${ts.length?0:-1}" aria-disabled="${!ts.length}" data-topic="${topic}" ${ts.length?'':`title="No ${h(prefs.mode)} questions in this topic. Choose another exam selection."`}><div class="topic-top"><span class="topic-icon">${topicIcon(topic)}</span><span class="topic-num">TOPIC ${String(topic).padStart(2,'0')}</span></div><h3 class="topic-title">${h(TOP[topic])}</h3><span class="topic-qty">${questionCount(ts.length).toUpperCase()}${ts.length?'':` · NO ${h(prefs.mode)} QUESTIONS`}</span><div class="topic-progress"><div class="progress-caption"><span>${r.total&&r.done===r.total?'Complete':r.done?'In progress':ts.length?'Not started':'Unavailable'}</span><strong>${h(progressLabel(r.done,r.total))}%</strong></div><div class="meter"><span style="width:${progressValue(r.done,r.total)}%"></span></div><div class="topic-bottom"><span>${r.done} / ${r.total} completed</span><span class="topic-arrow" aria-hidden="true">${ts.length?arrowIcon():'–'}</span></div></div></article>`;
 }
 out+='</div></section>';
 if(!stored)out+='<p class="settings-note">Progress could not be saved in this browser. Export a backup before closing this page.</p>';
 return out;
}
function groupsForTopic(topic){const qs=subset(all).filter(q=>q.topic===topic);let by=new Map();for(const q of qs){const key=`${q.set}:${q.section}`;if(!by.has(key))by.set(key,[]);by.get(key).push(q)}return [...by.entries()].map(([key,items])=>({key,set:items[0].set,roman:items[0].section,title:items[0].sectionTitle,items}));}
function renderTopic(){let topic=state.topic,groups=groupsForTopic(topic),f=stat(subset(all).filter(q=>q.topic===topic)),sets=new Set(groups.map(x=>x.set));
 let out=`<div class="breadcrumb"><button data-action="home">Home</button><span>/</span><b>Topic ${topic}</b></div><span class="kicker">Topic ${String(topic).padStart(2,'0')}</span><h1 class="page-heading">${h(TOP[topic])}</h1><p class="muted">${questionCount(f.total)} · ${f.done} completed · ${h(progressLabel(f.done,f.total))}% progress</p>`;
 let lastSet=0;
 for(const g of groups){if(g.set!==lastSet){if(sets.size>1)out+=`<div class="set-heading">SET ${g.set}</div>`;lastSet=g.set}let x=stat(g.items);out+=`<button class="unit-card" data-set="${g.set}" data-section="${h(g.roman)}"><span class="roman-icon">${g.roman}</span><span class="unit-text"><strong>${h(g.title)}</strong><small>${x.done} / ${x.total} completed · ${x.done?x.accuracy+'% accuracy':'Not started'}</small></span><span class="unit-arrow">›</span></button>`}
 if(!groups.length)out+=`<div class="empty-state"><h3>No questions in this selection</h3><p>Choose another exam selection on the home page.</p><button class="secondary-btn" data-action="home">Go home</button></div>`;
 return out;
}
function chosenSection(){return subset(all).filter(q=>q.topic===state.topic&&q.set===state.set&&q.section===state.section)}
function filteredSection(){const q=chosenSection();if(state.filter==='all')return q;if(state.filter==='todo')return q.filter(x=>outcome(x)==='todo');if(state.filter==='wrong')return q.filter(x=>outcome(x)==='wrong');return q.filter(x=>outcome(x)==='correct')}
function renderSection(){let qs=chosenSection(),group=qs[0];if(!group)return `<div class="empty-state"><h3>No questions</h3><p>Try changing the CE / AL selection on the home page.</p><button class="secondary-btn" data-action="home">Go home</button></div>`;
 let s=stat(qs);let out=`<div class="breadcrumb"><button data-action="home">Home</button><span>/</span><button data-action="topic">Topic ${state.topic}</button><span>/</span><b>${state.section}</b></div><span class="kicker">Topic ${state.topic} / ${group.set>1?'Set '+group.set+' / ':''}Section ${state.section}</span><h1 class="page-heading">${h(group.sectionTitle)}</h1><p class="muted">${questionCount(s.total)} · ${s.done} answered · ${s.accuracy}% accuracy${s.done?'':' (not started)'}</p>`;
 out+=`<div class="filter-row">${[['all','All questions',qs.length],['todo','Unanswered',s.total-s.done],['wrong','Incorrect',s.wrong],['correct','Correct',s.correct]].map(([k,n,c])=>`<button class="chip ${state.filter===k?'active':''}" data-filter="${k}">${n} (${c})</button>`).join('')}</div>`;
 let eligible=filteredSection();if(eligible.length)out+=`<button class="primary-btn" data-action="startSection">▶ ${state.filter==='all'?'Practice this section':'Practice selected questions'}</button><div class="question-grid" aria-label="Choose a question">${eligible.map(q=>{let status=outcome(q),label=status==='correct'?'✓':status==='wrong'?'✕':q.level;return `<button class="question-pill ${status}" data-question="${h(q.id)}" aria-label="Topic question ${q.number}: ${status}${q.scanOptions?', scan-based options':''}${q.sourceIssue?', incomplete scan':''}"><span class="q-no">${q.number}</span><small>${label}</small>${q.scanOptions?'<small class="scan-label">Scan</small>':''}${q.sourceIssue?'<small class="scan-label">Incomplete scan</small>':''}</button>`}).join('')}</div>`;
 else out+=`<div class="empty-state"><h3>Nothing here yet</h3><p>Try another filter to see more questions.</p></div>`;
 return out;
}
function renderQuiz(){let q=byId.get(state.queue[state.index]);if(!q){state.view='home';return renderHome()};let ans=records[q.id];let res=ans?outcome(q):'';let total=state.queue.length;
 let sourceLabel=q.paperQ?`${q.year||q.level} · Original Q${q.paperQ}`:(q.year||q.level);
 let out=`<div class="quiz-shell"><div class="quiz-nav"><button class="back-button" data-action="quizBack">← ${state.back==='section'?'Section': 'Topics / Home'}</button><span class="quiz-count">QUESTION ${state.index+1} / ${total}</span></div><div class="quiz-top-meter"><span style="width:${pct(state.index+1,total)}%"></span></div><article class="question-panel" data-question-id="${h(q.id)}"><div class="question-meta"><span class="tag level">${q.level}</span><span class="tag">TOPIC ${q.topic}${q.set===2?' · SET 2':''}</span><span class="tag">${q.section}</span><span class="tag">${h(sourceLabel)}</span></div><span class="kicker">TOPIC Q${q.number}${q.set>1?' · SET '+q.set:''}</span>${scanLabel(q)}`;
 if(q.context){out+=`<div class="context-panel"><span class="kicker">Reference information</span><div>${h(q.context)}</div>${q.contextImage?`<button class="source-btn" data-action="zoomShared" data-image="${h(q.contextImage)}" data-id="${h(q.id)}">↗ Enlarge shared question data</button>`:''}</div>`;}
 if(q.sourceIssue)out+=`<p class="question-fallback source-issue" role="note"><strong>Incomplete source scan.</strong> ${h(q.sourceIssue)}</p>`;
 if(q.stem)out+=`<div class="q-title">${h(q.stem)}</div>`;
 if(q.autoScan || !Object.keys(q.options).length){out+=`<div class="figure-zone"><img alt="Original question scan including any diagrams" src="${h(q.image)}" loading="eager" data-zoom="${h(q.id)}" /></div><div class="figure-instructions">↗ <button data-action="zoom" data-id="${h(q.id)}">Tap to enlarge the original question</button></div>`}
 else out+=`<button class="source-btn" data-action="toggleScan" data-id="${h(q.id)}">▣ View original question / diagram</button><div class="original-scan" id="scanSlot"></div>`;
 if(q.scanOptions)out+=`<p class="question-fallback">The A–D options are printed in the original scan above. Enlarge it to read the diagrams, then select the matching letter below.</p>`;
 out+=`<div class="options-list" role="group" aria-label="Answer options">${'ABCD'.split('').map(letter=>{let isRight=ans && q.answer===letter,isWrong=ans && ans.choice===letter && q.answer!==letter;
 let sty=isRight?'is-correct':isWrong?'is-wrong':'';let copy=q.options[letter]||`Option ${letter} (see the question scan)`;
 return `<button class="option ${sty} ${ans?'locked':''}" data-answer="${letter}" ${ans?'disabled':''} aria-label="Option ${letter}: ${h(copy)}"><span class="option-letter">${letter}</span><span class="option-copy">${h(copy)}</span>${isRight?'<span class="option-result" aria-hidden="true">✓</span>':isWrong?'<span class="option-result" aria-hidden="true">✕</span>':''}</button>`}).join('')}</div>`;
 if(ans){let correct=res==='correct';out+=`<div class="feedback ${correct?'pass':'fail'}" role="status"><div class="feedback-icon">${correct?'✓':'✕'}</div><div><strong>${correct?'Correct — well done!':'Not quite — incorrect.'}</strong><p>${correct?`Your answer ${ans.choice} is correct.`:`You chose ${ans.choice}. The correct answer is ${q.answer}.`} Answer verified against the supplied answer key.</p></div></div>`}
 out+=`<div class="source-row"><span class="source-btn">Original scan · source page ${q.page}</span>${ans?`<button class="clear-btn" data-action="clearAnswer" data-id="${h(q.id)}">Clear my answer</button>`:''}</div></article>`;
 out+=`<div class="quiz-bottom"><button class="secondary-btn" data-action="prev" ${state.index===0?'disabled':''}>← Previous</button><button class="primary-btn" data-action="next">${state.index===total-1?'Finish ✓':'Next question →'}</button></div></div>`;
 return out;
}
function render(){let views={home:renderHome,topic:renderTopic,section:renderSection,quiz:renderQuiz};main.dataset.view=state.view;main.innerHTML=(views[state.view]||renderHome)();document.title=(state.view==='quiz'?qTitle(byId.get(state.queue[state.index]))+' — ':'')+'ECON • MC Practice Bank';}
function switchMode(mode){prefs.mode=mode;save();state.view='home';scrollTop();render();}
function startQuiz(queue,index=0,back='section'){if(!queue.length){notice('No questions to practice here.');return}state.queue=queue.map(q=>typeof q==='string'?q:q.id);state.index=Math.max(0,Math.min(index,queue.length-1));state.back=back;state.view='quiz';prefs.last=state.queue[state.index];save();scrollTop();render()}
function goQuestion(q){const qq=filteredSection();const idx=qq.findIndex(x=>x.id===q.id);startQuiz(qq,Math.max(0,idx),'section')}
function answer(letter){let q=byId.get(state.queue[state.index]);if(!q||records[q.id])return;records[q.id]={choice:letter,time:new Date().toISOString()};prefs.last=q.id;save({id:q.id,value:records[q.id]});render();const feedback=document.querySelector('.feedback');if(feedback)feedback.scrollIntoView({block:'nearest',behavior:'smooth'});}
function doNext(){if(state.index<state.queue.length-1){state.index++;prefs.last=state.queue[state.index];save();scrollTop();render()}else{if(state.back==='section'){state.view='section'}else{state.view='home'}scrollTop();render();notice(stored?'Practice round completed. Your progress is saved.':'Practice round completed. Saving is blocked; export your progress before closing this page.')}}
function doPrev(){if(state.index>0){state.index--;prefs.last=state.queue[state.index];save();scrollTop();render()}}
function openTopic(topic){if(!subset(all).some(q=>q.topic===topic))return;state.topic=topic;state.view='topic';scrollTop();render()}
function openSection(set,roman){state.set=set;state.section=roman;state.filter='all';state.view='section';scrollTop();render()}
function quizBack(){state.view=state.back==='section'?'section':'home';scrollTop();render()}
function openZoom(qid){let q=byId.get(qid);if(!q)return;modalRoot.innerHTML=`<div class="source-modal" role="dialog" aria-modal="true" aria-label="Original question image"><div class="source-modal-top"><strong>${h(qTitle(q))} · Original scan</strong><button class="secondary-btn" data-action="closeModal">Close ✕</button></div><div class="source-scroll"><img src="${h(q.image)}" alt="Original page crop for question ${q.number}" /></div></div>`;showDialog(modalRoot.firstElementChild,()=>modalRoot.replaceChildren())}
function openShared(image,id){let q=byId.get(id);if(!q||!image)return;modalRoot.innerHTML=`<div class="source-modal" role="dialog" aria-modal="true"><div class="source-modal-top"><strong>Shared question information · ${h(qTitle(q))}</strong><button class="secondary-btn" data-action="closeModal">Close ✕</button></div><div class="source-scroll"><img src="${h(image)}" alt="Shared information from previous question"></div></div>`;showDialog(modalRoot.firstElementChild,()=>modalRoot.replaceChildren())}
let activeDialog=null;
function showDialog(dialog,onClose){
 const previous=activeDialog;
 activeDialog={element:dialog,onClose,opener:previous?.opener||document.activeElement,overflow:previous?.overflow??document.body.style.overflow};
 document.getElementById('app').inert=true;document.body.style.overflow='hidden';
 dialog.setAttribute('tabindex','-1');
 (dialog.querySelector('button:not(:disabled),a[href],input:not(:disabled)')||dialog).focus();
}
function closeModal(){
 if(!activeDialog){modalRoot.innerHTML='';return}
 const dialog=activeDialog;activeDialog=null;dialog.onClose();
 document.getElementById('app').inert=false;document.body.style.overflow=dialog.overflow;
 if(dialog.opener?.isConnected)dialog.opener.focus();
}
window.ECON_DIALOG={open:showDialog,close:closeModal};
document.addEventListener('keydown',e=>{
 if(!activeDialog)return;
 if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();closeModal();return}
 if(e.key!=='Tab')return;
 const dialog=activeDialog.element;
 const items=[...dialog.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')].filter(el=>el.getClientRects().length);
 const first=items[0]||dialog,last=items[items.length-1]||dialog;
 if(!dialog.contains(document.activeElement)||e.shiftKey&&document.activeElement===first||!e.shiftKey&&document.activeElement===last){e.preventDefault();(e.shiftKey?last:first).focus()}
},true);
function toggleScan(id){let slot=document.getElementById('scanSlot');if(!slot)return;if(slot.childElementCount){slot.innerHTML='';return}let q=byId.get(id);slot.innerHTML=`<div class="figure-zone"><img src="${h(q.image)}" data-zoom="${h(q.id)}" alt="Original question scan" loading="lazy"></div><div class="figure-instructions">↗ Tap the image to enlarge</div>`}
function openSettings(){
 const s=stat(all);
 modalRoot.innerHTML=`<div class="dialog-bg" data-dismiss="1"><div class="dialog" role="dialog" aria-modal="true" aria-label="Progress settings"><div class="dialog-heading"><div><span class="kicker">MAKE IT YOURS</span><h2>Practice settings</h2></div><button class="dialog-close" data-action="closeModal" aria-label="Close settings">✕</button></div><p>Your study space, saved on this device.</p><div class="settings-summary"><strong>${s.done}</strong> ${s.done===1?'answer':'answers'} saved <span>·</span> ${s.correct} correct <span>·</span> ${s.wrong} to review</div><section class="settings-section"><h3>Keep your progress</h3><p>Save a backup before switching devices or clearing your browser.</p><div class="dialog-actions"><button class="primary-btn" data-action="export">↓ Export progress</button><button class="secondary-btn" data-action="import">↑ Import backup</button></div></section><section class="settings-section"><h3>Practice anywhere</h3><p>Save every question scan before you go offline.</p><div id="offlineControls"><p id="offlineDetail" role="status">Checking offline storage…</p><button class="secondary-btn" id="downloadOffline" type="button">↓ Download all scans for offline use</button></div></section><section class="settings-section settings-reset"><div><h3>A fresh start</h3><p>Clear your answers on this device.</p></div><button class="secondary-btn warning-btn" data-action="confirmReset">Reset all answers</button></section><p class="settings-note">Viewed scans are saved automatically when offline storage is available. Progress does not sync between devices.</p></div></div>`;
 showDialog(modalRoot.querySelector('[role=dialog]'),()=>modalRoot.replaceChildren());window.ECON_OFFLINE?.refresh();
}
function exportProgress(){let body={format:'econ-mc-progress',version:1,exportedAt:new Date().toISOString(),records,prefs};let blob=new Blob([JSON.stringify(body,null,2)],{type:'application/json'});let url=URL.createObjectURL(blob);let a=document.createElement('a');a.href=url;a.download='econ-mc-progress.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3500);notice('Progress backup exported.')}
function confirmReset(){modalRoot.innerHTML=`<div class="dialog-bg"><div class="dialog" role="alertdialog" aria-modal="true"><h2>Reset all progress?</h2><p>This removes all saved answers from this device. Export a backup first if you want to keep your results.</p><div class="dialog-actions"><button class="secondary-btn" data-action="closeModal">Cancel</button><button class="secondary-btn warning-btn" data-action="reset">Reset my answers</button></div></div></div>`;showDialog(modalRoot.querySelector('[role=alertdialog]'),()=>modalRoot.replaceChildren())}
function resetAll(){records={};prefs.last=null;save({replace:records});closeModal();navHome();notice(stored?'Answers have been reset.':'Answers reset for this session. Browser storage could not be updated.')}
function importProgress(){document.getElementById('importFile').click()}
document.getElementById('importFile').addEventListener('change',async e=>{
 const f=e.target.files?.[0];if(!f)return;
 try{
  const obj=JSON.parse(await f.text());
  if(!obj||obj.format!=='econ-mc-progress'||obj.version!==1||!obj.records||typeof obj.records!=='object'||Array.isArray(obj.records))throw new Error('Not a supported ECON progress backup');
  const clean=cleanRecords(obj.records);records=clean;prefs=cleanPrefs(obj.prefs);save({replace:clean});closeModal();navHome();notice(`${Object.keys(clean).length} saved answers imported.`);
 }catch(err){notice('Unable to import: '+err.message)}finally{e.target.value=''}
});
function firstTodo(){const list=subset(all);if(!list.length)return;const first=list.find(q=>outcome(q)==='todo')||list[0];openTopic(first.topic);openSection(first.set,first.section);const qs=chosenSection();startQuiz(qs,Math.max(0,qs.findIndex(q=>q.id===first.id)),'section')}
function resume(){const q=byId.get(prefs.last);if(!q||!inMode(q)){firstTodo();return}openTopic(q.topic);openSection(q.set,q.section);let qs=chosenSection();let idx=qs.findIndex(z=>z.id===q.id);startQuiz(qs,idx>=0?idx:0,'section')}
function reviewWrong(){const wrong=subset(all).filter(q=>outcome(q)==='wrong');startQuiz(wrong,0,'home')}
main.addEventListener('click',e=>{
 const button=e.target.closest('button,[role="button"],article[data-topic],img[data-zoom]');if(!button)return;
 if(button.dataset.mode){switchMode(button.dataset.mode);return}
 if(button.dataset.topic){openTopic(Number(button.dataset.topic));return}
 if(button.dataset.set){openSection(Number(button.dataset.set),button.dataset.section);return}
 if(button.dataset.filter){state.filter=button.dataset.filter;render();return}
 if(button.dataset.question){const q=byId.get(button.dataset.question);if(q)goQuestion(q);return}
 if(button.dataset.answer){answer(button.dataset.answer);return}
 if(button.dataset.zoom){openZoom(button.dataset.zoom);return}
 const action=button.dataset.action;
 if(action==='home')navHome();else if(action==='topic')openTopic(state.topic);else if(action==='startSection')startQuiz(filteredSection(),0,'section');else if(action==='resume')resume();else if(action==='firstTodo')firstTodo();else if(action==='reviewWrong')reviewWrong();else if(action==='quizBack')quizBack();else if(action==='prev')doPrev();else if(action==='next')doNext();else if(action==='zoom')openZoom(button.dataset.id);else if(action==='zoomShared')openShared(button.dataset.image,button.dataset.id);else if(action==='toggleScan')toggleScan(button.dataset.id);else if(action==='clearAnswer'){delete records[button.dataset.id];save({id:button.dataset.id,value:null});render();notice(stored?'Answer cleared.':'Answer cleared for this session. Saving is blocked; export a backup before closing this page.')}
});
main.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.closest('article[data-topic]')){e.preventDefault();openTopic(Number(e.target.closest('article[data-topic]').dataset.topic))}});
modalRoot.addEventListener('click',e=>{if(e.target.dataset.dismiss)closeModal();let b=e.target.closest('button[data-action]');if(!b)return;let a=b.dataset.action;if(a==='closeModal')closeModal();else if(a==='export')exportProgress();else if(a==='import')importProgress();else if(a==='confirmReset')confirmReset();else if(a==='reset')resetAll()});
document.getElementById('settingsBtn').addEventListener('click',openSettings);
document.getElementById('brand').addEventListener('click',()=>{navHome();scrollTop()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeModal();return}if(e.defaultPrevented||e.ctrlKey||e.metaKey||e.altKey||activeDialog||modalRoot.childElementCount||state.view!=='quiz'||document.activeElement.isContentEditable||['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName))return;if(/^[a-d]$/i.test(e.key))answer(e.key.toUpperCase());else if(e.key==='ArrowRight')doNext();else if(e.key==='ArrowLeft')doPrev()});
// Scan failures must be visible, especially when a scan has not been saved offline yet.
document.addEventListener('error',e=>{
 const img=e.target;
 if(!(img instanceof HTMLImageElement)||!img.src.includes('/assets/scans/'))return;
 if(img.nextElementSibling?.classList.contains('figure-error'))return;
 const message=document.createElement('p');message.className='figure-error';message.setAttribute('role','status');
 message.textContent='This scan could not be loaded. Reconnect and reopen the scan, or download all scans in settings before going offline.';
 img.after(message);
},true);
render();
})();
