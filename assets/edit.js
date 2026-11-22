(function(){
const C=window.SITE_D_CONFIG||{};
let cards=[],q='',deleteMode=false,selected=new Set(),
    adminPassword=sessionStorage.getItem('freca_admin_password')||'';
let siteBUploadInProgress=false;
let siteBSaveInProgress=false;
function siteBShowSaving(message){
 let el=document.getElementById('site-b-save-progress');
 if(!el){
  el=document.createElement('div');
  el.id='site-b-save-progress';
  el.setAttribute('role','status');
  el.setAttribute('aria-live','polite');
  document.body.appendChild(el);
 }
 el.textContent=message;
}
function siteBHideSaving(){document.getElementById('site-b-save-progress')?.remove();}
window.addEventListener('beforeunload',e=>{
 if(siteBUploadInProgress||siteBSaveInProgress){
  e.preventDefault();
  e.returnValue='';
 }
});

const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));

function siteBListThumb(url){
 const src=String(url||'');
 if(!/^https:\/\/drive\.google\.com\/thumbnail\?/i.test(src))return src;
 if(/[?&]sz=/i.test(src))return src.replace(/([?&]sz=)[^&]*/i,'$1w480');
 return src+'&sz=w480';
}

const configured=()=>C.gasUrl &&
  /^https:\/\/script\.google\.com\/macros\/s\//.test(C.gasUrl) &&
  !C.gasUrl.includes('YOUR_');

const toast=m=>{
  const t=$('#toast');
  if(!t)return;
  t.textContent=m;
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),1800);
};

async function get(action,params={}){
  const u=new URL(C.gasUrl);
  u.searchParams.set('action',action);
  Object.entries(params).forEach(([k,v])=>u.searchParams.set(k,v));
  const r=await fetch(u.toString(),{redirect:'follow'});
  const j=await r.json();
  if(!j.ok)throw new Error(j.error||'API error');
  return j;
}

async function post(action,data={}){
  const body=new URLSearchParams({action,password:adminPassword,...data});
  const r=await fetch(C.gasUrl,{
    method:'POST',
    body,
    redirect:'follow'
  });
  const j=await r.json();
  if(!j.ok)throw new Error(j.error||'API error');
  return j;
}

function normalizeSearchText(s){
  return String(s??'')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u30a1-\u30f6]/g,ch =>
      String.fromCharCode(ch.charCodeAt(0)-0x60)
    );
}

function showMessage(t,m){
  document.body.innerHTML=
    '<div class="setup-warning"><b>'+esc(t)+'</b><br>'+esc(m)+'</div>';
}

async function init(){
  if(!configured()){
    showMessage(
      '初期設定が必要です',
      'assets/config.js の gasUrl にGASのウェブアプリURLを貼り付けてください。'
    );
    return;
  }

  if(adminPassword){
    try{
      await post('auth');
      await load();
      return;
    }catch(e){
      sessionStorage.removeItem('freca_admin_password');
      adminPassword='';
    }
  }

  renderLogin();
}

function renderLogin(error=''){
 document.body.innerHTML=`<main class="auth-screen"><div class="login-panel"><h1>フレカ管理ログイン</h1><p class="note">管理パスワードを入力してください。</p>
 ${error?`<p class="note" style="color:#b34664">${esc(error)}</p>`:''}
 <form id="login-form"><label class="field">パスワード
 <span class="password-control"><input id="password" type="password" required autocomplete="current-password">
 <button id="password-peek" type="button" class="password-peek" aria-pressed="false" aria-label="押している間パスワードを表示" title="押している間パスワードを表示"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/></svg></button>
 </span></label><button type="submit" class="btn primary" id="login">ログイン</button></form>
 <p class="note" style="margin-top:22px"><a href="index.html">フレカ閲覧ページに戻る</a></p></div></main>`;
 $('#login-form').onsubmit=e=>{e.preventDefault();login();};
 const input=$('#password'),peek=$('#password-peek');
 const reveal=show=>{input.type=show?'text':'password';peek.setAttribute('aria-pressed',String(show));};
 peek.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;e.preventDefault();reveal(true);});
 for(const ev of ['pointerup','pointercancel','pointerleave','blur'])peek.addEventListener(ev,()=>reveal(false));
 peek.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();reveal(true);}});
 peek.addEventListener('keyup',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();reveal(false);}});
}
async function login(){
  const p=$('#password').value;
  if(!p)return renderLogin('パスワードを入力してください。');

  adminPassword=p;
  try{
    await post('auth');
    sessionStorage.setItem('freca_admin_password',p);
    await load();
  }catch(e){
    adminPassword='';
    renderLogin('パスワードが違います。');
  }
}

