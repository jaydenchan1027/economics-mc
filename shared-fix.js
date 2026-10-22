/* Shared source images for linked Economics MC questions. Keeps existing progress unchanged. */
(()=>{'use strict';
const bank=window.ECON_DATA;if(!bank?.questions)return;
const keys=new Map(bank.questions.map(q=>[q.topic+':'+q.set+':'+q.number,q]));
const style=document.createElement('style');
style.textContent='.shared-reference{margin:18px 0 24px;padding:14px;border:1px solid #4a9188;background:#153238;border-radius:16px;color:#eaf4f2}.shared-reference strong{color:#a8f4e0;display:block;font-size:14px;margin-bottom:7px}.shared-reference p{font-size:12px;color:#bed2d4;line-height:1.65;margin:0 0 11px}.shared-reference img{display:block;width:100%;height:auto;border-radius:8px;background:white;cursor:zoom-in}.shared-reference button{display:block;margin-top:9px;width:100%;padding:12px;border:1px solid #619d94;border-radius:10px;background:#25474b;color:#e4fff4;font-weight:750}.shared-reference details{margin-top:11px;color:#aed8cf;font-size:12px}.shared-reference pre{font:inherit;white-space:pre-wrap;overflow-wrap:anywhere;padding:9px;background:#10232d;border-radius:8px;max-height:250px;overflow:auto}.shared-reference-zoom{position:fixed;z-index:99999;inset:0;display:flex;flex-direction:column;background:#071014;color:white}.shared-reference-zoom header{flex-shrink:0;padding:12px 16px;display:flex;gap:15px;align-items:center;justify-content:space-between;background:#152b36}.shared-reference-zoom header button{padding:10px 15px;border:1px solid #537981;border-radius:10px;background:#25444f;color:white}.shared-reference-zoom main{flex:1;min-height:0;overflow:auto;padding:12px}.shared-reference-zoom main img{display:block;width:max(100%,850px);max-width:none;height:auto;margin:0 auto;background:white}@media(min-width:700px){.shared-reference img{max-width:750px;margin:auto}}';
document.head.appendChild(style);
let last='';
function current(){
 const panel=document.querySelector('#main .question-panel');if(!panel)return null;
 const q=bank.questions.find(q=>q.id===panel.dataset.questionId);
 return q?{q,panel}:null;
}
function enlarged(image,num){
 document.getElementById('referenceZoom')?.remove();
 const overlay=document.createElement('div');overlay.id='referenceZoom';overlay.className='shared-reference-zoom';
 overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');
 const header=document.createElement('header');const label=document.createElement('span');label.textContent='Original reference from Question '+num;
 const close=document.createElement('button');close.textContent='Close ✕';close.onclick=()=>overlay.remove();header.append(label,close);
 const scroll=document.createElement('main');const img=document.createElement('img');img.src=image;img.alt='Original shared graph, table or information';scroll.append(img);overlay.append(header,scroll);document.body.append(overlay);
 overlay.addEventListener('keydown',e=>{if(e.key==='Escape')overlay.remove()});close.focus();
}
function apply(){
 const item=current();if(!item){last='';return}
 const {q,panel}=item;
 if(last===q.id && panel.querySelector('.shared-reference'))return;
 const old=panel.querySelector('.shared-reference');if(old)old.remove();
 const text=panel.querySelector('.context-panel > div');
 if(text)text.style.whiteSpace='pre-wrap';
 if(q.hasOwnCitation!==false){last=q.id;return}
 const prev=keys.get(q.topic+':'+q.set+':'+(q.number-1));
 if(!prev||prev.year!==q.year||prev.level!==q.level){last=q.id;return}
 const section=document.createElement('section');section.className='shared-reference';
 section.dataset.source=prev.id;
 const heading=document.createElement('strong');heading.textContent='▣ Shared graph / data from Question '+prev.number;
 const info=document.createElement('p');info.textContent='The original chart, table or passage is shown below. It remains available when you jump directly to this question, select CE/AL, or review mistakes.';
 const img=document.createElement('img');img.src=prev.image;img.loading='eager';img.alt='Original shared information from Question '+prev.number;img.onclick=()=>enlarged(prev.image,prev.number);
 const button=document.createElement('button');button.textContent='↗ Enlarge original information';button.onclick=()=>enlarged(prev.image,prev.number);
 section.append(heading,info,img,button);
 const context=q.context||prev.context;
 if(context&&context.trim().length>15){const details=document.createElement('details');const sum=document.createElement('summary');sum.textContent='Show reference as text';const p=document.createElement('pre');p.textContent=context;details.append(sum,p);section.append(details)}
 // Remove old flattened context (not reliable for tables/diagrams).
 panel.querySelector('.context-panel')?.remove();
 const title=panel.querySelector('.q-title');
 if(title)title.before(section);else panel.querySelector(':scope > .kicker')?.after(section);
 last=q.id;
}
let pending=false;const main=document.getElementById('main');
if(main)new MutationObserver(()=>{if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;apply()})}).observe(main,{childList:true});
apply();
})();