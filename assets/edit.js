(function(){
const C=window.FRECA_CONFIG||{};
let cards=[],q='',deleteMode=false,selected=new Set(),
    adminPassword=sessionStorage.getItem('freca_admin_password')||'';

const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));

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
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){toggle(false);closePreview();closeEditor();}});
 draw();
 $('#upload-trigger').onclick=()=>$('#files').click();
 $('#files').onchange=e=>addFiles(e.target.files);
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
      ${x.image_url?`<img src="${esc(x.image_url)}" alt="${esc(x.code)}" loading="${i<2?'eager':'lazy'}" decoding="async">`:'<span>画像なし</span>'}
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
function openPreview(id){
  const x=cards.find(x=>String(x.id)===String(id));
  if(!x)return;

  $('#adminModalImg').src=x.image_url;
  $('#adminModal').classList.add('open');
}

function closePreview(){
  const modal=$('#adminModal');
  if(!modal)return;
  modal.classList.remove('open');
  const img=$('#adminModalImg');
  if(img)img.src='';
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
  const chara=
    document.querySelector('.chara[data-id="'+id+'"]')?.value.trim()||'';
  const code=
    document.querySelector('.code[data-id="'+id+'"]')?.value.trim()||'';

  try{
    await post('update',{id,chara,code});

    const x=cards.find(x=>x.id===id);
    if(x){
      x.chara=chara;
      x.code=code;
    }

    toast('保存しました');
  }catch(e){
    alert('保存に失敗しました：'+e.message);
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
  const b=$('#bar');
  if(!b)return;

  b.classList.toggle('show',deleteMode);
  $('#selCount').textContent=selected.size+'件選択中';
}

init();
})();
