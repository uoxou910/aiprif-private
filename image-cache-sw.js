// サイトB: 一覧の軽量サムネイルのみ保存。拡大画像・API・HTMLは保存しない。
const CACHE='freca-siteb-thumbnails-v1';
const LIMIT=120;
self.addEventListener('install',e=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
function isThumb(req){
  if(req.destination!=='image')return false;
  const u=new URL(req.url);
  return u.hostname==='drive.google.com' && u.pathname==='/thumbnail' &&
    u.searchParams.has('id') && u.searchParams.get('sz')==='w480';
}
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(!isThumb(req))return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    const hit=await cache.match(req);
    if(hit)return hit;
    const response=await fetch(req);
    if(response.ok || response.type==='opaque'){
      try{
        await cache.put(req,response.clone());
        const keys=await cache.keys();
        if(keys.length>LIMIT){
          await Promise.all(keys.slice(0,keys.length-LIMIT).map(k=>cache.delete(k)));
        }
      }catch(e){}
    }
    return response;
  })());
});
