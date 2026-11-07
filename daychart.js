/* 每天的讀書長條圖（2026-11-07）：讀書網站「紀錄 → 進度回測」和家長版共用。
   DayChart.mount(元素, {get: 回傳資料的函式, plan: window.PLAN})
   資料＝跟雲端備份同一種格式：{ 'plan.hist.v1': 字串或物件, 'plan.state.v3': …, … }
   長條可以切「讀書時間／完成率」，‹ › 看更早的日子，點一根長條看那天：完成率、各科、完成和沒完成的任務、
   番茄鐘、給 Claude 檢查的作業、那天的點數（含家長加的）。 */
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
      html+='<div class="dc-det" id="'+(el.id||'dc')+'-det" aria-live="polite">'+detail(D[state.sel])+'</div>';
      var W=D.slice(DAYS-7), wm=W.reduce(function(a,x){ return a+x.m; },0), wa=W.reduce(function(a,x){ return a+x.a; },0), wd=W.reduce(function(a,x){ return a+x.dn; },0),
          wp=W.reduce(function(a,x){ return a+x.pomo.length; },0), wgood=W.filter(function(x){ return x.m>=60; }).length, wnone=W.filter(function(x){ return !x.has; }).length;
      html+='<div class="dc-sum"><span>'+(state.off?'這段的後 7 天':'最近 7 天')+'讀書　<b>'+(wm/60).toFixed(1)+'</b> 小時</span><span>任務完成率　<b>'+(wa?Math.round(wd/wa*100):0)+'%</b></span>'
        +'<span>讀滿 1 小時　<b>'+wgood+'</b>／7 天</span><span>番茄鐘　<b>'+wp+'</b> 顆</span>'
        +(wnone?'<span style="grid-column:1/-1;color:var(--warn,#A65A0C)">有 '+wnone+' 天沒有紀錄（那天沒打開網站）</span>':'')+'</div>';
      el.innerHTML=html;
      el.querySelectorAll('.dc-bar').forEach(function(b){ b.addEventListener('click',function(){
        state.sel=+b.getAttribute('data-j');
        el.querySelectorAll('.dc-bar').forEach(function(z){ z.classList.toggle('sel',z===b); });
        el.querySelector('.dc-det').innerHTML=detail(D[state.sel]);
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
  window.DayChart={mount:mount, dayInfo:dayInfo, parse:parse};
})();
