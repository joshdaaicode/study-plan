/* 雲端同步的「三方合併」（2026-11-21，使用者：「手機和筆電都會用，研究一下同步到底該怎麼寫」）
 *
 * 以前：兩台都改過就停下來，要你自己選「用雲端的」或「用這台的」——選哪一邊，另一邊這段時間做的就不見了。
 * 現在：每台都記得「上次同步的那一版」（base，叫共同祖先）。雲端有別台的新資料時，拿三份來比：
 *   - 只有一邊改的地方 → 用改過的那邊
 *   - 兩邊改成一樣 → 就是那樣
 *   - 兩邊都改、改得不一樣 → 照資料的種類決定（下面的規則），不是整份二選一
 * 這個檔只有純計算（不碰 localStorage、不連網路），index.html 的雲端同步那段叫它；Node 也能直接 require 來測。
 *
 * 規則（路徑用「/」分層，* 是任何一層）：
 *   加總：點數、籌碼、碎片、扭蛋券、收藏數量、存款……兩邊各自加減的都算進去（base + 這台的變化 + 雲端的變化）
 *   取大：名字是 max… 或 …Max 的（最高紀錄）
 *   過關優先：檢查的狀態有一邊是「過關」就是過關
 *   整天一起：每日紀錄（plan.hist.v1 的一天）是從當天勾選算出來的，挑勾比較多的那份，不拆開拼
 *   整包一起：番茄鐘的計時狀態、配色、單字的熟練度那幾個數字——拆開拼會變成兩邊都不是的怪組合，整包用比較晚改的那邊
 *   其他：比較晚改的那邊（每個 key 記最後修改時間）
 * 陣列：有不重複 id（或 k）的照 id 一筆一筆合併；全是數字、長度一樣的照位置合併；其他當清單：兩邊新加的都留、
 *   任一邊刪掉的就刪（同一筆兩邊都新增只留一筆），有時間 t 的照時間排回去；本來就滿了（三份一樣長）的照原長度截掉最舊的。
 */