function logout(){
  if(siteBUploadInProgress||siteBSaveInProgress){toast('保存処理中です。完了後にログアウトできます');return;}
  adminPassword='';
  sessionStorage.removeItem('freca_admin_password');
  renderLogin();
}

async function load(){
  document.body.innerHTML='<div class="loading">読み込み中…</div>';

  try{
    cards=(await post('adminList')).cards||[];
    render();
  }catch(e){
    showMessage('読み込みに失敗しました',e.message);
  }
}

function render(){
 const publicCount=cards.filter(x=>x.visible!==false).length;
 document.body.innerHTML=`<header class="app-header"><div class="title-bar"><div class="header-inner">
 <strong class="app-title">フレカ管理</strong><div class="header-actions"><button class="hamburger" id="menu-toggle" type="button" aria-expanded="false" aria-label="メニューを開く"><svg class="hamburger-lines" viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="2"/><rect x="2" y="11" width="20" height="2"/><rect x="2" y="17" width="20" height="2"/></svg></button></div></div></div></header>
 <div class="menu-scrim" id="menu-scrim"></div><nav class="hamburger-panel" id="hamburger-panel" aria-label="管理メニュー"><a href="index.html">公開画面へ切替</a><button class="selected" id="menu-cards" type="button">フレカ管理</button><button id="logout" type="button">ログアウト</button></nav>
 <button class="drawer-close" id="drawer-close" type="button" aria-hidden="true" aria-label="メニューを閉じる">×</button>
 <div class="admin-shell"><div class="animated-content">
 <div class="section-head"><h2>フレカ一覧 <small class="note">${cards.length}件・公開${publicCount}件</small></h2><div class="row"><button class="tiny-btn" id="del" type="button">一括削除</button><button class="btn primary" type="button" id="upload-trigger">＋ フレカを追加</button></div></div>
 <input id="files" type="file" accept="image/*" multiple hidden>
 <label class="search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m16.5 16.5 5 5"/></svg><input id="q" type="search" placeholder="キャラ名・コーデ名で検索" autocomplete="off" spellcheck="false" value="${esc(q)}"></label>
 <div class="admin-card-grid" id="list"></div></div></div>
 <div class="site-b-bulkbar" id="bar"><span id="selCount">0件選択中</span><button type="button" class="tiny-btn" id="cancel">キャンセル</button><button type="button" class="btn danger" id="exec">削除</button></div>
 <div class="overlay hidden" id="adminModal"><img id="adminModalImg" alt="フレカ拡大"><button class="overlay-close" id="adminModalClose" type="button" aria-label="閉じる">×</button></div>
 <div id="editor-host"></div><div class="toast" id="toast"></div>`;
 const menu=$('#menu-toggle'),panel=$('#hamburger-panel'),scrim=$('#menu-scrim'),close=$('#drawer-close');
 const positionClose=()=>{const r=menu.getBoundingClientRect();Object.assign(close.style,{left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'});};
 const toggle=open=>{
  if(open)positionClose();
  menu.setAttribute('aria-expanded',String(open));
  panel.classList.toggle('is-open',open);scrim.classList.toggle('is-open',open);
  close.classList.toggle('is-open',open);close.setAttribute('aria-hidden',String(!open));
 };
 menu.onclick=()=>toggle(!panel.classList.contains('is-open'));
 scrim.onclick=()=>toggle(false);close.onclick=()=>toggle(false);$('#menu-cards').onclick=()=>toggle(false);
 window.addEventListener('resize',()=>{if(panel.isConnected&&panel.classList.contains('is-open'))positionClose();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){toggle(false);closePreview();if(!closeSiteBUploadZoom())closeEditor();}});
 draw();
 $('#upload-trigger').onclick=openUploader;
 let timer;$('#q').oninput=e=>{clearTimeout(timer);const v=e.target.value;timer=setTimeout(()=>{q=v;draw();},120);};
 $('#del').onclick=()=>{deleteMode=!deleteMode;selected.clear();updateBar();draw();};
 $('#cancel').onclick=()=>{deleteMode=false;selected.clear();updateBar();draw();};
 $('#exec').onclick=deleteSelected;$('#logout').onclick=logout;
 $('#adminModalClose').onclick=closePreview;$('#adminModal').onclick=e=>{if(e.target.id==='adminModal')closePreview();};
 updateBar();
}
function filteredCards(){
  if(!q)return cards;
  const nq=normalizeSearchText(q);

  return cards.filter(x=>
    normalizeSearchText(`${x.chara} ${x.code}`).includes(nq)
  );
}

function draw(){
 const list=filteredCards();
 $('#list').innerHTML=list.length?list.map((x,i)=>{
  const visible=x.visible!==false,id=esc(x.id);
  return `<article class="admin-card ${visible?'':'site-b-unlisted'}">
   <div class="site-b-picture">
    <button type="button" class="admin-image" data-preview="${id}" aria-label="画像を拡大">
      ${x.image_url?`<img src="${esc(siteBListThumb(x.image_url))}" alt="${esc(x.code)}" loading="${i<2?'eager':'lazy'}" decoding="async">`:'<span>画像なし</span>'}
    </button>
    ${deleteMode?`<button type="button" class="site-b-selectbox ${selected.has(x.id)?'selected':''}" data-select="${id}" aria-pressed="${selected.has(x.id)}">${selected.has(x.id)?'✓':'選択'}</button>`:''}
   </div>
   <div class="admin-card-body">
    <div class="admin-title">${esc(x.code||'コーデ名未設定')}</div>
    <div class="admin-sub">${esc(x.chara||'キャラ名未設定')}${visible?'':' ・ 非公開'}</div>
    <div class="row">
     <button type="button" class="tiny-btn" data-edit="${id}">編集</button>
     <button type="button" class="tiny-btn" data-visibility="${id}" data-current-visible="${visible}">${visible?'非公開にする':'公開する'}</button>
     <button type="button" class="tiny-btn danger" data-delete="${id}">削除</button>
    </div>
   </div></article>`;
 }).join(''):'<div class="placeholder-panel">フレカがありません</div>';
 document.querySelectorAll('[data-preview]').forEach(b=>b.onclick=()=>{if(!deleteMode)openPreview(b.dataset.preview);});
 document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>openEditor(b.dataset.edit));
 document.querySelectorAll('[data-visibility]').forEach(b=>b.onclick=()=>toggleVisibility(b.dataset.visibility,b.dataset.currentVisible==='true'));
 document.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>deleteOne(b.dataset.delete));
 document.querySelectorAll('[data-select]').forEach(b=>b.onclick=()=>{
  const id=b.dataset.select;selected.has(id)?selected.delete(id):selected.add(id);updateBar();draw();
 });
}
function closeSiteBUploadZoom(){
 const zoom=document.querySelector('#site-b-upload-zoom');
 if(!zoom || zoom.classList.contains('hidden'))return false;
 zoom.classList.add('hidden');
 zoom.querySelector('img')?.removeAttribute('src');
 return true;
}

