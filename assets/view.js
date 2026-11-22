(async()=>{'use strict';const S=window.SiteD,{ $, $$, esc,norm,api,cardImage}=S;
function siteBListThumb(url){
 const src=String(url||'');
 if(!/^https:\/\/drive\.google\.com\/thumbnail\?/i.test(src))return src;
 if(/[?&]sz=/i.test(src))return src.replace(/([?&]sz=)[^&]*/i,'$1w480');
 return src+'&sz=w480';
}

// Read the existing, invisible GAS code suffixes as filterable card metadata.
// Never display the suffixes in the public card names or search.
const DARK_CODE_MARK='\u2063\u2063\u2063';
const MIKUKO_CODE_MARK='\u2064\u2064\u2064';
const publicCard=card=>{
 let code=String(card.code??''),darkened=false,mikuko=false;
 for(;;){
  if(code.endsWith(DARK_CODE_MARK)){
   code=code.slice(0,-DARK_CODE_MARK.length);darkened=true;
  }else if(code.endsWith(MIKUKO_CODE_MARK)){
   code=code.slice(0,-MIKUKO_CODE_MARK.length);mikuko=true;
  }else break;
 }
 return {...card,code,
  darkened:darkened||card.darkened===true||String(card.darkened).toLowerCase()==='true',
  mikuko:mikuko||card.mikuko===true||String(card.mikuko).toLowerCase()==='true'};
};
let cards=[],query='',darkOnly=false,mikukoOnly=false,lastCardsUpdated='';const wideGrid=window.matchMedia('(min-width: 1400px)');

function dateUpdate(){
 const timestamps=[Date.parse(lastCardsUpdated||''),...cards.map(x=>Date.parse(x.updated_at||x.created_at||''))].filter(Number.isFinite);
 if(!timestamps.length)return '更新:未記録';
 const d=new Date(Math.max(...timestamps));
 return `更新:${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
}
$('#app').innerHTML=`<header class="app-header"><div class="title-bar"><div class="header-inner"><div class="app-title">${esc(window.SITE_D_CONFIG.appName)}</div><div class="view-header-actions"><span class="header-date" id="update"></span><button class="hamburger" id="menu-toggle" type="button" aria-label="メニューを開く" aria-expanded="false"><svg class="hamburger-lines" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="2" y="5" width="20" height="2"/><rect x="2" y="11" width="20" height="2"/><rect x="2" y="17" width="20" height="2"/></svg></button></div></div></div></header><div class="menu-scrim" id="menu-scrim"></div><nav class="hamburger-panel" id="hamburger-panel" aria-label="メニュー"><a href="edit.html">管理画面へ切替</a></nav><button class="drawer-close" id="drawer-close" type="button" aria-label="メニューを閉じる" aria-hidden="true">×</button><div class="container search-dock"><div class="site-b-public-search-row"><label class="search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m16.5 16.5 5 5"/></svg><input id="query" type="search" placeholder="キャラ名・コーデ名で検索" autocomplete="off" spellcheck="false"></label><label class="site-b-public-filter-check"><input type="checkbox" id="public-dark-only">ダーク化</label><label class="site-b-public-filter-check"><input type="checkbox" id="public-mikuko-only">ミクコ</label></div></div><main class="container"><div class="card-grid animated-grid" id="grid"></div><div class="infinite-loader" id="infinite-loader" role="status" aria-live="polite" hidden><span class="infinite-loader-dot" aria-hidden="true"></span>続きを表示中…</div></main><div class="overlay hidden" id="overlay"><img id="full-image" alt="フレカ拡大"><button class="overlay-close" id="close" aria-label="閉じる">×</button></div>`;
const menuBtn=$('#menu-toggle'),menuPanel=$('#hamburger-panel'),menuScrim=$('#menu-scrim');
const drawerClose=$('#drawer-close');
function positionClose(){const r=menuBtn.getBoundingClientRect();Object.assign(drawerClose.style,{left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'});}
function toggleMenu(open){
 if(open)positionClose();
 menuBtn.setAttribute('aria-expanded',String(open));
 menuPanel.classList.toggle('is-open',open);menuScrim.classList.toggle('is-open',open);
 drawerClose.classList.toggle('is-open',open);drawerClose.setAttribute('aria-hidden',String(!open));
 if(open)drawerClose.focus({preventScroll:true});else menuBtn.focus({preventScroll:true});
}
window.addEventListener('resize',()=>{if(menuPanel.classList.contains('is-open'))positionClose();});
menuBtn.onclick=()=>toggleMenu(!menuPanel.classList.contains('is-open'));
menuScrim.onclick=()=>toggleMenu(false);
$('#drawer-close').onclick=()=>toggleMenu(false);
document.addEventListener('keydown',e=>{if(e.key==='Escape')toggleMenu(false);});
// Keep the data load single-shot, but progressively append visible DOM cards.
// At six columns each append is four full rows (24 cards); otherwise 20.
const grid=$('#grid'),loadTrigger=$('#infinite-loader');
let filteredCards=[],renderedCount=0;
const batchSize=()=>wideGrid.matches?24:20;
function cardMarkup(x,i,offset){
 return `<article class="freca-card" data-id="${esc(x.id)}" style="--stagger:${Math.min(i,9)*32}ms"><div class="card-picture" data-id="${esc(x.id)}">${(offset+i)<2&&x.image_url?`<img src="${esc(siteBListThumb(x.image_url))}" alt="${esc(x.code)}" loading="eager" fetchpriority="high" decoding="async">`:cardImage(siteBListThumb(x.image_url),x.code)}</div><div class="card-detail"><div class="card-chara">${esc(x.chara)}</div><div class="card-code">${esc(x.code)}</div></div></article>`;
}
function maybeLoadNext(){
 if(renderedCount>=filteredCards.length)return;
 if(loadTrigger.getBoundingClientRect().top<innerHeight+650)appendNextBatch();
}
function appendNextBatch(){
 if(renderedCount>=filteredCards.length)return;
 const start=renderedCount,size=batchSize();
 const remainder=start%size;
 const count=remainder?size-remainder:size;
 const next=filteredCards.slice(start,start+count);
 if(!next.length)return;
 grid.insertAdjacentHTML('beforeend',next.map((x,i)=>cardMarkup(x,i,start)).join(''));
 renderedCount+=next.length;
 loadTrigger.hidden=renderedCount>=filteredCards.length;
 if(!loadTrigger.hidden)requestAnimationFrame(maybeLoadNext);
}
function render(){
 filteredCards=cards.filter(x=>(!darkOnly||x.darkened===true)&&(!mikukoOnly||x.mikuko===true)&&(!query||norm(x.code+' '+x.chara).includes(norm(query))));
 renderedCount=0;
 grid.innerHTML=filteredCards.length?'':'<div class="placeholder-panel">カードがありません</div>';
 loadTrigger.hidden=!filteredCards.length;
 if(filteredCards.length)appendNextBatch();
}
// The sentinel automatically requests the next batch near the viewport.
if('IntersectionObserver' in window){
 const observer=new IntersectionObserver(entries=>{
  if(entries.some(entry=>entry.isIntersecting))appendNextBatch();
 },{rootMargin:'650px 0px'});
 observer.observe(loadTrigger);
}else{
 window.addEventListener('scroll',maybeLoadNext,{passive:true});
 window.addEventListener('resize',maybeLoadNext,{passive:true});
}
wideGrid.addEventListener('change',()=>{
 if(renderedCount<filteredCards.length&&renderedCount%batchSize())appendNextBatch();
});
grid.addEventListener('click',event=>{
 const picture=event.target.closest('.card-picture');
 if(!picture||!grid.contains(picture))return;
 const card=cards.find(x=>String(x.id)===picture.dataset.id);
 if(!card?.image_url)return;
 $('#full-image').src=card.image_url;
 $('#overlay').classList.remove('hidden');
});
$('#query').addEventListener('input',e=>{query=e.target.value;render();});
$('#public-dark-only').addEventListener('change',e=>{darkOnly=e.target.checked;render();});
$('#public-mikuko-only').addEventListener('change',e=>{mikukoOnly=e.target.checked;render();});
$('#close').onclick=()=>$('#overlay').classList.add('hidden');$('#overlay').onclick=e=>{if(e.target.id==='overlay')$('#overlay').classList.add('hidden');};document.addEventListener('keydown',e=>{if(e.key==='Escape')$('#overlay').classList.add('hidden')});
try{
 const d=await api('public');
 cards=(Array.isArray(d.cards)?d.cards:[]).filter(x=>x&&x.visible!==false&&typeof x.code==='string').map(publicCard);
 lastCardsUpdated=d.lastCardsUpdated||'';
 $('#update').textContent=dateUpdate();
 render();
}catch(e){
 console.error(e);
 loadTrigger.hidden=true;
 const needsSetup=/パスワード|認証|未設定/.test(String(e.message));
 $('#grid').innerHTML='<div class="placeholder-panel">'+
  (needsSetup?'公開用GASの閲覧パスワード設定の変更が必要です。':'フレカの読み込みに失敗しました。')+
  ' <a href="legacy-index.html">旧閲覧画面を開く</a></div>';
}
})();
