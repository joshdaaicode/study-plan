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

  function parse(s){ if(s===undefined) return {v:undefined}; try{ return {v:JSON.parse(s)}; }catch(e){ return {raw:true, v:s}; } }

  /* 合併三份備份資料（key → localStorage 存的字串）
   *   b：上次同步的那一版　l：這台現在　r：雲端現在
   *   opt.keys：key 的順序；opt.lt／opt.rt：這台／雲端每個 key 最後修改的時間（毫秒）
   * 回傳 {doc, n:各種處理的次數, log:前 40 筆兩邊都改的地方, keys:兩邊都改過的 key} */
  function merge(b,l,r,opt){
    opt=opt||{}; b=b||{}; l=l||{}; r=r||{};
    var cx={lt:opt.lt||{}, rt:opt.rt||{}, n:{}, log:[]}, out={}, order=[], seen={}, both=[];
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

  var api={merge:merge, docEq:docEq, deepEq:deepEq, ruleOf:ruleOf};
  if(typeof module!=='undefined' && module.exports) module.exports=api;
  else root.__SyncMerge=api;
})(typeof window!=='undefined'?window:this);
