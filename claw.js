/* 夾娃娃機（2026-11-21，他：「再多做一個夾娃娃機（分特殊版和普通版），真的可以操控按鈕去夾，裡面的東西每天不一樣，
   特殊版要一個禮拜平均讀書超過 3 小時，給你檢查的東西全清並且完成特別任務給你檢查（超修、超前、寫完你出的特殊考卷、臨時抽查
   之前做過的東西等等）才能限時開放特殊版娃娃機（一次 100），獎品更豐富、更高級，普通娃娃機只要昨天的任務有全清就能開放，一次 500」）。
   打開「獎勵 → 許願商店」才載入（index.html 底部），畫在 #cw-app。

   ・普通版：昨天的任務全清（hist 那天 a>0 且 d≥a）才開，一次 500 點。
   ・特殊版：三個條件都要有——①最近 7 天（不含今天）平均讀書 3 小時以上（讀書時間跟「每天的讀書長條圖」同一套：有番茄鐘算番茄鐘，
     沒有才算完成任務的表定分鐘）②給 Claude 檢查的全部過關 ③Claude 的特別任務連結（#fix kind 'claw'，記在 plan.checks.v1 的 sp.until）
     還沒過期。一次 100 點。
   ・跟扭蛋機一樣：讀書時段不能玩、點數是負的或欠銀行不能玩。
   ・機器裡的東西：每天用日期當亂數種子排一次（普通 10 個、特殊 8 個），夾走就少一個、掉下來就換位置，明天整台換新。
     狀態存在 plan.shop.v1 的 cl（會同步）：own（娃娃各幾隻）、ex（碎片袋、扭蛋券各夾到幾次）、n（夾了幾次）、win、spent、m.n／m.s（今天機器裡的東西和位置）。
   ・操作：◀ ▶ 按住移動（鍵盤左右鍵也可以），按「夾！」（或空白鍵、下鍵）爪子下去；15 秒沒按會自己下去。
     夾不夾得到看對得準不準（爪子中心和娃娃中心差多少）和娃娃的稀有度（越稀有越滑）；夾起來在半路還可能滑掉，掉在出口上就算你的。 */