(function(root){
  'use strict';
  var COUNT=[
    'plan.shop.v1/pts','plan.shop.v1/gc/sh','plan.shop.v1/gc/n','plan.shop.v1/gc/spent','plan.shop.v1/gc/tk','plan.shop.v1/gc/gtk','plan.shop.v1/gc/own/*',
    'plan.shop.v1/cl/n','plan.shop.v1/cl/win','plan.shop.v1/cl/spent','plan.shop.v1/cl/own/*','plan.shop.v1/cl/ex/*',
    'plan.vocab.v1/chips','plan.vocab.v1/k/*','plan.vocab.v1/k/net/*',
    'plan.bank.v1/sav','plan.bank.v1/st/*','plan.bank.v1/stk/*/sh','plan.bank.v1/stk/*/cost',
    'plan.pet.v1/gold','plan.pet.v1/clover','plan.pet.v1/bonusFood','plan.pet.v1/tickets','plan.pet.v1/bentos','plan.pet.v1/heals',
    'plan.pet.v1/trips','plan.pet.v1/charmsUsed','plan.pet.v1/souv/*','plan.pet.v1/trs/*',
    'plan.pomo.v1/total'
  ].map(function(s){ return s.split('/'); });
  var ATOM=['plan.pomo.v1/run','plan.theme.v1','plan.a11y.v1','plan.vocab.v1/ws/*','plan.vocab.v1/cur'].map(function(s){ return s.split('/'); });
  var BETTER=[['plan.hist.v1','*']];
  var STATUS=[['plan.checks.v1','items','*','st']];

  function hit(list,P){
    for(var i=0;i<list.length;i++){ var p=list[i]; if(p.length!==P.length) continue;
      var ok=true; for(var j=0;j<p.length;j++){ if(p[j]!=='*' && p[j]!==String(P[j])){ ok=false; break; } }
      if(ok) return true; }
    return false;
  }
  function ruleOf(P){
    var last=String(P[P.length-1]);
    if(/^max|Max$/.test(last)) return 'max';
    if(hit(ATOM,P)) return 'atom';
    if(hit(BETTER,P)) return 'better';
    if(hit(STATUS,P)) return 'status';
    if(hit(COUNT,P)) return 'count';
    return '';
  }

  var has=function(o,k){ return Object.prototype.hasOwnProperty.call(o,k); };
  function isObj(x){ return x!==null && typeof x==='object' && !Array.isArray(x); }
  function deepEq(a,b){
    if(a===b) return true;
    if(typeof a!==typeof b || a===null || b===null || typeof a!=='object') return a!==a && b!==b;   // NaN
    if(Array.isArray(a)){ if(!Array.isArray(b) || a.length!==b.length) return false; for(var i=0;i<a.length;i++) if(!deepEq(a[i],b[i])) return false; return true; }
    if(Array.isArray(b)) return false;
    var ka=Object.keys(a), kb=Object.keys(b); if(ka.length!==kb.length) return false;
    for(var j=0;j<ka.length;j++){ if(!has(b,ka[j]) || !deepEq(a[ka[j]],b[ka[j]])) return false; }
    return true;
  }

  function note(cx,kind,P,l,r,v){
    cx.n[kind]=(cx.n[kind]||0)+1;
    if(cx.log.length<40) cx.log.push({k:kind, p:P.join('/'), l:short(l), r:short(r), v:short(v)});
  }
  function short(v){ var s; try{ s=JSON.stringify(v); }catch(e){ s=String(v); } return s===undefined?'(沒有)':(s.length>60?s.slice(0,57)+'…':s); }
  // 兩邊都改、改得不一樣：比較晚改的那邊（同時間就用這台的）
  function lww(l,r,P,cx){ var t=String(P[0]), tl=+cx.lt[t]||0, tr=+cx.rt[t]||0, v=tr>tl?r:l; note(cx,'late',P,l,r,v); return v; }

  function m3(b,l,r,P,cx){
    if(deepEq(l,r)) return l;
    if(deepEq(b,l)) return r;   // 只有雲端改
    if(deepEq(b,r)) return l;   // 只有這台改
    // 兩邊都改了
    if(l===undefined || r===undefined){ var e=l===undefined?r:l; note(cx,'keep',P,l,r,e); return e; }   // 一邊刪、一邊改：留改的
    var rule=ruleOf(P);
    if(rule==='atom') return lww(l,r,P,cx);
    if(rule==='better' && isObj(l) && isObj(r)){
      var dl=+l.d||0, dr=+r.d||0, ml=+l.m||0, mr=+r.m||0;
      if(dl!==dr || ml!==mr){ var bv=(dl>dr || (dl===dr && ml>mr))?l:r; note(cx,'more',P,l,r,bv); return bv; }
      return lww(l,r,P,cx);
    }
    if(isObj(l) && isObj(r)) return mObj(isObj(b)?b:{},l,r,P,cx);
    if(Array.isArray(l) && Array.isArray(r)) return mArr(Array.isArray(b)?b:[],l,r,P,cx);
    if(typeof l==='number' && typeof r==='number'){
      if(rule==='max'){ var mx=Math.max(l,r); note(cx,'max',P,l,r,mx); return mx; }
      if(rule==='count'){ var bn=typeof b==='number'?b:0, sum=l+r-bn; note(cx,'sum',P,l,r,sum); return sum; }
    }
    if(rule==='status' && (l==='pass' || r==='pass')){ note(cx,'pass',P,l,r,'pass'); return 'pass'; }
    return lww(l,r,P,cx);
  }

  function mObj(b,l,r,P,cx){
    var out={}, k, v;
    for(k in l){ if(!has(l,k)) continue;
      v=m3(has(b,k)?b[k]:undefined, l[k], has(r,k)?r[k]:undefined, P.concat(k), cx);
      if(v!==undefined) out[k]=v; }
    for(k in r){ if(!has(r,k) || has(l,k)) continue;
      v=m3(has(b,k)?b[k]:undefined, undefined, r[k], P.concat(k), cx);
      if(v!==undefined) out[k]=v; }
    return out;
  }

  function idKey(arrs){
    var cands=['id','k'];
    for(var c=0;c<cands.length;c++){
      var f=cands[c], ok=true, any=false;
      for(var a=0;a<arrs.length && ok;a++){
        var seen={};
        for(var i=0;i<arrs[a].length;i++){
          var x=arrs[a][i];
          if(!isObj(x) || (typeof x[f]!=='string' && typeof x[f]!=='number')){ ok=false; break; }
          var key=typeof x[f]+':'+x[f]; if(seen[key]){ ok=false; break; } seen[key]=1; any=true;
        }
      }
      if(ok && any) return f;
    }
    return '';
  }
  function allNum(a){ for(var i=0;i<a.length;i++) if(typeof a[i]!=='number') return false; return true; }

  function mArr(b,l,r,P,cx){
    var f=idKey([b,l,r]);
    if(f) return mKeyed(b,l,r,f,P,cx);
    if(b.length && b.length===l.length && l.length===r.length && allNum(b) && allNum(l) && allNum(r)){
      var o=[]; for(var i=0;i<l.length;i++) o.push(m3(b[i],l[i],r[i],P.concat(i),cx)); return o;
    }
    return mSeq(b,l,r,cx,P);
  }

  function mKeyed(b,l,r,f,P,cx){
    function ix(a){ var m={}; a.forEach(function(x){ m[typeof x[f]+':'+x[f]]=x; }); return m; }
    function kof(x){ return typeof x[f]+':'+x[f]; }
    var B=ix(b), L=ix(l), out=[], seen={}, Q=P.concat('[]');
    r.forEach(function(x){ var k=kof(x); seen[k]=1; var v=m3(B[k],L[k],x,Q,cx); if(v!==undefined) out.push(v); });
    var prev=null;
    l.forEach(function(x){
      var k=kof(x), at;
      if(!seen[k]){
        var v=m3(B[k],x,undefined,Q,cx); if(v===undefined) return;
        if(prev===null) at=0; else { at=0; for(var i=0;i<out.length;i++) if(kof(out[i])===prev){ at=i+1; break; } }
        out.splice(at,0,v); prev=k;
      } else {
        for(var j=0;j<out.length;j++) if(kof(out[j])===k){ prev=k; break; }
      }
    });
    return out;
  }

  function mSeq(b,l,r,cx,P){
    var J=function(x){ return JSON.stringify(x); };
    function cnt(a){ var m={}; a.forEach(function(x){ var k=J(x); m[k]=(m[k]||0)+1; }); return m; }
    var cb=cnt(b), cL=cnt(l), cR=cnt(r), fin={}, all={};
    [cb,cL,cR].forEach(function(m){ Object.keys(m).forEach(function(k){ all[k]=1; }); });
    Object.keys(all).forEach(function(k){
      var B=cb[k]||0, dl=(cL[k]||0)-B, dr=(cR[k]||0)-B, x;
      if(dl>=0 && dr>=0) x=B+Math.max(dl,dr);        // 兩邊新加的都留（同一筆兩邊都加只算一次）
      else if(dl<=0 && dr<=0) x=B+Math.min(dl,dr);   // 任一邊刪掉的就刪
      else x=B+dl+dr;
      fin[k]=Math.max(0,x);
    });
    var out=[], used={}, keys=[];
    r.forEach(function(x){ var k=J(x); if((used[k]||0)<fin[k]){ out.push(x); keys.push(k); used[k]=(used[k]||0)+1; } });
    var pos=-1;   // 這台新加的放在它在這台前一筆的後面
    l.forEach(function(x){
      var k=J(x);
      if((used[k]||0)<fin[k]){ out.splice(pos+1,0,x); keys.splice(pos+1,0,k); used[k]=(used[k]||0)+1; pos++; }
      else { var p=keys.indexOf(k,pos+1); if(p>=0) pos=p; }
    });
    // 有時間（t）的清單照時間排回去：方向照雲端那份（只有一筆就看這台的）
    var dir=0, ref=r.length>1?r:l;
    if(out.length>1 && out.every(function(x){ return isObj(x) && typeof x.t==='number'; }) && ref.length>1 && ref.every(function(x){ return isObj(x) && typeof x.t==='number'; })){
      var up=true, dn=true; for(var i=1;i<ref.length;i++){ if(ref[i].t<ref[i-1].t) up=false; if(ref[i].t>ref[i-1].t) dn=false; }
      dir=dn&&!up?-1:(up&&!dn?1:0);
      if(dir){ var idx=out.map(function(x,i){ return [x,i]; }); idx.sort(function(a,c){ return dir*(a[0].t-c[0].t) || a[1]-c[1]; }); out=idx.map(function(a){ return a[0]; }); }
    }
    // 本來就滿了（三份一樣長、像最多 200 筆的點數紀錄）：照原長度截掉最舊的
    if(b.length && b.length===l.length && l.length===r.length && out.length>b.length){
      out=dir===1?out.slice(out.length-b.length):out.slice(0,b.length);
    }
    if(out.length!==r.length || !deepEq(out,r)) note(cx,'list',P,l.length,r.length,out.length);
    return out;
  }

  /* ---- 11-28 加的三個保險（設計：同步設計_v2.md）----
   * 起因：一台資料停在 6 天前的裝置，開頁時沒連上雲端就照舊資料結算（寵物離家、樹枯、保管費、重複扣點），
   * 之後合併時「比較晚改的那邊」＋「點數相加」把錯的結果蓋進雲端。index.html 那邊改成「先對過雲端才結算」；
   * 這裡是萬一還是發生時的保險。 */
  function dayN(k){ var p=String(k||'').split('-'); return p.length===3?(+p[0])*10000+(+p[1])*100+(+p[2]):0; }   // 'YYYY-M-D' → 可以比大小的數字
  // 合併某個 key 時要看另一個 key（例如點數要看檢查紀錄）：從三份原始資料裡解出來（解過的記住）
  function side(cx,s,key){
    var c=cx.pj[s]||(cx.pj[s]={}); if(has(c,key)) return c[key];
    var raw=cx.raw[s]&&cx.raw[s][key], v=null; try{ v=raw==null?null:JSON.parse(raw); }catch(e){}
    return (c[key]=v);
  }

  // (1) 自動效果的編號帳（ad：編號 → 這筆讓點數／存款加減多少）。兩邊都新記了同一個編號＝同一件事算了兩次：
  //     只留雲端那筆，這台那筆的加減扣回來、紀錄拿掉。只有一邊有的照留（真的是新的）。
  var EFFECT={'plan.shop.v1':'pts','plan.bank.v1':'sav'};
  function fixEffects(k,b,l,r,v,cx){
    var cnt=EFFECT[k]; if(!cnt || !isObj(v) || !isObj(l) || !isObj(r) || !isObj(l.ad)) return v;
    var B=(isObj(b)&&isObj(b.ad))?b.ad:{}, R=isObj(r.ad)?r.ad:{}, drop={}, nd=0, dup=0, dInt=0, dFee=0;
    var arr=function(o,f){ return (isObj(o)&&Array.isArray(o[f]))?o[f]:[]; };
    // 過渡期：雲端那份是舊版網站寫的（還沒有編號帳）。看雲端在「共同祖先之後」是不是已經做過同一件事，做過的話這台那筆是重複的。
    //   回傳這台那筆裡有多少是重複的（0＝不是重複）
    function legacyDup(a,dl){
      var m=a.match(/^d\|(.+)$/), f, id, done;
      if(k==='plan.bank.v1'){
        if(m) return (dayN(r.last)>=dayN(m[1]) && !(isObj(b) && dayN(b.last)>=dayN(m[1])))?dl:0;   // 雲端已經結算過那一天
        m=a.match(/^([fo])\|(.+)$/); if(!m) return 0;
        f=m[1]==='f'?'fixed':'bonds'; id=m[2];
        done=function(o){ return arr(o,f).some(function(x){ return isObj(x) && x.id===id && x.st && x.st!=='open'; }); };
        return (done(r) && !done(b))?dl:0;                                                        // 雲端已經付過那筆定存
      }
      if(k!=='plan.shop.v1') return 0;
      if((m=a.match(/^p\|(.+)$/))){   // 逾期扣點：雲端那份檢查在共同祖先之後已經扣了多少（pt＝累計扣的點）
        var pt=function(s){ var C=side(cx,s,'plan.checks.v1'), it=C&&isObj(C.items)&&C.items[m[1]]; return isObj(it)?(+it.pt||0):0; };
        var got=Math.max(0,pt('r')-pt('b'));
        return dl<0?-Math.min(-dl,got):0;
      }
      if((m=a.match(/^a\|(.+)\|(\d+)$/))){   // 領成就：雲端在共同祖先之後已經領到這一級
        var c=function(s){ var A=side(cx,s,'plan.ach.v1'); return (A&&isObj(A.c))?(+A.c[m[1]]||0):0; };
        return (c('r')>=+m[2] && c('b')<+m[2])?dl:0;
      }
      return 0;
    }
    Object.keys(l.ad).forEach(function(a){
      var bv=has(B,a)?(+B[a]||0):0, dl=(+l.ad[a]||0)-bv, dr=has(R,a)?(+R[a]||0)-bv:0;
      if(!dl) return;                                       // 這台這次沒動這筆
      var both=!!dr, lg=(!has(R,a))?legacyDup(a,dl):0;
      if(!both && !lg) return;                              // 只有這台有：真的是新的
      if(!both) dl=lg;                                      // 過渡期：只扣掉重複的那部分
      dup+=dl;
      if(!isObj(v.ad)) v.ad={};
      if(both) v.ad[a]=R[a]; else if(dl===(+l.ad[a]||0)-bv) delete v.ad[a]; else v.ad[a]=(+l.ad[a]||0)-dl;
      if(/^d\|/.test(a)){ if(dl>0) dInt+=dl; else dFee-=dl; }
      drop[a]=1; nd++; note(cx,'dup',[k,'ad',a],dl,dr,-dl);
    });
    if(!nd) return v;
    // 正確的總數＝共同祖先＋這台的變化＋雲端的變化－這台重複的那幾筆。
    // 不能直接拿合併結果去減：兩邊改成一樣的數字時，合併本來就只算一次（不會相加）。
    var num=function(o,f){ return isObj(o)?(+o[f]||0):0; };
    v[cnt]=num(l,cnt)+num(r,cnt)-num(b,cnt)-dup;
    if(isObj(v.st) && (dInt||dFee)){
      v.st.int=num(l.st,'int')+num(r.st,'int')-num(isObj(b)?b.st:null,'int')-dInt;
      v.st.fee=num(l.st,'fee')+num(r.st,'fee')-num(isObj(b)?b.st:null,'fee')-dFee;
    }
    if(k==='plan.bank.v1'){
      // 拿掉的是定存／考試定存到期：那筆的狀態（ok／bad、pay、違約）也用雲端的，到期次數統計扣回這台多算的
      var fixSt={fixOk:0,fixBad:0,bondWin:0,bondLose:0}, dayDrop=false;
      var byId=function(o,f,id){ return arr(o,f).filter(function(x){ return isObj(x) && x.id===id; })[0]; };
      Object.keys(drop).forEach(function(a){
        if(/^d\|/.test(a)){ dayDrop=true; return; }
        var m=a.match(/^([fo])\|(.+)$/); if(!m) return;
        var f=m[1]==='f'?'fixed':'bonds', id=m[2], re=byId(r,f,id), le=byId(l,f,id), be=byId(b,f,id);
        if(re && Array.isArray(v[f])) v[f]=v[f].map(function(x){ return (isObj(x) && x.id===id)?re:x; });
        if(le && le.st && le.st!=='open' && !(be && be.st && be.st!=='open'))
          fixSt[f==='fixed'?(le.st==='bad'?'fixBad':'fixOk'):(le.st==='win'?'bondWin':'bondLose')]++;
      });
      Object.keys(fixSt).forEach(function(sf){ if(fixSt[sf] && isObj(v.st)) v.st[sf]=num(l.st,sf)+num(r.st,sf)-num(isObj(b)?b.st:null,sf)-fixSt[sf]; });
      // 拿掉的有「某天的利息／保管費」＝這台那幾天是照舊資料算的：還沒到期的定存，「沒照顧天數」和違約也用雲端的
      if(dayDrop && Array.isArray(v.fixed)) v.fixed=v.fixed.map(function(x){
        var re=isObj(x)&&byId(r,'fixed',x.id); if(!re || x.st!=='open') return x;
        var y=Object.assign({},x); y.miss=re.miss||0; if(re.broke) y.broke=re.broke; else delete y.broke; return y; });
    }
    if(Array.isArray(v.log)){
      var keepJ={}; (Array.isArray(r.log)?r.log:[]).concat(isObj(b)&&Array.isArray(b.log)?b.log:[]).forEach(function(x){ keepJ[JSON.stringify(x)]=1; });
      v.log=v.log.filter(function(x){ return !(isObj(x) && x.a && drop[x.a] && !keepJ[JSON.stringify(x)]); });
    }
    return v;
  }
  // (2) 寵物：一邊「離家」（新的一筆離家紀錄、寵物是 null），另一邊同一隻還在、而且已經結算到離家那天或更晚
  //     ＝離家是用舊資料算的：留下還在的那隻，拿掉那筆離家紀錄；森林的枯樹也用還在那邊的（同一份舊資料算的）。
  function fixPet(b,l,r,v,cx){
    if(!isObj(v) || !isObj(l) || !isObj(r)) return v;
    var bg=(isObj(b)&&Array.isArray(b.gone))?b.gone:[];
    [[l,r],[r,l]].forEach(function(pr){
      var lost=pr[0], keep=pr[1], g=Array.isArray(lost.gone)&&lost.gone[0];
      if(lost.pet || !isObj(g) || !isObj(keep.pet)) return;
      if(bg.some(function(x){ return deepEq(x,g); })) return;                   // 不是這次才離家的
      var p=keep.pet; if(p.born!==g.born || p.name!==g.name) return;
      if(dayN(p.last)<dayN(g.left)) return;                                       // 還在的那邊還沒算到那天：離家可能是真的
      v.pet=p;
      v.gone=(Array.isArray(v.gone)?v.gone:[]).filter(function(x){ return !deepEq(x,g); });
      if(v.justLeft && v.justLeft===lost.justLeft) v.justLeft=keep.justLeft||'';
      ['dead','wilt','fLast'].forEach(function(f){ if(has(keep,f)) v[f]=keep[f]; });
      note(cx,'pet',['plan.pet.v1','pet'],null,p.name,p.name);
    });
    var arr=function(o,f){ return (isObj(o)&&Array.isArray(o[f]))?o[f]:[]; };
    // 森林：一邊新記了「某天沒照顧、樹枯萎」，另一邊已經算過那天卻沒枯（＝那天其實有照顧）→ 那天的枯萎、和這次跟著死的樹拿掉
    [[l,r],[r,l]].forEach(function(pr){
      var S=pr[0], O=pr[1]; if(!Array.isArray(v.wilt)) return;
      var bw=arr(b,'wilt'), ow=arr(O,'wilt');
      var bad=arr(S,'wilt').filter(function(w){ return isObj(w) && !bw.some(function(x){ return deepEq(x,w); })
        && dayN(O.fLast)>=dayN(w.d) && !ow.some(function(x){ return isObj(x) && x.d===w.d; }); });
      if(!bad.length) return;
      v.wilt=v.wilt.filter(function(w){ return !bad.some(function(x){ return deepEq(x,w); }); });
      var bd=arr(b,'dead'), od=arr(O,'dead'), nd=arr(S,'dead').filter(function(id){ return bd.indexOf(id)<0 && od.indexOf(id)<0; });
      if(nd.length) v.dead=arr(v,'dead').filter(function(id){ return nd.indexOf(id)<0; });
      note(cx,'forest',['plan.pet.v1','wilt'],bad.length,nd.length,0);
    });
    // 同一隻、兩邊都結算到同一天，「連續沒照顧幾天」卻不一樣：看到比較多照顧的那邊資料比較新（照顧的紀錄只會越來越多）
    if(isObj(v.pet) && isObj(l.pet) && isObj(r.pet) && l.pet.born===r.pet.born && l.pet.last===r.pet.last && (+l.pet.neglect||0)!==(+r.pet.neglect||0)){
      var good=(+l.pet.neglect||0)<(+r.pet.neglect||0)?l.pet:r.pet;
      ['neglect','sick','okRun'].forEach(function(f){ if(has(good,f)) v.pet[f]=good[f]; else delete v.pet[f]; });
      v.pet.bond=Math.max(+l.pet.bond||0,+r.pet.bond||0);
      note(cx,'pet',['plan.pet.v1','pet','neglect'],l.pet.neglect,r.pet.neglect,good.neglect);
    }
    return v;
  }
  // (3) 今天清單：兩邊的日期不同 → 用比較晚那天的清單（另一邊只是還沒換日）；
  //     同一天但欠帳是從不同天算來的（rf＝換日時的前一天）→ 用從比較晚那天算來的，兩邊的勾選照名稱留下。
  // 換日時是從哪天換過來的：有記 rf 就用；舊版網站沒記，就看那一份每日紀錄裡、今天以前最晚的一天（換日時會把前一天記進每日紀錄）
  function rfOf(S,s,cx){
    if(S.rf) return dayN(S.rf);
    var H=side(cx,s,'plan.hist.v1'), today=dayN(S.day), best=0;
    if(isObj(H)) Object.keys(H).forEach(function(k){ var n=dayN(k); if(n<today && n>best) best=n; });
    return best;
  }
  function fixState(b,l,r,v,cx){
    if(!isObj(v) || !isObj(l) || !isObj(r)) return v;
    var dl=dayN(l.day), dr=dayN(r.day), win=null;
    if(dl && dr && dl!==dr) win=dl>dr?l:r;
    else if(dl && dl===dr){ var fl=rfOf(l,'l',cx), fr=rfOf(r,'r',cx); if(fl!==fr) win=fl>fr?l:r; }
    if(!win) return v;
    var other=win===l?r:l, F=['day','rf','list','backlog','bonus','pv'];
    F.forEach(function(f){ if(has(win,f)) v[f]=win[f]; else delete v[f]; });
    if(!v.rf){ var wn=rfOf(win,win===l?'l':'r',cx); if(wn) v.rf=Math.floor(wn/10000)+'-'+Math.floor(wn/100)%100+'-'+wn%100; }
    var list=Array.isArray(v.list)?v.list:[], done={}, at={};
    if(dl===dr){   // 同一天：兩邊勾掉的都算（照名稱對，一個勾只還一項）
      var want={}, when={};
      [win,other].forEach(function(S){ var c={};
        (Array.isArray(S.list)?S.list:[]).forEach(function(x){ if(isObj(x) && S.done && S.done[x.id]){ c[x.n]=(c[x.n]||0)+1; if(S.doneAt&&S.doneAt[x.id]&&!when[x.n]) when[x.n]=S.doneAt[x.id]; } });
        Object.keys(c).forEach(function(n){ want[n]=Math.max(want[n]||0,c[n]); }); });
      list.forEach(function(x){ if(isObj(x) && want[x.n]>0){ want[x.n]--; done[x.id]=1; if(when[x.n]) at[x.id]=when[x.n]; } });
    } else { done=isObj(win.done)?win.done:{}; at=isObj(win.doneAt)?win.doneAt:{}; }
    v.done=done; v.doneAt=at;
    note(cx,'today',['plan.state.v3'],l.day+'/'+(l.rf||''),r.day+'/'+(r.rf||''),win.day+'/'+(win.rf||''));
    return v;
  }
  function fixKey(k,b,l,r,v,cx){
    if(EFFECT[k]) return fixEffects(k,b,l,r,v,cx);
    if(k==='plan.pet.v1') return fixPet(b,l,r,v,cx);
    if(k==='plan.state.v3') return fixState(b,l,r,v,cx);
    return v;
  }

  function parse(s){ if(s===undefined) return {v:undefined}; try{ return {v:JSON.parse(s)}; }catch(e){ return {raw:true, v:s}; } }

  /* 合併三份備份資料（key → localStorage 存的字串）
   *   b：上次同步的那一版　l：這台現在　r：雲端現在
   *   opt.keys：key 的順序；opt.lt／opt.rt：這台／雲端每個 key 最後修改的時間（毫秒）
   * 回傳 {doc, n:各種處理的次數, log:前 40 筆兩邊都改的地方, keys:兩邊都改過的 key} */
  function merge(b,l,r,opt){
    opt=opt||{}; b=b||{}; l=l||{}; r=r||{};
    var cx={lt:opt.lt||{}, rt:opt.rt||{}, n:{}, log:[], raw:{b:b,l:l,r:r}, pj:{}}, out={}, order=[], seen={}, both=[];
    (opt.keys||[]).concat(Object.keys(l),Object.keys(r),Object.keys(b)).forEach(function(k){ if(!seen[k]){ seen[k]=1; order.push(k); } });
    order.forEach(function(k){
      var sb=b[k], sl=l[k], sr=r[k];
      if(sl===sr){ if(sl!==undefined) out[k]=sl; return; }
      if(sb===sl){ if(sr!==undefined) out[k]=sr; return; }
      if(sb===sr){ if(sl!==undefined) out[k]=sl; return; }
      both.push(k);
      var pb=parse(sb), pl=parse(sl), pr=parse(sr), v;
      if(pb.raw || pl.raw || pr.raw){ v=lww(sl,sr,[k],cx); if(v!==undefined) out[k]=v; return; }
      v=m3(pb.v,pl.v,pr.v,[k],cx);
      v=fixKey(k,pb.v,pl.v,pr.v,v,cx);
      if(v===undefined) return;
      out[k]=deepEq(v,pl.v)?sl:(deepEq(v,pr.v)?sr:JSON.stringify(v));
    });
    return {doc:out, n:cx.n, log:cx.log, keys:both};
  }
  // 兩份備份資料一不一樣（只比內容，不管 key 的順序）
  function docEq(a,b){
    a=a||{}; b=b||{};
    var ka=Object.keys(a), kb=Object.keys(b); if(ka.length!==kb.length) return false;
    for(var i=0;i<ka.length;i++){ if(a[ka[i]]!==b[ka[i]]) return false; }
    return true;
  }

  var api={merge:merge, docEq:docEq, deepEq:deepEq, ruleOf:ruleOf, dayN:dayN};
  if(typeof module!=='undefined' && module.exports) module.exports=api;
  else root.__SyncMerge=api;
})(typeof window!=='undefined'?window:this);
