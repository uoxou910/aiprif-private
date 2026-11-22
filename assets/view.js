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
const pinEnabled=window.SITE_D_CONFIG?.pinAuthEnabled===true;
const pinSessionKey='freca_site_b_public_pin_token';
if(pinEnabled)document.body.classList.add('site-b-pin-locked');

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

async function loadPublicCards(authToken=''){
 const d=await api('public',{},authToken);
 cards=(Array.isArray(d.cards)?d.cards:[]).filter(x=>x&&x.visible!==false&&typeof x.code==='string').map(publicCard);
 lastCardsUpdated=d.lastCardsUpdated||'';
 $('#update').textContent=dateUpdate();
 render();
}
function showPublicFailure(error){
 console.error(error);
 loadTrigger.hidden=true;
 const needsSetup=/パスワード|認証|未設定/.test(String(error.message));
 $('#grid').innerHTML='<div class="placeholder-panel">'+
  (needsSetup?'公開用GASの閲覧パスワード設定の変更が必要です。':'フレカの読み込みに失敗しました。')+
  ' <a href="legacy-index.html">旧閲覧画面を開く</a></div>';
}
async function startPinScreen(){
 // An app-level gate only; the GAS must also disable its old unauthenticated GET list.
 const screen=document.createElement('section');
 screen.id='site-b-pin-screen';
 screen.className='site-b-pin-screen';
 screen.setAttribute('role','group');
 screen.setAttribute('aria-label','サイトBのPIN認証');
 const keys=[1,2,3,4,5,6,7,8,9,0];
 screen.innerHTML=
  '<div class="site-b-pin-panel">'+
   '<div class="site-b-pin-lock-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4.5" y="10.5" width="15" height="11" rx="2"/><path d="M8.5 10.5v-4a3.5 3.5 0 0 1 7 0v4"/></svg></div>'+
   '<h1 class="site-b-pin-title">フレカ置き場2</h1>'+
   '<p class="site-b-pin-caption">PINコードを入力</p>'+
   '<div class="site-b-pin-dots" role="img" aria-label="4桁中0桁入力済み">'+
    [0,1,2,3].map(()=>'<span class="site-b-pin-dot"></span>').join('')+
   '</div>'+
   '<p class="site-b-pin-message" role="status" aria-live="polite"></p>'+
   '<div class="site-b-pin-keypad" aria-label="PIN入力キー">'+
    keys.map(n=>'<button type="button" class="site-b-pin-key'+(n===0?' site-b-pin-zero':'')+'" data-pin-digit="'+n+'" aria-label="'+n+'">'+n+'</button>').join('')+
    '<button type="button" class="site-b-pin-backspace" id="site-b-pin-backspace" aria-label="1文字削除"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4H21v16H9L2 12z"/><path d="m12 9 6 6m0-6-6 6"/></svg></button>'+
   '</div>'+
   '<p class="site-b-pin-hint">PCでは数字キーでも入力できます</p>'+
  '</div>';
 document.body.appendChild(screen);
 let entered='',waiting=false,unlocked=false;
 const status=screen.querySelector('.site-b-pin-message');
 const dots=[...screen.querySelectorAll('.site-b-pin-dot')];
 const redraw=()=>{
  dots.forEach((dot,i)=>dot.classList.toggle('filled',i<entered.length));
  screen.querySelector('.site-b-pin-dots').setAttribute('aria-label','4桁中'+entered.length+'桁入力済み');
 };
 const message=(txt,bad=false)=>{
  status.textContent=txt||'';
  status.classList.toggle('is-error',bad);
 };
 const unlock=()=>{
  unlocked=true;
  screen.remove();
  document.body.classList.remove('site-b-pin-locked');
 };
 async function submitPin(){
  if(waiting||unlocked||entered.length!==4)return;
  waiting=true;
  message('認証しています…');
  try{
   const result=await api('pinLogin',{pin:entered});
   if(!result.token)throw Error('認証情報を取得できませんでした');
   // Do not unlock if the returned token cannot fetch the protected list.
   await loadPublicCards(result.token);
   sessionStorage.setItem(pinSessionKey,result.token);
   unlock();
  }catch(error){
   entered='';
   redraw();
   message(String(error.message||'認証に失敗しました'),true);
  }finally{waiting=false;}
 }
 function digit(n){
  if(waiting||unlocked||entered.length>=4)return;
  entered+=n;
  message('');
  redraw();
  if(entered.length===4)void submitPin();
 }
 function erase(){
  if(waiting||unlocked)return;
  entered=entered.slice(0,-1);
  message('');
  redraw();
 }
 screen.querySelectorAll('[data-pin-digit]').forEach(b=>b.addEventListener('click',()=>digit(b.dataset.pinDigit)));
 screen.querySelector('#site-b-pin-backspace').addEventListener('click',erase);
 document.addEventListener('keydown',event=>{
  if(unlocked||waiting)return;
  if(/^[0-9]$/.test(event.key)){
   event.preventDefault();digit(event.key);
  }else if(event.key==='Backspace'||event.key==='Delete'){
   event.preventDefault();erase();
  }
 });
 const saved=sessionStorage.getItem(pinSessionKey);
 if(saved){
  waiting=true;
  message('認証状態を確認しています…');
  try{
   await loadPublicCards(saved);
   unlock();
  }catch(error){
   sessionStorage.removeItem(pinSessionKey);
   message('PINコードを入力してください');
  }finally{waiting=false;}
 }
}
if(pinEnabled){
 try{await startPinScreen();}
 catch(error){
  console.error(error);
  // Keep the site locked even when initialization fails.
  $('#app').innerHTML='';
  document.body.classList.add('site-b-pin-locked');
 }
}else{
 try{await loadPublicCards();}
 catch(error){showPublicFailure(error);}
}
})();
