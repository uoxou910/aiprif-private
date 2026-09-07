const C=window.FRECA_CONFIG||{};
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
let cards=[],q='',chara='',page=1;
const PAGE=30;

function normalizeSearchText(s){
  return String(s??'')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u30a1-\u30f6]/g,ch =>
      String.fromCharCode(ch.charCodeAt(0)-0x60)
    );
}

let viewPassword=sessionStorage.getItem('freca_view_password')||'';

async function apiGet(action,params={}){
  const u=new URL(C.gasUrl);
  u.searchParams.set('action',action);
  Object.entries(params).forEach(([k,v])=>u.searchParams.set(k,v));
  u.searchParams.set('_ts',String(Date.now()));
  const r=await fetch(u.toString(),{redirect:'follow',cache:'no-store'});
  const j=await r.json();
  if(!j.ok)throw new Error(j.error||'API error');
  return j;
}

function renderViewLogin(error=''){
  document.body.innerHTML=`
    <main class="viewer-login-page">
      <div class="viewer-login-box">
        <div class="viewer-login-title">${esc(C.appName||'フレカ置き場')}</div>
        <div class="viewer-login-sub">閲覧パスワードを入力してください</div>
        ${error?`<div class="viewer-login-error">${esc(error)}</div>`:''}
        <label class="viewer-login-label">
          閲覧パスワード
          <input id="viewPasswordInput"
                 type="password"
                 autocomplete="current-password"
                 placeholder="パスワード">
        </label>
        <button class="viewer-login-button" id="viewLoginButton">見る</button>
      </div>
    </main>`;

  const login=async()=>{
    const p=$('#viewPasswordInput').value;
    if(!p){
      renderViewLogin('パスワードを入力してください。');
      return;
    }

    // 認証エラーと、認証後のカード読み込みエラーを分ける。
    try{
      await apiGet('viewAuth',{viewPassword:p});
    }catch(e){
      const msg=String(e.message||'');
      if(msg.includes('未設定')){
        renderViewLogin('閲覧パスワードがまだ設定されていません。');
      }else if(msg.includes('閲覧パスワードが違います')){
        renderViewLogin('パスワードが違います。');
      }else{
        renderViewLogin('認証に失敗しました：'+msg);
      }
      return;
    }

    viewPassword=p;
    sessionStorage.setItem('freca_view_password',p);
    await loadCards();
  };

  $('#viewLoginButton').onclick=login;
  $('#viewPasswordInput').onkeydown=e=>{
    if(e.key==='Enter')login();
  };
}

async function loadCards(){
  document.body.innerHTML='<div class="loading">読み込み中...</div>';
  try{
    const j=await apiGet('list',{viewPassword});
    cards=j.cards||[];
    buildShell();
    renderResults();
  }catch(e){
    const msg=String(e.message||'');
    sessionStorage.removeItem('freca_view_password');
    viewPassword='';
    if(msg.includes('未設定')){
      renderViewLogin('閲覧パスワードがまだ設定されていません。');
    }else if(msg.includes('閲覧パスワードが違います')){
      renderViewLogin('パスワードが違います。');
    }else{
      renderViewLogin('カード一覧の読み込みに失敗しました：'+msg);
    }
  }
}

async function load(){
  if(!C.gasUrl || !/^https:\/\/script\.google\.com\/macros\/s\//.test(C.gasUrl) || C.gasUrl.includes('YOUR_')){
    document.body.innerHTML='<div class="empty">assets/config.js にサイトB用GAS URLを設定してください</div>';
    return;
  }

  if(viewPassword){
    try{
      await apiGet('viewAuth',{viewPassword});
      await loadCards();
      return;
    }catch(e){
      sessionStorage.removeItem('freca_view_password');
      viewPassword='';
    }
  }

  renderViewLogin();
}

function filteredCards(){
  const nq=normalizeSearchText(q);

  // 検索中はキャラタブの選択に関係なく、
  // 全カードから「キャラ名 + コーデ名」を検索する。
  if(q){
    return cards.filter(x=>
      normalizeSearchText(`${x.chara} ${x.code}`).includes(nq)
    );
  }

  // 検索していない時だけキャラタブで絞り込む。
  return cards.filter(x=>
    !chara || x.chara===chara
  );
}


function getLatestUpdateDate(){
  const dates=cards
    .map(x=>new Date(x.created_at))
    .filter(d=>!Number.isNaN(d.getTime()));
  if(!dates.length)return '';
  const latest=new Date(Math.max(...dates.map(d=>d.getTime())));
  const y=latest.getFullYear();
  const m=String(latest.getMonth()+1).padStart(2,'0');
  const day=String(latest.getDate()).padStart(2,'0');
  return `${y}${m}${day}`;
}

