// 產生「Claude 補登連結」（2026-11-07）：番茄鐘做完卻因為手機清掉資料沒記到、點數算錯要補，Claude 在筆電執行這支程式。
// 和過關連結共用同一把私鑰（%USERPROFILE%\.claude\study-pass\pass_key.pem，不在 OneDrive、不在 repo），網站用 index.html 的 PUBKEY 驗證。
// 每個連結只能用一次（記在 plan.checks.v1 的 used，會同步）。內容有 d:'fix'，和過關連結分開，不能互換。
// 用法：
//   補一顆番茄鐘：node tools/make_fix.mjs pomo --day 2026-11-07 --end 14:47 --min 50 --subj soc [--orig 1794034024375] [--why "手機清快取"]
//     --subj：chi 國文、math 數學、eng 英文、sci 自然、soc 社會、kbm 科班資優數學、kbs 科班自然學科
//     --end：那顆番茄鐘結束的時間（HH:MM）；--orig：雲端備份裡那顆計時的 endAt（毫秒），網站會順便停掉還在跑的同一顆，避免算兩次
//   刪掉沒人在時計時器自己記的番茄鐘（2026-11-19）：node tools/make_fix.mjs pomodel --from "2026-11-19 00:50" --to "2026-11-19 13:55" --pp 6 --why "…"
//     只刪 from～to 之間計時器記的（補登、錯字本的不動）；--pp：每顆要扣回幾點（看點數紀錄那顆實際給了多少），一次最多扣 500
//   延後檢查期限（2026-11-20 段考週）：node tools/make_fix.mjs chkdelay --file keys.json --from 2026-11-21 --days 7 --why "…"
//     keys.json＝plan.checks.v1 items 的 key 陣列；from 以後才扣的點退回、才枯的樹苗救回；逾期第 1 天往後 days 天（已扣的不退）
//   救回枯掉的檢查樹苗（2026-11-20）：node tools/make_fix.mjs revive --file keys.json --why "…"
//     keys.json 同上；只救樹苗，扣過的點不退、期限不動
//   特別任務過關 → 特殊娃娃機限時開放（2026-11-21）：node tools/make_fix.mjs claw --hours 48 --task "超修：…" --why "…"
//     --hours 1～168（從他點開連結算起）；--task 寫做了什麼（會顯示在夾娃娃機）；另外兩個條件（7 天平均讀書 3 小時、檢查全過關）網站自己算
//   補／扣點數：node tools/make_fix.mjs pts --n 20 --why "家長加點沒收到"（一次最多 ±500）
//   補登以前的小考：node tools/make_fix.mjs quiz --file <rows.json> --why "補習班 LINE 的歷史成績"（2026-11-10）
//   救回被別台舊資料蓋掉的資料（2026-11-28）：node tools/make_fix.mjs restore --file <restore_payload.json> [--why "…"]
//     payload 由比對雲端版本的腳本算好（Claude工作資料\20261128_寵物離家\compute_restore.mjs）：pet／bank／shop／ach／today 各自要改什麼；
//     網站會等這台跟雲端對過資料才套用
//     rows.json＝[[日期 2026-8-8, 科目, 分數, 滿分, 'gq' 或 'q', 備註, 班平均], …]，最多 60 筆；成績只在連結裡、不要放進 repo
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const KEY_FILE = path.join(os.homedir(), '.claude', 'study-pass', 'pass_key.pem');
const SITE = 'https://joshdaaicode.github.io/study-plan/';
const SUBJ = { chi: '國文', math: '數學', eng: '英文', sci: '自然', soc: '社會', kbm: '科班資優數學', kbs: '科班自然學科' };

const kind = process.argv[2];
const args = {};
for (let i = 3; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith('--')) { const k = a.slice(2); const v = process.argv[i + 1]; if (v === undefined || v.startsWith('--')) args[k] = true; else { args[k] = v; i++; } }
}
const b64u = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const die = (m) => { console.error(m); process.exit(1); };

