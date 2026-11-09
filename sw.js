const CACHE='study-plan-v11';
const ASSETS=['./','./index.html','./plan.js','./manifest.json','./daychart.js?v=20261109a'];   // 11-09：daychart.js 補進離線清單（網址要跟兩頁載入的一樣，改檔記得換版本號）
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
  // 只有讀書網站本身（./、index.html）走這套；家長版 parent.html 等其他頁面直接連網路，不能被當成 index.html 存起來
  if(nav && !/\/(index\.html)?$/.test(u.pathname)) return;
  // 11-09 C12：網址帶版本號的（casino.js?v=…、vocab.js?v=…、toeic.js?v=…）內容永遠不會變，直接用存好的，
  // 不用每次等網路（以前開單字賭場在慢的 Wi-Fi 上最多要等約 8 秒）
  if(!nav && u.searchParams.has('v')){
    e.respondWith(caches.open(CACHE).then(cache=>cache.match(req).then(hit=>hit||fetch(req).then(r=>{
      if(r.ok && r.type==='basic') cache.put(req,r.clone()).catch(()=>{});
      return r;
    }))));
    return;
  }
  e.respondWith((async()=>{
    const cache=await caches.open(CACHE), key=nav?'./index.html':req;
    const cached=await cache.match(key);
    const net=fetch(req,{cache:'no-cache'}).then(r=>{
      // 學校 Wi-Fi 登入頁之類的轉址、錯誤頁不要存；伺服器回錯誤（404、500…）而手機裡有存過，就用存的那份
      if(!r.ok || r.redirected || r.type!=='basic') return cached || r;
      // 11-09 C12：內容沒變（ETag 一樣）就不重寫快取，以前每次打開都把約 0.9 MB 重寫一次
      const same=cached && r.headers.get('etag') && cached.headers.get('etag')===r.headers.get('etag');
      if(!same) cache.put(key,r.clone()).catch(()=>{});
      return r;
    });
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
