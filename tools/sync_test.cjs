// sync.js 的測試（2026-11-28）：node tools/sync_test.cjs
// 重現 11/28 的情況：一台資料停在 11/22 的裝置照舊資料結算（寵物離家、保管費、重複扣點），再跟雲端合併。
'use strict';
const SM = require('../sync.js');
let fail = 0, pass = 0;
function ok(c, msg) { if (c) pass++; else { fail++; console.log('✗', msg); } }
const S = (o) => JSON.stringify(o);
function mergeKey(k, b, l, r, lt, rt) {
  const res = SM.merge({ [k]: S(b) }, { [k]: S(l) }, { [k]: S(r) }, { keys: [k], lt: { [k]: lt || 0 }, rt: { [k]: rt || 0 } });
  return { v: JSON.parse(res.doc[k]), res };
}

// ---- 1. 點數：同一筆逾期扣點兩台都扣了 → 只算一次 ----
{
  const b = { pts: 100, ad: {}, log: [] };
  const l = { pts: 50, ad: { 'p|A': -50 }, log: [{ t: 2, n: '－50', w: '逾期 A', a: 'p|A' }] };
  const r = { pts: 50, ad: { 'p|A': -50 }, log: [{ t: 1, n: '－50', w: '逾期 A', a: 'p|A' }] };
  const { v } = mergeKey('plan.shop.v1', b, l, r, 2, 1);
  ok(v.pts === 50, '重複扣點只算一次，pts 應 50，得 ' + v.pts);
  ok(v.log.filter((x) => x.a === 'p|A').length === 1, '紀錄只留一筆');
}
// 累計型：雲端扣到第 3 天（−30），這台也從第 1 天扣到第 3 天
{
  const b = { pts: 90, ad: { 'p|A': -10 }, log: [] };
  const l = { pts: 70, ad: { 'p|A': -30 }, log: [{ t: 2, n: '－20', w: 'x', a: 'p|A' }] };
  const r = { pts: 70, ad: { 'p|A': -30 }, log: [{ t: 1, n: '－20', w: 'x', a: 'p|A' }] };
  const { v } = mergeKey('plan.shop.v1', b, l, r, 2, 1);
  ok(v.pts === 70, '累計扣點只算一次，pts 應 70，得 ' + v.pts);
}
// 只有這台有的編號：真的是新的，照留；別的加減照常相加
{
  const b = { pts: 100, ad: {}, log: [] };
  const l = { pts: 95, ad: { 'p|A': -5 }, log: [{ t: 2, n: '－5', w: 'x', a: 'p|A' }] };
  const r = { pts: 110, ad: {}, log: [{ t: 1, n: '＋10', w: '完成：y' }] };
  const { v } = mergeKey('plan.shop.v1', b, l, r, 2, 1);
  ok(v.pts === 105, '只有一邊的效果照留，pts 應 105，得 ' + v.pts);
  ok(v.log.length === 2, '兩邊的紀錄都在');
}
// ---- 2. 銀行：同一天這台算成保管費、雲端算成利息 → 用雲端的 ----
{
  const b = { sav: 1000, ad: {}, log: [], st: { int: 0, fee: 0 } };
  const l = { sav: 970, ad: { 'd|2026-11-27': -30 }, log: [{ t: 2, n: -30, w: '11/27 沒照顧，保管費 3%', a: 'd|2026-11-27' }], st: { int: 0, fee: 30 } };
  const r = { sav: 1010, ad: { 'd|2026-11-27': 10 }, log: [{ t: 1, n: 10, w: '11/27 活存利息', a: 'd|2026-11-27' }], st: { int: 10, fee: 0 } };
  const { v } = mergeKey('plan.bank.v1', b, l, r, 2, 1);
  ok(v.sav === 1010, '同一天只留雲端的結果，sav 應 1010，得 ' + v.sav);
  ok(v.st.fee === 0 && v.st.int === 10, '統計的保管費扣回來：fee ' + v.st.fee + ' int ' + v.st.int);
  ok(!v.log.some((x) => /保管費/.test(x.w)), '保管費那筆紀錄拿掉');
  ok(v.ad['d|2026-11-27'] === 10, '帳上記雲端那筆');
}
// 定存到期兩台都付了 → 只付一次
{
  const b = { sav: 500, ad: {}, log: [], st: {} };
  const l = { sav: 575, ad: { 'f|x1': 75 }, log: [{ t: 2, n: 75, w: '到期', a: 'f|x1' }], st: {} };
  const r = { sav: 575, ad: { 'f|x1': 75 }, log: [{ t: 1, n: 75, w: '到期', a: 'f|x1' }], st: {} };
  const { v } = mergeKey('plan.bank.v1', b, l, r, 2, 1);
  ok(v.sav === 575, '定存只付一次，sav 應 575，得 ' + v.sav);
}
// 過渡期：雲端是舊版網站寫的（沒有編號帳），但已經結算過那幾天、那筆定存也到期了 → 這台舊資料算的不收
{
  const b = { sav: 1000, last: '2026-11-22', fixed: [{ id: 'x1', amt: 50, st: 'open' }], log: [], st: { int: 0, fee: 0 } };
  const l = { sav: 1000 - 30 - 29 + 75 + 5, last: '2026-11-27', fixed: [{ id: 'x1', amt: 50, st: 'ok', pay: 75 }],
    ad: { 'd|2026-11-23': -30, 'd|2026-11-24': -29, 'f|x1': 75, 'x|手動': 5 }, log: [{ t: 3, n: -30, w: '保管費', a: 'd|2026-11-23' }, { t: 4, n: 5, w: '手動存', a: 'x|手動' }], st: { int: 0, fee: 59 } };
  const r = { sav: 1000 + 20 + 75, last: '2026-11-27', fixed: [{ id: 'x1', amt: 50, st: 'ok', pay: 75 }], log: [{ t: 1, n: 20, w: '利息' }], st: { int: 20, fee: 0 } };
  const { v } = mergeKey('plan.bank.v1', b, l, r, 9e12, 1);
  ok(v.sav === 1100, '雲端已結算的日子、已付的定存不再收，只留這台真的新的：sav 應 1100，得 ' + v.sav);
  ok(v.st.fee === 0, '保管費統計扣回：' + v.st.fee);
  ok(!v.log.some((x) => /保管費/.test(x.w)) && v.log.some((x) => x.a === 'x|手動'), '保管費紀錄拿掉、真的新的留著');
}
// 過渡期：點數。雲端（舊版、沒有編號帳）已經照檢查扣過逾期點數、領過成就 → 這台重複的不算
{
  const K = '2026-11-21|段考王 第 8 回';
  const docs = (shop, chk, ach) => ({ 'plan.shop.v1': S(shop), 'plan.checks.v1': S(chk), 'plan.ach.v1': S(ach) });
  const b = docs({ pts: 100, log: [] }, { items: { [K]: { st: 'pending', pt: 0 } } }, { r: { fixok: 1 }, c: {} });
  const l = docs({ pts: 100 - 50 + 10, ad: { ['p|' + K]: -50, 'a|fixok|1': 10 }, log: [{ t: 9, n: '－50', w: '逾期', a: 'p|' + K }, { t: 9, n: '＋10', w: '成就', a: 'a|fixok|1' }] },
    { items: { [K]: { st: 'late', pd: 4, pt: 50 } } }, { r: { fixok: 1 }, c: { fixok: 1 } });
  const r = docs({ pts: 100 - 50 + 10 + 7, log: [{ t: 1, n: '－50', w: '逾期' }, { t: 2, n: '＋10', w: '成就' }, { t: 3, n: '＋7', w: '完成：x' }] },
    { items: { [K]: { st: 'late', pd: 4, pt: 50 } } }, { r: { fixok: 1 }, c: { fixok: 1 } });
  const res = SM.merge(b, l, r, { keys: Object.keys(b), lt: {}, rt: {} });
  const v = JSON.parse(res.doc['plan.shop.v1']);
  ok(v.pts === 67, '雲端已扣過的逾期點數、已領過的成就不重複：pts 應 67，得 ' + v.pts);
  ok(!v.log.some((x) => x.a), '重複的紀錄拿掉：' + S(v.log));
}
// ---- 3. 寵物：舊資料算出離家、雲端那隻好好的 → 留下 ----
const pet = (last, neglect) => ({ name: '馬鈴鼠', born: '2026-10-26', last, neglect, lvSeen: 8 });
const gone = { name: '馬鈴鼠', sp: 'hamster', born: '2026-10-26', left: '2026-11-27', lv: 8, where: '東京' };
{
  const b = { pet: pet('2026-11-22', 0), gone: [], dead: [], wilt: [], fLast: '2026-11-22', gold: 5 };
  const l = { pet: null, gone: [gone], justLeft: '馬鈴鼠在東京住下來，不回來了', dead: ['t1', 't2'], wilt: [{ d: '2026-11-25', idx: ['t3'] }], fLast: '2026-11-27', gold: 5 };
  const r = { pet: pet('2026-11-27', 0), gone: [], dead: [], wilt: [], fLast: '2026-11-27', gold: 7 };
  const { v } = mergeKey('plan.pet.v1', b, l, r, 9e12, 1);   // 這台的時間比較新（以前就是這樣輸的）
  ok(v.pet && v.pet.name === '馬鈴鼠' && v.pet.last === '2026-11-27', '寵物留下');
  ok(v.gone.length === 0, '離家紀錄拿掉');
  ok(!v.justLeft, '離家通知拿掉');
  ok(v.dead.length === 0 && v.wilt.length === 0, '枯樹用雲端的：dead ' + v.dead.length + ' wilt ' + v.wilt.length);
  ok(v.gold === 7, '其他欄位照常合併');
}
// 反過來：雲端是舊資料算出的離家、這台好好的
{
  const b = { pet: pet('2026-11-22', 0), gone: [] };
  const l = { pet: pet('2026-11-27', 0), gone: [] };
  const r = { pet: null, gone: [gone], justLeft: 'x' };
  const { v } = mergeKey('plan.pet.v1', b, l, r, 1, 9e12);
  ok(v.pet && v.gone.length === 0, '雲端的錯誤離家也擋得住');
}
// 真的離家：還在的那邊只算到前一天 → 照樣離家
{
  const b = { pet: pet('2026-11-25', 3), gone: [] };
  const l = { pet: null, gone: [gone] };
  const r = { pet: Object.assign(pet('2026-11-26', 4), { hunger: 10 }), gone: [] };
  const { v } = mergeKey('plan.pet.v1', b, l, r, 2, 1);
  ok(!v.pet && v.gone.length === 1, '真的離家不會被救回');
}
// 寵物沒離家、但舊資料算出「連續 2 天沒照顧、生病」，森林也枯了兩天 → 用另一邊（那兩天其實有照顧）
{
  const b = { pet: pet('2026-11-25', 0), gone: [], wilt: [], dead: ['old'], fLast: '2026-11-25' };
  const l = { pet: Object.assign(pet('2026-11-27', 2), { sick: true, okRun: 0, bond: 40 }), gone: [], wilt: [{ d: '2026-11-26', idx: ['a'] }, { d: '2026-11-27', idx: ['b'] }], dead: ['old'], fLast: '2026-11-27' };
  const r = { pet: Object.assign(pet('2026-11-27', 0), { sick: false, okRun: 9, bond: 46 }), gone: [], wilt: [], dead: ['old'], fLast: '2026-11-27' };
  const { v } = mergeKey('plan.pet.v1', b, l, r, 9e12, 1);
  ok(v.pet.neglect === 0 && !v.pet.sick && v.pet.okRun === 9 && v.pet.bond === 46, '照顧狀態用看到比較多照顧的那邊：' + S(v.pet));
  ok(v.wilt.length === 0 && v.dead.length === 1, '那兩天的枯萎拿掉：' + S(v.wilt));
}
// 定存到期被重複算：狀態也用雲端的（不會顯示違約）
{
  const b = { sav: 500, last: '2026-11-22', fixed: [{ id: 'x2', amt: 200, st: 'open', miss: 1 }, { id: 'x3', amt: 50, st: 'open', miss: 0 }], log: [], st: { fixOk: 1, fixBad: 0 } };
  const l = { sav: 500 - 15 + 200, last: '2026-11-27', fixed: [{ id: 'x2', amt: 200, st: 'bad', broke: 1, miss: 5, pay: 200 }, { id: 'x3', amt: 50, st: 'open', miss: 5, broke: 1 }],
    ad: { 'd|2026-11-23': -15, 'f|x2': 200 }, log: [], st: { fixOk: 1, fixBad: 1 } };
  const r = { sav: 500 + 300 + 5, last: '2026-11-27', fixed: [{ id: 'x2', amt: 200, st: 'ok', miss: 1, pay: 300 }, { id: 'x3', amt: 50, st: 'open', miss: 0 }], log: [], st: { fixOk: 2, fixBad: 0 } };
  const { v } = mergeKey('plan.bank.v1', b, l, r, 9e12, 1);
  ok(v.sav === 805, '定存只算雲端那次：sav 應 805，得 ' + v.sav);
  ok(v.fixed[0].st === 'ok' && v.fixed[0].pay === 300, '那筆定存的狀態用雲端的：' + S(v.fixed[0]));
  ok(v.st.fixBad === 0 && v.st.fixOk === 2, '到期統計扣回：' + S(v.st));
  ok(v.fixed[1].miss === 0 && !v.fixed[1].broke, '還沒到期的定存，沒照顧天數用雲端的：' + S(v.fixed[1]));
}
// ---- 4. 今天清單 ----
const task = (id, n) => ({ id, n, t: '08:00', m: 60 });
{   // 同一天、欠帳從不同天算來：用從比較晚那天算來的，勾選照名稱留下
  const b = { day: '2026-11-22', list: [task('t0@2026-11-22', '舊')], done: {}, backlog: [] };
  const l = { day: '2026-11-28', rf: '2026-11-22', list: [task('b0@2026-11-28', '舊欠帳'), task('t0@2026-11-28', '補習重點回想'), task('t1@2026-11-28', '雄科班補習')], backlog: [{ n: '舊欠帳' }], done: { 't0@2026-11-28': 1 }, doneAt: { 't0@2026-11-28': 5 } };
  const r = { day: '2026-11-28', rf: '2026-11-27', list: [task('t0@2026-11-28', '嘉中化學'), task('t1@2026-11-28', '補習重點回想'), task('t2@2026-11-28', '雄科班補習')], backlog: [], done: { 't2@2026-11-28': 1 } };
  const { v } = mergeKey('plan.state.v3', b, l, r, 9e12, 1);
  ok(v.rf === '2026-11-27' && v.backlog.length === 0, '用從 11/27 算來的清單');
  ok(v.done['t1@2026-11-28'] && v.done['t2@2026-11-28'] && Object.keys(v.done).length === 2, '兩邊的勾選都留：' + S(v.done));
  ok(v.doneAt['t1@2026-11-28'] === 5, '完成時間跟著名稱');
}
{   // 雲端是舊版網站（沒記 rf）：看每日紀錄推算是從哪天換過來的
  const docs = (st, hist) => ({ 'plan.state.v3': S(st), 'plan.hist.v1': S(hist) });
  const b = docs({ day: '2026-11-22', list: [], done: {} }, { '2026-11-21': { d: 1 } });
  const l = docs({ day: '2026-11-28', rf: '2026-11-22', list: [task('b0@2026-11-28', '舊欠帳'), task('t0@2026-11-28', 'A')], backlog: [{ n: '舊欠帳' }], done: { 't0@2026-11-28': 1 } }, { '2026-11-21': { d: 1 }, '2026-11-22': { d: 1 } });
  const r = docs({ day: '2026-11-28', list: [task('t0@2026-11-28', 'A')], backlog: [], done: {} }, { '2026-11-21': { d: 1 }, '2026-11-27': { d: 2 } });
  const res = SM.merge(b, l, r, { keys: Object.keys(b), lt: { 'plan.state.v3': 9e12 }, rt: {} });
  const v = JSON.parse(res.doc['plan.state.v3']);
  ok(v.backlog.length === 0 && v.list.length === 1 && v.rf === '2026-11-27', '舊版雲端也能比出誰比較新：' + S({ rf: v.rf, backlog: v.backlog }));
  ok(v.done['t0@2026-11-28'] === 1, '勾選照名稱留下');
}
{   // 日期不同：用比較晚那天
  const b = { day: '2026-11-27', list: [], done: {} };
  const l = { day: '2026-11-27', list: [task('t0@2026-11-27', 'a')], done: { 't0@2026-11-27': 1 } };
  const r = { day: '2026-11-28', rf: '2026-11-27', list: [task('t0@2026-11-28', 'b')], done: {} };
  const { v } = mergeKey('plan.state.v3', b, l, r, 9e12, 1);
  ok(v.day === '2026-11-28' && v.list[0].n === 'b' && !v.done['t0@2026-11-27'], '日期不同用比較晚那天');
}
{   // 同一天、同一個 rf：照舊的合併（勾選照 id）
  const b = { day: '2026-11-28', rf: '2026-11-27', list: [task('t0@2026-11-28', 'a'), task('t1@2026-11-28', 'b')], done: {} };
  const l = Object.assign({}, b, { done: { 't0@2026-11-28': 1 } });
  const r = Object.assign({}, b, { done: { 't1@2026-11-28': 1 } });
  const { v } = mergeKey('plan.state.v3', b, l, r, 2, 1);
  ok(v.done['t0@2026-11-28'] && v.done['t1@2026-11-28'], '一般情況照舊合併');
}
// ---- 5. 舊規則沒壞 ----
{
  const { v } = mergeKey('plan.shop.v1', { pts: 10, log: [] }, { pts: 15, log: [] }, { pts: 13, log: [] }, 2, 1);
  ok(v.pts === 18, '沒有編號帳時點數照舊相加：' + v.pts);
  const h = SM.merge({ 'plan.hist.v1': S({ '2026-11-27': { a: 4, d: 1, m: 30 } }) }, { 'plan.hist.v1': S({ '2026-11-27': { a: 4, d: 3, m: 90 } }) }, { 'plan.hist.v1': S({ '2026-11-27': { a: 4, d: 2, m: 60 } }) }, { keys: ['plan.hist.v1'] });
  ok(JSON.parse(h.doc['plan.hist.v1'])['2026-11-27'].d === 3, '每日紀錄挑勾比較多的');
}
console.log((fail ? '✗ ' + fail + ' 項失敗，' : '✓ 全部通過，') + pass + ' 項通過');
process.exit(fail ? 1 : 0);
