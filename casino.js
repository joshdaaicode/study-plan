/* ===== 單字賭場（2026-11-02；規則見 claude 科班\單字賭場_設計_20261101.md） =====
   只有打開「獎勵 → 單字賭場」才載入這個檔案和 vocab.js、toeic.js（多益 5 級，2026-11-03 加入），不拖慢網站。
   資料：plan.vocab.v1（籌碼、每個字的答對紀錄、錯字本、統計、設定）、plan.vrev.v1（每天錯字本複習秒數，算英文讀書分鐘）。
   寵物、銀行、點數都透過 index.html 給的 window.__petApi、window.__award、window.__pts。 */
(function(){
  'use strict';
  var API=window.__petApi||{};
  var app=document.getElementById('vc-app'); if(!app) return;
  var CSS='.vc-card{padding:0;overflow:hidden;--vc-g1:#0F5D3A;--vc-g2:#1B7F52;--vc-acc:#F2C230}'
    +'.vc-card.bg_neon{--vc-g1:#1A1340;--vc-g2:#5B1A7A;--vc-acc:#38E1FF}.vc-card.bg_royal{--vc-g1:#3B1F6B;--vc-g2:#6A3FB0;--vc-acc:#F2C230}.vc-card.bg_gold{--vc-g1:#5C3D08;--vc-g2:#A87A1C;--vc-acc:#FFF1B8}'
    +'.vc-body{padding:14px 18px 16px}'
    +'.vc-top{border-radius:14px;background:linear-gradient(135deg,var(--vc-g1),var(--vc-g2));color:#fff;margin-bottom:12px;overflow:hidden}'
    +'.vc-hero{display:flex;align-items:flex-end;justify-content:center;gap:4px;padding:8px 8px 0}.vc-banner{display:block;width:100%;max-width:330px;height:auto}'
    +'.vc-dealer{display:flex;flex-direction:column;align-items:center;flex:0 0 auto;padding-bottom:6px}.vc-dealer small{font-size:10.5px;opacity:.85;white-space:nowrap}'
    +'@keyframes vc-blink{0%,100%{fill:#FFF3B0}50%{fill:#E5484D}}.vc-bulb{fill:#FFF3B0;animation:vc-blink 1.4s infinite}'
    +'@keyframes vc-pull{35%{transform:translateY(26px)}100%{transform:none}}.vc-lever.pull{animation:vc-pull .7s ease}'
    +'@media (prefers-reduced-motion:reduce){.vc-bulb,.vc-lever.pull{animation:none}}html.no-motion .vc-bulb,html.no-motion .vc-lever.pull{animation:none}'
    +'.vc-ico{width:26px;height:26px;display:block}.vc-slotsvg{width:220px;max-width:80%;height:auto}.vc-resart{width:52px;height:52px;flex:0 0 52px}'
    +'.vc-tiles{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px;padding:10px 8px}'
    +'.vc-tiles div{text-align:center;min-width:0}.vc-tiles small{display:block;font-size:11px;opacity:.85}.vc-tiles b{display:block;font-family:"IBM Plex Mono",monospace;font-size:19px;line-height:1.3;color:var(--vc-acc)}.vc-tiles em{display:block;font-style:normal;font-size:10.5px;opacity:.8}'
    +'@media (max-width:480px){.vc-tiles{grid-template-columns:repeat(3,minmax(0,1fr))}.vc-body{padding:12px 12px 14px}}'
    +'.vc-row{margin:0 0 14px}.vc-row h4,.vc-list h4{margin:0 0 8px;font-size:13.5px}.vc-row h4 span,.vc-list h4 span{font-weight:400;font-size:12px;color:var(--ink-faint);margin-left:6px}'
    +'.vc-chips{display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:12.5px;color:var(--ink-soft)}'
    +'.vc-chips button{font:inherit;font-size:13px;padding:6px 11px;border:1px solid var(--rule);border-radius:999px;background:var(--card);color:var(--ink);cursor:pointer}'
    +'.vc-chips button small{color:var(--ink-faint);font-size:11px;margin-left:2px}.vc-chips button[aria-pressed="true"]{background:var(--ink);color:var(--card);border-color:var(--ink)}.vc-chips button[aria-pressed="true"] small{color:inherit;opacity:.75}'
    +'.vc-let button{min-width:34px;padding:5px 8px}.vc-more{margin:8px 0}.vc-more summary{cursor:pointer;font-size:12.5px;color:var(--ink-soft)}.vc-more .vc-chips{margin-top:8px}'
    +'.vc-sub{font-size:12.5px;color:var(--ink-soft);margin:6px 0 0}.vc-mute{margin-left:8px;padding:3px 10px!important;font-size:12px!important}'
    +'.vc-modes{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px}'
    +'.vc-modes button{display:grid;grid-template-columns:30px minmax(0,1fr);column-gap:8px;text-align:left;font:inherit;padding:10px 12px;border:1px solid var(--rule);border-radius:12px;background:var(--card);color:var(--ink);cursor:pointer}'
    +'.vc-modes .e{grid-row:span 2;font-size:22px;line-height:1.2}.vc-modes b{font-size:13.5px}.vc-modes small{font-size:11.5px;color:var(--ink-faint);line-height:1.45}'
    +'.vc-modes button[aria-pressed="true"]{border-color:var(--ink);box-shadow:inset 0 0 0 1px var(--ink)}.vc-modes button:disabled{opacity:.5;cursor:not-allowed}'
    +'.vc-ghead{display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center;font-size:12.5px;color:var(--ink-soft);margin-bottom:10px}.vc-ghead b{color:var(--ink);font-size:14px}.vc-timer{color:var(--warn);font-family:"IBM Plex Mono",monospace}'
    +'.vc-q{border:1px solid var(--rule);border-radius:16px;padding:16px;background:var(--card)}.vc-q.ok{border-color:var(--cap);box-shadow:0 0 0 2px var(--cap-tint)}.vc-q.bad{border-color:var(--warn);box-shadow:0 0 0 2px var(--warn-tint)}'
    +'.vc-qmeta{display:flex;gap:10px;font-size:11.5px;color:var(--ink-faint);margin-bottom:6px}.vc-mul{font-family:"IBM Plex Mono",monospace;color:var(--cap)}.vc-mul.m{color:var(--ink-faint)}.vc-qtimer{margin-left:auto;color:var(--warn);font-family:"IBM Plex Mono",monospace}'
    +'.vc-prompt{font-size:26px;font-weight:600;line-height:1.35;word-break:break-word}.vc-prompt.sm{font-size:18px}'
    +'.vc-say{font:inherit;font-size:14px;border:1px solid var(--rule);border-radius:999px;background:var(--card);color:var(--ink);padding:2px 9px;cursor:pointer;vertical-align:middle}'
    +'.vc-pos{display:block;font-size:12px;color:var(--ink-faint);margin-top:2px}.vc-blank{font-family:"IBM Plex Mono",monospace;letter-spacing:.06em;color:var(--ink-faint);margin:8px 0 0;font-size:15px}'
    +'.vc-sent{font-size:16px;line-height:1.7;margin:8px 0 0}.vc-sent u{text-decoration:none;color:var(--ink-faint);font-family:"IBM Plex Mono",monospace;letter-spacing:.04em}'
    +'.vc-opts{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px}@media (max-width:480px){.vc-opts{grid-template-columns:1fr}}'
    +'.vc-opts button{display:flex;gap:8px;align-items:center;text-align:left;font:inherit;font-size:15px;padding:11px 13px;border:1px solid var(--rule);border-radius:12px;background:var(--card);color:var(--ink);cursor:pointer;min-height:48px}'
    +'.vc-opts kbd{font-family:"IBM Plex Mono",monospace;font-size:11px;color:var(--ink-faint);border:1px solid var(--rule);border-radius:5px;padding:0 5px}'
    +'.vc-opts button.right{border-color:var(--cap);background:var(--cap-tint)}.vc-opts button.wrong{border-color:var(--warn);background:var(--warn-tint)}.vc-opts button:disabled{cursor:default;color:var(--ink)}'
    +'.vc-type{display:flex;flex-wrap:wrap;gap:6px;margin-top:14px}.vc-type input{flex:1 1 180px;min-width:0;font:inherit;font-size:18px;padding:10px 12px;border:1px solid var(--rule);border-radius:10px;background:var(--card);color:var(--ink)}'
    +'.vc-last{flex-basis:100%;font-size:12px;color:var(--ink-faint)}.vc-fb{margin:12px 0 0;font-size:14px}.vc-pair{color:var(--ink-faint);font-size:12.5px}'
    +'.vc-duel{display:flex;gap:12px;align-items:center;justify-content:center;margin:0 0 10px}.vc-duel>div{display:flex;flex-direction:column;align-items:center;padding:8px 16px;border:1px solid var(--rule);border-radius:14px;min-width:96px}'
    +'.vc-duel .mono{font-family:"IBM Plex Mono",monospace;font-size:24px}.vc-duel small{font-size:11px;color:var(--ink-faint)}.vc-duel.res{justify-content:flex-start}.vc-duel.res p{margin:0}'
    +'.vc-slot{text-align:center;padding:10px 0}'
    +'.vc-res{display:flex;gap:12px;align-items:center;padding:14px;border-radius:14px;border:1px solid var(--rule);margin-bottom:12px}.vc-res .e{font-size:34px}.vc-res b{display:block;font-size:16px}.vc-res small{display:block;font-size:12.5px;color:var(--ink-soft)}'
    +'.vc-res.win{border-color:var(--cap);background:var(--cap-tint)}.vc-res.lose{border-color:var(--warn);background:var(--warn-tint)}'
    +'.vc-list{margin:0 0 12px}.vc-list>div{display:grid;grid-template-columns:22px minmax(0,auto) minmax(0,1fr) auto;gap:8px;align-items:baseline;font-size:13px;padding:5px 0;border-bottom:1px solid var(--rule2)}'
    +'.vc-list small{color:var(--ink-faint);font-size:11.5px}.vc-list .ok>span:first-child{color:var(--cap)}.vc-list .bad>span:first-child{color:var(--warn)}'
    +'.vc-list.wb>div{grid-template-columns:44px minmax(0,auto) minmax(0,1fr) auto}.vc-list.wb>div>span:first-child{color:var(--cap);font-size:11px}'
    +'.vc-bars>div{display:grid;grid-template-columns:110px minmax(0,1fr);gap:4px 10px;align-items:center;margin:6px 0;font-size:13px}.vc-bars small{grid-column:2;font-size:11.5px;color:var(--ink-faint)}.vc-bars .bar{margin:0;max-width:none}';
  if(!document.getElementById('vc-css')){ var stl=document.createElement('style'); stl.id='vc-css'; stl.textContent=CSS; document.head.appendChild(stl); }
  var VK='plan.vocab.v1', RK='plan.vrev.v1';
  function ls(k,d){ try{ var v=JSON.parse(localStorage.getItem(k)); return v===null||v===undefined?d:v; }catch(e){ return d; } }
  function sv(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){ if(window.__quota) window.__quota(e); } }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function d0(){ var d=new Date(); d.setHours(0,0,0,0); return d; }
  function kk(d){ return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate(); }
  function pk(k){ var p=String(k).split('-'); return new Date(+p[0],+p[1]-1,+p[2]); }
  function addDays(n){ var d=d0(); d.setDate(d.getDate()+n); return kk(d); }
  function hm(m){ return ('0'+Math.floor(m/60)).slice(-2)+':'+('0'+(m%60)).slice(-2); }
  function r2(x){ return Math.round(x*100)/100; }
  function shuffle(a){ a=a.slice(); for(var i=a.length-1;i>0;i--){ var j=Math.floor(Math.random()*(i+1)), t=a[i]; a[i]=a[j]; a[j]=t; } return a; }
  function pickR(a){ return a[Math.floor(Math.random()*a.length)]; }

  /* ---------- 規則 ---------- */
  var DIFF=[{id:'easy',n:'簡單',m:1.5,say:'看英文選中文'},{id:'norm',n:'普通',m:2,say:'看中文選英文（選項拼字很像）'},
    {id:'hard',n:'困難',m:3,say:'看中文拼出單字（給字數）；片語填空'},{id:'hell',n:'地獄',m:5,say:'聽發音拼字，每題限時 15 秒'}];
  var MODES=[
    {id:'round',n:'一局 10 題',e:'🎴',say:'押一次答 10 題：全對拿 注×平均倍率、7 題拿回本金、4 題以下全輸，中間照比例'},
    {id:'single',n:'一題一注',e:'🪙',say:'每題押一次：答對拿 注×倍率、答錯沒收，隨時收手'},
    {id:'ladder',n:'加倍爬梯',e:'🪜',say:'每答對一題，獎金再乘上這題的倍率（最多本金 10 倍、10 階）；隨時收手，錯一題全沒'},
    {id:'sprint',n:'限時衝刺',e:'⏱️',say:'60 秒答越多越好：拿回 注×（答對−答錯）÷10×平均倍率，最多 3 倍'},
    {id:'duel',n:'跟寵物對賭',e:'🐾',say:'同一組 10 題比答對數：贏拿 注×平均倍率、平手退錢；牠的實力照你最近 100 題'},
    {id:'slot',n:'拉霸轉倍率',e:'🎰',say:'先轉出 ×0～×10（長期平均約 ×1），再答一題：答對拿 注×拉霸×題目倍率'}];
  // 單字難度：來源決定（之後加康軒）。多益倍率：使用者 2026-11-02 定 Level 5 ×5（字長、對國中生難），中間照級別遞增
  var SRC={kb:{n:'會考基本 1200',m:1},ka:{n:'會考進階 800',m:1.2},pb:{n:'片語',m:1},pa:{n:'片語（較難）',m:1.2},
    t1:{n:'多益 Level 1',m:1.5},t2:{n:'多益 Level 2',m:2},t3:{n:'多益 Level 3',m:3},t4:{n:'多益 Level 4',m:4},t5:{n:'多益 Level 5',m:5}};
  var RANGES=[{id:'kb',n:'會考基本 1200'},{id:'ka',n:'會考進階 800'},{id:'ph',n:'片語'},
    {id:'t1',n:'多益 Lv1'},{id:'t2',n:'多益 Lv2'},{id:'t3',n:'多益 Lv3'},{id:'t4',n:'多益 Lv4'},{id:'t5',n:'多益 Lv5'},{id:'wb',n:'錯字本'}];
  var SOON='康軒課本（第 2～5 冊）之後加入';
  var POSF=[['n.','名詞'],['v.','動詞'],['adj.','形容詞'],['adv.','副詞'],['etc','其他']];
  var SLOT=[[0,.34],[.5,.24],[1,.19],[2,.12],[3,.065],[5,.03],[10,.015]];   // 期望值 ×1.045
  var INT=[1,3,7];            // 錯字本：隔 1、3、7 天再出現，連對 3 次移出
  var MASTER=3;               // 連對 3 次＝熟字，倍率降到 ×1
  var REV_CAP=30;             // 錯字本複習每題最多算 30 秒英文讀書；按「不會」、沒打字不算（2026-11-02 審查：防止開著不動刷分鐘）
  var SPRINT_MAX=3;           // 限時衝刺最多拿回本金 3 倍
  var PID=Date.now().toString(36)+Math.random().toString(36).slice(2,6);   // 這個分頁：別的分頁正在打的局不要當成放棄
  var CHIP_BACK=.8;           // 籌碼換回點數打 8 折
  var BGS=[{id:'',n:'經典綠桌'},{id:'bg_neon',n:'霓虹夜'},{id:'bg_royal',n:'皇家紫'},{id:'bg_gold',n:'黃金廳'}];
  var PRIZES=[
    {id:'visor',k:'acc',n:'發牌員遮陽帽',e:'🧢',c:300,say:'寵物可以戴（到「家 → 穿戴」）'},
    {id:'pokerhat',k:'acc',n:'撲克牌紳士帽',e:'🃏',c:500,say:'寵物可以戴'},
    {id:'t_luck',k:'title',n:'稱號「幸運兒」',e:'🍀',c:200,ti:'幸運兒'},
    {id:'t_speller',k:'title',n:'稱號「拼字王」',e:'✍️',c:400,ti:'拼字王'},
    {id:'t_god',k:'title',n:'稱號「單字賭神」',e:'👑',c:800,ti:'單字賭神'},
    {id:'bg_neon',k:'bg',n:'霓虹夜背景',e:'🌃',c:250},
    {id:'bg_royal',k:'bg',n:'皇家紫背景',e:'💜',c:350},
    {id:'bg_gold',k:'bg',n:'黃金廳背景',e:'🏆',c:600}];

  /* ---------- 圖（手畫 SVG，跟寵物同一種畫法：不用載圖檔、離線也能看） ---------- */
  var ART={
    // 招牌：撲克牌、拉霸機（轉輪是 A B C）、籌碼、金幣
    banner:function(){
      var bulbs=''; for(var i=0;i<9;i++) bulbs+='<circle cx="'+(122+i*9.5)+'" cy="22" r="2.6" class="vc-bulb" style="animation-delay:'+(i*.12).toFixed(2)+'s"/>';
      return '<svg class="vc-banner" viewBox="0 0 320 118" aria-hidden="true">'
        // 左邊：兩張撲克牌
        +'<g transform="translate(46 70) rotate(-16)"><rect x="-19" y="-27" width="38" height="54" rx="5" fill="#fff" stroke="#D9D2C3" stroke-width="1.2"/><text x="-12" y="-11" font-size="13" font-weight="700" fill="#1E1E1E" font-family="Georgia,serif">A</text><path d="M0 2 C-9 -6 -9 -14 0 -9 C9 -14 9 -6 0 2 Z M-2 1 L-4 9 L4 9 L2 1 Z" fill="#1E1E1E"/></g>'
        +'<g transform="translate(70 72) rotate(10)"><rect x="-19" y="-27" width="38" height="54" rx="5" fill="#fff" stroke="#D9D2C3" stroke-width="1.2"/><text x="-12" y="-11" font-size="13" font-weight="700" fill="#C0392B" font-family="Georgia,serif">K</text><path d="M0 10 L-9 0 C-13 -6 -6 -12 0 -5 C6 -12 13 -6 9 0 Z" fill="#C0392B"/></g>'
        // 中間：拉霸機
        +'<rect x="112" y="12" width="96" height="98" rx="14" fill="#B83227" stroke="#7E1F18" stroke-width="2"/>'
        +'<rect x="112" y="12" width="96" height="22" rx="11" fill="#E0A82E"/>'+bulbs
        +'<rect x="120" y="40" width="80" height="38" rx="7" fill="#2A1A12"/>'
        +['A','B','C'].map(function(c,i){ return '<rect x="'+(124+i*25.5)+'" y="44" width="22" height="30" rx="4" fill="#FFF8E7"/><text x="'+(135+i*25.5)+'" y="66" font-size="18" font-weight="800" text-anchor="middle" fill="'+['#1F6E43','#C0392B','#2D5BA8'][i]+'" font-family="Georgia,serif">'+c+'</text>'; }).join('')
        +'<rect x="128" y="84" width="64" height="9" rx="4.5" fill="#7E1F18"/><rect x="134" y="86.5" width="52" height="4" rx="2" fill="#2A1A12"/>'
        +'<rect x="122" y="98" width="76" height="6" rx="3" fill="#E0A82E" opacity=".9"/>'
        +'<g class="vc-lever"><path d="M210 66 h8 v-34" stroke="#9AA0A6" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="218" cy="28" r="6.5" fill="#E5484D" stroke="#9E2B2F" stroke-width="1.4"/><circle cx="216" cy="26" r="2" fill="#fff" opacity=".6"/></g>'
        // 右邊：一疊籌碼＋金幣
        +[0,1,2,3].map(function(i){ var c=['#2D5BA8','#1F8A52','#C0392B','#E0A82E'][i], y=96-i*9; return '<ellipse cx="262" cy="'+(y+4)+'" rx="22" ry="7" fill="rgba(0,0,0,.25)"/><ellipse cx="262" cy="'+y+'" rx="22" ry="7" fill="'+c+'"/><ellipse cx="262" cy="'+y+'" rx="22" ry="7" fill="none" stroke="#fff" stroke-width="2.4" stroke-dasharray="5 6"/><ellipse cx="262" cy="'+(y-1)+'" rx="12" ry="3.6" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="1"/>'; }).join('')
        +'<g transform="translate(296 96)"><circle r="9" fill="#F2C230" stroke="#B8901E" stroke-width="1.4"/><text y="3.6" font-size="10" font-weight="800" text-anchor="middle" fill="#8A6A12">$</text></g>'
        +'<g transform="translate(236 104) rotate(-20)"><ellipse rx="8" ry="8" fill="#F2C230" stroke="#B8901E" stroke-width="1.3"/><text y="3.4" font-size="9" font-weight="800" text-anchor="middle" fill="#8A6A12">★</text></g>'
        +'</svg>';
    },
    // 六種玩法的小圖示（24×24）
    icon:function(id){
      var s='<svg class="vc-ico" viewBox="0 0 24 24" aria-hidden="true">';
      if(id==='round') s+='<rect x="3" y="5" width="11" height="15" rx="2" fill="#fff" stroke="#8A8F98" transform="rotate(-12 8 12)"/><rect x="9" y="4" width="11" height="15" rx="2" fill="#fff" stroke="#8A8F98" transform="rotate(8 14 11)"/><path d="M15 9.5 l-2.4 2.4 L15 14.3 l2.4 -2.4 Z" fill="#C0392B" transform="rotate(8 14 11)"/>';
      else if(id==='single') s+='<circle cx="12" cy="12" r="9" fill="#F2C230" stroke="#B8901E" stroke-width="1.4"/><circle cx="12" cy="12" r="6.2" fill="none" stroke="#B8901E" stroke-width=".9"/><path d="M12 7.6 l1.3 2.7 3 .4 -2.2 2.1 .5 3 -2.6-1.4 -2.6 1.4 .5-3 -2.2-2.1 3-.4 Z" fill="#8A6A12"/>';
      else if(id==='ladder') s+='<path d="M7 3 V21 M17 3 V21" stroke="#A0733A" stroke-width="2.2" stroke-linecap="round"/><path d="M7 7 H17 M7 11.5 H17 M7 16 H17" stroke="#C8955A" stroke-width="2" stroke-linecap="round"/><path d="M15 2.5 l2.2 -1.5 1 2.4" stroke="#1F8A52" stroke-width="1.6" fill="none" stroke-linecap="round"/>';
      else if(id==='sprint') s+='<circle cx="12" cy="13.5" r="8" fill="#fff" stroke="#5A6673" stroke-width="1.8"/><rect x="10" y="2" width="4" height="3" rx="1" fill="#5A6673"/><path d="M12 13.5 V8.5 M12 13.5 l3.6 2.2" stroke="#E5484D" stroke-width="1.9" stroke-linecap="round"/><circle cx="12" cy="13.5" r="1.2" fill="#5A6673"/>';
      else if(id==='duel') s+='<g fill="#A0733A"><ellipse cx="8" cy="15.5" rx="3.6" ry="3"/><circle cx="4.6" cy="11" r="1.5"/><circle cx="7" cy="9" r="1.5"/><circle cx="9.8" cy="9.2" r="1.5"/><circle cx="11.8" cy="11.4" r="1.4"/></g><text x="18" y="17" font-size="8.5" font-weight="800" text-anchor="middle" fill="#E5484D" font-family="Arial,sans-serif">VS</text>';
      else if(id==='slot') s+='<rect x="3" y="4" width="15" height="17" rx="3" fill="#B83227"/><rect x="5" y="8.5" width="11" height="7" rx="1.5" fill="#FFF8E7"/><path d="M8.6 8.5 V15.5 M12.4 8.5 V15.5" stroke="#E0C9A0" stroke-width=".8"/><text x="10.5" y="14" font-size="5.5" font-weight="800" text-anchor="middle" fill="#C0392B">7</text><path d="M18 13 h2 v-7" stroke="#9AA0A6" stroke-width="1.6" fill="none"/><circle cx="20" cy="5.5" r="1.8" fill="#E5484D"/>';
      return s+'</svg>';
    },
    // 拉霸機：窗戶裡顯示轉到的倍率（spin() 直接改 .vc-reel 的字）
    slot:function(face){
      return '<svg class="vc-slotsvg" viewBox="0 0 220 150" aria-hidden="true"><rect x="30" y="10" width="150" height="132" rx="18" fill="#B83227" stroke="#7E1F18" stroke-width="2.4"/>'
        +'<rect x="30" y="10" width="150" height="26" rx="13" fill="#E0A82E"/><text x="105" y="29" font-size="13" font-weight="800" text-anchor="middle" fill="#7E1F18" letter-spacing="2">LUCKY ×</text>'
        +'<rect x="44" y="46" width="122" height="56" rx="10" fill="#2A1A12"/><rect x="50" y="52" width="110" height="44" rx="7" fill="#FFF8E7"/>'
        +'<text x="105" y="85" class="vc-reel" font-size="30" font-weight="800" text-anchor="middle" fill="#C0392B" font-family="IBM Plex Mono,monospace">'+esc(face)+'</text>'
        +'<rect x="58" y="112" width="94" height="10" rx="5" fill="#7E1F18"/><rect x="66" y="115" width="78" height="4" rx="2" fill="#2A1A12"/>'
        +'<g class="vc-lever on"><path d="M182 92 h12 v-52" stroke="#9AA0A6" stroke-width="5" fill="none" stroke-linecap="round"/><circle cx="194" cy="36" r="9" fill="#E5484D" stroke="#9E2B2F" stroke-width="1.6"/></g></svg>';
    },
    // 結算：贏了是一堆籌碼跟金幣，輸了是空空的錢包，平手是握手
    result:function(kind){
      if(kind==='win') return '<svg class="vc-resart" viewBox="0 0 64 64" aria-hidden="true">'+[0,1,2].map(function(i){ var c=['#C0392B','#1F8A52','#2D5BA8'][i], y=50-i*8; return '<ellipse cx="26" cy="'+y+'" rx="16" ry="5.5" fill="'+c+'"/><ellipse cx="26" cy="'+y+'" rx="16" ry="5.5" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="4 5"/>'; }).join('')
        +'<circle cx="48" cy="44" r="9" fill="#F2C230" stroke="#B8901E" stroke-width="1.4"/><text x="48" y="48" font-size="10" font-weight="800" text-anchor="middle" fill="#8A6A12">$</text><path d="M44 12 l2 5 5 1 -4 3 1 5 -4-3 -4 3 1-5 -4-3 5-1 Z" fill="#F2C230"/><path d="M14 8 l1.2 3 3 .6 -2.4 1.8 .6 3 -2.4-1.8 -2.4 1.8 .6-3 -2.4-1.8 3-.6 Z" fill="#F2C230" opacity=".8"/></svg>';
      if(kind==='lose') return '<svg class="vc-resart" viewBox="0 0 64 64" aria-hidden="true"><rect x="10" y="20" width="44" height="32" rx="6" fill="#8B5E3C"/><rect x="10" y="20" width="44" height="10" rx="5" fill="#6E4A2F"/><rect x="38" y="31" width="16" height="11" rx="3" fill="#A97B55"/><circle cx="44" cy="36.5" r="2" fill="#6E4A2F"/><path d="M22 14 q2 -6 6 0 M30 10 q2 -6 6 0" stroke="#9AA0A6" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="M18 58 h30" stroke="#C9CDD2" stroke-width="2" stroke-linecap="round" stroke-dasharray="3 4"/></svg>';
      return '<svg class="vc-resart" viewBox="0 0 64 64" aria-hidden="true"><path d="M8 36 l12 -10 h10 l6 4 h8 l12 8 -8 10 -10 -2 -8 6 -10 -6 Z" fill="#F4C9A0" stroke="#C9956A" stroke-width="1.5" stroke-linejoin="round"/><path d="M28 32 l8 6 M32 30 l8 6 M24 36 l6 5" stroke="#C9956A" stroke-width="1.4" stroke-linecap="round"/></svg>';
    }
  };

  /* ---------- 資料 ---------- */
  function st(){
    var s=ls(VK,null)||{};
    s.chips=s.chips||0; s.ws=s.ws||{}; s.wb=s.wb||{}; s.rec=s.rec||[]; s.own=s.own||{}; s.log=s.log||[]; s.set=s.set||{};
    s.k=s.k||{}; ['games','ans','ok','best','run','lad10','petW','petL','clr','rvAns','rvOk'].forEach(function(x){ s.k[x]=s.k[x]||0; });
    s.k.net=s.k.net||{pts:0,chip:0,star:0};
    return s;
  }
  function save(s){ sv(VK,s); }
  function mastered(s,key){ var w=s.ws[key]; return !!(w && w[2]>=MASTER); }
  function acc100(s){ if(s.rec.length<20) return .7; var n=0; s.rec.forEach(function(x){ n+=x; }); return n/s.rec.length; }

  /* ---------- 單字庫（vocab.js） ---------- */
  var ALL=null, BYKEY={}, loading=false, loadErr='';
  // vocab.js（會考 2000＋片語）一定要有；toeic.js（多益）載不到就先不出多益
  function loadVocab(){
    if(ALL||loading) return; loading=true;
    var need=[['VOCAB','vocab.js?v=20261102a'],['VOCAB_T','toeic.js?v=20261103a']].filter(function(x){ return !window[x[0]]; }), left=need.length;
    function one(){ if(--left===0 && !loadErr){ loading=false; build(); render(); } }
    if(!left){ loading=false; build(); render(); return; }
    need.forEach(function(x){
      var sc=document.createElement('script'); sc.src=x[1]; sc.onload=one;
      sc.onerror=function(){ if(x[0]==='VOCAB'){ loading=false; loadErr='單字庫載入失敗（網路不通？）。重新整理再試一次。'; render(); } else one(); };
      document.head.appendChild(sc);
    });
  }
  function build(){
    var V=window.VOCAB; if(!V){ loadErr='單字庫是空的。'; return; }
    ALL=[];
    (V.w||[]).forEach(function(r){ var it={key:'w:'+r[0], w:r[0], alt:r[1]?r[1].split('|'):[], pos:r[2]||'', zh:r[3], src:r[4], ph:0}; if(!BYKEY[it.key]){ BYKEY[it.key]=it; ALL.push(it); } });
    (V.p||[]).forEach(function(r){ var it={key:'p:'+r[0], w:r[0], alt:[], pos:'phr.', zh:r[1], s:r[2], f:r[3], src:r[4]==='a'?'pa':'pb', ph:1}; if(!BYKEY[it.key]){ BYKEY[it.key]=it; ALL.push(it); } });
    var T=window.VOCAB_T;   // 多益：o＝會考也有的字（標上多益級別），w＝[字, 其他拼法, 詞性, 中文, 級別]
    if(T){
      (T.o||[]).forEach(function(r){ var it=BYKEY['w:'+r[0]]; if(it && !it.tl) it.tl=r[1]; });
      (T.w||[]).forEach(function(r){ var k='w:'+r[0]; if(BYKEY[k]){ if(!BYKEY[k].tl) BYKEY[k].tl=r[4]; return; }
        var it={key:k, w:r[0], alt:r[1]?r[1].split('|'):[], pos:r[2]||'', zh:r[3], src:'t'+r[4], tl:r[4], ph:0}; BYKEY[k]=it; ALL.push(it); });
    }
  }
  function posHas(pos,p){
    var P=String(pos).split(/\s+/);
    if(p==='etc') return !P.some(function(x){ return /^(n|v|adj|adv)\.$/.test(x); });
    return P.indexOf(p)>=0;
  }
  function inRange(it,rg,s){
    return (rg.indexOf('kb')>=0&&it.src==='kb')||(rg.indexOf('ka')>=0&&it.src==='ka')||(rg.indexOf('ph')>=0&&it.ph)||(!!it.tl&&rg.indexOf('t'+it.tl)>=0)||(rg.indexOf('wb')>=0&&!!s.wb[it.key]);
  }
  function poolOf(set,s){
    if(!ALL) return [];
    var rg=set.rg&&set.rg.length?set.rg:['kb'], L=set.let||'', P=set.pos||[];
    return ALL.filter(function(it){
      if(!inRange(it,rg,s)) return false;
      if(L && L.indexOf(it.w.charAt(0).toLowerCase())<0) return false;
      if(P.length && !it.ph && !P.some(function(p){ return posHas(it.pos,p); })) return false;
      return true;
    });
  }
  // 倍率看這次選的範圍：會考、多益都有的字，選會考範圍照會考、選多益範圍照多益級別；只選錯字本就照字本來的來源
  function srcMul(it,rg){
    var m=0; rg=rg||[];
    if(rg.indexOf(it.src)>=0 || (it.ph && rg.indexOf('ph')>=0)) m=(SRC[it.src]||{m:1}).m;
    if(it.tl && rg.indexOf('t'+it.tl)>=0) m=Math.max(m,SRC['t'+it.tl].m);
    return m||(SRC[it.src]||{m:1}).m;
  }
  function diffOf(id){ return DIFF.filter(function(d){ return d.id===id; })[0]||DIFF[0]; }
  function modeOf(id){ return MODES.filter(function(m){ return m.id===id; })[0]||MODES[0]; }
  function qMult(it,diff,s){ return mastered(s,it.key)?1:r2(diffOf(diff).m*srcMul(it,s&&s.set?s.set.rg:null)); }
  function fam(x){ return /^t/.test(x.src)?'t':'k'; }   // 選項只從同一套字庫抽（多益的字配多益的字）
  // 題目上方顯示的來源：照倍率是從哪個範圍算的（會考也有的字，選多益範圍就顯示多益級別）
  function srcName(it,rg){ rg=rg||[]; var own=(rg.indexOf(it.src)>=0||(it.ph&&rg.indexOf('ph')>=0))?(SRC[it.src]||{m:0}).m:0;
    if(it.tl && rg.indexOf('t'+it.tl)>=0 && SRC['t'+it.tl].m>=own) return SRC['t'+it.tl].n; return SRC[it.src]?SRC[it.src].n:''; }

  /* ---------- 出題 ---------- */
  function lev(a,b){
    if(Math.abs(a.length-b.length)>4) return 9;
    var prev=[], cur, i, j;
    for(j=0;j<=b.length;j++) prev[j]=j;
    for(i=1;i<=a.length;i++){ cur=[i]; for(j=1;j<=b.length;j++) cur[j]=Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+(a.charAt(i-1)===b.charAt(j-1)?0:1)); prev=cur; }
    return prev[b.length];
  }
  function posMain(p){ return String(p).split(/\s+/)[0]; }
  function senses(z){ return String(z).replace(/（[^）]*）/g,'').split(/[；;、]/).map(function(x){ return x.trim(); }).filter(Boolean); }
  function zhOptions(it,n){
    var mine=senses(it.zh), pool=ALL.filter(function(x){ return x.ph===it.ph && x.key!==it.key && x.zh!==it.zh && fam(x)===fam(it); });
    var same=it.ph?pool:pool.filter(function(x){ return posMain(x.pos)===posMain(it.pos); });
    var out=[], used=mine.slice();
    function tryAdd(x){ if(out.length>=n) return; var ss=senses(x.zh); if(ss.some(function(z){ return used.indexOf(z)>=0; })) return; out.push(x.zh); used=used.concat(ss); }
    shuffle(same).slice(0,40).forEach(tryAdd);
    if(out.length<n) shuffle(pool).slice(0,60).forEach(tryAdd);
    return out;
  }
  function enOptions(it,n){
    var w=it.w.toLowerCase(), cand=[];
    ALL.forEach(function(x){
      if(x.ph!==it.ph||x.key===it.key||x.zh===it.zh||fam(x)!==fam(it)) return; var y=x.w.toLowerCase(); if(y===w) return;
      var sc=0; if(y.charAt(0)===w.charAt(0)) sc+=2; if(Math.abs(y.length-w.length)<=1) sc+=2;
      sc+=Math.max(0,4-lev(w,y)); if(!it.ph && posMain(x.pos)===posMain(it.pos)) sc+=1;
      cand.push([sc+Math.random()*1.5,x.w]);
    });
    cand.sort(function(a,b){ return b[0]-a[0]; });
    var out=[]; cand.slice(0,14).forEach(function(c){ if(out.indexOf(c[1])<0) out.push(c[1]); });
    return shuffle(out).slice(0,n);
  }
  function blanks(w){ return String(w).split('').map(function(c){ return /[A-Za-z]/.test(c)?'＿':(c===' '?'　':c); }).join(' '); }
  function letters(w){ return String(w).replace(/[^A-Za-z]/g,'').length; }
  function norm(x){ return String(x||'').toLowerCase().replace(/[’‘`]/g,"'").replace(/\./g,'').replace(/-/g,' ').replace(/\s+/g,' ').trim(); }
  function makeQ(it,diff,s){
    var q={key:it.key, diff:diff, m:qMult(it,diff,s), t0:Date.now(), mast:mastered(s,it.key)};
    if(diff==='easy'){ q.kind='choice'; q.ans=it.zh; q.opts=shuffle([it.zh].concat(zhOptions(it,3))); }
    else if(diff==='norm'){ q.kind='choice'; q.ans=it.w; q.opts=shuffle([it.w].concat(enOptions(it,3))); }
    else { q.kind='type'; q.ans=(it.ph&&diff==='hard')?it.f:it.w; q.accept=[q.ans].concat(it.ph?[]:it.alt); if(diff==='hell'){ q.limit=15; q.listen=1; } }
    return q;
  }
  // 拼字題：看中文拼字時，中文意思一模一樣的別的字也算對（秋天：autumn、fall）
  function judge(q,val){
    if(q.kind==='choice') return val===q.ans;
    var v=norm(val); if(!v) return false;
    if(q.accept.some(function(a){ return norm(a)===v; })) return true;
    var it=BYKEY[q.key]; if(!it || it.ph || q.listen) return false;
    return ALL.some(function(x){ return !x.ph && x.key!==it.key && x.zh===it.zh && (norm(x.w)===v || x.alt.some(function(a){ return norm(a)===v; })); });
  }

  /* ---------- 發音、音效 ---------- */
  var voice=null;
  function pickVoice(){ try{ var vs=speechSynthesis.getVoices(); voice=vs.filter(function(v){ return /^en[-_]US/i.test(v.lang); })[0]||vs.filter(function(v){ return /^en/i.test(v.lang); })[0]||null; }catch(e){} }
  if(window.speechSynthesis){ pickVoice(); try{ speechSynthesis.onvoiceschanged=pickVoice; }catch(e){} }
  function canSpeak(){ return !!window.speechSynthesis; }
  function speak(t){ if(!canSpeak()) return; try{ speechSynthesis.cancel(); var u=new SpeechSynthesisUtterance(t); u.lang='en-US'; u.rate=.88; if(voice) u.voice=voice; speechSynthesis.speak(u); }catch(e){} }
  var AC=null;
  function snd(kind){
    if(st().set.mute) return;
    try{
      AC=AC||new (window.AudioContext||window.webkitAudioContext)(); if(AC.state==='suspended') AC.resume();
      var seq=kind==='ok'?[660,880]:(kind==='bad'?[300,220]:(kind==='win'?[523,659,784,1047]:[440]));
      seq.forEach(function(f,i){ var o=AC.createOscillator(), g=AC.createGain(), t0=AC.currentTime+i*.11;
        o.type=kind==='bad'?'triangle':'sine'; o.frequency.setValueAtTime(f,t0); g.gain.setValueAtTime(.0001,t0); g.gain.exponentialRampToValueAtTime(.18,t0+.02); g.gain.exponentialRampToValueAtTime(.0001,t0+.2);
        o.connect(g); g.connect(AC.destination); o.start(t0); o.stop(t0+.22); });
    }catch(e){}
  }

  /* ---------- 錢：點數、籌碼、🌟 ---------- */
  var CUR={pts:{n:'點數',u:'點'},chip:{n:'籌碼',u:'籌碼'},star:{n:'🌟 金幸運草',u:'🌟'}};
  function bal(cur){ if(cur==='pts') return window.__pts?window.__pts():0; if(cur==='chip') return st().chips; return API.petState?(API.petState().gold||0):0; }
  // logN：寫進許願商店紀錄的數字（一局只記一筆淨輸贏）；quiet：不記
  function addCur(cur,n,why,logN){
    if(cur==='pts'){ if(window.__award) window.__award(n,why,true,logN===undefined?{quiet:1}:{logN:logN}); return; }
    if(cur==='chip'){ var s=st(); s.chips=Math.max(0,s.chips+n); save(s); return; }
    var ps=API.petState(); ps.gold=Math.max(0,(ps.gold||0)+n); API.savePet(ps);
  }
  function todayMin(){ var h=API.allHist?API.allHist():{}, e=h[kk(d0())]||{}; return e.m||0; }
  function capOf(cur){ return cur==='star'?3:50+todayMin(); }   // 今天讀越多，一次能押越多

  /* ---------- 能不能下注 ---------- */
  function lockState(){
    var why=[], tk=kk(d0()), h=API.allHist?API.allHist():{}, e=h[tk]||{}, easy=API.easyMap?API.easyMap()[tk]:null;
    var blk=API.studyBlockNow?API.studyBlockNow():null;
    if(blk) why.push('現在是讀書時段（'+hm(blk.a)+'–'+hm(blk.b)+' '+esc(blk.n)+'）');
    if(easy){ if(!(e.d>0)) why.push('今天是降級模式：先完成一項任務'); }
    else if(e.a>0 && e.d/e.a<.5) why.push('今天任務完成 '+(e.d||0)+'/'+e.a+'，要做完一半（'+Math.ceil(e.a/2)+' 項）才開放');
    var pts=bal('pts'); if(pts<0) why.push('點數是負的（'+pts+'）');
    var bk=API.bankState?API.bankState():{}; if(bk.loan) why.push('欠銀行 '+bk.loan.owe+' 點');
    return why;
  }

  /* ---------- 作答紀錄、錯字本 ---------- */
  function record(s,key,ok,inGame,keepWb){
    var w=s.ws[key]||[0,0,0,0];
    w[0]++; if(ok) w[1]++; w[2]=ok?w[2]+1:0; w[3]=Date.now(); s.ws[key]=w;
    if(inGame){
      s.rec.push(ok?1:0); if(s.rec.length>100) s.rec=s.rec.slice(-100);
      s.k.ans++; if(ok) s.k.ok++; s.k.run=ok?s.k.run+1:0; s.k.best=Math.max(s.k.best,s.k.run);
    }
    if(!ok && !keepWb){ s.wb[key]={t:(s.wb[key]&&s.wb[key].t)||Date.now(), lv:0, ok:0, due:addDays(1)}; }
  }
  function dueList(s){ var t=d0(); return Object.keys(s.wb).filter(function(k){ return BYKEY[k] && pk(s.wb[k].due)<=t; }); }
  function addReviewTime(sec){
    sec=Math.max(1,Math.min(REV_CAP,Math.round(sec)));
    var r=ls(RK,{})||{}, tk=kk(d0()); r[tk]=(r[tk]||0)+sec;
    Object.keys(r).forEach(function(k){ if(k!=='pomo' && pk(k)<pk(addDays(-120))) delete r[k]; });   // 留 4 個月就好
    r.pomo=(r.pomo||0)+sec; var pomos=0;
    while(r.pomo>=1500){ r.pomo-=1500; pomos++; }
    sv(RK,r);
    for(var i=0;i<pomos;i++){ if(window.__pomoAdd) window.__pomoAdd('eng',25,'錯字本複習'); }
    return pomos;
  }
  function reviewMinToday(){ var r=ls(RK,{})||{}; return Math.floor((r[kk(d0())]||0)/60); }

  /* ---------- 畫面狀態 ---------- */
  var view='home', G=null, R=null, msg='', tick=null;
  function setDef(s){
    var d=s.set; d.rg=d.rg&&d.rg.length?d.rg:['kb']; d.let=d.let||''; d.pos=d.pos||[]; d.diff=d.diff||'easy'; d.mode=d.mode||'round'; d.cur=d.cur||'pts'; d.bet=d.bet||20; return d;
  }
  // 上次沒打完就關掉網頁的局：下注已經扣了，算放棄
  function settleAbandoned(force){
    var s=st(); if(!s.cur) return;
    if(s.cur.pid===PID) return;
    if(!force && Date.now()-(s.cur.at||0)<15*60000) return;   // 可能是另一個分頁正在打
    var c=s.cur; s.cur=null;
    var single=c.mode==='single', net=single?(c.net||0):-c.bet;   // 一題一注：每題已經各自結算，這裡只補記淨輸贏
    s.k.net[c.cur]=(s.k.net[c.cur]||0)+net; s.k.games++;
    s.log.unshift({t:Date.now(),m:c.mode,d:c.diff,c:c.cur,b:c.bet,p:single?net:0,r:c.right||0,n:c.n||0,ab:1,single:single?1:0}); s.log=s.log.slice(0,60);
    save(s);
    if(c.cur==='pts' && net && window.__award) window.__award(0,'單字賭場：'+modeOf(c.mode).n+' 沒打完就離開'+(single?'（答 '+(c.n||0)+' 題）':'，押的 '+c.bet+' 點沒收'),true,{logN:net});
    msg=single?'上次一題一注沒按收手就離開了，已經照每題結算（淨 '+(net>0?'+':'')+net+'）。':'上次那局沒打完就離開了，押的 '+c.bet+' '+CUR[c.cur].u+'沒收。';
  }

  /* ---------- 主畫面 ---------- */
  function render(){
    if(tick && !(G && (G.endAt || (G.q && G.q.limit)))){ clearInterval(tick); tick=null; }
    var s=st(), set=setDef(s);
    app.className='card vc-card'+(s.set.bg?' '+s.set.bg:'');
    if(loadErr){ app.innerHTML='<div class="vc-body"><p class="fp-care bad">'+esc(loadErr)+'</p></div>'; return; }
    if(!ALL){ loadVocab(); if(!ALL) app.innerHTML='<div class="vc-body"><p class="fp-gone">🎰 正在載入單字庫…</p></div>'; return; }
    if(view==='game' && G) return renderGame();
    if(view==='result' && R) return renderResult();
    if(view==='review') return renderReview();
    var tabs='<div class="fp-tabs vc-tabs" role="tablist" aria-label="賭場分頁">'+[['home','🎰 下注'],['review','📕 錯字本'+(dueList(s).length?' <b class="fp-dot">'+dueList(s).length+'</b>':'')],['shop','🛍️ 籌碼與獎品'],['stats','📊 統計']]
      .map(function(t){ return '<button type="button" data-view="'+t[0]+'" aria-pressed="'+(view===t[0]||(view==='review0'&&t[0]==='review'))+'">'+t[1]+'</button>'; }).join('')+'</div>';
    var o=tabs+'<div class="vc-body">'+tiles(s,view==='home');
    if(view==='shop') o+=shopHtml(s); else if(view==='stats') o+=statsHtml(s); else if(view==='review0') o+=reviewHome(s); else o+=setupHtml(s,set);
    o+='<p class="fp-msg" id="vc-msg" aria-live="polite">'+msg+'</p></div>';
    app.innerHTML=o;
  }
  function tiles(s,hero){
    var nm=0; Object.keys(s.ws).forEach(function(k){ if(s.ws[k][2]>=MASTER) nm++; });
    var p=hero&&API.petState?API.petState().pet:null, top='';
    if(hero) top='<div class="vc-hero">'+ART.banner()+(p&&!p.trip&&API.petMini?'<div class="vc-dealer">'+API.petMini(p,'stand',58)+'<small>發牌員 '+esc(p.name)+'</small></div>':'')+'</div>';
    return '<div class="vc-top">'+top+'<div class="vc-tiles">'
      +'<div><small>點數</small><b>'+bal('pts')+'</b></div><div><small>籌碼</small><b>'+s.chips+'</b></div><div><small>🌟</small><b>'+bal('star')+'</b></div>'
      +'<div><small>熟字</small><b>'+nm+'</b></div><div><small>錯字本</small><b>'+Object.keys(s.wb).length+'</b><em>今天到期 '+dueList(s).length+'</em></div></div></div>';
  }
  function chipBtn(attr,v,on,label){ return '<button type="button" '+attr+'="'+v+'" aria-pressed="'+on+'">'+label+'</button>'; }
  function setupHtml(s,set){
    var pool=poolOf(set,s), nm=pool.filter(function(it){ return mastered(s,it.key); }).length, lock=lockState(), cap=capOf(set.cur), D=diffOf(set.diff);
    var avgM=pool.length?r2(pool.reduce(function(a,it){ return a+qMult(it,set.diff,s); },0)/pool.length):0;
    var pet=API.petState?API.petState().pet:null;
    var o='';
    o+=lock.length?'<p class="fp-care bad">🔒 現在不能下注：'+lock.join('；')+'。錯字本複習隨時都可以。</p>'
      :'<p class="fp-care">✅ 可以下注。今天讀了 '+todayMin()+' 分鐘，一次最多押 '+capOf('pts')+' 點／籌碼（讀越多押越大）、🌟 最多 3 顆。</p>';
    o+='<div class="vc-row"><h4>範圍 <span>可以複選；'+esc(SOON)+'</span></h4><div class="vc-chips">'
      +RANGES.map(function(r){ var n=r.id==='wb'?Object.keys(s.wb).length:ALL.filter(function(it){ return inRange(it,[r.id],s); }).length; return chipBtn('data-rg',r.id,set.rg.indexOf(r.id)>=0,esc(r.n)+' <small>'+n+'</small>'); }).join('')+'</div>'
      +'<details class="vc-more"'+(set.let||set.pos.length?' open':'')+'><summary>只考某些字母、詞性'+(set.let?'（'+set.let.toUpperCase().split('').join('')+'）':'')+(set.pos.length?'（'+set.pos.map(function(p){ return POSF.filter(function(x){ return x[0]===p; })[0][1]; }).join('、')+'）':'')+'</summary>'
      +'<div class="vc-chips vc-let">'+'abcdefghijklmnopqrstuvwxyz'.split('').map(function(c){ return chipBtn('data-let',c,set.let.indexOf(c)>=0,c.toUpperCase()); }).join('')+'<button type="button" data-let="*">全部</button></div>'
      +'<div class="vc-chips">'+POSF.map(function(p){ return chipBtn('data-pos',p[0],set.pos.indexOf(p[0])>=0,p[1]); }).join('')+'</div></details>'
      +'<p class="vc-sub">這個範圍 <b>'+pool.length+'</b> 個字、熟字 '+nm+'（'+(pool.length?Math.round(nm/pool.length*100):0)+'%）。熟字（連對 '+MASTER+' 次）倍率只有 ×1，想賺就往更難的範圍走。</p></div>';
    o+='<div class="vc-row"><h4>題型 <span>倍率＝題型 × 單字難度（會考基本 ×1、進階 ×1.2、片語 ×1／×1.2、多益 Lv1～5 ×1.5／2／3／4／5）</span></h4><div class="bn-terms">'
      +DIFF.map(function(d){ var dis=d.id==='hell'&&!canSpeak(); return '<button type="button" role="radio" data-diff="'+d.id+'" aria-pressed="'+(set.diff===d.id)+'" aria-checked="'+(set.diff===d.id)+'"'+(dis?' disabled':'')+'><b>'+d.n+'</b><span>×'+d.m+'</span><small>'+(dis?'這個瀏覽器不能發音':d.say)+'</small></button>'; }).join('')+'</div>'
      +'<p class="vc-sub">這個範圍＋題型，平均每題 ×'+avgM+'。</p></div>';
    o+='<div class="vc-row"><h4>玩法</h4><div class="vc-modes">'+MODES.map(function(m){
        var dis=m.id==='duel'&&(!pet||pet.trip), why=dis?(pet?'牠去旅行了':'先到「我的森林」領養寵物'):'';
        return '<button type="button" data-mode="'+m.id+'" aria-pressed="'+(set.mode===m.id)+'"'+(dis?' disabled':'')+'><span class="e">'+ART.icon(m.id)+'</span><b>'+m.n+'</b><small>'+(why||m.say)+'</small></button>'; }).join('')+'</div></div>';
    o+='<div class="vc-row"><h4>下注 <span>'+CUR[set.cur].n+'：有 '+bal(set.cur)+'，這把最多 '+cap+'</span></h4><div class="vc-chips">'
      +['pts','chip','star'].map(function(c){ return chipBtn('data-cur',c,set.cur===c,CUR[c].n); }).join('')+'</div>'
      +'<div class="bn-amt"><input type="number" id="vc-bet" min="1" step="1" inputmode="numeric" value="'+Math.min(set.bet,cap)+'" aria-label="下注金額">'
      +(set.cur==='star'?[1,2,3]:[10,20,50,100]).map(function(v){ return '<button type="button" class="btn ghost" data-betq="'+v+'">'+v+'</button>'; }).join('')
      +'<button type="button" class="btn ghost" data-betq="max">最多</button></div>'
      +'<div class="bar-btns"><button class="btn solid" type="button" data-act="start"'+(lock.length||pool.length<4?' disabled':'')+'>'+modeOf(set.mode).e+' 開始</button>'
      +(pool.length<4?'<span class="sub" style="margin:0">範圍裡至少要 4 個字</span>':'<span class="sub" style="margin:0">'+esc(modeOf(set.mode).say)+'</span>')+'</div></div>';
    o+='<p class="vc-sub">答錯的字自動收進錯字本；錯字本複習不用下注、隨時能做，時間算英文讀書分鐘，滿 25 分鐘種一棵英文番茄樹。'
      +'<button type="button" class="btn ghost vc-mute" data-act="mute">'+(s.set.mute?'🔇 音效關':'🔊 音效開')+'</button></p>';
    return o;
  }

  /* ---------- 開局 ---------- */
  function startGame(){
    settleAbandoned(true);
    var s=st(), set=setDef(s), lock=lockState();
    if(lock.length){ msg='🔒 '+lock.join('；'); return render(); }
    var pool=poolOf(set,s); if(pool.length<4){ msg='範圍裡至少要 4 個字。'; return render(); }
    var el=document.getElementById('vc-bet'), bet=el?parseInt(el.value,10):set.bet, cur=set.cur, cap=capOf(cur);
    if(!(bet>=1)){ msg='先填要押多少。'; return render(); }
    if(bet>cap){ msg='這把最多押 '+cap+'（'+(cur==='star'?'🌟 一次最多 3 顆':'50＋今天讀書分鐘')+'）。'; return render(); }
    if(bet>bal(cur)){ msg=CUR[cur].n+'不夠：只有 '+bal(cur)+'。'; return render(); }
    var pet=API.petState?API.petState().pet:null;
    if(set.mode==='duel' && (!pet||pet.trip)){ msg='對賭要寵物在家。'; return render(); }
    set.bet=bet; save(s);
    // 題目：偏向還不熟的字（熟字少出一點）
    var order=shuffle(pool).sort(function(a,b){ return (mastered(s,a.key)?1:0)-(mastered(s,b.key)?1:0)+(Math.random()-.5)*.6; });
    G={mode:set.mode, diff:set.diff, cur:cur, bet:bet, queue:order.map(function(it){ return it.key; }), qi:0, q:null, right:0, wrong:0, n:0, mults:[], hist:[], prize:bet, rung:0, net:0};
    if(G.mode!=='single'){ addCur(cur,-bet,'單字賭場下注'); }
    if(G.mode==='duel'){ var tal=API.talent?API.talent('vocab'):0; G.petAcc=Math.max(.25,Math.min(.97,acc100(s)+(Math.random()*.16-.08)-(tal>=3?.05:0))); G.petScore=0; G.petName=pet.name; }
    if(G.mode==='sprint'){ G.endAt=Date.now()+60000; }
    s=st(); s.cur={mode:G.mode, diff:G.diff, cur:cur, bet:bet, right:0, n:0, pid:PID, at:Date.now()}; save(s);
    msg=''; view='game';
    if(G.mode==='slot'){ G.spinning=true; renderGame(); spin(); return; }
    nextQ();
  }
  function spin(){
    var r=Math.random(), acc=0, res=SLOT[SLOT.length-1][0];
    for(var i=0;i<SLOT.length;i++){ acc+=SLOT[i][1]; if(r<acc){ res=SLOT[i][0]; break; } }
    var reel=app.querySelector('.vc-reel'), lever=app.querySelector('.vc-slotsvg .vc-lever'), n=0, faces=SLOT.map(function(x){ return '×'+x[0]; });
    if(lever) lever.classList.add('pull');
    var iv=setInterval(function(){ n++; if(reel) reel.textContent=faces[n%faces.length]; if(n>=16){ clearInterval(iv); G.spinning=false; G.slot=res; snd(res>=2?'win':(res===0?'bad':'tick'));
      if(res===0){ finish(); } else nextQ(); } },90);
  }
  function nextQ(){
    if(!G) return;
    var s=st(), key=G.queue[G.qi%G.queue.length]; G.qi++;
    var it=BYKEY[key]; G.q=makeQ(it,G.diff,s); G.typed='';
    if(G.mode==='single'){
      if(bal(G.cur)<G.bet){ return finish('錢不夠下一注了'); }
      if(lockState().length && G.n>0){ return finish('現在不能再下注了'); }
      addCur(G.cur,-G.bet,'單字賭場下注'); G.net-=G.bet;
      var s1=st(); if(s1.cur){ s1.cur.net=G.net; save(s1); }
    }
    renderGame();
    if(G.q.listen) speak(BYKEY[G.q.key].w);   // 直接在按鈕的點擊裡念：iPhone 的 Safari 不是使用者點擊觸發的發音會被擋掉
    if(G.endAt || G.q.limit){ if(tick) clearInterval(tick); tick=setInterval(onTick,200); }
    var inp=app.querySelector('#vc-ans'); if(inp) try{ inp.focus({preventScroll:true}); }catch(e){}
  }
  function onTick(){
    if(!G){ clearInterval(tick); tick=null; return; }
    var el=app.querySelector('.vc-timer'), now=Date.now();
    if(G.endAt){ var left=Math.max(0,G.endAt-now); if(el) el.textContent='⏱️ '+Math.ceil(left/1000)+' 秒'; if(left<=0){ clearInterval(tick); tick=null; return finish(); } }
    if(G.q && G.q.limit && !G.q.done){ var ql=Math.max(0,G.q.t0+G.q.limit*1000-now), e2=app.querySelector('.vc-qtimer'); if(e2) e2.textContent=Math.ceil(ql/1000)+' 秒'; if(ql<=0) answer(null); }
  }
  function answer(val){
    var q=G&&G.q; if(!q||q.done) return;
    if(q.kind==='type' && val!==null && !String(val).trim()) return;   // 空白送出不算答錯
    q.done=1;
    var ok=val===null?false:judge(q,val), s=st(), it=BYKEY[q.key];
    record(s,q.key,ok,true); if(s.cur){ s.cur.right=G.right+(ok?1:0); s.cur.n=G.n+1; s.cur.at=Date.now(); }
    G.n++; if(ok) G.right++; else G.wrong++; G.mults.push(q.m); G.hist.push({key:q.key, ok:ok, m:q.m, val:val});
    q.ok=ok; q.val=val; snd(ok?'ok':'bad');
    if(G.mode==='duel'){ var pOk=Math.random()<G.petAcc; if(pOk) G.petScore++; q.pet=pOk; }
    if(G.mode==='single' && ok){ var win=G.cur==='star'?Math.floor(G.bet*q.m):Math.round(G.bet*q.m); G.net+=win; if(s.cur) s.cur.net=G.net; save(s); addCur(G.cur,win,'單字賭場'); }
    else save(s);
    if(G.mode==='ladder'){ if(ok){ G.rung++; G.prize=Math.min(G.bet*10,G.prize*q.m); } else G.prize=0; }
    if(G.mode==='slot'){ G.slotPay=ok?G.bet*G.slot*q.m:0; }
    if(G.mode==='sprint'){
      if(Date.now()>=G.endAt) return finish();
      if(q.kind==='type'){ G.lastFb=(ok?'✅ ':'❌ ')+BYKEY[q.key].w+'＝'+BYKEY[q.key].zh; return nextQ(); }
      renderGame(); setTimeout(function(){ if(G&&G.mode==='sprint'&&G.q===q) nextQ(); },ok?350:900); return;
    }
    var over=(G.mode==='round'||G.mode==='duel')&&G.n>=10 || G.mode==='slot' || (G.mode==='ladder'&&(!ok||G.rung>=10));
    if(over){ renderGame(); setTimeout(function(){ if(G&&G.q===q) finish(); },ok?700:1400); return; }
    renderGame();
  }
  function ratio10(c,M){ if(c<=4) return 0; if(c<=7) return (c-4)/3; return 1+(M-1)*(c-7)/3; }
  function finish(why){
    if(!G) return; if(tick){ clearInterval(tick); tick=null; }
    var g=G, M=g.mults.length?g.mults.reduce(function(a,b){ return a+b; },0)/g.mults.length:1, pay=0, note='';
    if(g.mode==='round'){ pay=g.bet*ratio10(g.right,M); note='答對 '+g.right+'/10，平均 ×'+r2(M); }
    else if(g.mode==='duel'){ pay=g.right>g.petScore?g.bet*M:(g.right===g.petScore?g.bet:0); note='你 '+g.right+' : '+g.petScore+' '+esc(g.petName); }
    else if(g.mode==='ladder'){ pay=g.prize; note='爬到第 '+g.rung+' 階'; }
    else if(g.mode==='sprint'){ pay=Math.min(g.bet*SPRINT_MAX,g.bet*Math.max(0,g.right-g.wrong)/10*M); note='60 秒答 '+g.n+' 題：對 '+g.right+'、錯 '+g.wrong; }
    else if(g.mode==='slot'){ pay=g.slotPay||0; note='拉霸 ×'+g.slot+(g.slot?'，'+(g.right?'答對':'答錯'):''); }
    var s=st();
    if(g.mode==='single'){
      note='答 '+g.n+' 題、對 '+g.right+' 題'; s.cur=null; s.k.net[g.cur]=(s.k.net[g.cur]||0)+g.net; s.k.games++; save(s);
      if(g.cur==='pts' && g.n && window.__award) window.__award(0,'單字賭場：一題一注 '+note,true,{logN:g.net});
      pay=null;
    } else {
      pay=g.cur==='star'?Math.floor(pay):Math.round(pay);
      s.cur=null; s.k.games++; s.k.net[g.cur]=(s.k.net[g.cur]||0)+pay-g.bet;
      if(g.mode==='ladder'&&g.rung>=10) s.k.lad10++;
      if(g.mode==='duel'){ if(g.right>g.petScore) s.k.petW++; else if(g.right<g.petScore) s.k.petL++; }
      save(s);
      addCur(g.cur,pay,'單字賭場：'+modeOf(g.mode).n+'（'+note.replace(/<[^>]+>/g,'')+'）押 '+g.bet+' 拿回 '+pay,pay-g.bet);
    }
    s=st(); s.log.unshift({t:Date.now(),m:g.mode,d:g.diff,c:g.cur,b:g.bet,p:pay==null?g.net:pay,r:g.right,n:g.n,single:pay==null?1:0}); s.log=s.log.slice(0,60); save(s);
    var gain=pay==null?g.net:pay-g.bet;
    if(gain>0){ snd('win'); if(gain>=Math.max(30,g.bet) && window.__fx && window.__fx.banner) window.__fx.banner('🎰 單字賭場贏了 '+gain+' '+CUR[g.cur].u+'！'); }
    if(g.mode==='duel' && API.petTouch) API.petTouch(g.right>g.petScore?'你贏了！我要再多練練 💪':(g.right===g.petScore?'平手！下次再比':'嘿嘿，這次我贏了 😝'));
    R={g:g, pay:pay, gain:gain, note:note, why:why||''}; G=null; view='result'; render();
    if(window.__petRefresh) setTimeout(window.__petRefresh,50);
  }
  function cashOut(){ if(!G) return; if(G.mode==='ladder'){ finish('收手'); } else if(G.mode==='single'){ finish('收手'); } }

  /* ---------- 遊戲畫面 ---------- */
  function petFace(pose){ var p=API.petState?API.petState().pet:null; return p&&API.petMini?API.petMini(p,pose,52):'🐾'; }
  function renderGame(){
    var g=G, q=g.q, it=q?BYKEY[q.key]:null, M=modeOf(g.mode), o='<div class="vc-body vc-game">';
    var head='<div class="vc-ghead"><b>'+M.e+' '+M.n+'</b><span>'+diffOf(g.diff).n+'</span><span>押 '+g.bet+' '+CUR[g.cur].u+'</span>';
    if(g.mode==='round'||g.mode==='duel') head+='<span>第 '+Math.min(10,g.n+(q&&!q.done?1:0))+' / 10 題・對 '+g.right+'</span>';
    if(g.mode==='single') head+='<span>第 '+(g.n+(q&&!q.done?1:0))+' 題・淨 '+(g.net>=0?'+':'')+g.net+'</span>';
    if(g.mode==='ladder') head+='<span>第 '+g.rung+' 階・獎金 <b>'+(g.cur==='star'?Math.floor(g.prize):Math.round(g.prize))+'</b></span>';
    if(g.mode==='sprint' && g.lastFb && q && !q.done) head+='<span class="vc-last">上一題 '+esc(g.lastFb)+'</span>';
    if(g.mode==='sprint') head+='<span class="vc-timer">⏱️ '+Math.ceil(Math.max(0,g.endAt-Date.now())/1000)+' 秒</span><span>對 '+g.right+'・錯 '+g.wrong+'</span>';
    if(g.mode==='slot') head+='<span>拉霸 '+(g.spinning?'轉動中':'×'+g.slot)+'</span>';
    head+='</div>';
    o+=head;
    if(g.mode==='duel') o+='<div class="vc-duel"><div><b>你</b><span class="mono">'+g.right+'</span></div><div class="vc-pet">'+petFace(q&&q.done?(q.pet?'stand':'sulk'):'stand')+'<b>'+esc(g.petName)+'</b><span class="mono">'+g.petScore+'</span>'+(q&&q.done?'<small>'+(q.pet?'牠答對了':'牠答錯了')+'</small>':'<small>牠也在想…</small>')+'</div></div>';
    if(g.mode==='slot' && (g.spinning||!q)){ o+='<div class="vc-slot">'+ART.slot('×?')+'<p class="vc-sub">'+(g.spinning?'轉轉轉…':'')+'</p></div></div>'; app.innerHTML=o; return; }
    if(!q){ app.innerHTML=o+'</div>'; return; }
    o+='<div class="vc-q'+(q.done?(q.ok?' ok':' bad'):'')+'">';
    o+='<div class="vc-qmeta"><span>'+esc(srcName(it,st().set.rg))+'</span><span class="vc-mul'+(q.mast?' m':'')+'">×'+q.m+(q.mast?'（熟字）':'')+'</span>'+(q.limit&&!q.done?'<span class="vc-qtimer">'+q.limit+' 秒</span>':'')+'</div>';
    if(g.diff==='easy') o+='<div class="vc-prompt en">'+esc(it.w)+(canSpeak()?' <button type="button" class="vc-say" data-say="1" aria-label="發音">🔊</button>':'')+'</div><small class="vc-pos">'+esc(it.pos)+'</small>';
    else if(g.diff==='norm') o+='<div class="vc-prompt">'+esc(it.zh)+'</div><small class="vc-pos">'+esc(it.pos)+'</small>';
    else if(g.diff==='hard'){
      if(it.ph) o+='<div class="vc-prompt sm">'+esc(it.zh)+'</div><p class="vc-sent">'+esc(it.s).replace(esc(it.f),'<u>'+blanks(it.f)+'</u>')+'</p>';
      else o+='<div class="vc-prompt">'+esc(it.zh)+'</div><small class="vc-pos">'+esc(it.pos)+'　'+letters(it.w)+' 個字母</small><p class="vc-blank">'+blanks(it.w)+'</p>';
    } else o+='<div class="vc-prompt sm">🎧 聽'+(it.ph?'片語':'單字')+'，拼出來 <button type="button" class="vc-say" data-say="1" aria-label="再聽一次">🔊 再聽</button></div><small class="vc-pos">'+esc(it.pos)+'　'+letters(it.w)+' 個字母</small>';
    if(q.kind==='choice'){
      o+='<div class="vc-opts">'+q.opts.map(function(op,i){ var cls=q.done?(op===q.ans?' right':(op===q.val?' wrong':'')):''; return '<button type="button" data-opt="'+i+'" class="'+cls+'"'+(q.done?' disabled':'')+'><kbd>'+(i+1)+'</kbd>'+esc(op)+'</button>'; }).join('')+'</div>';
    } else {
      o+='<div class="vc-type"><input id="vc-ans" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done" placeholder="打出英文" value="'+esc(q.done?(q.val||''):(g.typed||''))+'"'+(q.done?' disabled':'')+'><button class="btn solid" type="button" data-act="submit"'+(q.done?' disabled':'')+'>送出</button><button class="btn ghost" type="button" data-act="giveup"'+(q.done?' disabled':'')+'>不會</button></div>';
    }
    if(q.done){
      o+='<p class="vc-fb">'+(q.ok?'✅ 答對了！':'❌ '+(q.val===null?'時間到':'答錯了')+'。正確答案：<b>'+esc(q.kind==='choice'?q.ans:q.ans)+'</b>')+'　<span class="vc-pair">'+esc(it.w)+'＝'+esc(it.zh)+'</span>'+(q.ok?'':'（收進錯字本）')+'</p>';
    }
    o+='</div>';
    var btns='';
    if(q.done && g.mode!=='sprint'){
      var over=(g.mode==='round'||g.mode==='duel')&&g.n>=10 || g.mode==='slot' || (g.mode==='ladder'&&(!q.ok||g.rung>=10));
      if(!over){
        btns+='<button class="btn solid" type="button" data-act="next">'+(g.mode==='ladder'?'🪜 繼續爬（下一題）':'下一題 →')+'</button>';
        if(g.mode==='ladder') btns+='<button class="btn" type="button" data-act="cash">💰 收手，拿 '+(g.cur==='star'?Math.floor(g.prize):Math.round(g.prize))+'</button>';
        if(g.mode==='single') btns+='<button class="btn" type="button" data-act="cash">收手</button>';
      } else btns+='<span class="sub" style="margin:0">結算中…</span>';
    }
    if(btns) o+='<div class="bar-btns">'+btns+'</div>';
    o+='</div>';
    app.innerHTML=o;
  }
  function renderResult(){
    var r=R, g=r.g, win=r.gain>0, M=modeOf(g.mode);
    var o='<div class="vc-body"><div class="vc-res '+(win?'win':(r.gain<0?'lose':'even'))+'">'+ART.result(win?'win':(r.gain<0?'lose':'even'))+'<div><b>'+M.e+' '+M.n+'：'+(win?'贏了 '+r.gain+' '+CUR[g.cur].u:(r.gain<0?'輸了 '+(-r.gain)+' '+CUR[g.cur].u:'不賺不賠'))+'</b>'
      +'<small>'+r.note+(r.pay!=null?'。押 '+g.bet+'，拿回 '+r.pay:'')+(r.why?'（'+esc(r.why)+'）':'')+'</small></div></div>';
    if(g.mode==='duel') o+='<div class="vc-duel res">'+petFace(g.right>g.petScore?'sulk':'stand')+'<p>'+esc(g.petName)+'：'+(g.right>g.petScore?'你贏了！我要再多練練 💪':(g.right===g.petScore?'平手！下次再比':'嘿嘿，這次我贏了 😝'))+'</p></div>';
    if(g.hist.length){
      o+='<div class="vc-list"><h4>這局的字 <span>✗ 的已收進錯字本</span></h4>'+g.hist.map(function(h){ var it=BYKEY[h.key]; return '<div class="'+(h.ok?'ok':'bad')+'"><span>'+(h.ok?'✓':'✗')+'</span><b>'+esc(it.w)+'</b><span>'+esc(it.zh)+'</span><small>×'+h.m+'</small></div>'; }).join('')+'</div>';
    }
    o+='<div class="bar-btns"><button class="btn solid" type="button" data-act="again">再來一局</button><button class="btn" type="button" data-view="home">回賭場</button>'
      +(g.hist.some(function(h){ return !h.ok; })?'<button class="btn ghost" type="button" data-view="review0">去錯字本</button>':'')+'</div></div>';
    app.innerHTML=o;
  }

  /* ---------- 錯字本複習（不用下注、隨時能做；時間算英文讀書） ---------- */
  var RV=null;
  function reviewHome(s){
    var due=dueList(s), all=Object.keys(s.wb).filter(function(k){ return BYKEY[k]; }), tal=API.talent?API.talent('vocab'):0;
    var o='<div class="vc-row"><h4>錯字本 <span>答錯的字會進來；隔 1、3、7 天再考，連對 3 次就移出</span></h4>';
    o+='<p class="fp-care">今天到期 <b>'+due.length+'</b> 個・錯字本共 '+all.length+' 個・今天已經複習 '+reviewMinToday()+' 分鐘（算英文讀書分鐘，每題最多算 30 秒、按「不會」不算；滿 25 分鐘種一棵英文番茄樹）'
      +(tal?'。寵物天賦「單字」：每答對一題 +'+tal+' 籌碼':'')+'</p>';
    o+='<div class="bar-btns"><button class="btn solid" type="button" data-act="rvstart"'+(due.length?'':' disabled')+'>開始複習（'+due.length+' 個）</button></div>';
    if(all.length){
      var list=all.map(function(k){ return {k:k, w:s.wb[k]}; }).sort(function(a,b){ return pk(a.w.due)-pk(b.w.due); });
      o+='<div class="vc-list wb">'+list.slice(0,60).map(function(x){ var it=BYKEY[x.k], dd=Math.round((pk(x.w.due)-d0())/864e5);
        return '<div><span>'+'●'.repeat(x.w.ok)+'○'.repeat(3-x.w.ok)+'</span><b>'+esc(it.w)+'</b><span>'+esc(it.zh)+'</span><small>'+(dd<=0?'今天':dd+' 天後')+'</small></div>'; }).join('')+'</div>'
        +(list.length>60?'<p class="vc-sub">只列最早到期的 60 個。</p>':'');
    } else o+='<p class="vc-sub">錯字本是空的。去賭場答錯的字會自動收進來。</p>';
    return o+'</div>';
  }
  function rvStart(){
    var s=st(), due=shuffle(dueList(s)); if(!due.length) return;
    RV={queue:due, i:0, ok:0, bad:0, sec:0, cleared:0, chips:0, q:null}; view='review'; rvNext();
  }
  function rvNext(){
    if(!RV) return;
    if(RV.i>=RV.queue.length){ RV.done=1; return renderReview(); }
    var it=BYKEY[RV.queue[RV.i]]; RV.q={key:it.key, kind:'type', ans:it.ph?it.f:it.w, accept:[it.ph?it.f:it.w].concat(it.ph?[]:it.alt), t0:Date.now(), hint:0}; renderReview();
    var inp=app.querySelector('#vc-ans'); if(inp) try{ inp.focus({preventScroll:true}); }catch(e){}
  }
  function rvAnswer(val){
    var q=RV&&RV.q; if(!q||q.done) return;
    if(val!==null && !String(val).trim()) return;   // 空白送出不算
    q.done=1;
    var ok=val===null?false:judge(q,val), s=st(), sec=(Date.now()-q.t0)/1000, tal=API.talent?API.talent('vocab'):0, pomos=0;
    if(val!==null){ RV.sec+=Math.min(REV_CAP,sec); pomos=addReviewTime(sec); }   // 按「不會」不算讀書時間
    record(s,q.key,ok&&!q.hint,false,ok&&q.hint); s.k.rvAns++;   // 用提示答對：記這次作答，但錯字本進度不歸零
    if(ok){ s.k.rvOk++; RV.ok++; }
    else RV.bad++;
    var w=s.wb[q.key];
    if(w){
      if(ok && !q.hint){ w.ok++; if(w.ok>=3){ delete s.wb[q.key]; s.k.clr++; RV.cleared++; } else { w.lv=Math.min(INT.length-1,w.ok); w.due=addDays(INT[w.lv]); } }
      else if(ok && q.hint){ w.due=addDays(1); }
      else { w.ok=0; w.lv=0; w.due=addDays(1); }
    }
    if(ok && tal){ s.chips+=tal; RV.chips+=tal; }
    save(s); q.ok=ok; q.val=val; snd(ok?'ok':'bad');
    if(pomos) msg='🍅 錯字本複習滿 25 分鐘，種了一棵英文番茄樹！';
    RV.i++; renderReview();
  }
  function renderReview(){
    if(!RV){ view='review0'; return render(); }
    var o='<div class="vc-body vc-game"><div class="vc-ghead"><b>📕 錯字本複習</b><span>'+Math.min(RV.i+(RV.q&&!RV.q.done?1:0),RV.queue.length)+' / '+RV.queue.length+'</span><span>對 '+RV.ok+'・錯 '+RV.bad+'</span><span>已算 '+Math.round(RV.sec/60)+' 分鐘</span></div>';
    if(RV.done){
      o+='<div class="vc-res win"><span class="e">📕</span><div><b>今天的錯字複習完了</b><small>答對 '+RV.ok+'、答錯 '+RV.bad+'；移出錯字本 '+RV.cleared+' 個；算進英文讀書 '+Math.round(RV.sec/60)+' 分鐘'+(RV.chips?'；天賦獎勵 +'+RV.chips+' 籌碼':'')+'。</small></div></div>'
        +'<div class="bar-btns"><button class="btn solid" type="button" data-view="review0">回錯字本</button><button class="btn" type="button" data-view="home">去賭場</button></div></div>';
      app.innerHTML=o; RV=null; if(window.__petRefresh) setTimeout(window.__petRefresh,50); return;
    }
    var q=RV.q, it=BYKEY[q.key], w=st().wb[q.key];
    o+='<div class="vc-q'+(q.done?(q.ok?' ok':' bad'):'')+'"><div class="vc-qmeta"><span>'+esc(SRC[it.src]?SRC[it.src].n:'')+'</span><span>'+(w?'●'.repeat(w.ok)+'○'.repeat(3-w.ok):'')+'</span></div>';
    if(it.ph) o+='<div class="vc-prompt sm">'+esc(it.zh)+'</div><p class="vc-sent">'+esc(it.s).replace(esc(it.f),'<u>'+blanks(it.f)+'</u>')+'</p>';
    else o+='<div class="vc-prompt">'+esc(it.zh)+(canSpeak()?' <button type="button" class="vc-say" data-say="1" aria-label="發音">🔊</button>':'')+'</div><small class="vc-pos">'+esc(it.pos)+'　'+letters(it.w)+' 個字母'+(q.hint?'　提示：'+esc(it.w.charAt(0))+'…':'')+'</small><p class="vc-blank">'+blanks(it.w)+'</p>';
    o+='<div class="vc-type"><input id="vc-ans" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done" placeholder="打出英文" value="'+esc(q.done?(q.val||''):'')+'"'+(q.done?' disabled':'')+'><button class="btn solid" type="button" data-act="rvsubmit"'+(q.done?' disabled':'')+'>送出</button>'
      +'<button class="btn ghost" type="button" data-act="rvhint"'+(q.done||q.hint?' disabled':'')+'>提示</button><button class="btn ghost" type="button" data-act="rvgiveup"'+(q.done?' disabled':'')+'>不會</button></div>';
    if(q.done) o+='<p class="vc-fb">'+(q.ok?'✅ 答對了'+(q.hint?'（用了提示或發音，進度不變，明天再考一次）':''):'❌ 正確答案：<b>'+esc(q.ans)+'</b>，明天再考')+'　<span class="vc-pair">'+esc(it.w)+'＝'+esc(it.zh)+'</span></p>';
    o+='</div>';
    if(q.done) o+='<div class="bar-btns"><button class="btn solid" type="button" data-act="rvnext">'+(RV.i>=RV.queue.length?'看結果':'下一個 →')+'</button><button class="btn ghost" type="button" data-act="rvstop">先停在這裡</button></div>';
    o+='<p class="fp-msg" aria-live="polite">'+msg+'</p></div>';
    app.innerHTML=o;
  }

  /* ---------- 籌碼與獎品 ---------- */
  function shopHtml(s){
    var pts=bal('pts'), debt=lockState().filter(function(x){ return /負的|欠銀行/.test(x); });
    var o='<div class="vc-row"><h4>換籌碼 <span>1 點 = 1 籌碼；籌碼換回點數打 8 折（10 籌碼 = 8 點）</span></h4>'
      +(debt.length?'<p class="fp-care bad">'+debt.join('；')+'：先還清才能換籌碼。</p>':'')
      +'<div class="bn-amt"><input type="number" id="vc-chipn" min="1" step="1" inputmode="numeric" placeholder="數量" aria-label="數量"><button class="btn ghost" type="button" data-chipq="50">50</button><button class="btn ghost" type="button" data-chipq="100">100</button></div>'
      +'<div class="bar-btns"><button class="btn solid" type="button" data-act="buychips"'+(debt.length?' disabled':'')+'>用點數買籌碼</button><button class="btn" type="button" data-act="sellchips">籌碼換回點數</button><span class="sub" style="margin:0">點數 '+pts+'・籌碼 '+s.chips+'</span></div></div>';
    o+='<div class="vc-row"><h4>獎品 <span>用籌碼換，只有賭場拿得到</span></h4><div class="bn-ex">'+PRIZES.map(function(p){
        var own=p.k==='acc'?(API.hasAcc&&API.hasAcc(p.id)):!!s.own[p.id];
        return '<button type="button" data-prize="'+p.id+'"'+(own||s.chips<p.c?' disabled':'')+'><span class="e">'+p.e+'</span><b>'+esc(p.n)+'</b><small>'+(own?'已擁有':p.c+' 籌碼'+(p.say?'・'+esc(p.say):''))+'</small></button>'; }).join('')+'</div>';
    var bgs=BGS.filter(function(b){ return !b.id||s.own[b.id]; });
    o+='<div class="vc-chips" style="margin-top:10px">背景：'+bgs.map(function(b){ return chipBtn('data-bg',b.id||'none',(s.set.bg||'')===b.id,esc(b.n)); }).join('')+'</div>'
      +'<p class="vc-sub">買到的稱號到「成就 → 稱號」選。</p></div>';
    return o;
  }
  function buyChips(sell){
    var el=document.getElementById('vc-chipn'), n=el?parseInt(el.value,10):0, s=st();
    if(!(n>0)){ msg='先填數量。'; return render(); }
    if(!sell){
      if(lockState().some(function(x){ return /負的|欠銀行/.test(x); })){ msg='先把欠的還清。'; return render(); }
      if(n>bal('pts')){ msg='點數只有 '+bal('pts')+'。'; return render(); }
      window.__award(-n,'單字賭場：換 '+n+' 籌碼',true); s=st(); s.chips+=n; save(s); msg='換到 '+n+' 籌碼。';
    } else {
      n=Math.floor(n/10)*10; if(n<10){ msg='一次至少換 10 籌碼（換 8 點）。'; return render(); }
      if(n>s.chips){ msg='籌碼只有 '+s.chips+'。'; return render(); }
      s.chips-=n; save(s); var back=Math.round(n*CHIP_BACK); window.__award(back,'單字賭場：'+n+' 籌碼換回點數',true); msg=n+' 籌碼換回 '+back+' 點。';
    }
    render();
  }
  function buyPrize(id){
    var p=PRIZES.filter(function(x){ return x.id===id; })[0], s=st(); if(!p||s.chips<p.c) return;
    if(p.k==='acc'){ if(API.hasAcc&&API.hasAcc(id)) return; if(!confirm('用 '+p.c+' 籌碼換「'+p.n+'」？')) return; s.chips-=p.c; save(s); API.giveAcc(id); msg='換到 '+p.e+' '+p.n+'！到「我的森林 → 家 → 穿戴」幫牠戴上。'; }
    else { if(s.own[id]) return; if(!confirm('用 '+p.c+' 籌碼換「'+p.n+'」？')) return; s.chips-=p.c; s.own[id]=1; if(p.k==='bg') s.set.bg=id; save(s); msg='換到 '+p.e+' '+p.n+'！'+(p.k==='title'?'到「成就 → 稱號」選。':''); }
    if(window.__fx && window.__fx.unlock) window.__fx.unlock(null,p.n);
    render(); if(window.__petRefresh) setTimeout(window.__petRefresh,50);
  }

  /* ---------- 統計 ---------- */
  function statsHtml(s){
    var o='<div class="vc-row"><h4>各範圍熟字 <span>連對 '+MASTER+' 次算熟字</span></h4><div class="vc-bars">';
    [['kb','會考基本 1200'],['ka','會考進階 800'],['ph','片語'],['t1','多益 Level 1'],['t2','多益 Level 2'],['t3','多益 Level 3'],['t4','多益 Level 4'],['t5','多益 Level 5']].forEach(function(r){
      var L=ALL.filter(function(it){ return inRange(it,[r[0]],s); }); if(!L.length) return; var m=L.filter(function(it){ return mastered(s,it.key); }).length, seen=L.filter(function(it){ return s.ws[it.key]; }).length;
      o+='<div><span>'+r[1]+'</span><div class="bar"><i style="width:'+(L.length?Math.round(m/L.length*100):0)+'%"></i></div><small>熟字 '+m+' / '+L.length+'・考過 '+seen+'</small></div>'; });
    o+='</div></div>';
    var a=s.rec.length?Math.round(s.rec.reduce(function(x,y){ return x+y; },0)/s.rec.length*100):0;
    o+='<div class="vc-row"><h4>戰績</h4><ul class="bn-ul"><li>玩了 '+s.k.games+' 局、答了 '+s.k.ans+' 題、答對 '+s.k.ok+' 題；最近 '+s.rec.length+' 題答對率 '+a+'%；最長連對 '+s.k.best+' 題</li>'
      +'<li>淨輸贏：點數 '+sg(s.k.net.pts)+'、籌碼 '+sg(s.k.net.chip)+'、🌟 '+sg(s.k.net.star)+'</li>'
      +'<li>爬梯爬滿 10 階 '+s.k.lad10+' 次；跟寵物對賭 '+s.k.petW+' 勝 '+s.k.petL+' 敗</li>'
      +'<li>錯字本：複習 '+s.k.rvAns+' 題、答對 '+s.k.rvOk+'、移出 '+s.k.clr+' 個；今天複習 '+reviewMinToday()+' 分鐘</li></ul></div>';
    o+='<div class="vc-row"><h4>最近的局</h4>'+(s.log.length?s.log.slice(0,20).map(function(l){ var d=new Date(l.t), gain=l.single?l.p:l.p-l.b;
        return '<div class="bn-log"><span class="mono">'+(d.getMonth()+1)+'/'+d.getDate()+' '+hm(d.getHours()*60+d.getMinutes())+'</span><span class="mono '+(gain>0?'up':(gain<0?'dn':''))+'">'+sg(gain)+'</span><span>'+modeOf(l.m).e+' '+modeOf(l.m).n+'・'+diffOf(l.d).n+'・'+CUR[l.c].n+(l.ab?'（沒打完）':'')+'・對 '+l.r+'/'+l.n+'</span></div>'; }).join(''):'<p class="vc-sub">還沒玩過。</p>')+'</div>';
    return o;
  }
  function sg(n){ return (n>0?'+':'')+(n||0); }

  /* ---------- 事件 ---------- */
  app.addEventListener('click',function(e){
    var b=e.target.closest('button'); if(!b||b.disabled) return;
    var s=st(), set=setDef(s);
    if(b.dataset.say){
      var it=G&&G.q?BYKEY[G.q.key]:(RV&&RV.q?BYKEY[RV.q.key]:null); if(!it) return;
      if(!G && RV && RV.q && !RV.q.done && !RV.q.hint){ RV.q.hint=1; speak(it.w); renderReview(); var hi=document.getElementById('vc-ans'); if(hi) hi.focus(); return; }   // 錯字本：聽發音等於看提示
      speak(it.w); return;
    }
    if(b.dataset.view){ if(G) return; view=b.dataset.view==='review'?'review0':b.dataset.view; R=null; msg=''; return render(); }
    if(b.dataset.rg){ var i=set.rg.indexOf(b.dataset.rg); if(i>=0){ if(set.rg.length>1) set.rg.splice(i,1); } else set.rg.push(b.dataset.rg); save(s); return render(); }
    if(b.dataset.let){ if(b.dataset.let==='*') set.let=''; else set.let=set.let.indexOf(b.dataset.let)>=0?set.let.replace(b.dataset.let,''):(set.let+b.dataset.let).split('').sort().join(''); save(s); return render(); }
    if(b.dataset.pos){ var j=set.pos.indexOf(b.dataset.pos); if(j>=0) set.pos.splice(j,1); else set.pos.push(b.dataset.pos); save(s); return render(); }
    if(b.dataset.diff){ set.diff=b.dataset.diff; save(s); return render(); }
    if(b.dataset.mode){ set.mode=b.dataset.mode; save(s); return render(); }
    if(b.dataset.cur){ set.cur=b.dataset.cur; set.bet=set.cur==='star'?1:20; save(s); return render(); }
    if(b.dataset.betq){ var inp=document.getElementById('vc-bet'); if(inp){ inp.value=b.dataset.betq==='max'?Math.max(1,Math.min(capOf(set.cur),bal(set.cur))):b.dataset.betq; } return; }
    if(b.dataset.chipq){ var ci=document.getElementById('vc-chipn'); if(ci) ci.value=b.dataset.chipq; return; }
    if(b.dataset.prize) return buyPrize(b.dataset.prize);
    if(b.dataset.bg){ var bg=b.dataset.bg==='none'?'':b.dataset.bg; if(bg && !s.own[bg]) return; s.set.bg=bg; save(s); return render(); }
    if(b.dataset.opt!==undefined && G && G.q){ if(Date.now()-G.q.t0<250) return; return answer(G.q.opts[+b.dataset.opt]); }
    var act=b.dataset.act;
    if(act==='start') return startGame();
    if(act==='again'){ R=null; view='home'; return startGame(); }
    if(act==='mute'){ s.set.mute=!s.set.mute; save(s); return render(); }
    if(act==='submit'){ var a=document.getElementById('vc-ans'); return answer(a?a.value:''); }
    if(act==='giveup') return answer(null);
    if(act==='next') return nextQ();
    if(act==='cash') return cashOut();
    if(act==='buychips') return buyChips(false);
    if(act==='sellchips') return buyChips(true);
    if(act==='rvstart'){ msg=''; return rvStart(); }
    if(act==='rvsubmit'){ var a2=document.getElementById('vc-ans'); return rvAnswer(a2?a2.value:''); }
    if(act==='rvgiveup') return rvAnswer(null);
    if(act==='rvhint'){ if(RV&&RV.q&&!RV.q.done){ RV.q.hint=1; renderReview(); var ii=document.getElementById('vc-ans'); if(ii) ii.focus(); } return; }
    if(act==='rvnext'){ msg=''; return rvNext(); }
    if(act==='rvstop'){ RV=null; view='review0'; msg=''; if(window.__petRefresh) setTimeout(window.__petRefresh,50); return render(); }
  });
  app.addEventListener('input',function(e){ if(e.target.id==='vc-ans' && G) G.typed=e.target.value; });
  app.addEventListener('keydown',function(e){
    if(e.target.id==='vc-ans' && e.key==='Enter'){ e.preventDefault(); e.stopPropagation(); if(RV&&RV.q&&!RV.q.done) rvAnswer(e.target.value); else if(G&&G.q&&!G.q.done) answer(e.target.value); return; }
  });
  document.addEventListener('keydown',function(e){
    if(window.__tab!==5 || window.__sub!==22 || !G || !G.q || G.q.done || G.q.kind!=='choice') return;
    if(/INPUT|TEXTAREA|SELECT/.test((document.activeElement||{}).tagName||'')) return;
    var n=parseInt(e.key,10); if(n>=1&&n<=4){ e.preventDefault(); answer(G.q.opts[n-1]); }
  });
  // 按 Enter 進下一題（選擇題答完後）
  document.addEventListener('keydown',function(e){
    if(e.key!=='Enter' || e.defaultPrevented || window.__tab!==5 || window.__sub!==22) return;
    if(e.target && e.target.id==='vc-ans') return;
    if(/INPUT|TEXTAREA|SELECT|BUTTON/.test((document.activeElement||{}).tagName||'')) return;
    if(G&&G.q&&G.q.done&&G.mode!=='sprint'){ var nb=app.querySelector('[data-act="next"]'); if(nb){ e.preventDefault(); nextQ(); } }
    else if(RV&&RV.q&&RV.q.done){ e.preventDefault(); rvNext(); }
  });

  /* ---------- 給 index.html 的出入口 ---------- */
  window.__casino={
    show:function(){ if(!G && !RV && view!=='result') render(); else if(!ALL) render(); },
    due:function(){ return ALL?dueList(st()).length:null; }
  };
  settleAbandoned();
  render();
})();
