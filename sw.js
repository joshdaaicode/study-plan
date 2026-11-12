const CACHE='study-plan-v12';   // 11-12：v11 裡可能還存著 11-11 以前的舊版（持股上限 500），換名字讓手機丟掉重抓
const ASSETS=['./','./index.html','./plan.js','./manifest.json','./daychart.js?v=20261110a'];   // 11-09：daychart.js 補進離線清單（網址要跟兩頁載入的一樣，改檔記得換版本號）
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
  // 11-12：網路太慢先給了手機裡存的那份、之後新版才到 → 通知頁面跳「點這裡重新整理」（以前會一直開著舊版，
  // 他 11-12 看到持股上限又變回 500，就是開到 11-11 以前存的舊版）
  const tag=r=>r && (r.headers.get('etag')||r.headers.get('last-modified'));
  let gaveOld=false, netP=null;
  const p=(async()=>{
    const cache=await caches.open(CACHE), key=nav?'./index.html':req;
    const cached=await cache.match(key);
    netP=fetch(req,{cache:'no-cache'}).then(r=>{
      // 學校 Wi-Fi 登入頁之類的轉址、錯誤頁不要存；伺服器回錯誤（404、500…）而手機裡有存過，就用存的那份
      if(!r.ok || r.redirected || r.type!=='basic') return cached || r;
      // 11-09 C12：內容沒變（ETag 一樣）就不重寫快取，以前每次打開都把約 0.9 MB 重寫一次
      const ct=tag(cached), nt=tag(r), same=cached && nt && ct===nt;
      if(!same){
        cache.put(key,r.clone()).catch(()=>{});
        if(gaveOld && ct && nt) self.clients.matchAll({type:'window'}).then(cs=>cs.forEach(c=>c.postMessage({t:'newver'})));
      }
      return r;
    });
    if(!cached) return netP.catch(()=>nav?cache.match('./'):Response.error());
    const slow=new Promise(res=>setTimeout(()=>{ gaveOld=true; res(cached); },4000));
    return Promise.race([netP.catch(()=>{ gaveOld=true; return cached; }),slow]);
  })();
  e.respondWith(p);
  e.waitUntil(p.then(()=>netP && netP.catch(()=>{})).catch(()=>{}));   // 給了舊版之後還要等新版下載完、存好、通知
});
// 點時段提醒的通知：打開（或切回）網站
self.addEventListener('notificationclick',e=>{
  e.notification.close();
  e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(cs=>{
    for(const c of cs){ if('focus' in c) return c.focus(); }
    return self.clients.openWindow('./');
  }));
});
