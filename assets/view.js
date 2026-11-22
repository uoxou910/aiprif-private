(async()=>{'use strict';const S=window.SiteD,{ $, $$, esc,norm,api,cardImage}=S;
function siteBListThumb(url){
 const src=String(url||'');
 if(!/^https:\/\/drive\.google\.com\/thumbnail\?/i.test(src))return src;
 if(/[?&]sz=/i.test(src))return src.replace(/([?&]sz=)[^&]*/i,'$1w480');
 return src+'&sz=w480';
}

// Site B's original GAS carries darkened / Mikuko flags as invisible name suffixes.
// Never display the metadata on the public card list or in public search.
const DARK_CODE_MARK='\u2063\u2063\u2063';
const MIKUKO_CODE_MARK='\u2064\u2064\u2064';
const publicCard=card=>{
 let code=String(card.code??'');
 for(;;){
  if(code.endsWith(DARK_CODE_MARK))code=code.slice(0,-DARK_CODE_MARK.length);
  else if(code.endsWith(MIKUKO_CODE_MARK))code=code.slice(0,-MIKUKO_CODE_MARK.length);
  else break;
 }
 return {...card,code};
};
let cards=[],query='',page=1,lastCardsUpdated='';const wideGrid=window.matchMedia('(min-width: 1400px)');
let PAGE=wideGrid.matches?24:20;
function dateUpdate(){
 const timestamps=[Date.parse(lastCardsUpdated||''),...cards.map(x=>Date.parse(x.updated_at||x.created_at||''))].filter(Number.isFinite);
 if(!timestamps.length)return '更新:未記録';
 const d=new Date(Math.max(...timestamps));
 return `更新:${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
}
$('#app').innerHTML=`<header class="app-header"><div class="title-bar"><div class="header-inner"><div class="app-title">${esc(window.SITE_D_CONFIG.appName)}</div><div class="view-header-actions"><span class="header-date" id="update"></span><button class="hamburger" id="menu-toggle" type="button" aria-label="メニューを開く" aria-expanded="false"><svg class="hamburger-lines" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="2" y="5" width="20" height="2"/><rect x="2" y="11" width="20" height="2"/><rect x="2" y="17" width="20" height="2"/></svg></button></div></div></div></header><div class="menu-scrim" id="menu-scrim"></div><nav class="hamburger-panel" id="hamburger-panel" aria-label="メニュー"><a href="edit.html">管理画面へ切替</a></nav><button class="drawer-close" id="drawer-close" type="button" aria-label="メニューを閉じる" aria-hidden="true">×</button><div class="container search-dock"><label class="search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m16.5 16.5 5 5"/></svg><input id="query" type="search" placeholder="キャラ名・コーデ名で検索" autocomplete="off" spellcheck="false"></label></div><main class="container"><div class="card-grid animated-grid" id="grid"></div><div class="pager" id="pager"></div></main><div class="overlay hidden" id="overlay"><img id="full-image" alt="フレカ拡大"><button class="overlay-close" id="close" aria-label="閉じる">×</button></div>`;
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
// At six columns, use four complete rows (24 cards) instead of 20 (6/6/6/2).
// All other layouts retain the existing 20-card page size.
wideGrid.addEventListener('change',()=>{
 const oldPageSize=PAGE;
 PAGE=wideGrid.matches?24:20;
 page=Math.floor((page-1)*oldPageSize/PAGE)+1;
 render();
});
function pages(current,total){if(total<=7)return Array.from({length:total},(_,i)=>i+1);const out=[1];let a=Math.max(2,current-1),b=Math.min(total-1,current+1);if(current<=3){a=2;b=4;}else if(current>=total-2){a=total-3;b=total-1;}if(a>2)out.push('…');for(let i=a;i<=b;i++)out.push(i);if(b<total-1)out.push('…');out.push(total);return out;}
function render(){const filtered=cards.filter(x=>!query||norm(x.code+' '+x.chara).includes(norm(query)));const total=Math.max(1,Math.ceil(filtered.length/PAGE));page=Math.min(page,total);const rows=filtered.slice((page-1)*PAGE,page*PAGE);
$('#grid').innerHTML=rows.length?rows.map((x,i)=>`<article class="freca-card" data-id="${esc(x.id)}" style="--stagger:${Math.min(rows.indexOf(x),9)*32}ms"><div class="card-picture" data-id="${esc(x.id)}">${i<2&&x.image_url?`<img src="${esc(siteBListThumb(x.image_url))}" alt="${esc(x.code)}" loading="eager" fetchpriority="high" decoding="async">`:cardImage(siteBListThumb(x.image_url),x.code)}</div><div class="card-detail"><div class="card-chara">${esc(x.chara)}</div><div class="card-code">${esc(x.code)}</div></div></article>`).join(''):'<div class="placeholder-panel">カードがありません</div>';
$('#pager').innerHTML=total<=1?'':`<button data-page="${page-1}" ${page===1?'disabled':''}>‹</button>${pages(page,total).map(p=>p==='…'?'<span class="pager-ellipsis">…</span>':`<button data-page="${p}" class="${p===page?'active':''}">${p}</button>`).join('')}<button data-page="${page+1}" ${page===total?'disabled':''}>›</button>`;
$$('#pager [data-page]').forEach(b=>b.addEventListener('click',()=>{if(b.disabled)return;page=+b.dataset.page;render();scrollTo({top:0,behavior:'smooth'});}));
$$('.card-picture').forEach(el=>el.addEventListener('click',()=>{const x=cards.find(x=>String(x.id)===el.dataset.id);if(!x?.image_url)return;$('#full-image').src=x.image_url;$('#overlay').classList.remove('hidden');}));}
$('#query').addEventListener('input',e=>{query=e.target.value;page=1;render();});$('#close').onclick=()=>$('#overlay').classList.add('hidden');$('#overlay').onclick=e=>{if(e.target.id==='overlay')$('#overlay').classList.add('hidden');};document.addEventListener('keydown',e=>{if(e.key==='Escape')$('#overlay').classList.add('hidden')});
try{
 const d=await api('public');
 cards=(Array.isArray(d.cards)?d.cards:[]).filter(x=>x&&x.visible!==false&&typeof x.code==='string').map(publicCard);
 lastCardsUpdated=d.lastCardsUpdated||'';
 $('#update').textContent=dateUpdate();
 render();
}catch(e){
 console.error(e);
 const needsSetup=/パスワード|認証|未設定/.test(String(e.message));
 $('#grid').innerHTML='<div class="placeholder-panel">'+
  (needsSetup?'公開用GASの閲覧パスワード設定の変更が必要です。':'フレカの読み込みに失敗しました。')+
  ' <a href="legacy-index.html">旧閲覧画面を開く</a></div>';
}
})();