// Suggestions come from existing Site B cards and current unsaved ZIP entries.
// A datalist is advisory: users can always type/edit any name after selection.
function siteBInputHistory(kind,extra=[]){
 const field=kind==='code'?'code':'chara',seen=new Set(),values=[];
 for(const item of [...extra,...cards]){
  const value=String(item?.[field]||'').trim();
  const key=normalizeSearchText(value);
  if(!value||seen.has(key))continue;
  seen.add(key);
  values.push(value);
 }
 return values;
}
function setupSiteBInputHistory(extra=[]){
 const host=$('#editor-host');
 if(!host)return;
 host._siteBNameSuggestController?.abort();
 const controller=new AbortController();
 host._siteBNameSuggestController=controller;
 let popup=host.querySelector('#site-b-name-popup');
 if(!popup){
  popup=document.createElement('div');
  popup.id='site-b-name-popup';
  popup.className='site-b-name-popup';
  popup.setAttribute('role','listbox');
  host.appendChild(popup);
 }
 popup.hidden=true;
 popup.innerHTML='';
 let current=null,matched=[],selected=-1;
 const hide=()=>{
  popup.hidden=true;
  popup.innerHTML='';
  if(current){
   current.setAttribute('aria-expanded','false');
   current.removeAttribute('aria-activedescendant');
  }
  matched=[];
  selected=-1;
 };
 const position=()=>{
  if(popup.hidden||!current?.isConnected)return;
  const rect=current.getBoundingClientRect();
  popup.style.left=Math.max(8,rect.left)+'px';
  popup.style.top=(rect.bottom+4)+'px';
  popup.style.width=Math.min(rect.width,window.innerWidth-16)+'px';
  const remaining=window.innerHeight-rect.bottom-14;
  popup.style.maxHeight=Math.max(48,Math.min(222,remaining))+'px';
 };
 const highlight=()=>{
  const options=popup.querySelectorAll('[data-site-b-suggest]');
  options.forEach((button,i)=>{
   const active=i===selected;
   button.classList.toggle('is-active',active);
   button.setAttribute('aria-selected',String(active));
   if(active){
    current.setAttribute('aria-activedescendant',button.id);
    button.scrollIntoView({block:'nearest'});
   }
  });
  if(selected<0)current?.removeAttribute('aria-activedescendant');
 };
 const choose=value=>{
  const input=current;
  if(!input?.isConnected)return hide();
  input.value=value;
  input.dispatchEvent(new Event('input',{bubbles:true}));
  input.focus({preventScroll:true});
  input.setSelectionRange(input.value.length,input.value.length);
  hide();
 };
 const show=input=>{
  current=input;
  const query=normalizeSearchText(input.value.trim());
  if(!query){hide();return;}
  const kind=input.matches('input[data-code],input.code')?'code':'chara';
  const entryKey=input.dataset.code||input.dataset.chara||'';
  const otherEntries=entryKey?extra.filter(item=>String(item.key)!==entryKey):extra;
  matched=siteBInputHistory(kind,otherEntries)
   .filter(v=>normalizeSearchText(v).includes(query))
   .sort((a,b)=>{
    const pa=normalizeSearchText(a).startsWith(query)?0:1;
    const pb=normalizeSearchText(b).startsWith(query)?0:1;
    return pa-pb;
   }).slice(0,10);
  if(!matched.length){hide();return;}
  selected=-1;
  popup.innerHTML=matched.map((value,i)=>
   `<button type="button" role="option" id="site-b-suggest-${i}" aria-selected="false" class="site-b-name-option" data-site-b-suggest="${i}">${esc(value)}</button>`
  ).join('');
  popup.hidden=false;
  input.setAttribute('aria-expanded','true');
  popup.querySelectorAll('[data-site-b-suggest]').forEach(button=>{
   button.addEventListener('mousedown',e=>e.preventDefault());
   button.addEventListener('click',()=>choose(matched[Number(button.dataset.siteBSuggest)]));
  });
  position();
 };
 const inputs=host.querySelectorAll('input[data-code],input[data-chara],input.chara,input.code');
 inputs.forEach(input=>{
  input.removeAttribute('list');
  input.setAttribute('autocomplete','off');
  input.setAttribute('role','combobox');
  input.setAttribute('aria-autocomplete','list');
  input.setAttribute('aria-controls',popup.id);
  input.setAttribute('aria-expanded','false');
  input.addEventListener('input',()=>show(input));
  input.addEventListener('focus',()=>show(input));
  input.addEventListener('keydown',e=>{
   if(e.isComposing||e.keyCode===229)return;
   if(popup.hidden||input!==current)return;
   if(e.key==='ArrowDown'||e.key==='ArrowUp'){
    e.preventDefault();
    selected=e.key==='ArrowDown'?(selected+1)%matched.length:(selected-1+matched.length)%matched.length;
    highlight();
   }else if(e.key==='Enter'&&matched.length){
    e.preventDefault();
    e.stopPropagation();
    choose(matched[selected>=0?selected:0]);
   }else if(e.key==='Escape'){
    e.preventDefault();
    e.stopPropagation();
    hide();
   }else if(e.key==='Tab'){
    hide();
   }
  });
  input.addEventListener('blur',()=>setTimeout(()=>{
   if(current===input&&!popup.contains(document.activeElement))hide();
  },100));
 });
 const reposition=()=>{
  if(!popup.hidden&&current?.isConnected)position();
  else if(!popup.hidden)hide();
 };
 host.addEventListener('scroll',reposition,{capture:true,passive:true,signal:controller.signal});
 window.addEventListener('scroll',reposition,{passive:true,signal:controller.signal});
 window.addEventListener('resize',reposition,{passive:true,signal:controller.signal});
}
function openUploader(){
 if(siteBUploadInProgress||siteBSaveInProgress){toast('保存処理中です。完了後に追加できます');return;}
 const imageMime={
  png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',
  gif:'image/gif',bmp:'image/bmp',avif:'image/avif',apng:'image/png',
  jpe:'image/jpeg',jfif:'image/jpeg',svg:'image/svg+xml',
  heic:'image/heic',heif:'image/heif',tif:'image/tiff',tiff:'image/tiff'
 };
 const MAX_IMAGE=8*1024*1024,MAX_ZIP=150*1024*1024,MAX_UNPACKED=180*1024*1024;
 const entries=[];let serial=0,preparing=false,submitting=false,closed=false;
 const getExt=name=>String(name).split('.').pop().toLowerCase();
 const isImageName=name=>Object.prototype.hasOwnProperty.call(imageMime,getExt(name));
 const displayName=path=>String(path).replace(/\\/g,'/').split('/').pop();
 const notify=msg=>{const el=$('#upload-status');if(el){el.textContent=msg;el.hidden=!msg;}};
 const revoke=item=>{if(item.preview)URL.revokeObjectURL(item.preview);};
 const release=()=>{entries.forEach(revoke);entries.length=0;};
 const dismiss=()=>{
  if(submitting)return;
  closed=true;release();closeEditor();
 };
 const ensureFflate=()=>{
  if(window.fflate?.unzipSync)return Promise.resolve(window.fflate);
  if(!window.__siteBZipLoader){
   window.__siteBZipLoader=new Promise((resolve,reject)=>{
    const tag=document.createElement('script');
    tag.src='https://cdn.jsdelivr.net/npm/fflate@0.8.2/umd/index.js';
    tag.async=true;tag.onload=()=>window.fflate?.unzipSync?resolve(window.fflate):reject(Error('ZIPの解凍機能を読み込めませんでした'));
    tag.onerror=()=>reject(Error('ZIPの解凍機能を読み込めませんでした。ネットワーク接続を確認してください'));
    document.head.appendChild(tag);
   }).catch(e=>{window.__siteBZipLoader=null;throw e;});
  }
  return window.__siteBZipLoader;
 };
 $('#editor-host').innerHTML=`<div class="dialog-shade" id="upload-shade">
 <section class="dialog card-entry-dialog" role="dialog" aria-modal="true" aria-labelledby="upload-title">
  <div class="row between dialog-heading">
   <h2 id="upload-title">フレカを追加</h2>
   <button class="dialog-x" id="upload-close" type="button" aria-label="閉じる">×</button>
  </div>
  <div class="card-upload-zone" id="upload-zone" tabindex="0" role="button" aria-label="画像またはZIPを選択">
   <span class="upload-symbol">＋</span><strong>画像・ZIPを選択</strong>
   <span class="upload-hint">またはここにドロップ</span>
  </div>
  <input id="upload-files" type="file" accept="image/*,.zip,application/zip,application/x-zip-compressed" multiple hidden>
  <p class="site-b-upload-status" id="upload-status" role="status" aria-live="polite" hidden></p>
  <div id="upload-details" class="upload-entries"></div>
  <div class="dialog-actions hidden" id="upload-actions">
   <button class="btn primary" id="upload-save" type="button">追加する</button>
  </div>
 </section></div>
 <div class="overlay hidden" id="site-b-upload-zoom" role="dialog" aria-modal="true" aria-label="追加する画像の拡大">
   <img id="site-b-upload-zoom-image" alt="追加する画像の拡大">
   <button type="button" class="overlay-close" id="site-b-upload-zoom-close" aria-label="閉じる">×</button>
 </div>`;
 const zoom=$('#site-b-upload-zoom');
 $('#site-b-upload-zoom-close').onclick=closeSiteBUploadZoom;
 zoom.onclick=e=>{if(e.target===zoom)closeSiteBUploadZoom();};
 const zone=$('#upload-zone'),picker=$('#upload-files'),submit=$('#upload-save'),actions=$('#upload-actions');
 const paint=()=>{
  const host=$('#upload-details');if(!host)return;
  host.innerHTML=entries.map((item,i)=>`<div class="upload-entry" data-entry="${item.key}">
   <button type="button" class="upload-thumb site-b-upload-zoom-trigger" data-zoom="${item.key}" aria-label="${i+1}件目の画像を拡大"><img src="${esc(item.preview)}" alt="画像プレビュー" loading="lazy"></button>
   <div class="upload-fields">
    <input type="text" data-code="${item.key}" aria-label="${i+1}件目のコーデ名" placeholder="コーデ名" maxlength="120" value="${esc(item.code)}">
    <input type="text" data-chara="${item.key}" aria-label="${i+1}件目のキャラ名" placeholder="キャラ名（自由入力）" maxlength="120" value="${esc(item.chara)}">
   </div>
   <button type="button" class="upload-remove" data-remove="${item.key}" aria-label="${i+1}件目を除外">×</button>
  </div>`).join('');
  actions.classList.toggle('hidden',entries.length===0);
  submit.textContent=`${entries.length}件を追加する`;
  setupSiteBInputHistory(entries);
  host.querySelectorAll('[data-zoom]').forEach(button=>button.onclick=()=>{
   const item=entries.find(x=>x.key===button.dataset.zoom);
   if(!item)return;
   $('#site-b-upload-zoom-image').src=item.preview;
   zoom.classList.remove('hidden');
  });
  host.querySelectorAll('[data-code]').forEach(input=>input.oninput=()=>{
   const item=entries.find(x=>x.key===input.dataset.code);if(item)item.code=input.value;
  });
  host.querySelectorAll('[data-chara]').forEach(input=>input.oninput=()=>{
   const item=entries.find(x=>x.key===input.dataset.chara);if(item)item.chara=input.value;
  });
  host.querySelectorAll('[data-remove]').forEach(button=>button.onclick=()=>{
   if(preparing||submitting)return;
   const i=entries.findIndex(x=>x.key===button.dataset.remove);
   if(i>=0){revoke(entries[i]);entries.splice(i,1);paint();notify(`${entries.length}件の画像を選択中`);}
  });
 };
 const addEntry=(file,path)=>{
  if(!isImageName(file.name))return false;
  if(!file.size||file.size>MAX_IMAGE)throw Error(`${path}：画像は8MB以下にしてください`);
  entries.push({key:String(++serial),file,path,
   code:'',chara:'',preview:URL.createObjectURL(file)});
  return true;
 };
 const addFiles=async fileList=>{
  const list=[...fileList];if(!list.length||preparing||submitting||closed)return;
  preparing=true;picker.disabled=true;zone.classList.add('upload-busy');submit.disabled=true;
  let added=0,skipped=0;const errors=[];
  try{
   for(const file of list){
    if(closed)break;
    if(getExt(file.name)!=='zip'){
     try{if(addEntry(file,file.name))added++;else skipped++;}catch(e){errors.push(e.message);}
     continue;
    }
    notify(`ZIPを展開中：${file.name}`);
    try{
     if(file.size>MAX_ZIP)throw Error('ZIPは150MB以下にしてください');
     const lib=await ensureFflate();
     const bytes=new Uint8Array(await file.arrayBuffer());
     let unpacked=0;
     const extracted=lib.unzipSync(bytes,{filter:meta=>{
      const name=meta.name.replace(/\\/g,'/');
      if(name.startsWith('__MACOSX/')||name.split('/').some(p=>p.startsWith('._')))return false;
      if(!isImageName(name)){skipped++;return false;}
      if(meta.originalSize>MAX_IMAGE){errors.push(`${name}：画像は8MB以下にしてください`);return false;}
      if(unpacked+meta.originalSize>MAX_UNPACKED)throw Error('ZIPの展開後サイズが上限を超えています');
      unpacked+=meta.originalSize;return true;
     }});
     for(const [name,content] of Object.entries(extracted)){
      if(closed)break;
      const image=new File([content],displayName(name),{type:imageMime[getExt(name)]});
      try{if(addEntry(image,name))added++;else skipped++;}catch(e){errors.push(e.message);}
     }
    }catch(e){errors.push(`${file.name}：${e.message}`);}
   }
   if(!closed){paint();notify(`${entries.length}件の画像を選択中${skipped?`（画像以外${skipped}件を除外）`:''}${errors.length?`・処理できなかったファイル${errors.length}件`:''}`);
    if(errors.length)alert(errors.slice(0,6).join('\n')+(errors.length>6?`\nほか${errors.length-6}件`:''));}
  }finally{
   preparing=false;picker.disabled=false;zone.classList.remove('upload-busy');submit.disabled=false;
  }
 };
 $('#upload-close').onclick=dismiss;
 $('#upload-shade').onclick=e=>{if(e.target.id==='upload-shade')dismiss();};
 zone.onclick=()=>picker.click();
 zone.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();picker.click();}};
 picker.onchange=e=>{addFiles(e.target.files);e.target.value='';};
 zone.ondragover=e=>{e.preventDefault();zone.classList.add('dragging');};
 zone.ondragleave=()=>zone.classList.remove('dragging');
 zone.ondrop=e=>{e.preventDefault();zone.classList.remove('dragging');addFiles(e.dataTransfer.files);};
 submit.onclick=async()=>{
 if(!entries.length||preparing||submitting||siteBUploadInProgress||siteBSaveInProgress)return;
 const work=entries.map(x=>({file:x.file,path:x.path,chara:x.chara.trim(),code:x.code.trim()}));
 if(work.some(x=>!x.chara||!x.code)){
  alert('すべての画像にキャラ名とコーデ名を入力してください。');
  return;
 }
 submitting=true;
 closed=true;
 picker.disabled=true;
 submit.disabled=true;
 // Return to the card list now. Only the upload is still running.
 release();
 closeEditor();
 siteBUploadInProgress=true;
 siteBShowSaving(`フレカを登録中… 0/${work.length}件。このページを閉じないでください`);
 let complete=0;
 const created=[],errors=[];
 try{
  for(let i=0;i<work.length;i++){
   const item=work[i];
   let uploadedId='';
   siteBShowSaving(`フレカを登録中… ${i+1}/${work.length}件（完了 ${complete}件）。このページを閉じないでください`);
   try{
    const data=await readDataURL(item.file);
    const saved=await post('upload',{filename:item.file.name,mimeType:item.file.type||'image/png',data});
    uploadedId=saved.card?.id||'';
    if(!uploadedId)throw Error('アップロードしたカードIDが取得できませんでした');
    await post('update',{id:uploadedId,chara:item.chara,code:item.code});
    created.push({...saved.card,id:uploadedId,chara:item.chara,code:item.code});
    complete++;
   }catch(err){
    if(uploadedId){
     try{await post('delete',{id:uploadedId});}
     catch(_){errors.push(`${item.path}：保存途中のカードが残っている可能性があります`);}
    }
    errors.push(`${item.path}：${err.message}`);
   }
  }
 }finally{
  siteBUploadInProgress=false;
  // The GAS already returned the saved cards; avoid an extra adminList request.
  if(created.length)cards.unshift(...created.reverse());
  try{if($('#list'))render();}catch(e){console.error(e);}
  siteBHideSaving();
 }
 toast(`${complete}/${work.length}件を登録しました`);
 if(errors.length)alert(`登録できなかった画像があります。\n${errors.slice(0,5).join('\n')}${errors.length>5?`\nほか${errors.length-5}件`:''}`);
}
}
function openEditor(id){
 if(siteBUploadInProgress||siteBSaveInProgress){toast('保存処理中です');return;}
 const x=cards.find(v=>String(v.id)===String(id));if(!x)return;
 $('#editor-host').innerHTML=`<div class="dialog-shade" id="edit-shade"><section class="dialog" role="dialog" aria-modal="true" aria-label="フレカを編集">
 <div class="row between"><h2>フレカを編集</h2><button type="button" class="tiny-btn" id="edit-close">×</button></div>
 <label class="field">キャラ名<input type="text" class="chara" data-id="${esc(id)}" value="${esc(x.chara||'')}" placeholder="自由入力" maxlength="120"></label>
 <label class="field">コーデ名<input type="text" class="code" data-id="${esc(id)}" value="${esc(x.code||'')}" placeholder="コーデ名" maxlength="120"></label>
 <div class="dialog-actions"><button type="button" class="btn" id="edit-cancel">キャンセル</button><button type="button" class="btn primary" id="edit-save">保存</button></div>
 </section></div>`;
 $('#edit-close').onclick=closeEditor;$('#edit-cancel').onclick=closeEditor;
 $('#edit-shade').onclick=e=>{if(e.target.id==='edit-shade')closeEditor();};
 $('#edit-save').onclick=()=>saveCard(id);
 setupSiteBInputHistory();
}
function closeEditor(){if(siteBUploadInProgress)return;const host=$('#editor-host');if(host){host._siteBNameSuggestController?.abort();host.innerHTML='';}}
function openPreview(id){
 const x=cards.find(v=>String(v.id)===String(id));if(!x?.image_url)return;
 $('#adminModalImg').src=x.image_url;$('#adminModal').classList.remove('hidden');
}
function closePreview(){
 const modal=$('#adminModal');if(!modal)return;
 modal.classList.add('hidden');const img=$('#adminModalImg');if(img)img.removeAttribute('src');
}
async function toggleVisibility(id,currentVisible){
  const next=!currentVisible;
  const x=cards.find(x=>String(x.id)===String(id));
  if(!x)return;

  try{
    await post('visibility',{
      id,
      visible:String(next)
    });

    x.visible=next;
    draw();
    toast(next?'公開しました':'非表示にしました');
  }catch(e){
    alert('表示状態の変更に失敗しました：'+e.message);
  }
}