function buildShell(){
  const chars=[...new Set(cards.map(x=>x.chara).filter(Boolean))];

  document.body.innerHTML=`
    <header class="header">
      <div class="header-inner">
        <div class="title">${esc(C.appName||'フレカ置き場')}</div>
        <div class="updated" id="updated"></div>
      </div>
    </header>

    <div class="hero">
      <div class="search">⌕<input id="q" inputmode="search" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="キャラ名・コーデ名で検索"></div>
    </div>

    <div class="tabs" id="tabs">
      <button class="tab active" data-c="">
        <span class="tab-icon tab-icon-home" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M3.5 10.7 12 3.8l8.5 6.9v8.8a1 1 0 0 1-1 1h-5v-6h-5v6h-5a1 1 0 0 1-1-1z"/></svg>
        </span>
        <span class="tab-label">すべて</span>
      </button>
      ${chars.map(c=>`<button class="tab" data-c="${esc(c)}">
        <span class="tab-icon tab-icon-person" aria-hidden="true">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.2"/><path d="M5.8 20c.4-4 2.7-6.2 6.2-6.2s5.8 2.2 6.2 6.2"/></svg>
        </span>
        <span class="tab-label">${esc(c)}</span>
      </button>`).join('')}
    </div>

    <main class="grid" id="grid"></main>
    <div class="pager" id="pager"></div>

    <div class="modal" id="modal">
      <div class="modal-content">
        <img id="modal-img">
        <button class="close" id="close" aria-label="閉じる">×</button>
      </div>
    </div>`;

  const latest=getLatestUpdateDate();
  if(latest)$('#updated').textContent=`更新:${latest}`;

  const input=$('#q');
  let timer;

  input.addEventListener('input',e=>{
    clearTimeout(timer);
    timer=setTimeout(()=>{
      q=e.target.value.trim();
      page=1;
      renderResults();
    },180);
  });

  document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{
    chara=b.dataset.c;
    page=1;
    document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x===b));
    renderResults();
  });

  $('#close').onclick=()=>$('#modal').classList.remove('open');
  $('#modal').onclick=e=>{
    if(e.target.id==='modal')$('#modal').classList.remove('open');
  };
}


function makePageItems(current,total){
  if(total<=7)return Array.from({length:total},(_,i)=>i+1);

  const items=[1];
  let start=Math.max(2,current-1);
  let end=Math.min(total-1,current+1);

  if(current<=3){
    start=2;
    end=4;
  }else if(current>=total-2){
    start=total-3;
    end=total-1;
  }

  if(start>2)items.push('…');
  for(let i=start;i<=end;i++)items.push(i);
  if(end<total-1)items.push('…');
  items.push(total);
  return items;
}

function renderResults(){
  const filtered=filteredCards();
  const total=Math.max(1,Math.ceil(filtered.length/PAGE));
  page=Math.min(page,total);
  const list=filtered.slice((page-1)*PAGE,page*PAGE);

  const grid=$('#grid');
  const pager=$('#pager');

  grid.innerHTML=list.length
    ? list.map((x,i)=>`
      <article class="card" data-id="${x.id}" style="--delay:${Math.min(i,18)*55}ms">
        <div class="card-img"><img
          src="${esc(x.image_url)}"
          loading="${i<6?'eager':'lazy'}"
          fetchpriority="${i<3?'high':'auto'}"
          decoding="async"
        ></div>
        <div class="card-info">
          <div class="chara">${esc(x.chara||'未設定')}</div>
          <div class="code">${esc(x.code||'')}</div>
        </div>
      </article>`).join('')
    : '<div class="empty" style="grid-column:1/-1">カードがありません</div>';

  const pageItems=makePageItems(page,total);
  pager.innerHTML=`
    <button class="page-btn page-arrow" data-page="${page-1}" ${page<=1?'disabled':''} aria-label="前のページ">‹</button>
    ${pageItems.map(p=>p==='…'
      ? '<span class="page-ellipsis">…</span>'
      : `<button class="page-btn ${p===page?'active':''}" data-page="${p}">${p}</button>`
    ).join('')}
    <button class="page-btn page-arrow" data-page="${page+1}" ${page>=total?'disabled':''} aria-label="次のページ">›</button>`;

  pager.querySelectorAll('[data-page]').forEach(btn=>{
    btn.onclick=()=>{
      if(btn.disabled)return;
      const next=Number(btn.dataset.page);
      if(!Number.isFinite(next)||next<1||next>total||next===page)return;
      page=next;
      renderResults();
      window.scrollTo({top:0,behavior:'smooth'});
    };
  });

  document.querySelectorAll('.card').forEach(el=>el.onclick=()=>{
    const x=cards.find(x=>String(x.id)===String(el.dataset.id));
    if(!x)return;
    $('#modal-img').src=x.image_url;
    $('#modal').classList.add('open');
  });
}

load();