const payload = { v: 1, d: 'fix', kind, i: b64u(crypto.randomBytes(6)), why: String(args.why || ''), at: Date.now() };
if (kind === 'pomo') {
  if (!args.day || !/^\d{4}-\d{1,2}-\d{1,2}$/.test(args.day)) die('--day 格式是 2026-11-07');
  if (!args.end || !/^\d{1,2}:\d{2}$/.test(args.end)) die('--end 格式是 14:47');
  const min = parseInt(args.min, 10); if (!(min >= 1 && min <= 120)) die('--min 要 1～120');
  if (!SUBJ[args.subj]) die('--subj 要是 ' + Object.keys(SUBJ).join('、'));
  const [y, mo, d] = args.day.split('-').map(Number); const [hh, mm] = args.end.split(':').map(Number);
  payload.k = [y, mo, d].join('-');                     // 網站的日期鍵：月日不補零
  payload.t = new Date(y, mo - 1, d, hh, mm).getTime();  // 筆電和手機都是台灣時間
  payload.m = min; payload.s = args.subj;
  if (args.orig) payload.e = Number(args.orig);
} else if (kind === 'pomodel') {
  const re = /^(\d{4})-(\d{1,2})-(\d{1,2}) (\d{1,2}):(\d{2})$/;
  const pa = re.exec(String(args.from || '')), pb = re.exec(String(args.to || ''));
  if (!pa || !pb) die('--from／--to 格式是 "2026-11-19 00:50"');
  const ms = (m) => new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]).getTime();
  payload.a = ms(pa); payload.b = ms(pb);
  if (!(payload.b > payload.a) || payload.b - payload.a > 36 * 3600e3) die('時間範圍要在 36 小時內');
  const pp = parseInt(args.pp, 10); if (!(pp >= 0 && pp <= 50)) die('--pp 要 0～50');
  if (!payload.why) die('要寫 --why 理由');
  payload.pp = pp;
} else if (kind === 'claw') {
  const hrs = parseInt(args.hours, 10); if (!(hrs >= 1 && hrs <= 168)) die('--hours 要 1～168');
  if (!args.task || args.task === true) die('要寫 --task 做了什麼特別任務');
  if (!payload.why) die('要寫 --why 理由');
  payload.hrs = hrs; payload.task = String(args.task);
} else if (kind === 'revive') {
  if (!args.file) die('要給 --file <keys.json>');
  const keys = JSON.parse(fs.readFileSync(args.file, 'utf8'));
  if (!Array.isArray(keys) || !keys.length || keys.length > 20 || keys.some((k) => typeof k !== 'string' || !/^\d{4}-\d{1,2}-\d{1,2}\|/.test(k))) die('keys 要是 1～20 個「日期|任務名稱」');
  if (!payload.why) die('要寫 --why 理由');
  payload.keys = keys;
} else if (kind === 'chkdelay') {
  if (!args.file) die('要給 --file <keys.json>');
  const keys = JSON.parse(fs.readFileSync(args.file, 'utf8'));
  if (!Array.isArray(keys) || !keys.length || keys.length > 20 || keys.some((k) => typeof k !== 'string' || !/^\d{4}-\d{1,2}-\d{1,2}\|/.test(k))) die('keys 要是 1～20 個「日期|任務名稱」');
  if (!/^\d{4}-\d{1,2}-\d{1,2}$/.test(String(args.from || ''))) die('--from 格式是 2026-11-21');
  const days = parseInt(args.days, 10); if (!(days >= 1 && days <= 14)) die('--days 要 1～14');
  if (!payload.why) die('要寫 --why 理由');
  payload.keys = keys; payload.from = args.from.split('-').map(Number).join('-'); payload.days = days;
} else if (kind === 'pts') {
  const n = parseInt(args.n, 10); if (!n || Math.abs(n) > 500) die('--n 要是 ±1～500');
  if (!payload.why) die('點數要寫 --why 理由');
  payload.n = n;
} else if (kind === 'quiz') {
  if (!args.file) die('要給 --file <rows.json>');
  const rows = JSON.parse(fs.readFileSync(args.file, 'utf8'));
  if (!Array.isArray(rows) || !rows.length || rows.length > 60) die('rows 要是 1～60 筆的陣列');
  for (const r of rows) {
    if (!/^\d{4}-\d{1,2}-\d{1,2}$/.test(r[0]) || !r[1] || !(r[2] >= 0) || !(r[3] > 0) || r[2] > r[3]) die('格式不對：' + JSON.stringify(r));
    r[0] = r[0].split('-').map(Number).join('-');
  }
  payload.q = rows;
} else if (kind === 'restore') {   // 2026-11-28：救回被別台舊資料蓋掉的寵物、森林、銀行、點數、欠帳（內容先比對雲端版本算好，放在 --file）
  if (!args.file) die('要給 --file <restore_payload.json>');
  const r = JSON.parse(fs.readFileSync(args.file, 'utf8'));
  if (r.shop && Math.abs(+r.shop.dpts || 0) > 500) die('點數一次最多 ±500');
  if (r.bank && Math.abs(+r.bank.dsav || 0) > 50000) die('活存一次最多 ±50000');
  if (!payload.why) payload.why = String(r.why || '');
  delete r.why; payload.r = r;
} else die('第一個參數要是 pomo、pomodel、chkdelay、revive、claw、pts、quiz 或 restore');

const body = b64u(Buffer.from(JSON.stringify(payload), 'utf8'));
const key = crypto.createPrivateKey(fs.readFileSync(KEY_FILE));
const sig = crypto.sign('sha256', Buffer.from(body, 'utf8'), { key, dsaEncoding: 'ieee-p1363' });
if (kind === 'restore') console.error(`救回：${Object.keys(payload.r).join('、')}（${payload.why}）`); else if (kind === 'claw') console.error(`特殊娃娃機開放 ${payload.hrs} 小時：${payload.task}`); else if (kind === 'revive') console.error(`救回樹苗 ${payload.keys.length} 份`); else if (kind === 'chkdelay') console.error(`延後檢查 ${payload.keys.length} 份 ${payload.days} 天（${payload.from} 起）`); else if (kind === 'pomodel') console.error(`刪番茄鐘：${args.from}～${args.to}，每顆扣 ${payload.pp} 點`); else console.error(kind === 'pomo' ? `補登番茄鐘：${payload.k} ${args.end} 結束、${payload.m} 分、${SUBJ[payload.s]}` : kind === 'quiz' ? `補登小考 ${payload.q.length} 筆` : `點數 ${payload.n > 0 ? '+' : ''}${payload.n}：${payload.why}`);
console.log(SITE + '#fix=' + body + '.' + b64u(sig));