async function saveCard(id){
 if(siteBUploadInProgress||siteBSaveInProgress){toast('ほかの保存処理が完了してから操作してください');return;}
 const chara=document.querySelector('.chara[data-id="'+id+'"]')?.value.trim()||'';
 const code=document.querySelector('.code[data-id="'+id+'"]')?.value.trim()||'';
 const original=cards.find(x=>String(x.id)===String(id));
 if(!original)return;
 if(original.chara===chara&&original.code===code){closeEditor();return;}

 siteBSaveInProgress=true;
 // Start the request, then close immediately; report success only after GAS confirms.
 const saving=post('update',{id,chara,code});
 closeEditor();
 siteBShowSaving('フレカを保存中… このページを閉じないでください');
 try{
  await saving;
  const card=cards.find(x=>String(x.id)===String(id));
  if(card){card.chara=chara;card.code=code;}
  if($('#list'))draw();
  toast('保存しました');
 }catch(e){
  // The saved data is not changed locally on failure.
  if($('#list')&&!$('#edit-shade')&&!$('#upload-shade')){
   siteBSaveInProgress=false;
   openEditor(id);
   const c=document.querySelector('.chara[data-id="'+id+'"]');
   const n=document.querySelector('.code[data-id="'+id+'"]');
   if(c)c.value=chara;
   if(n)n.value=code;
  }
  alert('保存に失敗しました。入力内容は編集欄に残しています：'+e.message);
 }finally{
  siteBSaveInProgress=false;
  siteBHideSaving();
 }
}

