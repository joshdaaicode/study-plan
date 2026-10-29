const CACHE='study-plan-v9';
const ASSETS=['./','./index.html','./plan.js','./manifest.json'];
self.addEventListener('install',e=>{
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS.map(u=>new Request(u,{cache:'reload'}))).catch(()=>{})));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
// 有網路：一定跟伺服器確認是不是最新版（不吃瀏覽器的舊快取）；網路太慢（4 秒）或斷線：先用手機裡存的那份
self.addEventListener('fetch',e=>{
  const req=e.request, u=new URL(req.url);
  if(req.method!=='GET' || u.origin!==self.location.origin) return;
  const nav=req.mode==='navigate';
  e.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    const net=fetch(req,{cache:'no-cache'}).then(r=>{
      // 學校 Wi-Fi 登入頁之類的轉址、錯誤頁不要存
      if(r.ok && !r.redirected && r.type==='basic') cache.put(nav?'./index.html':req,r.clone()).catch(()=>{});
      return r;
    });
    const cached=await cache.match(nav?'./index.html':req);
    if(!cached) return net.catch(()=>nav?cache.match('./'):Response.error());
    const slow=new Promise(res=>setTimeout(()=>res(cached),4000));
    return Promise.race([net.catch(()=>cached),slow]);
  })());
});
// 點時段提醒的通知：打開（或切回）網站
self.addEventListener('notificationclick',e=>{
  e.notification.close();
  e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(cs=>{
    for(const c of cs){ if('focus' in c) return c.focus(); }
    return self.clients.openWindow('./');
  }));
});
