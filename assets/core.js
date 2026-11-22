(()=>{'use strict';
const groups=[];
const chars=groups.flat(), DEFAULT_COLORS={'すべて':'#eaa1bf'};
chars.forEach((c,i)=>DEFAULT_COLORS[c]=['#edafc8','#bdcfec','#d7b7e9','#eca8a3'][i]);
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
const norm=s=>String(s??'').normalize('NFKC').toLowerCase().replace(/[\u30a1-\u30f6]/g,c=>String.fromCharCode(c.charCodeAt(0)-0x60)).trim();
const uuid=()=>crypto?.randomUUID?.()||('id-'+Date.now()+'-'+Math.random().toString(36).slice(2));
const cleanColor=s=>/^#[a-f\d]{6}$/i.test(String(s))?s.toLowerCase():null;
function colorSpec(value,fallback='#eaa1bf'){
 const legacy=cleanColor(value),obj=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
 const first=legacy||cleanColor(obj.first)||cleanColor(obj.hex)||fallback;
 const second=cleanColor(obj.second)||first;
 return {mode:obj.mode==='gradient'?'gradient':'solid',first,second};
}
function themeBackground(value,fallback){
 const t=colorSpec(value,fallback);
 return t.mode==='gradient'?`linear-gradient(110deg, ${t.first}, ${t.second})`:t.first;
}
function themeMain(value,fallback){return colorSpec(value,fallback).first;}

const validChara=s=>typeof s==='string'&&!!s.trim();
const base=()=>({cards:[],owned:[],ownedImages:{},plans:[],colors:{...DEFAULT_COLORS},lastCardsUpdated:'',lastSavedAt:''});
function sanitize(obj){const out=base();if(!obj||typeof obj!=='object')return out;
 for(const key of ['cards','owned','plans'])if(Array.isArray(obj[key]))out[key]=obj[key].filter(x=>x&&typeof x.code==='string'&&validChara(x.chara)).map(x=>({id:String(x.id||uuid()),code:x.code.trim().slice(0,120),chara:x.chara,...(key==='cards'?{image_url:typeof x.image_url==='string'?x.image_url:'',updated_at:typeof x.updated_at==='string'?x.updated_at:''}:{}),...(key==='plans'?{note:String(x.note||'').slice(0,600),done:!!x.done}:{})})).filter(x=>x.code);
 if(obj.ownedImages&&typeof obj.ownedImages==='object'&&!Array.isArray(obj.ownedImages)){
  for(const [key,image] of Object.entries(obj.ownedImages)){
   if(typeof key==='string'&&key.length<=120&&typeof image==='string'&&(/^(?:data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+)$/.test(image)&&image.length<=38000||/^idb:[A-Za-z0-9_-]{6,100}$/.test(image)))out.ownedImages[key]=image;
  }
 }
 if(typeof obj.lastCardsUpdated==='string')out.lastCardsUpdated=obj.lastCardsUpdated;
 if(typeof obj.lastSavedAt==='string')out.lastSavedAt=obj.lastSavedAt;
 if(obj.colors&&typeof obj.colors==='object')Object.keys(DEFAULT_COLORS).forEach(c=>{out.colors[c]=colorSpec(obj.colors[c],DEFAULT_COLORS[c])});return out;}
const KEY='site_d_preview_v3';
let cache;
const isDemo=()=>!String(window.SITE_D_CONFIG?.gasUrl||'').trim();
const isRemoteHost=()=>/^https?:$/.test(location.protocol)&&!['localhost','127.0.0.1','[::1]'].includes(location.hostname);
function localRead(){if(cache)return cache;try{cache=sanitize(JSON.parse(localStorage.getItem(KEY)||'null'));}catch(e){cache=base();}return cache;}
function localSave(d){const val=sanitize(d);localStorage.setItem(KEY,JSON.stringify(val));cache=val;return val;}
function publicData(d){return {cards:d.cards,colors:d.colors,lastCardsUpdated:d.lastCardsUpdated||''};}
async function pinRequest_(action,params={}) {
 const body=new URLSearchParams({action,...params});
 const res=await fetch(window.SITE_D_CONFIG.gasUrl,{
  method:'POST',body,redirect:'follow',cache:'no-store'
 });
 if(!res.ok)throw Error('通信エラー: '+res.status);
 const result=await res.json();
 if(result.ok!==true)throw Error(result.error||'PIN認証に失敗しました');
 return result;
}
async function api(action,payload={},token=''){
 const pinEnabled=window.SITE_D_CONFIG?.pinAuthEnabled===true;
 if(pinEnabled&&action==='pinLogin'){
  const pin=String(payload.pin??'');
  if(!/^[0-9]{4}$/.test(pin))throw Error('4桁のPINを入力してください');
  return pinRequest_('pinLogin',{pin});
 }
 if(action!=='public')throw Error('サイトBの管理操作は専用APIを利用します');
 // A signed-in administrator may read the public list through the existing
 // password-checked adminList endpoint, without knowing the separate public PIN.
 // Never trust an unsigned URL flag or show data before server verification.
 const adminPassword=pinEnabled&&!token
  ?sessionStorage.getItem('freca_admin_password')||''
  :'';
 if(pinEnabled&&!token&&!adminPassword)throw Error('PIN_REQUIRED');
 const url=new URL(window.SITE_D_CONFIG.gasUrl);
 let result;
 if(pinEnabled){
  // Every route is authenticated on GAS: either pinList with a token or
  // adminList with the existing administrator password. No public GET fallback.
  result=token
   ?await pinRequest_('pinList',{token})
   :await pinRequest_('adminList',{password:adminPassword});
 }else{
  url.searchParams.set('action','list');
  url.searchParams.set('_ts',String(Date.now()));
  const res=await fetch(url.toString(),{cache:'no-store',redirect:'follow'});
  if(!res.ok)throw Error('通信エラー: '+res.status);
  result=await res.json();
  if(result.ok===false)throw Error(result.error||'公開データを取得できませんでした');
 }
 const rows=Array.isArray(result)?result:(Array.isArray(result.cards)?result.cards:[]);
 if(!Array.isArray(rows))throw Error('公開データの形式が正しくありません');
 const cards=rows.filter(x=>x&&x.visible!==false&&typeof x.code==='string')
   .map(x=>({id:String(x.id||uuid()),chara:String(x.chara||''),code:x.code,
     image_url:String(x.image_url||''),updated_at:String(x.updated_at||x.created_at||'')}));
 const stamps=cards.map(x=>Date.parse(x.updated_at)).filter(Number.isFinite);
 return {cards,colors:{...DEFAULT_COLORS},
   lastCardsUpdated:stamps.length?new Date(Math.max(...stamps)).toISOString():''};
}
function colorInfo(hex){
 const c=cleanColor(hex)||DEFAULT_COLORS['すべて'];
 const r=parseInt(c.slice(1,3),16),g=parseInt(c.slice(3,5),16),b=parseInt(c.slice(5,7),16);
 const f=v=>{v/=255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4)};
 const L=.2126*f(r)+.7152*f(g)+.0722*f(b);
 const on=(L+.05)/.05>=1.05/(L+.05)?'#171717':'#ffffff';
 return {color:c,on,soft:`rgba(${r}, ${g}, ${b}, .21)`,line:`rgba(${r}, ${g}, ${b}, .38)`};
}
let lastBackground='';
function theme(chara,colors){
 const key=chara||'すべて',spec=colorSpec(colors[key],DEFAULT_COLORS[key]);
 const mix=spec.mode==='gradient'?
 '#'+[1,3,5].map(i=>Math.round((parseInt(spec.first.slice(i,i+2),16)+parseInt(spec.second.slice(i,i+2),16))/2).toString(16).padStart(2,'0')).join('')
 :spec.first;
 const t=colorInfo(mix),bg=themeBackground(spec),st=document.documentElement.style;
 if(lastBackground && lastBackground!==bg){
  st.setProperty('--old-theme-background',lastBackground);
  document.documentElement.classList.remove('theme-changing');
  void document.documentElement.offsetWidth;
  document.documentElement.classList.add('theme-changing');
  clearTimeout(theme.timer);
  theme.timer=setTimeout(()=>document.documentElement.classList.remove('theme-changing'),720);
 }
 lastBackground=bg;
 st.setProperty('--theme-background',bg);
 st.setProperty('--theme-color',t.color);st.setProperty('--theme-on',t.on);
 st.setProperty('--theme-soft',t.soft);st.setProperty('--theme-line',t.line);
}
function characterStyle(chara,colors){
 const spec=colorSpec(colors[chara||'すべて'],DEFAULT_COLORS[chara||'すべて']);
 const c=colorInfo(spec.first),other=colorInfo(spec.second);
 const soft=spec.mode==='gradient'?`linear-gradient(110deg, ${c.soft}, ${other.soft})`:c.soft;
 return `--item-color:${c.color};--item-background:${themeBackground(spec)};--item-on:${c.on};--item-soft:${soft};--item-line:${c.line}`;
}
function cardImage(src,code){if(!src)return '<div class="empty-image"><span>♡</span><small>画像未登録</small></div>';return `<img src="${esc(src)}" alt="${esc(code)}" loading="lazy" decoding="async">`;}
function iconHome(){return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 10 9-7 9 7v10h-6v-7H9v7H3z"/></svg>';}
function iconUser(){return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.3"/><path d="M5.5 21c.5-4.6 2.7-6.8 6.5-6.8s6 2.2 6.5 6.8"/></svg>';}
function buildCharacterNav(onSelect,{mobile=true,colors=DEFAULT_COLORS}={}){
 let current='', group=0;
 const pc=`<nav class="desktop-tabs" aria-label="キャラクター切替"><button data-char="" class="char-tab active">すべて</button>${chars.map(c=>`<button data-char="${esc(c)}" class="char-tab">${esc(c)}</button>`).join('')}</nav>`;
 const bottom=mobile?`<nav class="bottom-nav" aria-label="キャラクター切替"><div class="bottom-nav-inner"><button class="bottom-all active" data-char="">すべて</button><div class="nav-scroller" id="nav-scroller"><div class="nav-track">${groups.map((a,i)=>`<div class="nav-slide" data-group="${i}">${a.map(c=>`<button class="bottom-char" data-char="${esc(c)}">${esc(c)}</button>`).join('')}</div>`).join('')}</div></div></div></nav>`:'';
 return {html:pc+bottom,init(root=document){
  const update=()=>{
   $$('[data-char]',root).forEach(b=>{b.classList.toggle('active',b.dataset.char===current);b.style.cssText=characterStyle(b.dataset.char||'すべて',colors);});
   theme(current,colors);
  };
  $$('[data-char]',root).forEach(b=>b.addEventListener('click',()=>{current=b.dataset.char;update();onSelect(current);}));
  const sc=$('#nav-scroller',root);
  if(sc){let timer;sc.addEventListener('scroll',()=>{clearTimeout(timer);timer=setTimeout(()=>{group=Math.max(0,Math.min(3,Math.round(sc.scrollLeft/Math.max(1,sc.clientWidth))));},60);},{passive:true});}
  update();
  return {set(c){current=c;update();},updateColors(c){colors=c;update();}};
 }};}
function toast(msg){let n=$('#toast');if(!n){n=document.createElement('div');n.id='toast';n.className='toast';document.body.appendChild(n);}n.textContent=msg;n.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>n.classList.remove('show'),2300);}
window.SiteD={colorSpec,themeBackground,themeMain,colorInfo,characterStyle,groups,chars,DEFAULT_COLORS,$,$$,esc,norm,uuid,cleanColor,validChara,base,sanitize,localRead,localSave,isDemo,api,theme,cardImage,buildCharacterNav,toast,publicData};
})();