function readDataURL(file){
  return new Promise((res,rej)=>{
    const r=new FileReader();
    r.onload=()=>res(r.result);
    r.onerror=rej;
    r.readAsDataURL(file);
  });
}

async function addFiles(files){
  const list=[...files];
  if(!list.length)return;

  let completed=0;
  for(const file of list){
    try{
      toast(`アップロード中… ${completed+1}/${list.length}`);
      const dataUrl=await readDataURL(file);

      // PNG・解像度・画質はそのまま。余計な画像変換処理はしません。
      const j=await post('upload',{
        filename:file.name,
        mimeType:file.type||'image/png',
        data:dataUrl
      });

      cards.unshift(j.card);
      completed++;
    }catch(e){
      alert('アップロードに失敗しました：'+e.message);
    }
  }

  // 全件アップロード後に一度だけ管理画面を描画します。
  render();
  toast(completed===list.length?'追加しました':`${completed}/${list.length}件追加しました`);
}

async function deleteOne(id){
  if(confirm('このカードを削除しますか？')){
    await remove([id]);
  }
}

async function deleteSelected(){
  if(selected.size && confirm(selected.size+'件削除しますか？')){
    await remove([...selected]);
  }
}

async function remove(ids){
  try{
    for(const id of ids)await post('delete',{id});

    cards=cards.filter(x=>!ids.includes(x.id));
    selected.clear();
    deleteMode=false;

    render();
    toast('削除しました');
  }catch(e){
    alert('削除に失敗しました：'+e.message);
  }
}

function updateBar(){
 const bar=$('#bar');if(!bar)return;
 bar.classList.toggle('show',deleteMode);$('#selCount').textContent=selected.size+'件選択中';
}

init();
})();
