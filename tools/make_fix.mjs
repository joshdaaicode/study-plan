// 產生「Claude 補登連結」（2026-11-07）：番茄鐘做完卻因為手機清掉資料沒記到、點數算錯要補，Claude 在筆電執行這支程式。
// 和過關連結共用同一把私鑰（%USERPROFILE%\.claude\study-pass\pass_key.pem，不在 OneDrive、不在 repo），網站用 index.html 的 PUBKEY 驗證。
// 每個連結只能用一次（記在 plan.checks.v1 的 used，會同步）。內容有 d:'fix'，和過關連結分開，不能互換。
// 用法：
//   補一顆番茄鐘：node tools/make_fix.mjs pomo --day 2026-11-07 --end 14:47 --min 50 --subj soc [--orig 1794034024375] [--why "手機清快取"]
//     --subj：chi 國文、math 數學、eng 英文、sci 自然、soc 社會、kbm 科班資優數學、kbs 科班自然學科
//     --end：那顆番茄鐘結束的時間（HH:MM）；--orig：雲端備份裡那顆計時的 endAt（毫秒），網站會順便停掉還在跑的同一顆，避免算兩次
//   補／扣點數：node tools/make_fix.mjs pts --n 20 --why "家長加點沒收到"（一次最多 ±500）
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
} else if (kind === 'pts') {
  const n = parseInt(args.n, 10); if (!n || Math.abs(n) > 500) die('--n 要是 ±1～500');
  if (!payload.why) die('點數要寫 --why 理由');
  payload.n = n;
} else die('第一個參數要是 pomo 或 pts');

const body = b64u(Buffer.from(JSON.stringify(payload), 'utf8'));
const key = crypto.createPrivateKey(fs.readFileSync(KEY_FILE));
const sig = crypto.sign('sha256', Buffer.from(body, 'utf8'), { key, dsaEncoding: 'ieee-p1363' });
console.error(kind === 'pomo' ? `補登番茄鐘：${payload.k} ${args.end} 結束、${payload.m} 分、${SUBJ[payload.s]}` : `點數 ${payload.n > 0 ? '+' : ''}${payload.n}：${payload.why}`);
console.log(SITE + '#fix=' + body + '.' + b64u(sig));
