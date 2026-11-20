/* 每天摘要（2026-11-18 使用者要「整理今天摘要」）：讀書網站「紀錄 → 日誌」和家長頁共用。
   DaySum.mount(元素, {get: 回傳資料的函式（跟雲端備份同一種格式）, plan: window.PLAN, parent: true＝家長頁})
   一天一張：一句話總結、任務、讀書分（表定＋番茄鐘×1.5，跟賭場押注上限同一套算法）、番茄鐘（各科、備註）、
   給 Claude 檢查、點數、單字賭場、錯字本、寵物（只有今天）、心情和日誌。‹ › 看前 30 天，「複製文字」可以貼給別人。
   家長頁不顯示心情、體力和日誌內容（那是他自己寫的）。要先載入 daychart.js（用它的 parse、dayInfo、POMO_SUBJ、CHECK_RE）。 */
(function(){
  if(window.DaySum) return;
  var WD='日一二三四五六', BACK=30, CHECK_DAYS=3;
  var MOOD=['很低','偏低','普通','不錯','很好'], ENER=['很累','有點累','普通','有精神','充沛'];
  var CURU={pts:'點',chip:'籌碼',star:'🌟'};
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function J(o,k,d){ try{ var v=o[k]; if(v==null) return d; var x=typeof v==='string'?JSON.parse(v):v; return x==null?d:x; }catch(e){ return d; } }
  function d0(){ var d=new Date(); d.setHours(0,0,0,0); return d; }
  function key(d){ return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate(); }
  function pk(k){ var p=String(k).split('-'); return new Date(+p[0],+p[1]-1,+p[2]); }
  function md(k){ var p=String(k).split('-'); return (+p[1])+'/'+(+p[2]); }
  function addD(d,n){ var x=new Date(d); x.setDate(x.getDate()+n); return x; }
  function days(a,b){ return Math.round((b-a)/864e5); }
  function sg(n){ return (n>0?'+':(n<0?'−':'±'))+Math.abs(n); }
  function hm(t){ var d=new Date(t); return d.getHours()+':'+('0'+d.getMinutes()).slice(-2); }

  var CSS='.ds-head{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:6px}'
    +'.ds-nav{display:inline-flex;align-items:center;gap:8px}'
    +'.ds-nav b{font-size:15px;color:var(--ink,#131C26)}'
    +'.ds-nav button,.ds-copy{font:inherit;border:1px solid var(--rule,#D6E0E8);background:var(--card,#fff);color:var(--ink,#131C26);border-radius:999px;cursor:pointer}'
    +'.ds-nav button{width:32px;height:30px;padding:0}'
    +'.ds-nav button:disabled{opacity:.35;cursor:default}'
    +'.ds-copy{font-size:12.5px;padding:4px 12px}'
    +'.ds-one{font-size:14px;line-height:1.6;margin:4px 0 8px;color:var(--ink,#131C26)}'
    +'.ds-kpi{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin:6px 0 8px}'
    +'@media (max-width:420px){.ds-kpi{grid-template-columns:repeat(2,minmax(0,1fr))}}'
    +'.ds-kpi div{background:var(--paper,#EEF5FA);border-radius:10px;padding:7px 8px;min-width:0}'
    +'.ds-kpi b{display:block;font-family:"IBM Plex Mono",monospace;font-size:19px;line-height:1.25;color:var(--ink,#131C26)}'
    +'.ds-kpi small{font-size:11.5px;color:var(--ink-faint,#6B7782)}'
    +'.ds-sub{font-size:12.5px;color:var(--ink-faint,#6B7782);margin:10px 0 3px;font-weight:600}'
    +'.ds-ul{list-style:none;margin:0;padding:0}'
    +'.ds-ul li{display:grid;grid-template-columns:20px minmax(0,1fr);gap:0 4px;padding:3px 0;font-size:13px;overflow-wrap:anywhere}'
    +'.ds-ul small{display:block;font-size:11.5px;color:var(--ink-faint,#6B7782)}'
    +'.ds-ok{color:var(--ok,var(--cap,#0D7F63))}.ds-bad{color:var(--bad,var(--rest,#B83227))}.ds-wait{color:var(--sky,#1C7EBB)}'
    +'.ds-p{font-size:13px;margin:2px 0;overflow-wrap:anywhere}'
    +'.ds-note{font-size:12px;color:var(--ink-faint,#6B7782);margin:6px 0 0}'
    +'.ds-more{margin:2px 0}.ds-more summary{cursor:pointer;font-size:12.5px;color:var(--sky,#1C7EBB)}';
  function injectCss(){ if(document.getElementById('ds-css')) return; var s=document.createElement('style'); s.id='ds-css'; s.textContent=CSS; document.head.appendChild(s); }

  // 番茄鐘每天幾分鐘
  function pomoMap(P){ var m={}; (Array.isArray(P.pomo.log)?P.pomo.log:[]).forEach(function(e){ if(e&&e.k) m[e.k]=(m[e.k]||0)+(+e.m||25); }); return m; }
  // 讀書分＝表定（做完的任務分鐘＋錯字本）＋番茄鐘×1.5：跟 casino.js 的押注上限同一套（11-18）
  function scorePast(P,pm,k){ var e=P.hist[k]||{}; return (+e.m||0)+Math.round((+(P.vrev||{})[k]||0)/60)+1.5*(pm[k]||0); }
  // 保底＝那個月 1 號到前一天每天讀書分的平均（沒讀的日子算 0）；1 號用上個月整月
  function floorOf(P,pm,k){
    var D=pk(k), y=D.getFullYear(), mo=D.getMonth(), n=D.getDate()-1, sum=0, i;
    if(n<1){ var last=new Date(y,mo,0); n=last.getDate(); y=last.getFullYear(); mo=last.getMonth(); }
    for(i=1;i<=n;i++) sum+=scorePast(P,pm,key(new Date(y,mo,i)));
    return Math.round(sum/n);
  }
  function casinoDay(V,k){
    var t0=pk(k).getTime(), t1=addD(pk(k),1).getTime(), r={g:0,ok:0,n:0,net:{pts:0,chip:0,star:0}};
    (Array.isArray(V.log)?V.log:[]).forEach(function(l){ if(!l||!(l.t>=t0&&l.t<t1)) return;
      r.g++; r.ok+=+l.r||0; r.n+=+l.n||0; var c=CURU[l.c]?l.c:'pts'; r.net[c]+=l.single?(+l.p||0):(+l.p||0)-(+l.b||0); });
    return r;
  }

  // 整理一天：回傳 {html, text}
  function build(o,k,opts){
    var DC=window.DayChart, P=DC.parse(o), today=d0(), tk=key(today), isT=(k===tk);
    var x=DC.dayInfo(P,k,today,opts.plan||window.PLAN||null), pm=pomoMap(P);
    var sch=x.taskM||0, pomoM=x.pomoM||0, score=Math.round(sch+1.5*pomoM), fl=floorOf(P,pm,k);
    var vr=Math.round((+(P.vrev||{})[k]||0)/60);
    var V=J(o,'plan.vocab.v1',{})||{}, cz=casinoDay(V,k);
    var he=P.hist[k]||{}, jr=(J(o,'plan.journal.v1',{})||{})[k]||null;
    var items=(P.C&&P.C.items)||{}, pend=isT?Object.keys(items).map(function(i){ return items[i]; }).filter(function(it){ return it&&it.st!=='pass'&&it.k!==k; }):[];
    var by={}; x.pomo.forEach(function(p){ var s=(DC.POMO_SUBJ||{})[p.s]||'沒選科目'; by[s]=(by[s]||0)+(+p.m||25); });
    var bys=Object.keys(by).sort(function(a,b){ return by[b]-by[a]; });
    var T=[], h='';   // T：純文字版（複製用）

    // 一句話
    var one=[];
    if(x.a) one.push('完成 '+x.dn+'／'+x.a+' 項任務（'+x.pct+'%）');
    if(score||fl) one.push('讀書分 '+score+(fl?'（這個月平均 '+fl+'，'+(score>=fl?'多 '+(score-fl):'少 '+(fl-score))+'）':''));
    if(x.pomo.length) one.push('番茄鐘 '+x.pomo.length+' 個 '+pomoM+' 分鐘'+(bys.length?'，最多的是'+bys[0]:''));
    if(cz.g) one.push('單字賭場 '+cz.g+' 局');
    var oneS=one.length?one.join('；')+'。':(x.has?'這天有排任務，但還沒有做完的紀錄。':'這天沒有紀錄。');
    if(isT) oneS+='（今天還沒結束，數字會繼續變）';
    h+='<p class="ds-one">'+esc(oneS)+'</p>';
    T.push(md(k)+'（週'+WD[pk(k).getDay()]+'）摘要', oneS);

    h+='<div class="ds-kpi"><div><b>'+(x.pct==null?'—':x.pct+'%')+'</b><small>任務 '+x.dn+'／'+x.a+' 項</small></div>'
      +'<div><b>'+score+'</b><small>讀書分（平均 '+fl+'）</small></div>'
      +'<div><b>'+x.pomo.length+'</b><small>番茄鐘 '+pomoM+' 分</small></div>'
      +'<div><b>'+(x.ptsKnown||!x.has?sg(x.plus-x.minus):'—')+'</b><small>點數</small></div></div>';
    h+='<p class="ds-note" style="margin-top:0">讀書分＝表定 '+sch+' 分鐘'+(vr?'（含錯字本 '+vr+' 分）':'')+'＋番茄鐘 '+pomoM+'×1.5；賭場一次最多押「平均＋今天的讀書分」。</p>';
    T.push('讀書分 '+score+'＝表定 '+sch+'＋番茄鐘 '+pomoM+'×1.5（這個月平均 '+fl+'）');

    function list(title,arr,cls,mark,limit){
      if(!arr.length) return '';
      var li=function(a){ return '<li><span class="'+cls+'">'+mark+'</span><span>'+a+'</span></li>'; };
      var s='<div class="ds-sub">'+title+'</div><ul class="ds-ul">'+arr.slice(0,limit).map(li).join('')+'</ul>';
      if(arr.length>limit) s+='<details class="ds-more"><summary>還有 '+(arr.length-limit)+' 項</summary><ul class="ds-ul">'+arr.slice(limit).map(li).join('')+'</ul></details>';
      return s;
    }
    if(x.done.length){ h+=list('✅ 做完的（'+x.done.length+'）',x.done.map(function(t){ return esc(t.n); }),'ds-ok','●',6); T.push('做完：'+x.done.map(function(t){ return t.n; }).join('、')); }
    if(x.undone.length){ h+=list('⏳ 沒做完的（'+x.undone.length+'）'+(x.guess?'（照排程推算）':''),x.undone.map(function(t){ return esc(t.n); }),'ds-bad','●',6); T.push('沒做完：'+x.undone.map(function(t){ return t.n; }).join('、')); }

    if(x.pomo.length){
      h+='<div class="ds-sub">🍅 番茄鐘</div><p class="ds-p">'+bys.map(function(s){ return esc(s)+' '+by[s]+' 分'; }).join('・')+'</p>';
      var notes=x.pomo.filter(function(p){ return p.n; }).sort(function(a,b){ return (a.t||0)-(b.t||0); });
      if(notes.length) h+='<ul class="ds-ul">'+notes.map(function(p){ return '<li><span>📝</span><span>'+(p.t?hm(p.t)+' ':'')+esc((DC.POMO_SUBJ||{})[p.s]||'')+(p.s?'：':'')+esc(p.n)+'</span></li>'; }).join('')+'</ul>';
      T.push('番茄鐘：'+bys.map(function(s){ return s+' '+by[s]+' 分'; }).join('、'));
      notes.forEach(function(p){ T.push('　'+(p.t?hm(p.t)+' ':'')+p.n); });
    }

    var ck=x.checks.map(function(it){
      if(it.st==='pass') return {c:'ds-ok', s:esc(it.n)+'<small>過關（'+esc(it.g||'')+'）</small>', t:it.n+' 過關'+(it.g?'（'+it.g+'）':'')};
      var left=CHECK_DAYS+(+it.ext||0)-days(pk(it.k),today), dly=it.ls&&it.ext&&days(pk(it.ls),today)+1<=(+it.xpd||0), fr=it.ls?md(key(addD(pk(it.ls),(+it.xpd||0)-1))):'';
      if(dly) return {c:'ds-wait', s:esc(it.n)+'<small>延後到 '+fr+' 前交・已扣 '+(it.pt||0)+' 點</small>', t:it.n+' 延後到 '+fr};
      return {c:left>=0&&!it.ls?'ds-wait':'ds-bad', s:esc(it.n)+'<small>'+(it.ls?'逾期・已扣 '+(it.pt||0)+' 點':(left>0?'等檢查，還有 '+left+' 天':(left===0?'等檢查，今天最後一天':'超過期限')))+'</small>', t:it.n+' 等檢查'};
    });
    pend.forEach(function(it){ var late=(it.ls?days(pk(it.ls),today)+1>(it.ext?(+it.xpd||0):0):false)||(!it.ls&&CHECK_DAYS+(+it.ext||0)-days(pk(it.k),today)<0);   // 11-20：延後中（還沒扣到新的一天）不算逾期
      ck.push({c:late?'ds-bad':'ds-wait', s:esc(it.n)+'<small>'+md(it.k)+' 的'+(late?'，逾期'+(it.pt?'・已扣 '+it.pt+' 點':''):(it.ext?'，延後到 '+(it.ls?md(key(addD(pk(it.ls),(+it.xpd||0)-1))):md(key(addD(pk(it.k),CHECK_DAYS+(+it.ext||0)))))+' 前交':'，還沒交'))+(it.st==='dead'?'（樹苗枯了，還是要交）':'')+'</small>', t:md(it.k)+' '+it.n+(late?' 逾期':' 還沒交')}); });
    if(ck.length){
      h+='<div class="ds-sub">🔍 給 Claude 檢查</div><ul class="ds-ul">'+ck.map(function(c){ return '<li><span class="'+c.c+'">●</span><span>'+c.s+'</span></li>'; }).join('')+'</ul>';
      T.push('給 Claude 檢查：'+ck.map(function(c){ return c.t; }).join('；'));
    }

    var par=(x.parent||[]).filter(function(l){ return l.kind==='pts'&&l.n>0; }).reduce(function(a,l){ return a+l.n; },0);
    if(x.plus||x.minus||par){
      var ps=(x.ptsKnown?'賺 '+x.plus+'、花 '+x.minus+' 點':'點數紀錄太舊，看不到')+(par?'（爸媽加 '+par+' 點）':'');
      h+='<div class="ds-sub">💰 點數</div><p class="ds-p">'+esc(ps)+'</p>'; T.push('點數：'+ps);
    }
    if(cz.g){
      var net=Object.keys(cz.net).filter(function(c){ return cz.net[c]; }).map(function(c){ return sg(cz.net[c])+' '+CURU[c]; }).join('、')||'不輸不贏';
      var cs=cz.g+' 局，答對 '+cz.ok+'／'+cz.n+' 題'+(cz.n?'（'+Math.round(cz.ok/cz.n*100)+'%）':'')+'，淨 '+net;
      h+='<div class="ds-sub">🎰 單字賭場</div><p class="ds-p">'+esc(cs)+'</p>'; T.push('單字賭場：'+cs);
    }
    if(vr){ h+='<div class="ds-sub">📖 錯字本</div><p class="ds-p">複習 '+vr+' 分鐘（算英文讀書時間）</p>'; T.push('錯字本：'+vr+' 分鐘'); }

    // 11-19：每天 21:00 吃藥（plan.pomo.v1 的 med.log＝{日期:按「吃了」的時間}；11/19 以前沒有這個功能就不寫）
    var mlog=((P.pomo&&P.pomo.med)||{}).log||{}, mt=+mlog[k]||0;
    if(pk(k)>=new Date(2026,10,19)){
      var ms=mt?'吃了 ✓（'+hm(mt)+'）':(isT&&new Date().getHours()<21?'今晚 21:00 要吃':'沒有按「吃了」');
      h+='<div class="ds-sub">💊 吃藥</div><p class="ds-p'+(!mt&&!(isT&&new Date().getHours()<21)?' ds-bad':'')+'">'+esc(ms)+'</p>'; T.push('吃藥：'+ms);
    }
    if(isT){
      var pet=(J(o,'plan.pet.v1',{})||{}).pet;
      if(pet&&pet.name){
        var pe=esc(pet.name)+'：'+(pet.trip?'出門旅行中':'飽足 '+Math.round(pet.hunger||0)+'、心情 '+Math.round(pet.mood||0))+(pet.sick?'，生病了，要照顧':'');
        h+='<div class="ds-sub">🐾 寵物</div><p class="ds-p">'+pe+'</p>'; T.push('寵物：'+pe.replace(/&[a-z#0-9]+;/g,''));
      }
    }
    if(!opts.parent){
      var mo=he.mood?MOOD[he.mood-1]:'', en=he.energy?ENER[he.energy-1]:'';
      if(mo||en||jr){
        h+='<div class="ds-sub">📝 心情和日誌</div>';
        if(mo||en){ var me=(mo?'心情 '+mo:'')+(mo&&en?'、':'')+(en?'體力 '+en:''); h+='<p class="ds-p">'+me+'</p>'; T.push(me); }
        if(jr){
          if(jr.w){ h+='<p class="ds-p">最有進展：'+esc(jr.w)+'</p>'; T.push('最有進展：'+jr.w); }
          if(jr.s){ h+='<p class="ds-p">卡住：'+esc(jr.s)+'</p>'; T.push('卡住：'+jr.s); }
          if(jr.n){ h+='<p class="ds-p">明天第一件事：'+esc(jr.n)+'</p>'; T.push('明天第一件事：'+jr.n); }
        }
      } else if(isT) h+='<p class="ds-note">今天的心情、體力和日誌還沒填（在下面）。</p>';
    }
    return {html:h, text:T.join('\n')};
  }

  function mount(el,opts){
    injectCss(); opts=opts||{};
    var off=0, lastText='', sig='';
    function render(force){
      var o={}; try{ o=opts.get()||{}; }catch(e){}
      var k=key(addD(d0(),-off)), s2=k+'|'+off+'|'+JSON.stringify(o).length;   // 資料長度＋日期都沒變就不重畫
      if(!force && s2===sig) return; sig=s2;
      var r; try{ r=build(o,k,opts); }catch(e){ r={html:'<p class="ds-note">摘要算不出來：'+esc(e.message)+'</p>', text:''}; }
      lastText=r.text;
      el.innerHTML='<div class="ds-head"><div class="ds-nav"><button type="button" data-ds="1" aria-label="前一天"'+(off>=BACK?' disabled':'')+'>‹</button>'
        +'<b>'+(off?md(k):'今天 '+md(k))+'（週'+WD[pk(k).getDay()]+'）</b>'
        +'<button type="button" data-ds="-1" aria-label="後一天"'+(off?'':' disabled')+'>›</button></div>'
        +'<button type="button" class="ds-copy" data-ds-copy="1">複製文字</button></div>'+r.html;
    }
    el.addEventListener('click',function(e){
      var b=e.target.closest('button'); if(!b||!el.contains(b)) return;
      if(b.dataset.ds){ off=Math.max(0,Math.min(BACK,off+(+b.dataset.ds))); render(true); return; }
      if(b.dataset.dsCopy){
        var done=function(ok){ b.textContent=ok?'複製好了 ✓':'複製不了'; setTimeout(function(){ if(b.isConnected) b.textContent='複製文字'; },2000); };
        if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(lastText).then(function(){ done(true); },function(){ done(false); });
        else done(false);
      }
    });
    render(true);
    return {refresh:function(){ render(false); }, text:function(){ return lastText; }};
  }

  window.DaySum={mount:mount, build:build};
})();
