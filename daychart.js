/* 每天的讀書長條圖（2026-11-07）：讀書網站「紀錄 → 進度回測」和家長版共用。
   DayChart.mount(元素, {get: 回傳資料的函式, plan: window.PLAN})
   資料＝跟雲端備份同一種格式：{ 'plan.hist.v1': 字串或物件, 'plan.state.v3': …, … }
   長條可以切「讀書時間／完成率」，‹ › 看更早的日子，點一根長條看那天：完成率、各科、完成和沒完成的任務、
   番茄鐘、給 Claude 檢查的作業、那天的點數（含家長加的）。
   11-17 加 DayChart.subj：各科讀書時間（番茄鐘／表定、長條圖／圓餅圖、統計數字、數字表），在檔案後半段。 */
(function(){
  if(window.DayChart) return;
  var CATN={chi:'國文',math:'數學',eng:'英文',sci:'自然',soc:'社會',kb:'科班考古題',kbfix:'科班訂正',kbr:'科班複習',
    hw:'補習作業',mock:'模考／訂正',term:'段考',fu:'複試',other:'其他',fixed:'上課',life:'生活',rest:'休息'};
  var POMO_SUBJ={chi:'國文',math:'數學',eng:'英文',sci:'自然',soc:'社會',kbm:'科班資優數學',kbs:'科班自然學科'};
  var CHECK_RE=/(訂正|限時作答|模考卷|歷屆會考|限時重做|整份限時|錯題重做|雄中考古題)/;
  var WD='日一二三四五六', DAYS=14, CHECK_DAYS=3, LATE_PEN=5;

  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function J(o,k,d){ try{ var v=o[k]; if(v==null) return d; var x=typeof v==='string'?JSON.parse(v):v; return x==null?d:x; }catch(e){ return d; } }
  function d0(){ var d=new Date(); d.setHours(0,0,0,0); return d; }
  function key(d){ return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate(); }
  function pk(k){ var p=String(k).split('-'); return new Date(+p[0],+p[1]-1,+p[2]); }
  function md(k){ var p=String(k).split('-'); return (+p[1])+'/'+(+p[2]); }
  function addD(d,n){ var x=new Date(d); x.setDate(x.getDate()+n); return x; }
  function days(a,b){ return Math.round((b-a)/864e5); }
  function lsGet(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
  function lsSet(k,v){ try{ localStorage.setItem(k,v); }catch(e){} }

  var CSS='.dc-head{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:6px}'
    +'.dc-seg{display:inline-flex;border:1px solid var(--rule,#D6E0E8);border-radius:999px;overflow:hidden}'
    +'.dc-seg button{font:inherit;font-size:12.5px;border:0;background:none;color:var(--ink-soft,#4E5B67);padding:4px 12px;cursor:pointer}'
    +'.dc-seg button[aria-pressed="true"]{background:var(--dc-acc,var(--sky,#1C7EBB));color:#fff}'
    +'.dc-nav{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;color:var(--ink-faint,#6B7782)}'
    +'.dc-nav button{font:inherit;border:1px solid var(--rule,#D6E0E8);background:var(--card,#fff);color:var(--ink,#131C26);border-radius:999px;width:30px;height:28px;cursor:pointer;padding:0}'
    +'.dc-nav button:disabled{opacity:.35;cursor:default}'
    +'.dc-chart{display:flex;align-items:flex-end;gap:4px;height:140px;padding-top:18px;padding-right:44px;border-bottom:1px solid var(--rule,#D6E0E8);position:relative}'
    +'.dc-gl{position:absolute;left:0;right:0;border-top:1px dashed var(--rule,#D6E0E8);font-size:10.5px;color:var(--ink-faint,#6B7782);font-family:"IBM Plex Mono",monospace}'
    +'.dc-gl span{position:absolute;right:0;top:-9px;background:var(--card,#fff);padding-left:4px;line-height:1.5}'
    +'.dc-bar{flex:1;min-width:0;height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:stretch;background:none;border:0;padding:0;position:relative;z-index:1;cursor:pointer}'
    +'.dc-bar i{display:block;width:100%;border-radius:4px 4px 0 0;background:var(--dc-bar,var(--bar,#3A9AD9));min-height:3px}'
    +'.dc-bar.zero i{background:var(--dc-empty,var(--bar-empty,#DCE6EE))}'
    +'.dc-bar.easy i{background:repeating-linear-gradient(135deg,var(--dc-bar,var(--bar,#3A9AD9)) 0 3px,transparent 3px 6px);border:1px solid var(--dc-bar,var(--bar,#3A9AD9));border-bottom:0}'
    +'.dc-bar.sel i{outline:2px solid var(--ink,#131C26);outline-offset:1px}'
    +'.dc-bar:focus-visible{outline:2px solid var(--dc-acc,var(--sky,#1C7EBB));outline-offset:2px}'
    +'.dc-x{display:flex;gap:4px;margin-top:4px;padding-right:44px}'
    +'.dc-x span{flex:1;min-width:0;text-align:center;font-size:10.5px;color:var(--ink-faint,#6B7782);font-family:"IBM Plex Mono",monospace;white-space:nowrap;overflow:hidden}'
    +'.dc-x span.wk{color:var(--ink,#131C26);font-weight:600}'
    +'.dc-cap{font-size:11.5px;color:var(--ink-faint,#6B7782);text-align:right;padding-right:44px;margin:2px 0 0}'
    +'.dc-det{margin-top:10px;border-top:1px solid var(--rule,#D6E0E8);padding-top:10px;font-size:13.5px}'
    +'.dc-det h4{margin:0 0 6px;font-size:15px}'
    +'.dc-kpi{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin:6px 0 8px}'
    +'.dc-kpi div{background:var(--paper,#EEF5FA);border-radius:10px;padding:7px 8px;min-width:0}'
    +'.dc-kpi b{display:block;font-family:"IBM Plex Mono",monospace;font-size:19px;line-height:1.25;color:var(--ink,#131C26)}'
    +'.dc-kpi small{font-size:11.5px;color:var(--ink-faint,#6B7782)}'
    +'.dc-prog{height:8px;border-radius:99px;background:var(--dc-empty,var(--bar-empty,#DCE6EE));overflow:hidden;margin:2px 0 8px}'
    +'.dc-prog i{display:block;height:100%;background:var(--dc-bar,var(--bar,#3A9AD9));border-radius:99px}'
    +'.dc-sub{font-size:12.5px;color:var(--ink-faint,#6B7782);margin:10px 0 3px;font-weight:600}'
    +'.dc-cats{display:flex;flex-wrap:wrap;gap:4px 6px}'
    +'.dc-cats span{font-size:12px;border:1px solid var(--rule,#D6E0E8);border-radius:999px;padding:1px 8px;color:var(--ink-soft,#4E5B67)}'
    +'.dc-cats span b{font-family:"IBM Plex Mono",monospace;font-weight:600;color:var(--ink,#131C26)}'
    +'.dc-ul{list-style:none;margin:0;padding:0}'
    +'.dc-ul li{display:grid;grid-template-columns:20px minmax(0,1fr);gap:0 4px;padding:3px 0;font-size:13px;overflow-wrap:anywhere}'
    +'.dc-ul li.no{color:var(--ink-soft,#4E5B67)}'
    +'.dc-ul li small{display:block;font-size:11.5px;color:var(--ink-faint,#6B7782)}'
    +'.dc-ok{color:var(--ok,var(--cap,#0D7F63))} .dc-bad{color:var(--bad,var(--rest,#B83227))} .dc-wait{color:var(--dc-acc,var(--sky,#1C7EBB))}'
    +'.dc-sum{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px 12px;font-size:13px;margin-top:10px}'
    +'.dc-sum b{font-family:"IBM Plex Mono",monospace}'
    +'.dc-note{font-size:12px;color:var(--ink-faint,#6B7782);margin:4px 0 0}';
  function injectCss(){ if(document.getElementById('dc-css')) return; var s=document.createElement('style'); s.id='dc-css'; s.textContent=CSS; document.head.appendChild(s); }

  // ---- 把資料整理成「每一天」 ----
  function parse(o){
    return {st:J(o,'plan.state.v3',{}), hist:J(o,'plan.hist.v1',{}), pomo:J(o,'plan.pomo.v1',{}), C:J(o,'plan.checks.v1',{}),
      shop:J(o,'plan.shop.v1',{}), vrev:J(o,'plan.vrev.v1',{}), easy:J(o,'plan.easy.v1',{}), par:J(o,'plan.parent.v1',{})};
  }
  function dayInfo(P,k,today,PL){
    var tk=key(today), e=P.hist[k], st=P.st, x={k:k, d:pk(k), has:false, a:0, dn:0, m:0, done:[], undone:[], guess:false, cats:[], fixA:0, fixD:0, easy:!!(P.easy&&P.easy[k])};
    if(k===tk && st.day===tk){
      var list=(st.list||[]).filter(function(t){ return !t.pre; }), done=st.done||{}, cat={};
      list.forEach(function(t){
        if(t.f){ x.fixA++; if(done[t.id]) x.fixD++; return; }
        var c=t.c||'other', o=cat[c]=cat[c]||{a:0,d:0,m:0}; o.a++;
        if(done[t.id]){ o.d++; o.m+=(+t.m||0); x.done.push({n:t.n, bk:!!t.bk}); } else x.undone.push({n:t.n, bk:!!t.bk});
      });
      x.has=list.length>0; x.a=x.done.length+x.undone.length; x.dn=x.done.length;
      x.m=Object.keys(cat).reduce(function(s,c){ return s+cat[c].m; },0)+Math.round((+(P.vrev||{})[k]||0)/60);
      x.cats=Object.keys(cat).map(function(c){ return {c:c, a:cat[c].a, d:cat[c].d, m:cat[c].m}; });
    } else if(e){
      x.has=true;
      if(e.cat){ Object.keys(e.cat).forEach(function(c){ var o=e.cat[c]; x.a+=o.a||0; x.dn+=o.d||0; x.cats.push({c:c, a:o.a||0, d:o.d||0, m:o.m||0}); }); x.fixA=Math.max(0,(e.a||0)-x.a); x.fixD=Math.max(0,(e.d||0)-x.dn); }
      else { x.a=e.a||0; x.dn=e.d||0; }
      x.m=(+e.m||0)+Math.round((+(P.vrev||{})[k]||0)/60);
      x.done=(e.dn||[]).map(function(n){ return {n:n}; });
      if(Array.isArray(e.un)) x.undone=e.un.map(function(n){ return {n:n}; });
      else if(x.a>x.dn && PL && PL.days && PL.days[k]){   // 舊紀錄沒存「沒完成的」：照原本的排程推算
        var dn={}; (e.dn||[]).forEach(function(n){ dn[n]=1; });
        x.undone=(PL.days[k].b||[]).filter(function(b){ return b[5]===0 && !dn[b[3]]; }).map(function(b){ return {n:b[3]}; });
        if(x.undone.length>x.a-x.dn) x.undone=x.undone.slice(0,Math.max(0,x.a-x.dn));
        x.guess=true;
      }
    }
    x.pct=x.a?Math.round(x.dn/x.a*100):null;
    var plog=Array.isArray(P.pomo.log)?P.pomo.log:[];
    x.pomo=plog.filter(function(p){ return p&&p.k===k; });
    x.pomoM=x.pomo.reduce(function(s,p){ return s+(+p.m||25); },0);
    // 讀書時間（11-07 使用者定）：那天有番茄鐘就算番茄鐘的分鐘；沒有番茄鐘才算完成任務的表定分鐘
    x.taskM=x.m; x.src=x.pomoM>0?'pomo':'task'; x.m=x.pomoM>0?x.pomoM:x.taskM;
    if(!x.has && x.pomo.length) x.has=true;
    var items=(P.C&&P.C.items)||{};
    x.checks=Object.keys(items).map(function(i){ return items[i]; }).filter(function(it){ return it&&it.k===k; });
    // 那天的點數（點數紀錄只留最近 200 筆，太舊的看不到）
    var log=Array.isArray(P.shop.log)?P.shop.log:[], t0=x.d.getTime(), t1=addD(x.d,1).getTime();
    var oldest=log.length?log[log.length-1].t:Infinity;
    x.ptsKnown=log.length>0 && (log.length<200 || oldest<=t0);
    x.plus=0; x.minus=0;
    log.forEach(function(l){ if(!l||l.t<t0||l.t>=t1) return; var n=parseInt(String(l.n).replace(/[^\d]/g,''),10)||0; if(/^－|^-/.test(String(l.n))) x.minus+=n; else x.plus+=n; });
    var plg=(P.par&&Array.isArray(P.par.log))?P.par.log:[];
    x.parent=plg.filter(function(l){ return l&&l.day===k; });
    return x;
  }

  function mount(el, opts){
    injectCss();
    opts=opts||{};
    var state={mode:(lsGet('dc.mode')==='p'?'p':'m'), off:0, sel:null};
    function PL(){ return opts.plan||window.PLAN||null; }
    function render(){
      var o={}; try{ o=opts.get()||{}; }catch(e){}
      var P=parse(o), today=d0(), end=addD(today,-state.off), D=[];
      for(var i=DAYS-1;i>=0;i--) D.push(dayInfo(P,key(addD(end,-i)),today,PL()));
      if(state.sel==null || state.sel>=DAYS) state.sel=DAYS-1;
      var isM=state.mode==='m';
      var mx=isM?Math.max(60,Math.max.apply(null,D.map(function(x){ return x.m; }))):100;
      var step=isM?(mx>360?120:(mx>180?60:30)):25, top=isM?Math.ceil(mx/step)*step:100, H=121;   // 圖高 140－上方留白 18－底線 1
      var grid='';
      for(var g=step; g<=top; g+=step) grid+='<div class="dc-gl" style="bottom:'+(g/top*H).toFixed(1)+'px"><span>'+g+(isM?' 分':'%')+'</span></div>';
      var html='<div class="dc-head"><div class="dc-seg" role="group" aria-label="長條顯示">'
        +'<button type="button" data-m="m" aria-pressed="'+isM+'">讀書時間</button><button type="button" data-m="p" aria-pressed="'+(!isM)+'">完成率</button></div>'
        +'<div class="dc-nav"><button type="button" data-nav="1" aria-label="往前 7 天">‹</button><span>'+md(D[0].k)+'～'+(state.off?md(D[DAYS-1].k):'今天')+'</span><button type="button" data-nav="-1" aria-label="往後 7 天"'+(state.off?'':' disabled')+'>›</button></div></div>';
      html+='<div class="dc-chart">'+grid+D.map(function(x,j){
        var v=isM?x.m:(x.pct||0), h=v?Math.max(3,v/top*100):3;
        var lab=md(x.k)+' '+(x.has?(isM?x.m+' 分鐘':(x.pct==null?'沒有任務':x.pct+'%')):'沒有紀錄');
        return '<button type="button" class="dc-bar'+(v?'':' zero')+(x.easy?' easy':'')+(j===state.sel?' sel':'')+'" data-j="'+j+'" aria-label="'+esc(lab)+'" title="'+esc(lab)+'"><i style="height:'+h.toFixed(1)+'%"></i></button>'; }).join('')+'</div>';
      html+='<div class="dc-x">'+D.map(function(x,j){ var lab=(state.off===0&&j===DAYS-1)?'今':String(x.d.getDate()); return '<span'+(x.d.getDay()===1?' class="wk"':'')+'>'+lab+'</span>'; }).join('')+'</div>';
      html+='<p class="dc-cap">'+(isM?'讀書分鐘：有番茄鐘看番茄鐘，沒有才看完成任務的表定時間':'讀書任務完成的比例（上學、補習不算）；斜線是降級／休息日')+'・粗體是週一・點長條看那天</p>';
      // opts.compact（11-10，孩子的網站用）：那天的細節先收起來，點長條才展開；家長頁沒帶這個，照舊直接顯示
      html+='<div class="dc-det" id="'+(el.id||'dc')+'-det" aria-live="polite"'+(opts.compact&&!state.picked?' hidden':'')+'>'+detail(D[state.sel])+'</div>'
        +(opts.compact&&!state.picked?'<p class="dc-cap" style="margin-top:6px">點長條看那天做了什麼。</p>':'');
      var W=D.slice(DAYS-7), wm=W.reduce(function(a,x){ return a+x.m; },0), wa=W.reduce(function(a,x){ return a+x.a; },0), wd=W.reduce(function(a,x){ return a+x.dn; },0),
          wp=W.reduce(function(a,x){ return a+x.pomo.length; },0), wgood=W.filter(function(x){ return x.m>=60; }).length, wnone=W.filter(function(x){ return !x.has; }).length;
      html+='<div class="dc-sum"><span>'+(state.off?'這段的後 7 天':'最近 7 天')+'讀書　<b>'+(wm/60).toFixed(1)+'</b> 小時</span><span>任務完成率　<b>'+(wa?Math.round(wd/wa*100):0)+'%</b></span>'
        +'<span>讀滿 1 小時　<b>'+wgood+'</b>／7 天</span><span>番茄鐘　<b>'+wp+'</b> 顆</span>'
        +(wnone?'<span style="grid-column:1/-1;color:var(--warn,#A65A0C)">有 '+wnone+' 天沒有紀錄（那天沒打開網站）</span>':'')+'</div>';
      el.innerHTML=html;
      el.querySelectorAll('.dc-bar').forEach(function(b){ b.addEventListener('click',function(){
        state.sel=+b.getAttribute('data-j'); state.picked=true;
        el.querySelectorAll('.dc-bar').forEach(function(z){ z.classList.toggle('sel',z===b); });
        var dt=el.querySelector('.dc-det'); dt.innerHTML=detail(D[state.sel]); dt.hidden=false;
      }); });
      el.querySelectorAll('[data-m]').forEach(function(b){ b.addEventListener('click',function(){ state.mode=b.getAttribute('data-m'); lsSet('dc.mode',state.mode); render(); }); });
      el.querySelectorAll('[data-nav]').forEach(function(b){ b.addEventListener('click',function(){ state.off=Math.max(0,state.off+7*(+b.getAttribute('data-nav'))); state.sel=DAYS-1; render(); }); });
    }
    function detail(x){
      if(!x) return '';
      var today=d0(), h='<h4>'+md(x.k)+'（週'+WD[x.d.getDay()]+'）'+(x.easy?'<span class="dc-wait" style="font-size:12.5px;font-weight:400">　降級／休息日</span>':'')+'</h4>';
      if(!x.has && !x.pomo.length) return h+'<p class="dc-note">這天沒有紀錄：沒有打開讀書網站，或那天沒有排任務。</p>'+extra(x,today);
      h+='<div class="dc-kpi"><div><b>'+(x.pct==null?'—':x.pct+'%')+'</b><small>完成 '+x.dn+'／'+x.a+' 項</small></div>'
        +'<div><b>'+x.m+'</b><small>讀書分鐘（'+(x.src==='pomo'?'番茄鐘':'表定')+'）</small></div>'
        +'<div><b>'+x.pomo.length+'</b><small>番茄鐘（'+x.pomoM+' 分）</small></div></div>';
      if(x.a) h+='<div class="dc-prog" role="img" aria-label="完成 '+x.pct+'%"><i style="width:'+x.pct+'%"></i></div>';
      h+='<p class="dc-note" style="margin-top:0">'+(x.src==='pomo'?'讀書時間照番茄鐘算'+(x.taskM?'（完成任務的表定時間是 '+x.taskM+' 分）':''):'這天沒有番茄鐘，讀書時間照完成任務的表定分鐘算')+'。</p>';
      if(x.fixA) h+='<p class="dc-note" style="margin-top:0">上學、上課、補習：'+x.fixD+'／'+x.fixA+' 有打勾</p>';
      if(x.cats.length){
        h+='<div class="dc-sub">各科</div><div class="dc-cats">'+x.cats.sort(function(a,b){ return b.a-a.a; }).map(function(c){
          return '<span>'+esc(CATN[c.c]||c.c)+' <b>'+c.d+'/'+c.a+'</b>'+(c.m?'・'+c.m+' 分':'')+'</span>'; }).join('')+'</div>';
      }
      if(x.done.length) h+='<div class="dc-sub">✅ 完成（'+x.done.length+'）</div><ul class="dc-ul">'+x.done.map(function(t){
        return '<li><span class="dc-ok">✓</span><span>'+esc(t.n)+(t.bk?'<small>補前一天的欠帳</small>':'')+'</span></li>'; }).join('')+'</ul>';
      if(x.undone.length) h+='<div class="dc-sub">⬜ 沒完成（'+x.undone.length+'）'+(x.guess?'<span style="font-weight:400">・依原本排程推算</span>':'')+'</div><ul class="dc-ul">'+x.undone.map(function(t){
        return '<li class="no"><span>○</span><span>'+esc(t.n)+(t.bk?'<small>欠帳</small>':'')+'</span></li>'; }).join('')+'</ul>';
      else if(x.a>x.dn) h+='<p class="dc-note">還有 '+(x.a-x.dn)+' 項沒完成（這天的紀錄沒有存名稱）。</p>';
      if(x.pomo.length){
        var by={}; x.pomo.forEach(function(p){ var s=POMO_SUBJ[p.s]||'沒選科目'; by[s]=(by[s]||0)+(+p.m||25); });
        h+='<div class="dc-sub">🍅 番茄鐘</div><div class="dc-cats">'+Object.keys(by).map(function(s){ return '<span>'+esc(s)+' <b>'+by[s]+'</b> 分</span>'; }).join('')+'</div>';
      }
      return h+extra(x,today);
    }
    function extra(x,today){
      var h='';
      if(x.checks.length){
        h+='<div class="dc-sub">🔍 給 Claude 檢查</div><ul class="dc-ul">'+x.checks.map(function(it){
          var s, cls;
          if(it.st==='pass'){ cls='dc-ok'; s='過關（'+esc(it.g||'')+'）'+(it.pt?'・逾期被扣 '+it.pt+' 點':''); }
          else if(it.ls){ var n=Math.max(0,days(pk(it.ls),today)+1); cls='dc-bad'; s=(it.st==='dead'?'樹苗已枯，':'')+'逾期第 '+n+' 天・已扣 '+(it.pt||0)+' 點'; }
          else { var left=CHECK_DAYS-days(pk(it.k),today); cls=left>=0?'dc-wait':'dc-bad'; s=left>0?'等檢查，還有 '+left+' 天':(left===0?'等檢查，今天最後一天':'已經超過期限'); }
          return '<li><span class="'+cls+'">●</span><span>'+esc(it.n)+'<small class="'+cls+'">'+s+'</small></span></li>'; }).join('')+'</ul>';
      }
      var par=x.parent.filter(function(l){ return l.kind==='pts' && l.n>0; }).reduce(function(a,l){ return a+l.n; },0);
      if(x.plus||x.minus||par){
        h+='<div class="dc-sub">⭐ 點數</div><p class="dc-note" style="margin:0">得到 <b class="dc-ok">+'+x.plus+'</b>　扣掉 <b class="dc-bad">−'+x.minus+'</b>'+(par?'　其中家長加 <b class="dc-ok">+'+par+'</b>':'')+'</p>';
      } else if(!x.ptsKnown && x.has) h+='<p class="dc-note">點數紀錄只留最近 200 筆，這天的看不到了。</p>';
      var msgs=x.parent.filter(function(l){ return l.kind==='msg'; });
      if(msgs.length) h+='<div class="dc-sub">📣 家長留言</div><ul class="dc-ul">'+msgs.map(function(l){ return '<li><span>💬</span><span>'+esc(l.who||'家長')+'：'+esc(l.text||'')+'</span></li>'; }).join('')+'</ul>';
      return h;
    }
    render();
    return {refresh:render};
  }

  /* ===== 各科讀書時間（2026-11-17）：「紀錄 → 進度」和家長頁共用 =====
     DayChart.subj(元素, {get: 跟 mount 一樣的資料函式, media: true＝深色跟著系統設定（家長頁）})
     兩種資料可以切：
       番茄鐘＝plan.pomo.v1.log 每一顆開始前選的科目和分鐘；
       表定＝勾掉的讀書任務照表定分鐘（plan.hist.v1[日].cat；手機上目前那一天照 plan.state.v3 的清單算，跟 dayInfo 一樣）。
     科目合成 7 組＋其他：番茄鐘的「科班資優數學、自然學科」和表定的「科班考古題、訂正、複習、補習作業、複試」都算科班，
     模考、段考算一組；細項放在數字表和提示裡。
     顏色跟著科目走（換資料、換期間都不變）：dataviz 預設類別色的前 7 色，亮、暗兩組各自用 validate_palette.js 驗過
     （卡片底色 #FFFFFF／#16212C）。長條圖只用一種顏色（科目名稱寫在旁邊）；圓餅圖相鄰兩塊如果是驗證時分不清楚的兩色，
     會自動換一個排法（ringOrder），每一塊也印百分比、旁邊有圖例和數字表，不只靠顏色。 */
  var SG=['math','chi','sci','soc','eng','mt','kb','oth'];   // 顏色順序，也是圓餅圖預設的排法
  var SGN={math:'數學',chi:'國文',sci:'自然',soc:'社會',eng:'英文',mt:'模考／段考',kb:'科班',oth:'其他'};
  var PG={chi:'chi',math:'math',eng:'eng',sci:'sci',soc:'soc',kbm:'kb',kbs:'kb'};   // 番茄鐘科目 → 組
  var SCG={chi:'chi',math:'math',eng:'eng',sci:'sci',soc:'soc',mock:'mt',term:'mt',kb:'kb',kbfix:'kb',kbr:'kb',fu:'kb',hw:'kb'};   // 任務類別 → 組（沒列的都算其他）
  var SUBP={kbm:'資優數學',kbs:'自然學科'};
  var SUBS={kb:'考古題',kbfix:'考古題訂正',kbr:'科班複習',fu:'複試',hw:'補習作業',mock:'模考',term:'段考',late:'熬夜補進度',vrev:'錯字本複習'};
  var CORE=['chi','math','eng','sci','soc','kb'];   // 「沒讀到」只看這幾科
  // 驗證時（亮或暗任一種）色盲模擬 ΔE<6 或一般視覺 ΔE<15 的兩色：圓餅圖裡不要讓它們相鄰
  var WEAK={'math|kb':1,'chi|soc':1,'chi|eng':1,'chi|mt':1,'sci|eng':1,'sci|mt':1,'soc|mt':1,'sci|oth':1,'eng|oth':1,'soc|oth':1};
  var RNG={d:['今天',1,'昨天'],w:['近 7 天',7,'前 7 天'],m:['近 30 天',30,'前 30 天'],a:['全部',0,'']};
  var SS_DARK='--ss-math:#3987e5;--ss-chi:#d95926;--ss-sci:#199e70;--ss-soc:#c98500;--ss-eng:#d55181;--ss-mt:#0ca30c;--ss-kb:#9085e9;--ss-oth:#898781;--ss-tx-soc:#fff';
  var SS_CSS='.ss{--ss-math:#2a78d6;--ss-chi:#eb6834;--ss-sci:#1baf7a;--ss-soc:#eda100;--ss-eng:#e87ba4;--ss-mt:#008300;--ss-kb:#6250d6;--ss-oth:#898781;--ss-tx-soc:#0b0b0b;'
    +'--ss-surf:var(--card,#fff);--ss-acc:var(--dc-acc,var(--sky,#1C7EBB));--ss-barc:var(--dc-bar,var(--bar,#3A9AD9));container-type:inline-size}'
    +'[data-dark] .ss,:root[data-theme="dark"] .ss.ss-m{'+SS_DARK+'}'
    +':root[data-theme="dark"] .ss.ss-m{--ss-on:#0F171E}'   // 家長頁深色的強調色很淺，選中的按鈕字改深色才看得清楚
    +'@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .ss.ss-m{'+SS_DARK+';--ss-on:#0F171E}}'
    +'.ss-bar{display:flex;flex-wrap:wrap;gap:6px 8px;margin:0 0 10px}'
    +'.ss-seg{display:inline-flex;border:1px solid var(--rule,#D6E0E8);border-radius:999px;overflow:hidden}'
    +'.ss-seg button{font:inherit;font-size:13px;line-height:1.2;border:0;background:none;color:var(--ink-soft,#4E5B67);padding:6px 11px;min-block-size:32px;min-inline-size:44px;cursor:pointer}'
    +'.ss-seg button+button{border-inline-start:1px solid var(--rule,#D6E0E8)}'
    +'.ss-seg button[aria-pressed="true"]{background:var(--ss-acc);color:var(--ss-on,#fff);font-weight:600}'
    +'.ss-seg button:focus-visible{outline:2px solid var(--ink,#131C26);outline-offset:-4px}'
    +'@media (hover:hover){.ss-seg button[aria-pressed="false"]:hover{color:var(--ink,#131C26);background:var(--paper,#EEF5FA)}}'
    +'.ss-kpi{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin:0 0 8px}'
    +'.ss-kpi>div{background:var(--paper,#EEF5FA);border-radius:10px;padding:7px 8px;min-width:0}'
    +'.ss-kpi small{display:block;font-size:11.5px;line-height:1.45;color:var(--ink-faint,#6B7782);overflow-wrap:anywhere}'
    +'.ss-kpi b{display:block;font-family:"IBM Plex Mono",monospace;font-size:19px;font-weight:600;line-height:1.3;color:var(--ink,#131C26)}'
    +'.ss-kpi b span{font-family:inherit;font-size:12px;font-weight:400;color:var(--ink-faint,#6B7782);margin-inline-start:2px}'
    +'.ss-up{color:var(--ok,var(--cap,#0D7F63))} .ss-dn{color:var(--warn,#A65A0C)}'
    +'.ss-facts{list-style:none;margin:0 0 10px;padding:0;font-size:13px;color:var(--ink-soft,#4E5B67)}'
    +'.ss-facts li{padding:2px 0;overflow-wrap:anywhere}'
    +'.ss-facts b{color:var(--ink,#131C26);font-weight:600}'
    +'.ss-plot{position:relative}'
    +'.ss-bars{list-style:none;margin:0;padding:0}'
    +'.ss-row{display:grid;grid-template-columns:5.6em minmax(0,1fr) auto;align-items:center;gap:8px;inline-size:100%;font:inherit;font-size:13.5px;text-align:start;color:var(--ink,#131C26);background:none;border:0;border-radius:8px;padding:5px 4px;min-block-size:34px;cursor:pointer}'
    +'.ss-nm{line-height:1.3;overflow-wrap:anywhere}'
    +'.ss-tr{display:block;block-size:14px}'
    +'.ss-tr i{display:block;block-size:100%;min-inline-size:3px;background:var(--ss-barc);border-radius:0 4px 4px 0}'
    +'.ss-v{text-align:end;white-space:nowrap;font-size:12px;color:var(--ink-faint,#6B7782)}'
    +'.ss-v b{font-family:"IBM Plex Mono",monospace;font-size:13.5px;font-weight:600;color:var(--ink,#131C26);margin-inline-end:2px}'
    +'.ss-v small{font-size:11.5px;margin-inline-start:6px}'
    +'.ss-row.on{background:var(--paper,#EEF5FA)}'
    +'@media (hover:hover){.ss-row:hover{background:var(--paper,#EEF5FA)}}'
    +'.ss-row:focus-visible{outline:2px solid var(--ss-acc);outline-offset:1px}'
    +'.ss-pie{display:flex;flex-wrap:wrap;align-items:center;gap:8px 18px}'
    +'.ss-svg{inline-size:min(184px,100%);block-size:auto;flex:none;margin-inline:auto}'
    +'@container (min-width:420px){.ss-svg{margin-inline:0}}'
    +'.ss-sl{stroke:var(--ss-surf);stroke-width:2;stroke-linejoin:round;cursor:pointer;transition:opacity .15s}'
    +'.ss-sl:focus{outline:none} .ss-sl:focus-visible{stroke:var(--ink,#131C26);stroke-width:3}'
    +'.ss-pie.hov .ss-sl:not(.on){opacity:.3}'
    +'.ss-pct{font:600 12px "IBM Plex Mono",monospace;pointer-events:none}'
    +'.ss-ctr{fill:var(--ink,#131C26);font-family:"IBM Plex Mono",monospace;font-weight:600;font-size:28px}'
    +'.ss-ctr2{fill:var(--ink-faint,#6B7782);font-size:12px}'
    +'.ss-leg{list-style:none;margin:0;padding:0;flex:1 1 170px;min-width:0;max-inline-size:22rem;font-size:13px}'
    +'.ss-leg li{display:grid;grid-template-columns:12px minmax(0,1fr) auto;gap:6px;align-items:center;padding:4px 2px;border-top:1px solid var(--rule,#D6E0E8)}'
    +'.ss-leg li:first-child{border-top:0}'
    +'.ss-leg li.on{background:var(--paper,#EEF5FA)}'
    +'.ss-leg i,.ss-dot{display:inline-block;inline-size:10px;block-size:10px;border-radius:2px}'
    +'.ss-leg span{overflow-wrap:anywhere}'
    +'.ss-leg em{font-style:normal;white-space:nowrap;color:var(--ink-faint,#6B7782);font-size:12px}'
    +'.ss-leg em b{font-family:"IBM Plex Mono",monospace;color:var(--ink,#131C26);font-weight:600;margin-inline-end:6px}'
    +'.ss-tip{position:absolute;z-index:5;inset-inline-start:0;inset-block-start:0;max-inline-size:min(250px,100%);background:var(--card,#fff);color:var(--ink,#131C26);border:1px solid var(--rule,#D6E0E8);border-radius:10px;box-shadow:0 6px 20px rgba(0,0,0,.18);padding:7px 10px;font-size:12.5px;line-height:1.5}'
    +'.ss-tip p{margin:0}'
    +'.ss-tip .v{font-family:"IBM Plex Mono",monospace;font-size:16px;font-weight:600}'
    +'.ss-tip .k{display:inline-block;inline-size:14px;block-size:3px;border-radius:2px;vertical-align:middle;margin-inline-end:6px}'
    +'.ss-tip .mut{color:var(--ink-faint,#6B7782)}'
    +'.ss-tbl{margin-top:10px}'
    +'.ss-tbl>summary{cursor:pointer;font-size:13px;color:var(--ss-acc);inline-size:fit-content}'
    +'.ss-tw{overflow:auto;max-inline-size:100%;margin-top:6px}'
    +'.ss-tw:focus-visible{outline:2px solid var(--ss-acc);outline-offset:2px}'
    +'.ss-tw table{border-collapse:separate;border-spacing:0;inline-size:100%;min-inline-size:0;font-size:12.5px}'   // 讀書網站的 table 預設 min-width:520px，這裡蓋掉
    +'.ss-tw th,.ss-tw td{vertical-align:middle;letter-spacing:0}'
    +'.ss-tw caption{text-align:start;font-size:12px;color:var(--ink-faint,#6B7782);padding:0 0 4px}'
    +'.ss-tw th,.ss-tw td{padding:5px 6px;border-bottom:1px solid var(--rule,#D6E0E8);text-align:end;white-space:nowrap;font-variant-numeric:tabular-nums}'
    +'.ss-tw thead th{font-weight:500;font-size:12px;color:var(--ink-faint,#6B7782);background:var(--card,#fff)}'
    +'.ss-tw tbody tr:last-child td{border-bottom:1px solid var(--rule,#D6E0E8)}'
    +'.ss-tw tbody th,.ss-tw tfoot th,.ss-tw thead th:first-child{text-align:start;position:sticky;inset-inline-start:0;background:var(--card,#fff)}'
    +'.ss-tw tbody th{font-weight:500}'
    +'.ss-tw .ss-dot{margin-inline-end:6px}'
    +'.ss-tw tr.sub th{font-weight:400;color:var(--ink-soft,#4E5B67);padding-inline-start:22px}'
    +'.ss-tw tr.sub td{color:var(--ink-soft,#4E5B67)}'
    +'.ss-tw tfoot th,.ss-tw tfoot td{font-weight:600;border-bottom:0}'
    +'@container (max-width:420px){.ss-tw th,.ss-tw td{padding:5px 4px}.ss-tw tr.sub th{padding-inline-start:14px}}'   // 手機上欄位擠一點，比較不用左右滑
    +'.ss-note{font-size:12px;color:var(--ink-faint,#6B7782);margin:8px 0 0}'
    +'.ss-empty{font-size:13.5px;color:var(--ink-soft,#4E5B67);background:var(--paper,#EEF5FA);border-radius:10px;padding:10px 12px;margin:0}'
    +'@media (forced-colors:active){.ss-tr i{background:CanvasText}.ss-svg,.ss-leg i,.ss-dot,.ss-tip .k{forced-color-adjust:none}.ss-seg button[aria-pressed="true"]{background:Highlight;color:HighlightText}.ss-tip{border-color:CanvasText}}'
    +'@media (prefers-reduced-motion:reduce){.ss-sl{transition:none}}';
  function injectSsCss(){ if(document.getElementById('ss-css')) return; var s=document.createElement('style'); s.id='ss-css'; s.textContent=SS_CSS; document.head.appendChild(s); }
  function weak(a,b){ return !!(WEAK[a+'|'+b]||WEAK[b+'|'+a]); }
  // 圓餅圖的排法：先照固定順序；相鄰（含頭尾）有分不清楚的兩色，就找第一個都分得清楚的排法（最多 8 塊，很快）；找不到就照原本的
  var ringMemo={};
  function ringOrder(ids){
    var k=ids.join(','); if(ringMemo[k]) return ringMemo[k];
    var n=ids.length, bad=false, i;
    for(i=0;i<n && n>2;i++) if(weak(ids[i],ids[(i+1)%n])) bad=true;
    if(!bad) return (ringMemo[k]=ids);
    var used={}, cur=[ids[0]], hit=null; used[ids[0]]=1;
    (function dfs(){
      if(hit) return;
      if(cur.length===n){ if(!weak(cur[n-1],cur[0])) hit=cur.slice(); return; }
      for(var j=1;j<n && !hit;j++){ var x=ids[j]; if(used[x] || weak(cur[cur.length-1],x)) continue; used[x]=1; cur.push(x); dfs(); cur.pop(); used[x]=0; }
    })();
    return (ringMemo[k]=hit||ids);
  }
  // 每天、每組加起來（資料沒變就用上次算好的）
  var aggC={};
  function aggregate(o){
    var hs=o['plan.hist.v1'], ps=o['plan.pomo.v1'], ss=o['plan.state.v3'], rs=o['plan.vrev.v1'];
    if(aggC.r && aggC.hs===hs && aggC.ps===ps && aggC.ss===ss && aggC.rs===rs) return aggC.r;
    var P={}, S={};
    var plog=(J(o,'plan.pomo.v1',{})||{}).log;
    (Array.isArray(plog)?plog:[]).forEach(function(e){
      if(!e||!e.k) return;
      var c=e.s||'', g=PG[c]||'oth', m=Math.round(+e.m||25), D=P[e.k]=P[e.k]||{}, x=D[g]=D[g]||{m:0,n:0,a:0,d:0,sub:{}};
      x.m+=m; x.n++; var s=x.sub[c]=x.sub[c]||{m:0,n:0,a:0,d:0}; s.m+=m; s.n++;
    });
    var hist=J(o,'plan.hist.v1',{})||{}, st=J(o,'plan.state.v3',{})||{}, cats={};
    Object.keys(hist).forEach(function(k){ if(hist[k]&&hist[k].cat) cats[k]=hist[k].cat; });
    if(st.day && Array.isArray(st.list) && st.list.length){   // 手機上目前那一天（還沒換日、還沒寫進紀錄的勾）照清單算
      var cc={}, dn=st.done||{};
      st.list.forEach(function(t){ if(!t||t.pre||t.f) return; var c=t.c||'other', q=cc[c]=cc[c]||{a:0,d:0,m:0}; q.a++; if(dn[t.id]){ q.d++; q.m+=(+t.m||0); } });
      cats[st.day]=cc;
    }
    Object.keys(cats).forEach(function(k){
      var c=cats[k]||{};
      Object.keys(c).forEach(function(cat){
        var q=c[cat]||{}, a=+q.a||0, d=+q.d||0, m=Math.round(+q.m||0); if(!a&&!d&&!m) return;
        var g=SCG[cat]||'oth', D=S[k]=S[k]||{}, x=D[g]=D[g]||{m:0,n:0,a:0,d:0,sub:{}}, s=x.sub[cat]=x.sub[cat]||{m:0,n:0,a:0,d:0};
        x.m+=m; x.a+=a; x.d+=d; s.m+=m; s.a+=a; s.d+=d;
      });
    });
    // 11-17 審查：單字賭場的錯字本複習，網站其他地方都算英文讀書分鐘（2026-11-01 他選的），表定這邊也算進英文（只加分鐘，不算完成率）
    var rv=J(o,'plan.vrev.v1',{})||{};
    Object.keys(rv).forEach(function(k){ if(k==='pomo') return; var mm=Math.round((+rv[k]||0)/60); if(!mm) return;
      var D=S[k]=S[k]||{}, x=D.eng=D.eng||{m:0,n:0,a:0,d:0,sub:{}}, s=x.sub.vrev=x.sub.vrev||{m:0,n:0,a:0,d:0}; x.m+=mm; s.m+=mm; });
    function firstDay(M){ var f=null; Object.keys(M).forEach(function(k){ var d=pk(k); if(!isNaN(d.getTime()) && (!f||d<f)) f=d; }); return f; }
    aggC={hs:hs, ps:ps, ss:ss, rs:rs, r:{p:{M:P, first:firstDay(P)}, s:{M:S, first:firstDay(S)}}};
    return aggC.r;
  }
  function sumRange(M,from,to){
    var G={}, tot=0, n=0, a=0, dd=0, days=0, act=0;
    for(var d=new Date(from); d<=to; d=addD(d,1)){
      days++; var D=M[key(d)]; if(!D) continue; var dayM=0;
      Object.keys(D).forEach(function(g){
        var x=D[g], y=G[g]=G[g]||{m:0,n:0,a:0,d:0,sub:{}};
        y.m+=x.m; y.n+=x.n; y.a+=x.a; y.d+=x.d; tot+=x.m; n+=x.n; a+=x.a; dd+=x.d; dayM+=x.m;
        Object.keys(x.sub).forEach(function(c){ var s=x.sub[c], z=y.sub[c]=y.sub[c]||{m:0,n:0,a:0,d:0}; z.m+=s.m; z.n+=s.n; z.a+=s.a; z.d+=s.d; });
      });
      if(dayM>0) act++;
    }
    return {G:G, tot:tot, n:n, a:a, d:dd, days:days, act:act};
  }
  function fmtM(m){ m=Math.round(m); return m<60?m+' 分':(Math.round(m/6)/10)+' 小時'; }
  function pct(v,t){ var p=t?Math.round(v/t*100):0; return (p===0&&v>0)?'<1':p; }   // 只拿來顯示；有讀但不到 0.5% 寫「<1」

  var ssN=0;
  function subjMount(el, opts){
    injectSsCss();
    opts=opts||{};
    var uid='ss'+(++ssN), pref={src:'p', rng:'w', view:'bar', tbl:0};
    try{ var sp=JSON.parse(lsGet('ss.pref')||'{}')||{};
      if(sp.src==='p'||sp.src==='s') pref.src=sp.src; if(RNG[sp.rng]) pref.rng=sp.rng; if(sp.view==='bar'||sp.view==='pie') pref.view=sp.view; pref.tbl=sp.tbl?1:0; }catch(e){}
    function savePref(){ lsSet('ss.pref',JSON.stringify(pref)); }
    function seg(k,lab,items){
      return '<div class="ss-seg" role="group" aria-label="'+lab+'">'+items.map(function(it){
        return '<button type="button" data-k="'+k+'" data-v="'+it[0]+'" aria-pressed="'+(pref[k]===it[0])+'">'+it[1]+'</button>'; }).join('')+'</div>';
    }
    el.innerHTML='<div class="ss'+(opts.media?' ss-m':'')+'">'
      +'<div class="ss-bar" role="toolbar" aria-label="各科讀書時間的選項" focusgroup="toolbar wrap">'
      +seg('rng','期間',[['d','今天'],['w','7 天'],['m','30 天'],['a','全部']])
      +seg('src','資料',[['p','番茄鐘'],['s','表定']])
      +seg('view','圖',[['bar','長條圖'],['pie','圓餅圖']])
      +'</div><div class="ss-body"></div></div>';
    var root=el.firstChild, bar=root.firstChild, body=root.lastChild, cur=null, last={};
    // 選項列：一個 Tab 進來、左右鍵換（瀏覽器沒有 focusgroup 時自己做）
    var btns=[].slice.call(bar.querySelectorAll('button'));
    if(!('focusGroup' in HTMLElement.prototype)){
      var setTab=function(t){ btns.forEach(function(b){ b.tabIndex=b===t?0:-1; }); };
      setTab(btns[0]);
      bar.addEventListener('focusin',function(e){ if(btns.indexOf(e.target)>=0) setTab(e.target); });
      bar.addEventListener('keydown',function(e){
        var i=btns.indexOf(document.activeElement), n=btns.length, j=null; if(i<0) return;
        if(e.key==='ArrowRight') j=(i+1)%n; else if(e.key==='ArrowLeft') j=(i-1+n)%n; else if(e.key==='Home') j=0; else if(e.key==='End') j=n-1;
        if(j===null) return; e.preventDefault(); btns[j].focus();
      });
    }
    bar.addEventListener('click',function(e){
      var b=e.target.closest&&e.target.closest('button[data-k]'); if(!b) return;
      var k=b.getAttribute('data-k'); pref[k]=b.getAttribute('data-v'); savePref();
      btns.forEach(function(x){ if(x.getAttribute('data-k')===k) x.setAttribute('aria-pressed',String(x===b)); });
      render(true);
    });

    function render(force){
      var o={}; try{ o=opts.get()||{}; }catch(e){}
      var A=aggregate(o), today=d0(), tk=key(today);
      if(!force && last.A===A && last.tk===tk) return;   // 資料沒變、還是同一天：不重畫
      last={A:A, tk:tk};
      var src=pref.src, R=RNG[pref.rng], SRC=A[src], first=SRC.first, isP=src==='p';
      var from, prev=null;
      if(pref.rng==='a') from=first&&first<today?first:today;
      else { from=addD(today,-(R[1]-1)); prev={from:addD(from,-R[1]), to:addD(from,-1)}; }
      var eff=first&&first>from?first:from;   // 開始有紀錄以前的日子不算進日平均
      var C=sumRange(SRC.M,from,today), effDays=Math.max(1,Math.round((today-eff)/864e5)+1);
      var PV=(prev && first && first<=prev.to)?sumRange(SRC.M,prev.from,prev.to):null;
      var ids=Object.keys(C.G).filter(function(g){ var x=C.G[g]; return x.m>0||x.n>0||x.a>0; });
      var ranked=ids.slice().sort(function(a,b){ return (C.G[b].m-C.G[a].m)||(SG.indexOf(a)-SG.indexOf(b)); });
      cur={C:C, PV:PV, src:src, R:R, ranked:ranked};
      var rangeTxt=pref.rng==='d'?md(tk):md(key(from))+'～'+md(tk);
      var h='';
      if(!first){
        h='<p class="ss-empty">'+(isP?'還沒有番茄鐘紀錄：番茄鐘開始前選這顆讀的科目，做完一顆這裡就會出現。'
          :'還沒有勾掉的讀書任務：在「今天」勾了任務，這裡就會開始累積。')+(A[isP?'s':'p'].first?'可以先切到「'+(isP?'表定':'番茄鐘')+'」看。':'')+'</p>';
        body.innerHTML=h; return;
      }
      // 數字卡：總時數（跟上一段比）、日平均、番茄鐘顆數／完成率
      var dl='';
      if(pref.rng==='a') dl='從 '+md(key(first))+' 起';
      else if(!PV) dl=R[2]+'還沒有紀錄';
      else { var df=C.tot-PV.tot; dl=df?'比'+R[2]+' <span class="'+(df>0?'ss-up':'ss-dn')+'">'+(df>0?'▲ ':'▼ ')+fmtM(Math.abs(df))+'</span>':(C.tot?'跟'+R[2]+'一樣':R[2]+'也沒有'); }
      function big(m){ m=Math.round(m); return m<60?m+'<span>分</span>':(Math.round(m/6)/10)+'<span>小時</span>'; }
      var main=ranked.filter(function(g){ return g!=='oth' && C.G[g].m>0; }), facts=[];
      h+='<div class="ss-kpi"><div><small>總時數</small><b>'+big(C.tot)+'</b><small>'+dl+'</small></div>';
      if(pref.rng==='d') h+='<div><small>讀了幾科</small><b>'+main.length+'<span>科</span></b><small>'+(main.length?'最多：'+SGN[main[0]]:'還沒開始')+'</small></div>';
      else h+='<div><small>日平均</small><b>'+Math.round(C.tot/effDays)+'<span>分</span></b><small>'+effDays+' 天裡有 '+C.act+' 天有讀</small></div>';
      if(isP) h+='<div><small>番茄鐘</small><b>'+C.n+'<span>顆</span></b><small>'+(C.n?'平均一顆 '+Math.round(C.tot/C.n)+' 分':'這段時間沒有')+'</small></div></div>';
      else h+='<div><small>完成率</small><b>'+(C.a?pct(C.d,C.a)+'<span>%</span>':'—')+'</b><small>完成 '+C.d+'／'+C.a+' 項</small></div></div>';
      // 重點：最多、最少、沒讀到、跟上一段比變最多的、表定沒做完的
      if(main.length){ var top=main[0]; facts.push('最多：<b>'+SGN[top]+'</b> '+C.G[top].m+' 分（'+pct(C.G[top].m,C.tot)+'%）'); }
      if(main.length>1){ var lo=main[main.length-1]; facts.push('最少：<b>'+SGN[lo]+'</b> '+C.G[lo].m+' 分（'+pct(C.G[lo].m,C.tot)+'%）'); }
      var none=CORE.filter(function(g){ return !(C.G[g]&&C.G[g].m>0); });
      if(none.length && none.length<CORE.length) facts.push('沒讀到：'+none.map(function(g){ return SGN[g]; }).join('、'));
      if(PV){
        var ch=SG.filter(function(g){ return g!=='oth'; }).map(function(g){ return {g:g, v:((C.G[g]||{}).m||0)-((PV.G[g]||{}).m||0)}; });
        var up=ch.slice().sort(function(a,b){ return b.v-a.v; })[0], dn=ch.slice().sort(function(a,b){ return a.v-b.v; })[0], bits=[];
        if(up&&up.v>0) bits.push('多最多 <b>'+SGN[up.g]+'</b> <span class="ss-up">▲ '+fmtM(up.v)+'</span>');
        if(dn&&dn.v<0) bits.push('少最多 <b>'+SGN[dn.g]+'</b> <span class="ss-dn">▼ '+fmtM(-dn.v)+'</span>');
        if(bits.length) facts.push('跟'+R[2]+'比：'+bits.join('，'));
      }
      if(!isP){
        var lag=ranked.filter(function(g){ return C.G[g].a>C.G[g].d; }).sort(function(a,b){ return (C.G[b].a-C.G[b].d)-(C.G[a].a-C.G[a].d); }).slice(0,3);
        if(lag.length) facts.push('還沒做完：'+lag.map(function(g){ return SGN[g]+' '+C.G[g].d+'／'+C.G[g].a; }).join('、'));
      }
      if(facts.length) h+='<ul class="ss-facts">'+facts.map(function(f){ return '<li>'+f+'</li>'; }).join('')+'</ul>';
      // 圖
      var shown=ranked.filter(function(g){ return C.G[g].m>0; });
      h+='<div class="ss-plot">';
      if(!shown.length) h+='<p class="ss-empty">'+R[0]+'（'+rangeTxt+'）沒有'+(isP?'番茄鐘紀錄':'完成的讀書任務')+'。</p>';
      else if(pref.view==='bar'){
        var mx=C.G[shown[0]].m;
        h+='<ol class="ss-bars" aria-label="各科分鐘，由多到少">'+shown.map(function(g){
          var x=C.G[g];
          return '<li><button type="button" class="ss-row" data-g="'+g+'" aria-label="'+SGN[g]+' '+x.m+' 分，占 '+pct(x.m,C.tot)+'%">'
            +'<span class="ss-nm">'+SGN[g]+'</span><span class="ss-tr"><i style="inline-size:'+Math.max(1,x.m/mx*100).toFixed(1)+'%"></i></span>'
            +'<span class="ss-v"><b>'+x.m+'</b>分<small>'+pct(x.m,C.tot)+'%</small></span></button></li>'; }).join('')+'</ol>';
      } else {
        var order=ringOrder(SG.filter(function(g){ return shown.indexOf(g)>=0; })), a0=0, Ro=92, Ri=58, svg='', lab='';
        order.forEach(function(g){
          var x=C.G[g], f=x.m/C.tot, a1=a0+f*2*Math.PI, al=SGN[g]+' '+x.m+' 分，占 '+pct(x.m,C.tot)+'%';
          if(order.length===1) svg+='<circle class="ss-sl" data-g="'+g+'" cx="100" cy="100" r="'+((Ro+Ri)/2)+'" fill="none" style="stroke:var(--ss-'+g+');stroke-width:'+(Ro-Ri)+'" tabindex="0" role="img" aria-label="'+al+'"></circle>';
          else svg+='<path class="ss-sl" data-g="'+g+'" d="'+arcPath(Ro,Ri,a0,a1)+'" fill="var(--ss-'+g+')" tabindex="0" role="img" aria-label="'+al+'"></path>';
          if(f>=0.09){ var am=(a0+a1)/2, rm=(Ro+Ri)/2; lab+='<text class="ss-pct" x="'+(100+rm*Math.sin(am)).toFixed(1)+'" y="'+(100-rm*Math.cos(am)).toFixed(1)+'" text-anchor="middle" dominant-baseline="central" style="fill:var(--ss-tx-'+g+',#fff)">'+Math.round(f*100)+'%</text>'; }
          a0=a1;
        });
        var tm=Math.round(C.tot), cv=tm<60?String(tm):String(Math.round(tm/6)/10);
        h+='<div class="ss-pie"><svg class="ss-svg" viewBox="0 0 200 200" role="group" aria-label="各科占比的圓餅圖">'+svg+lab
          +'<text class="ss-ctr" x="100" y="96" text-anchor="middle">'+cv+'</text><text class="ss-ctr2" x="100" y="120" text-anchor="middle">'+(tm<60?'分鐘':'小時')+'</text></svg>'
          +'<ul class="ss-leg" aria-label="圖例">'+order.map(function(g){ var x=C.G[g];
            return '<li data-g="'+g+'"><i style="background:var(--ss-'+g+')"></i><span>'+SGN[g]+'</span><em><b>'+pct(x.m,C.tot)+'%</b>'+x.m+' 分</em></li>'; }).join('')+'</ul></div>';
      }
      h+='<div class="ss-tip" hidden aria-hidden="true"></div></div>';
      // 數字表（圖的無障礙版本；科班、模考／段考、其他列出細項）
      var hasPV=!!PV, last3=isP?'顆數':'完成';
      h+='<details class="ss-tbl"'+(pref.tbl?' open':'')+'><summary>看數字表</summary><div class="ss-tw" role="region" tabindex="0" aria-labelledby="'+uid+'-cap"><table>'
        +'<caption id="'+uid+'-cap">'+(isP?'番茄鐘':'表定')+'・'+R[0]+'（'+rangeTxt+'）各科分鐘</caption>'
        +'<thead><tr><th scope="col">科目</th><th scope="col">分鐘</th><th scope="col">占比</th>'+(hasPV?'<th scope="col">'+R[2]+'</th><th scope="col">增減</th>':'')+'<th scope="col">'+last3+'</th></tr></thead><tbody>';
      var rows=ranked.slice();
      if(PV) Object.keys(PV.G).forEach(function(g){ if(rows.indexOf(g)<0 && PV.G[g].m>0) rows.push(g); });
      rows.forEach(function(g){
        var x=C.G[g]||{m:0,n:0,a:0,d:0,sub:{}}, pv=PV&&PV.G[g]?PV.G[g]:{m:0,sub:{}};
        function cells(y,p,isSub){ var dm=y.m-(p?p.m:0);
          return '<td>'+y.m+'</td><td>'+pct(y.m,C.tot)+'%</td>'+(hasPV?'<td>'+(p?p.m:0)+'</td><td>'+(dm>0?'+'+dm:(dm<0?'−'+(-dm):'0'))+'</td>':'')
            +'<td>'+(isP?y.n:y.d+'／'+y.a)+'</td>'; }
        h+='<tr><th scope="row"><i class="ss-dot" style="background:var(--ss-'+g+')"></i>'+SGN[g]+'</th>'+cells(x,pv)+'</tr>';
        var subs=Object.keys(x.sub).concat(Object.keys(pv.sub||{}).filter(function(c){ return !x.sub[c]; }));
        // 細項：科班、模考／段考一定列；其他只有一種（沒選科目／其他）就不用再列一次
        if(g==='kb'||g==='mt'||(g==='oth'&&!(subs.length===1&&subs[0]===(isP?'':'other')))) subs.sort(function(a,b){ return ((x.sub[b]||{}).m||0)-((x.sub[a]||{}).m||0); }).forEach(function(c){
          var y=x.sub[c]||{m:0,n:0,a:0,d:0}, p=(pv.sub&&pv.sub[c])?pv.sub[c]:{m:0};
          h+='<tr class="sub"><th scope="row">'+esc(isP?(SUBP[c]||POMO_SUBJ[c]||'沒選科目'):(SUBS[c]||CATN[c]||c||'其他'))+'</th>'+cells(y,p,true)+'</tr>';
        });
      });
      var dt=C.tot-(PV?PV.tot:0);
      h+='</tbody><tfoot><tr><th scope="row">合計</th><td>'+C.tot+'</td><td>'+(C.tot?'100%':'—')+'</td>'+(hasPV?'<td>'+PV.tot+'</td><td>'+(dt>0?'+'+dt:(dt<0?'−'+(-dt):'0'))+'</td>':'')
        +'<td>'+(isP?C.n:C.d+'／'+C.a)+'</td></tr></tfoot></table></div></details>';
      h+='<p class="ss-note">'+(isP?'照每一顆番茄鐘開始前選的科目算；科班＝資優數學＋自然學科。':'照勾掉的讀書任務、表定的分鐘算（上學、補習這些固定行程不算）；科班＝考古題、訂正、科班複習、補習作業。')
        +'點長條或圓餅看細項。</p>';
      body.innerHTML=h;
      wire();
    }
    function arcPath(R,r,a0,a1){
      var big=(a1-a0)>Math.PI?1:0;
      function P(rad,a){ return (100+rad*Math.sin(a)).toFixed(2)+' '+(100-rad*Math.cos(a)).toFixed(2); }
      return 'M'+P(R,a0)+'A'+R+' '+R+' 0 '+big+' 1 '+P(R,a1)+'L'+P(r,a1)+'A'+r+' '+r+' 0 '+big+' 0 '+P(r,a0)+'Z';
    }
    // 提示：滑過、點一下、Tab 到長條或扇形就出現；Esc 或點外面收起來
    var tipG=null, onDoc=false;
    function tipHide(){
      var tip=body.querySelector('.ss-tip'); if(tip) tip.hidden=true; tipG=null;
      [].forEach.call(body.querySelectorAll('.on'),function(x){ x.classList.remove('on'); });
      var pie=body.querySelector('.ss-pie'); if(pie) pie.classList.remove('hov');
    }
    function tipShow(g, mark, ev){
      var plot=body.querySelector('.ss-plot'), tip=body.querySelector('.ss-tip'); if(!plot||!tip||!cur||!cur.C.G[g]) return;
      var C=cur.C, x=C.G[g], isP=cur.src==='p';
      if(tipG!==g){
        tipG=g; tip.textContent='';
        var p1=document.createElement('p'), v=document.createElement('span'); v.className='v'; v.textContent=x.m+' 分';
        var k=document.createElement('i'); k.className='k'; k.style.background='var(--ss-'+g+')';
        p1.appendChild(k); p1.appendChild(v); p1.appendChild(document.createTextNode('　'+SGN[g]+'・'+pct(x.m,C.tot)+'%')); tip.appendChild(p1);
        function line(t,cls){ var p=document.createElement('p'); if(cls) p.className=cls; p.textContent=t; tip.appendChild(p); }
        line(isP?'番茄鐘 '+x.n+' 顆':'完成 '+x.d+'／'+x.a+' 項');
        if(cur.PV){ var pm=(cur.PV.G[g]||{}).m||0, df=x.m-pm; line(cur.R[2]+' '+pm+' 分'+(df?'（'+(df>0?'▲ +':'▼ −')+Math.abs(df)+' 分）':'（一樣）')); }
        var subs=Object.keys(x.sub).filter(function(c){ return x.sub[c].m>0; });
        if(subs.length>1||g==='kb'||g==='mt') line(subs.sort(function(a,b){ return x.sub[b].m-x.sub[a].m; }).map(function(c){
          return (isP?(SUBP[c]||POMO_SUBJ[c]||'沒選科目'):(SUBS[c]||CATN[c]||c||'其他'))+' '+x.sub[c].m; }).join('・')+' 分','mut');
      }
      [].forEach.call(body.querySelectorAll('[data-g]'),function(z){ z.classList.toggle('on',z.getAttribute('data-g')===g); });
      var pie=body.querySelector('.ss-pie'); if(pie) pie.classList.add('hov');
      tip.hidden=false;
      var pr=plot.getBoundingClientRect(), mr=mark.getBoundingClientRect(), tw=tip.offsetWidth, th=tip.offsetHeight;
      var cx=ev&&ev.clientX!=null&&ev.pointerType!=='touch'?ev.clientX:mr.left+mr.width/2, cy=ev&&ev.clientY!=null&&ev.pointerType!=='touch'?ev.clientY:mr.top;
      var left=Math.max(0,Math.min(pr.width-tw,cx-pr.left-tw/2)), top=cy-pr.top-th-10;
      if(top<-pr.top+4) top=(ev&&ev.pointerType!=='touch'&&ev.clientY!=null?cy-pr.top+18:mr.bottom-pr.top+6);
      tip.style.transform='translate('+left.toFixed(0)+'px,'+top.toFixed(0)+'px)';
    }
    function markOf(t){ var m=t&&t.closest&&t.closest('[data-g]'); return m&&body.contains(m)?m:null; }
    function wire(){
      tipG=null;
      var plot=body.querySelector('.ss-plot'); if(!plot) return;
      plot.addEventListener('pointermove',function(e){ if(e.pointerType==='touch') return; var m=markOf(e.target); if(m) tipShow(m.getAttribute('data-g'),m,e); });
      plot.addEventListener('pointerleave',function(e){ if(e.pointerType!=='touch') tipHide(); });
      plot.addEventListener('click',function(e){ var m=markOf(e.target); if(m) tipShow(m.getAttribute('data-g'),m.classList.contains('ss-sl')||m.classList.contains('ss-row')?m:(body.querySelector('.ss-sl[data-g="'+m.getAttribute('data-g')+'"]')||m),e); });
      plot.addEventListener('focusin',function(e){ var m=markOf(e.target); if(m) tipShow(m.getAttribute('data-g'),m,null); });
      plot.addEventListener('focusout',function(e){ if(!plot.contains(e.relatedTarget)) tipHide(); });
      var det=body.querySelector('.ss-tbl'); if(det) det.addEventListener('toggle',function(){ pref.tbl=det.open?1:0; savePref(); });
      if(!onDoc){ onDoc=true;
        var kd=function(e){ if(!el.isConnected){ document.removeEventListener('keydown',kd); document.removeEventListener('pointerdown',pd,true); return; } if(e.key==='Escape' && tipG) tipHide(); };
        var pd=function(e){ if(!el.isConnected){ document.removeEventListener('keydown',kd); document.removeEventListener('pointerdown',pd,true); return; } var p=body.querySelector('.ss-plot'); if(tipG && p && !p.contains(e.target)) tipHide(); };
        document.addEventListener('keydown',kd); document.addEventListener('pointerdown',pd,true);
      }
    }
    render(true);
    return {refresh:function(){ render(false); }};
  }

  // CHECK_RE：哪些任務要給 Claude 檢查。11-09 D：index.html、parent.html 都讀這一份，改規則只要改這裡
  window.DayChart={mount:mount, dayInfo:dayInfo, parse:parse, CHECK_RE:CHECK_RE, subj:subjMount, POMO_SUBJ:POMO_SUBJ};
})();