(function(){
  if(window.__claw) return;
  var API=window.__shopApi, U=window.__U, app=document.getElementById('cw-app');
  if(!API || !U || !app) return;
  function esc(s){ return window.__esc?window.__esc(s):String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function md(d){ return (d.getMonth()+1)+'/'+d.getDate(); }
  function hhmm(d){ return ('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2); }
  function addD(d,n){ var x=new Date(d); x.setDate(x.getDate()+n); return x; }

  /* ---------- 獎品 ---------- */
  var RAR={N:{n:'普通',g:.86}, R:{n:'稀有',g:.72}, SR:{n:'史詩',g:.58}, SSR:{n:'傳說',g:.46}, UR:{n:'神話',g:.36}};   // g＝好不好夾（越稀有越滑）
  var PZ=[   // [代號, 哪台（n 普通／s 特殊）, 稀有度, 圖, 名字, 一句話]
    ['c1','n','N','🧸','小熊','最經典的那一隻'],['c2','n','N','🐰','兔兔','耳朵軟軟的'],['c3','n','N','🐱','小貓','喵一聲就原諒你'],
    ['c4','n','N','🐶','小狗','等你讀完書一起散步'],['c5','n','N','🐥','小雞','早起的鳥兒有蟲吃'],['c6','n','N','🐷','小豬','吃飽才有力氣讀書'],
    ['c7','n','R','🐼','熊貓','黑眼圈是熬夜的證明？'],['c8','n','R','🐨','無尾熊','一天睡 20 小時'],['c9','n','R','🐧','企鵝','穿西裝來考試'],['c10','n','R','🐙','章魚','八隻手一起寫考卷'],
    ['c11','n','SR','🦁','獅子','百獸之王'],['c12','n','SR','🐯','老虎','虎虎生風'],['c13','n','SSR','🦒','長頸鹿','站得高、看得遠'],
    ['s1','s','SR','🐳','大鯨魚','抱起來超大一隻'],['s2','s','SR','🦉','博士貓頭鷹','戴著小小的方帽'],['s3','s','SSR','🦚','孔雀','開屏的那一刻'],
    ['s4','s','SSR','🐲','龍寶寶','還不會噴火'],['s5','s','UR','🦄','彩虹獨角獸','特殊娃娃機的鎮店之寶'],['s6','s','UR','🐉','金龍','只有真正努力的人夾得到']];
  var EX=[   // 不是收藏品：直接變成扭蛋的碎片、扭蛋券
    ['xs5','n','N','✨','碎片袋','扭蛋碎片 +5',['sh',5]],['xt1','n','SR','🎟️','扭蛋券','免費轉 1 次扭蛋',['tk',1]],
    ['xs30','s','R','💠','大碎片袋','扭蛋碎片 +30',['sh',30]],['xt3','s','SR','🎫','扭蛋券組','扭蛋券 ×3',['tk',3]],['xg1','s','SSR','🌟','金扭蛋券','轉 1 次必出傳說以上',['gtk',1]]];
  function item(id){ return PZ.filter(function(x){ return x[0]===id; })[0] || EX.filter(function(x){ return x[0]===id; })[0]; }
  // 每天放進機器的機率（每一格各抽一次）
  var MIX={
    n:{cnt:10, cost:500, w:[['N',46,'p'],['R',22,'p'],['SR',9,'p'],['SSR',3,'p'],['xs5',14,'x'],['xt1',6,'x']]},
    s:{cnt:8, cost:100, w:[['SR',24,'p'],['SSR',16,'p'],['UR',6,'p'],['xs30',22,'x'],['xt3',18,'x'],['xg1',14,'x']]}};

  /* ---------- 資料 ---------- */
  function st(){ var sh=API.shop(), c=sh.cl||(sh.cl={}); c.own=c.own||{}; c.ex=c.ex||{}; c.n=c.n||0; c.win=c.win||0; c.spent=c.spent||0; c.m=c.m||{}; return c; }
  function today(){ return U.kk(U.d0()); }
  function rng(seed){ var h=2166136261>>>0; for(var i=0;i<seed.length;i++){ h^=seed.charCodeAt(i); h=Math.imul(h,16777619)>>>0; } var s=h||1;
    return function(){ s^=s<<13; s>>>=0; s^=s>>>17; s^=s<<5; s>>>=0; return s/4294967296; }; }
  // 今天機器裡的東西（同一天、同一台每次算出來都一樣；夾走、掉下來的位置另外存）
  function machine(t){
    var c=st(), k=today(), M=c.m[t];
    if(M && M.k===k && Array.isArray(M.it)) return M;
    var R=rng('claw|'+t+'|'+k), mx=MIX[t], ids=[], i;
    for(i=0;i<mx.cnt;i++){
      var tot=mx.w.reduce(function(a,w){ return a+w[1]; },0), r=R()*tot, w=mx.w[mx.w.length-1];
      for(var j=0,a=0;j<mx.w.length;j++){ a+=mx.w[j][1]; if(r<a){ w=mx.w[j]; break; } }
      if(t==='s' && i===0) w=R()<.5?['SSR',1,'p']:(R()<.6?['xg1',1,'x']:['UR',1,'p']);   // 特殊機每天至少一個傳說以上的
      if(w[2]==='x') ids.push(w[0]);
      else { var L=PZ.filter(function(x){ return x[1]===t && x[2]===w[0]; }); ids.push(L[Math.floor(R()*L.length)][0]); }
    }
    // 位置：出口在左邊（0～.24），娃娃堆在 .30～.94；下層排開，上層卡在兩隻中間
    var nb=Math.ceil(ids.length*.6), it=[];
    for(i=0;i<ids.length;i++){
      if(i<nb) it.push({id:ids[i], x:.33+(.58*(i+.5)/nb)+(R()-.5)*.03, row:0});
      else { var gap=(i-nb)%(nb-1); it.push({id:ids[i], x:.33+(.58*(gap+1)/nb)+(R()-.5)*.02, row:1}); }
    }
    M=c.m[t]={k:k, it:it}; API.save(); return M;
  }

  /* ---------- 開不開放 ---------- */
  function J(k){ try{ return JSON.parse(localStorage.getItem(k)); }catch(e){ return null; } }
  function baseLock(){
    var a=window.__petApi||{}, b=a.studyBlockNow?a.studyBlockNow():null;
    if(b) return '現在是讀書時段（'+b.n+'），夾娃娃機先休息（跟扭蛋機一樣）。';
    var pts=window.__pts?window.__pts():0; if(pts<0) return '點數是負的（'+pts+'），先補回來才能玩。';
    var bk=a.bankState?a.bankState():{}; if(bk.loan) return '欠銀行 '+bk.loan.owe+' 點，先還清才能玩。';
    return '';
  }
  function yday(){ var a=window.__petApi||{}, h=a.allHist?a.allHist():{}, d=addD(U.d0(),-1), e=h[U.kk(d)]||{}; return {d:d, a:e.a||0, dn:e.d||0, ok:(e.a||0)>0 && (e.d||0)>=(e.a||0)}; }
  function weekAvg(){
    var DC=window.DayChart, t0=U.d0(), sum=0, days=[];
    if(!DC) return {avg:0, days:[], ok:false};
    var P=DC.parse(localStorage);
    for(var i=7;i>=1;i--){ var d=addD(t0,-i), x=DC.dayInfo(P,U.kk(d),t0,window.PLAN||null), m=Math.round(+x.m||0); sum+=m; days.push({d:d, m:m}); }
    var avg=Math.round(sum/7); return {avg:avg, days:days, ok:avg>=180, from:days[0].d, to:days[6].d};
  }
  function checksLeft(){ var C=J('plan.checks.v1')||{}, it=C.items||{}; return Object.keys(it).filter(function(k){ var x=it[k]; return x && x.st!=='pass' && !x.old; }).length; }
  function spWin(){ var C=J('plan.checks.v1')||{}, sp=C.sp; return (sp && +sp.until>Date.now())?sp:null; }
  function spLast(){ var C=J('plan.checks.v1')||{}; return C.sp||null; }
  function gate(t){
    var lk=baseLock();
    if(t==='n'){ var y=yday(); return {ok:!lk && y.ok, lock:lk, y:y}; }
    var w=weekAvg(), cl=checksLeft(), sp=spWin();
    return {ok:!lk && w.ok && cl===0 && !!sp, lock:lk, w:w, cl:cl, sp:sp};
  }

  /* ---------- 畫面 ---------- */
  var CSS=''
    +'.cw-gate{list-style:none;margin:0 0 10px;padding:0;display:grid;gap:4px;font-size:12.5px}'
    +'.cw-gate li{display:flex;gap:6px;align-items:baseline;line-height:1.5}'
    +'.cw-gate li b{flex:0 0 auto}'
    +'.cw-gate .ok{color:var(--ok,#1F8A52)} .cw-gate .no{color:var(--bad,#C0392B)}'
    +'.cw-stage{position:relative;max-width:460px;margin:0 auto}'
    +'.cw-stage canvas{display:block;width:100%;height:auto;aspect-ratio:100/80;border-radius:14px;touch-action:none}'
    +'.cw-time{position:absolute;top:8px;right:12px;font:700 13px/1 "IBM Plex Mono",monospace;color:#fff;background:rgba(0,0,0,.45);padding:4px 8px;border-radius:999px}'
    +'.cw-time:empty{display:none}'
    +'.cw-ctl{display:grid;grid-template-columns:1fr 1fr 1.3fr;gap:8px;max-width:460px;margin:10px auto 0}'
    +'.cw-ctl button{min-block-size:52px;font:inherit;font-size:20px;font-weight:700;border-radius:14px;border:1px solid var(--rule);background:var(--card2,var(--card));color:var(--ink);cursor:pointer;'
    +'touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;transition:scale .12s ease-out,box-shadow .12s ease-out}'
    +'.cw-ctl button.go{background:var(--warn,#E67E22);border-color:var(--warn,#E67E22);color:#fff;font-size:17px}'
    +'.cw-ctl button:active:not(:disabled),.cw-ctl button.held{scale:.95;box-shadow:inset 0 2px 6px rgba(0,0,0,.25)}'
    +'.cw-ctl button:disabled{opacity:.4;cursor:default}'
    +'.cw-ctl button:focus-visible,.cw-coin:focus-visible{outline:2px solid var(--warn,#E67E22);outline-offset:2px}'
    +'.cw-coin{max-width:460px;margin:10px auto 0;display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:center}'
    +'.cw-coin .btn{min-block-size:48px;min-inline-size:200px}'
    +'.cw-line{display:flex;flex-wrap:wrap;gap:4px;margin:8px 0 0}'
    +'.cw-line span{font-size:11.5px;padding:2px 8px;border-radius:999px;border:1px solid var(--rule);background:var(--card)}'
    +'.cw-line span.got{opacity:.4;text-decoration:line-through}'
    +'@media (max-width:560px){.cw-ctl button{min-block-size:56px}}';
  function injectCss(){ if(document.getElementById('cw-css')) return; var s=document.createElement('style'); s.id='cw-css'; s.textContent=CSS; document.head.appendChild(s); }

  var tab='n', msg='', cv=null, ctx=null, timeEl=null, W=0, H=0, dpr=1;
  var G=null;   // 正在玩的這一局
  // 11-21：正在夾的時候，雲端合併先等（合併完要重新整理，會把這一局打斷）
  (window.__busyFns=window.__busyFns||[]).push(function(){ return G?'夾娃娃':''; });
  var clawX=.13, HOME=.13;
  function onTab(){ return window.__tab===5 && window.__sub===18; }
  function total(){ var c=st(); return PZ.filter(function(x){ return c.own[x[0]]; }).length; }

  function card(x,have){
    var r=RAR[x[2]];
    return '<div class="sg-it '+x[2]+(have?'':' miss')+'"><span class="e" aria-hidden="true">'+(have?x[3]:'？')+'</span><b>'+(have?esc(x[4]):'？？？')+'</b><small class="rr">'+r.n+'</small>'
      +'<small>'+(have?esc(x[5])+(have>1?'・×'+have:''):(x[1]==='s'?'特殊機才有':'普通機'))+'</small></div>';
  }
  function gateHTML(t,g){
    var o='<ul class="cw-gate">';
    function li(ok,txt){ return '<li class="'+(ok?'ok':'no')+'"><b>'+(ok?'✓':'✗')+'</b><span>'+txt+'</span></li>'; }
    if(t==='n'){
      o+=li(g.y.ok,'昨天（'+md(g.y.d)+'）任務'+(g.y.a?' '+g.y.dn+'/'+g.y.a:'')+(g.y.ok?' 全清，今天開放':(g.y.a?'，沒有全清':'沒有紀錄')+'；要昨天全清，今天才開放'));
    } else {
      var w=g.w;
      o+=li(w.ok,'最近 7 天（'+md(w.from)+'～'+md(w.to)+'）平均讀書 '+Math.floor(w.avg/60)+' 小時 '+(w.avg%60)+' 分'+(w.ok?'':'，要 3 小時以上'));
      o+=li(g.cl===0, g.cl===0?'給 Claude 檢查的全部過關':'給 Claude 檢查的還有 '+g.cl+' 份沒過關');
      var last=spLast();
      o+=li(!!g.sp, g.sp?'特別任務過關：開放到 '+md(new Date(g.sp.until))+' '+hhmm(new Date(g.sp.until))+(g.sp.why?'（'+esc(g.sp.why)+'）':'')
        :(last&&last.until?'特別任務的開放時間到 '+md(new Date(last.until))+' 已經結束，再做一個特別任務給 Claude 檢查':'特別任務還沒過關：超修、超前、寫完 Claude 出的特殊考卷、臨時抽查之前做過的東西……做完拍給 Claude 檢查，過關會拿到連結'));
    }
    if(g.lock) o+=li(false,esc(g.lock));
    return o+'</ul>';
  }
  function shell(){
    var c=st(), have=total();
    var o='<div class="sg-head"><div><b>🧸 夾娃娃機</b><small>娃娃 '+have+' / '+PZ.length+'・夾了 '+c.n+' 次・夾到 '+c.win+' 個</small></div></div>'
      +'<div class="fp-tabs sg-tabs" aria-label="夾娃娃機分頁">'+[['n','🧸 普通・500'],['s','💎 特殊・100'],['book','📖 收藏 '+have+'/'+PZ.length]].map(function(x){
        return '<button type="button" data-cltab="'+x[0]+'" aria-pressed="'+(tab===x[0])+'"'+(G?' disabled':'')+'>'+x[1]+'</button>'; }).join('')+'</div><div class="sg-body">';
    if(tab==='book'){
      o+='<p class="sg-note" style="margin:0 0 10px">普通機有 13 隻、特殊機有 6 隻（史詩以上）。碎片袋、扭蛋券夾到就直接放進扭蛋機。</p>';
      [['n','🧸 普通機的娃娃'],['s','💎 特殊機的娃娃']].forEach(function(s){
        var L=PZ.filter(function(x){ return x[1]===s[0]; }), n=L.filter(function(x){ return c.own[x[0]]; }).length;
        o+='<h4 class="sg-ser">'+s[1]+' '+n+'/'+L.length+(n===L.length?'<span>✓ 全部收齊</span>':'')+'</h4><div class="sg-grid">'+L.map(function(x){ return card(x,c.own[x[0]]||0); }).join('')+'</div>';
      });
      var exs=EX.filter(function(x){ return c.ex[x[0]]; });
      if(exs.length) o+='<p class="sg-note">夾到過：'+exs.map(function(x){ return x[3]+' '+esc(x[4])+' ×'+c.ex[x[0]]; }).join('、')+'</p>';
      o+='</div>';
    } else {
      o+='<div id="cw-gate"></div>'
        +'<div class="cw-stage"><canvas id="cw-cv" role="img" aria-label="夾娃娃機"></canvas><div class="cw-time" id="cw-time" aria-hidden="true"></div></div>'
        +'<div class="cw-ctl" role="group" aria-label="操控夾子">'
        +'<button type="button" data-clmv="-1" aria-label="往左（按住）">◀</button><button type="button" data-clmv="1" aria-label="往右（按住）">▶</button>'
        +'<button type="button" class="go" data-cldrop="1">夾！</button></div>'
        +'<div class="cw-coin" id="cw-coin"></div>'
        +'<p class="sg-note">按住 ◀ ▶ 移動爪子（鍵盤：左右鍵），對準了按「夾！」（空白鍵或下鍵）；15 秒沒按會自己下去。對得越準越容易夾起來；越稀有的越滑，夾起來在半路也可能掉下來，掉在出口就算你的。機器裡的東西每天換一次，今天夾走就少一個。'
        +(tab==='s'?'特殊機的獎品：史詩以上的娃娃（有神話）、大碎片袋 ✨30、扭蛋券 ×3、金扭蛋券（必出傳說以上）。':'普通機的獎品：13 種娃娃、碎片袋 ✨5、扭蛋券。')+'</p>'
        +'<div class="cw-line" id="cw-line" aria-label="今天機器裡有"></div></div>';
    }
    o+='<p class="fp-msg" id="cw-msg" aria-live="polite" style="margin:0;padding:0 18px 14px"></p>';
    app.innerHTML=o;
    cv=document.getElementById('cw-cv'); timeEl=document.getElementById('cw-time');
    if(cv){ ctx=cv.getContext('2d'); size(); }
    paintCtl(); draw();
  }
  // 按鈕、條件、今天的內容（不重畫整張卡片，玩到一半畫布不會被換掉）
  function paintCtl(){
    var m=document.getElementById('cw-msg'); if(m) m.textContent=msg;
    if(tab==='book') return;
    var g=gate(tab), ge=document.getElementById('cw-gate'), co=document.getElementById('cw-coin'), ln=document.getElementById('cw-line'), cost=MIX[tab].cost, pts=window.__pts?window.__pts():0;
    var M=machine(tab), left=M.it.length;
    if(ge) ge.innerHTML=gateHTML(tab,g);
    if(co) co.innerHTML=G?'<span class="sub" style="margin:0">'+(G.ph==='move'?'移動爪子，對準了按「夾！」':'夾子動作中…')+'</span>'
      :(left?'<button class="btn solid" type="button" data-clcoin="1"'+(!g.ok||pts<cost?' disabled':'')+'>投幣・'+cost+' 點</button>':'<span class="sub" style="margin:0">今天的都被你夾光了！明天會補新的。</span>')
       +'<span class="sub" style="margin:0">你有 '+pts.toLocaleString()+' 點</span>';
    if(ln) ln.innerHTML='今天機器裡（'+left+'）：'+M.it.map(function(p){ var x=item(p.id); return '<span>'+x[3]+' '+esc(x[4])+'</span>'; }).join('');
    var mv=app.querySelectorAll('[data-clmv],[data-cldrop]'); for(var i=0;i<mv.length;i++) mv[i].disabled=!(G&&G.ph==='move');
    if(cv) cv.setAttribute('aria-label','夾娃娃機（'+(tab==='s'?'特殊':'普通')+'）：裡面有 '+M.it.map(function(p){ return item(p.id)[4]; }).join('、')+'。爪子在'+(clawX<.25?'出口上面':clawX<.5?'左邊':clawX<.75?'中間':'右邊'));
    var tb=app.querySelectorAll('[data-cltab]'); for(var k=0;k<tb.length;k++) tb[k].disabled=!!G;
  }
  function size(){
    if(!cv) return; var w=cv.clientWidth||320; dpr=Math.min(3,window.devicePixelRatio||1);
    W=w; H=Math.round(w*.8); cv.width=Math.round(W*dpr); cv.height=Math.round(H*dpr); ctx.setTransform(dpr,0,0,dpr,0,0);
  }

  /* ---------- 畫 ---------- */
  var FONT='"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  function geo(){ var r=Math.max(16,W*.068); return {r:r, top:H*.13, floor:H*.88, chute:W*.24}; }
  function py(p,g){ return g.floor-g.r-(p.row?g.r*1.55:0); }
  function rr(x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }
  function prize(id,x,y,g,air){   // air：吊在爪子上、正在掉，不畫影子
    var it=item(id), r=g.r;
    ctx.save();
    if(!air){ ctx.fillStyle='rgba(0,0,0,.12)'; ctx.beginPath(); ctx.ellipse(x,y+r*.92,r*.8,r*.18,0,0,Math.PI*2); ctx.fill(); }
    if(it[2]==='UR'||it[2]==='SSR'){ ctx.fillStyle=it[2]==='UR'?'rgba(214,51,108,.22)':'rgba(242,194,48,.28)'; ctx.beginPath(); ctx.arc(x,y,r*1.05,0,Math.PI*2); ctx.fill(); }
    ctx.fillStyle='#000'; ctx.font=Math.round(r*1.6)+'px '+FONT; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(it[3],x,y+r*.08);   // 彩色 emoji 會吃 fillStyle 的透明度
    ctx.restore();
  }
  function draw(){
    if(!ctx || !W) return;
    var g=geo(), sp=tab==='s', M=machine(tab);
    ctx.clearRect(0,0,W,H);
    // 機台外框
    ctx.fillStyle=sp?'#6C3FB5':'#E0577A'; rr(0,0,W,H,14); ctx.fill();
    ctx.fillStyle=sp?'#F2C230':'#FFD2DE'; ctx.font='700 '+Math.round(H*.06)+'px system-ui,sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(sp?'★ SPECIAL ★':'CLAW MACHINE',W/2,H*.055);
    // 玻璃
    var gx=W*.03, gy=H*.1, gw=W*.94, gh=H*.87, grd=ctx.createLinearGradient(0,gy,0,gy+gh);
    grd.addColorStop(0,sp?'#F4ECFF':'#EAF6FF'); grd.addColorStop(1,sp?'#E1D2FA':'#CFE6F7'); ctx.fillStyle=grd; rr(gx,gy,gw,gh,10); ctx.fill();
    // 地板、出口
    ctx.fillStyle=sp?'#E9D9B0':'#F6E7C8'; ctx.fillRect(g.chute,g.floor,gx+gw-g.chute,gy+gh-g.floor);
    ctx.fillStyle='#3A2C2A'; ctx.fillRect(gx,g.floor-g.r*.2,g.chute-gx,gy+gh-g.floor+g.r*.2);
    ctx.fillStyle='rgba(255,255,255,.55)'; ctx.fillRect(g.chute-3,g.floor-g.r*1.1,6,g.r*1.1+2);   // 出口旁的擋板
    ctx.fillStyle='#fff'; ctx.font='700 '+Math.round(g.r*.62)+'px system-ui,sans-serif'; ctx.fillText('出口',(gx+g.chute)/2,g.floor+(gy+gh-g.floor)/2);
    // 軌道
    ctx.fillStyle='#8A8F98'; ctx.fillRect(gx+4,g.top-4,gw-8,5);
    // 娃娃（先畫下層）
    var held=G&&G.hold?G.hold:null, falling=G&&G.fall?G.fall.p:null;
    M.it.filter(function(p){ return !p.row && p!==held && p!==falling; }).forEach(function(p){ prize(p.id,p.x*W,py(p,g),g); });
    M.it.filter(function(p){ return p.row && p!==held && p!==falling; }).forEach(function(p){ prize(p.id,p.x*W,py(p,g),g); });
    // 掉下來中的
    if(G && G.fall) prize(G.fall.id,G.fall.x*W,G.fall.y,g,1);
    // 爪子
    var cx=clawX*W, cy=G?G.y:g.top+g.r*.9, op=G?G.open:1;
    ctx.strokeStyle='#5A5F66'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(cx,g.top); ctx.lineTo(cx,cy-g.r*.35); ctx.stroke();
    ctx.fillStyle='#5A5F66'; ctx.fillRect(cx-g.r*.45,g.top-7,g.r*.9,9);
    if(held) prize(held.id,cx,cy+g.r*.75,g,1);
    ctx.strokeStyle=sp?'#C99212':'#7A7F86'; ctx.lineWidth=Math.max(3,g.r*.16); ctx.lineCap='round';
    [-1,1].forEach(function(s){
      var a=(.25+.55*op)*s, l=g.r*1.15;
      ctx.beginPath(); ctx.moveTo(cx,cy-g.r*.15);
      var mx=cx+Math.sin(a)*l*.55, my=cy+Math.cos(a)*l*.5; ctx.lineTo(mx,my);
      ctx.lineTo(mx-s*g.r*(.3+.25*(1-op)), my+l*.55); ctx.stroke();
    });
    ctx.fillStyle=sp?'#F2C230':'#B8BDC4'; ctx.beginPath(); ctx.arc(cx,cy-g.r*.2,g.r*.32,0,Math.PI*2); ctx.fill();
  }

  /* ---------- 一局 ---------- */
  var raf=0, last=0, MOVE_T=15;
  function toast(s){ msg=s; var m=document.getElementById('cw-msg'); if(m) m.textContent=s; }
  function coin(){
    if(G) return;
    var g=gate(tab), cost=MIX[tab].cost, M=machine(tab);
    if(!g.ok){ toast(g.lock||'還沒開放，看上面還差什麼。'); return paintCtl(); }
    if(!M.it.length) return;
    var pts=window.__pts?window.__pts():0; if(pts<cost){ toast('點數不夠：要 '+cost+' 點，現在 '+pts+' 點。'); return paintCtl(); }
    var c=st(); c.n++; c.spent+=cost;
    window.__award(-cost,'夾娃娃機（'+(tab==='s'?'特殊':'普通')+'）',true);   // 存檔（cl 一起存）、寫兌換紀錄
    var gg=geo(); clawX=HOME;
    G={t:tab, ph:'move', y:gg.top+gg.r*.9, open:1, dir:0, tl:MOVE_T, hold:null, fall:null};
    toast('投幣成功！移動爪子，對準了按「夾！」。');
    paintCtl(); loop();
    var b=app.querySelector('[data-clmv="1"]'); if(b) try{ b.focus({preventScroll:true}); }catch(e){}
  }
  function drop(){ if(!G || G.ph!=='move') return; G.dir=0; G.ph='down'; setHeld(null); paintCtl(); }
  function target(){
    var g=geo(), M=machine(G.t), cand=M.it.filter(function(p){ return Math.abs(p.x-clawX)*W<g.r*1.15; });
    if(!cand.length) return null;
    cand.sort(function(a,b){ return (b.row-a.row) || (Math.abs(a.x-clawX)-Math.abs(b.x-clawX)); });   // 上層的先碰到
    return cand[0];
  }
  function land(p){   // 掉下來的娃娃找位置：壓在下層某隻上面就是上層
    var g=geo(), M=machine(G.t), others=M.it.filter(function(q){ return q!==p; });
    p.x=Math.max(.3,Math.min(.94,p.x));
    var under=others.some(function(q){ return !q.row && Math.abs(q.x-p.x)*W<g.r*1.5; }), onTop=others.some(function(q){ return q.row && Math.abs(q.x-p.x)*W<g.r*1.6; });
    if(under && onTop) p.x=Math.max(.3,Math.min(.94,p.x+(Math.random()<.5?-1:1)*.08));
    p.row=others.some(function(q){ return !q.row && Math.abs(q.x-p.x)*W<g.r*1.5; })?1:0;
  }
  function win(p){
    var c=st(), M=machine(G.t), x=item(p.id), i=M.it.indexOf(p); if(i>=0) M.it.splice(i,1);
    c.win++;
    if(x.length>6){ c.ex[x[0]]=(c.ex[x[0]]||0)+1; var gv=x[6]; if(gv[0]==='sh') API.giveSh(gv[1]); else API.giveTk(gv[0],gv[1]); }
    else { var nw=!c.own[x[0]]; c.own[x[0]]=(c.own[x[0]]||0)+1; if(nw && window.__fx && window.__fx.unlock && (x[2]==='SSR'||x[2]==='UR')) window.__fx.unlock(null,'娃娃「'+x[4]+'」'); }
    API.save();
    if(window.__fx && window.__fx.banner && (x[2]==='UR'||x[2]==='SSR')) window.__fx.banner((x[2]==='UR'?'🌌 神話！':'✨ 傳說！')+x[3]+' '+x[4]);
    return x;
  }
  function setHeld(){ var a=app.querySelectorAll('.held'); for(var i=0;i<a.length;i++) a[i].classList.remove('held'); }
  function step(dt){
    var g=geo(), sp=H*.75;   // 上下的速度（每秒）
    if(G.ph==='move'){
      clawX=Math.max(.1,Math.min(.94,clawX+G.dir*.3*dt)); G.tl-=dt;
      var s=Math.ceil(Math.max(0,G.tl)); if(timeEl && timeEl.textContent!==s+' 秒') timeEl.textContent=s+' 秒';
      if(G.tl<=0){ toast('時間到，爪子自己下去了。'); drop(); }
    } else if(G.ph==='down'){
      if(timeEl) timeEl.textContent='';
      if(G.stopY==null){ var t=target(); G.tgt=t; G.stopY=t?py(t,g)-g.r*.75:g.floor-g.r*.55; }
      G.y=Math.min(G.stopY,G.y+sp*dt); if(G.y>=G.stopY){ G.ph='close'; G.tc=0; }
    } else if(G.ph==='close'){
      G.tc+=dt; G.open=Math.max(0,1-G.tc/.45);
      if(G.tc>=.55){
        var p=G.tgt; G.ph='up';
        if(p){ var r=geo().r, d=Math.min(1,Math.abs(p.x-clawX)*W/(r*1.15)), gr=RAR[item(p.id)[2]].g, ch=gr*(1-.75*d*d);
          if(Math.random()<ch){ G.hold=p; p.x=clawX; G.slip=Math.random()<(1-gr)*.5*(1+d)?{ph:Math.random()<.35?'up':'back', at:.2+Math.random()*.75}:null; }   // slip：會不會在半路滑掉、在上升還是回程的哪裡
          else { p.x=Math.max(.3,Math.min(.94,p.x+(clawX<p.x?1:-1)*(.01+Math.random()*.03))); G.miss=d>.6?'只碰到邊邊，沒夾起來。':'夾到了，可是滑掉了！'; }
        } else G.miss='夾到空氣……要對準娃娃的正上方。';
      }
    } else if(G.ph==='up'){
      if(G.y0==null) G.y0=G.y;
      G.y=Math.max(g.top+g.r*.9,G.y-sp*.8*dt);
      if(G.hold && G.slip && G.slip.ph==='up' && (G.y0-G.y)/Math.max(1,G.y0-(g.top+g.r*.9))>=G.slip.at) return slip();
      if(G.y<=g.top+g.r*.9) G.ph='back';
    } else if(G.ph==='back'){
      if(G.x0==null) G.x0=clawX;
      var dx=HOME-clawX, v=.35*dt; clawX+=Math.abs(dx)<v?dx:(dx>0?v:-v);
      if(G.hold){ G.hold.x=clawX; if(G.slip && G.slip.ph==='back' && (G.x0-clawX)/Math.max(.001,G.x0-HOME)>=G.slip.at) return slip(); }
      if(Math.abs(HOME-clawX)<.001){ G.ph='open'; G.tc=0; }
    } else if(G.ph==='open'){
      G.tc+=dt; G.open=Math.min(1,G.tc/.35);
      if(G.hold && G.tc>.2){ G.fall={id:G.hold.id, x:clawX, y:G.y+g.r*.75, v:0, chute:true, p:G.hold}; G.hold=null; }
      if(G.fall){ fallStep(dt,g); return; }
      if(G.tc>.5) end();
    } else if(G.ph==='fall'){ fallStep(dt,g); }
  }
  function slip(){ var g=geo(), p=G.hold; G.hold=null; G.fall={id:p.id, x:clawX, y:G.y+g.r*.75, v:0, chute:clawX<.24, p:p}; G.after=G.ph; G.ph='fall'; G.slipped=1; }
  function fallStep(dt,g){
    var f=G.fall; f.v+=H*2.6*dt; f.y+=f.v*dt;
    var stopY=f.chute?g.floor+g.r*.6:(function(){ var M=machine(G.t), others=M.it.filter(function(o){ return o!==f.p; }), on=others.some(function(o){ return !o.row && Math.abs(o.x-f.x)*W<g.r*1.5; }); return g.floor-g.r-(on?g.r*1.55:0); })();
    if(f.y<stopY) return;
    G.fall=null;
    if(f.chute){
      var x=win(f.p); G.won=1;
      toast((G.slipped?'差點掉了……結果剛好掉進出口！':'夾到了！')+x[3]+' '+x[4]+'（'+RAR[x[2]].n+'）'+(x.length>6?'：'+x[5]:'')+'。');
      if(G.ph==='fall') G.ph='back'; else end();
    } else {
      f.p.x=f.x; land(f.p); API.save();
      toast('半路滑掉了！'+item(f.p.id)[3]+' 掉回機器裡，位置變了。');
      G.ph=G.after==='up'?'up':'back'; G.lost=1;
    }
  }
  function end(){
    if(!G.won && !G.lost) toast(G.miss||'沒夾到。');
    API.save(); G=null; if(timeEl) timeEl.textContent='';
    cancelAnimationFrame(raf); raf=0; clawX=HOME;
    try{ document.dispatchEvent(new CustomEvent('plan:gc')); }catch(e){}
    paintCtl(); draw();
  }
  function loop(){
    cancelAnimationFrame(raf); last=performance.now();
    var f=function(now){ if(!G){ raf=0; return; } var dt=Math.min(.05,(now-last)/1000); last=now;
      var was=G.ph; step(dt); if(G){ if(G.ph!==was && (was==='move'||G.ph==='move')) paintCtl(); draw(); raf=requestAnimationFrame(f); } };
    raf=requestAnimationFrame(f);
  }

  /* ---------- 操作 ---------- */
  app.addEventListener('click',function(e){
    var b=e.target.closest('button'); if(!b || b.disabled) return;
    if(b.dataset.cltab){ if(G) return; tab=b.dataset.cltab; msg=''; return shell(); }
    if(b.dataset.clcoin) return coin();
    if(b.dataset.cldrop) return drop();
  });
  function hold(b,on){ if(!G || G.ph!=='move'){ G&&(G.dir=0); return; } G.dir=on?+b.dataset.clmv:0; b.classList.toggle('held',!!on); }
  app.addEventListener('pointerdown',function(e){ var b=e.target.closest('[data-clmv]'); if(!b || b.disabled) return; e.preventDefault(); try{ b.setPointerCapture(e.pointerId); }catch(x){} hold(b,true); });
  ['pointerup','pointercancel','lostpointercapture'].forEach(function(t){ app.addEventListener(t,function(e){ var b=e.target.closest&&e.target.closest('[data-clmv]'); if(b) hold(b,false); }); });
  app.addEventListener('contextmenu',function(e){ if(e.target.closest('.cw-ctl')) e.preventDefault(); });
  document.addEventListener('keydown',function(e){
    if(!G || G.ph!=='move' || !onTab()) return;
    if(e.key==='ArrowLeft'||e.key==='ArrowRight'){ e.preventDefault(); G.dir=e.key==='ArrowLeft'?-1:1; }
    else if(e.key==='ArrowDown'||(e.key===' '&&!(e.target.closest&&e.target.closest('button:not([data-clmv])')))){ e.preventDefault(); drop(); }
  });
  document.addEventListener('keyup',function(e){ if(G && (e.key==='ArrowLeft'||e.key==='ArrowRight')) G.dir=0; });
  var ro=window.ResizeObserver?new ResizeObserver(function(){ if(cv){ size(); draw(); } }):null;
  if(ro) ro.observe(app);
  document.addEventListener('plan:points',function(){ if(onTab() && !G) paintCtl(); });
  document.addEventListener('plan:checks',function(){ if(onTab() && !G) paintCtl(); });

  function show(){ if(!onTab()) return; if(G) return; injectCss(); if(!app.firstChild || !document.getElementById('cw-msg')) shell(); else { paintCtl(); size(); draw(); } }
  window.__claw={show:show, _test:{gate:gate, machine:machine, weekAvg:weekAvg, st:st, item:item, coin:coin, drop:drop, game:function(){ return G; }, setX:function(x){ clawX=x; },
    tick:function(dt){ if(G){ var was=G.ph; step(dt); if(G){ if(G.ph!==was) paintCtl(); draw(); } } }}};   // 測試用：畫面藏起來時 requestAnimationFrame 不會跑
  document.addEventListener('plan:tab',function(){ if(onTab()) U.later(show); });
  injectCss(); show();
})();
