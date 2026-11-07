// 讀孩子讀書網站的雲端備份（GitHub Gist），印出讀書狀況給 Claude 看。只讀、不需要 token。
// 用法：
//   node tools/status.mjs                      讀已記住的 Gist
//   node tools/status.mjs --gist <家長連結或 Gist ID>   第一次：記住這個 Gist（存在 %USERPROFILE%\.claude\study-pass\parent_gist.txt，不在 repo、不在 OneDrive）
//   node tools/status.mjs --days 14            最近幾天（預設 7）
//   node tools/status.mjs --json               印原始的摘要 JSON
//   node tools/status.mjs --file <備份.json>    讀本機的備份檔（網站「下載成檔案」那份），不連網
// 規則和網站一致：勾完 3 天內要交檢查；逾期第 n 天扣 5n 點，逾期超過 5 天樹苗枯（2026-11-07）。
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const FILE = 'study-plan-backup.json', OWNER = 'joshdaaicode';
const CFG = path.join(os.homedir(), '.claude', 'study-pass', 'parent_gist.txt');
const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? (args[i + 1] || '') : null; };

let gid = '';
const g = opt('--gist'), localFile = opt('--file');   // --file：改讀本機的備份檔（網站「下載成檔案」的那份，或測試用）
if (localFile) gid = 'local';
else if (g) {
  const m = g.match(/([0-9a-f]{20,40})/i);
  if (!m) { console.error('看不懂這個 Gist ID／連結'); process.exit(1); }
  gid = m[1].toLowerCase();
  fs.mkdirSync(path.dirname(CFG), { recursive: true });
  fs.writeFileSync(CFG, gid + '\n');
  console.error('已記住 Gist（' + CFG + '）');
} else if (fs.existsSync(CFG)) gid = fs.readFileSync(CFG, 'utf8').trim();
if (!gid) { console.error('還沒有 Gist ID：請使用者在網站「紀錄 → 進度回測 → 給爸媽的週報」按「複製家長網頁連結」，再跑 --gist <連結>'); process.exit(1); }
const nDays = Math.max(1, Math.min(60, +(opt('--days') || 7)));

async function fetchText() {
  const r = await fetch('https://api.github.com/gists/' + gid, { headers: { 'Accept': 'application/vnd.github+json', 'User-Agent': 'study-plan-status' } });
  if (r.status === 404) throw new Error('找不到這個 Gist');
  if (r.ok) {
    const j = await r.json(), f = j.files && j.files[FILE];
    if (!f) throw new Error('Gist 裡沒有 ' + FILE);
    if (f.truncated && f.raw_url) { const x = await fetch(f.raw_url); return await x.text(); }
    return f.content;
  }
  const x = await fetch(`https://gist.githubusercontent.com/${OWNER}/${gid}/raw/${FILE}?t=${Date.now()}`);
  if (!x.ok) throw new Error('GitHub 回應 ' + r.status + '／raw ' + x.status);
  return await x.text();
}

const J = (o, k, d) => { try { const v = o[k]; if (v == null) return d; const x = typeof v === 'string' ? JSON.parse(v) : v; return x == null ? d : x; } catch { return d; } };
const d0 = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const key = (d) => d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
const pk = (k) => { const p = String(k).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); };
const md = (k) => { const p = String(k).split('-'); return (+p[1]) + '/' + (+p[2]); };
const days = (a, b) => Math.round((b - a) / 864e5);
const addD = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const hm = (t) => { const d = new Date(t); return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
const WD = '日一二三四五六';

const o = JSON.parse(localFile ? fs.readFileSync(localFile, 'utf8') : await fetchText());
const today = d0(), tk = key(today);
const st = J(o, 'plan.state.v3', {}), hist = J(o, 'plan.hist.v1', {}), pomo = J(o, 'plan.pomo.v1', {}), C = J(o, 'plan.checks.v1', {}),
  shop = J(o, 'plan.shop.v1', {}), vrev = J(o, 'plan.vrev.v1', {}), easy = J(o, 'plan.easy.v1', {});
const plog = Array.isArray(pomo.log) ? pomo.log : [], items = C.items || {};
const at = o._at ? new Date(o._at).getTime() : 0;

// 讀書時間（11-07 使用者定）：那天有番茄鐘就算番茄鐘分鐘，沒有才算完成任務的表定分鐘
const pomoMin = (k) => plog.filter((e) => e && e.k === k).reduce((a, e) => a + (+e.m || 25), 0);
const studyMin = (k, taskMin) => pomoMin(k) || taskMin;
const out = { 資料時間: at ? hm(at) : '不明', 幾小時前: at ? +((Date.now() - at) / 36e5).toFixed(1) : null, 點數: shop.pts ?? null };

// 今天
const opened = st.day === tk, done = st.done || {};
const list = opened ? (st.list || []).filter((x) => !x.pre && !x.f) : [];
out.今天 = opened ? {
  完成: list.filter((x) => done[x.id]).length + '/' + list.length,
  讀書分鐘: studyMin(tk, list.filter((x) => done[x.id]).reduce((a, x) => a + (+x.m || 0), 0) + Math.round((+vrev[tk] || 0) / 60)),
  番茄鐘: plog.filter((e) => e && e.k === tk).length,
  已完成: list.filter((x) => done[x.id]).map((x) => (x.bk ? '[欠帳] ' : '') + x.n),
  還沒做: list.filter((x) => !done[x.id]).map((x) => (x.bk ? '[欠帳] ' : '') + x.n),
} : '今天還沒打開網站（最後一次 ' + (st.day ? md(st.day) : '—') + '）';

// 最近幾天
out.最近 = [];
for (let i = nDays - 1; i >= 0; i--) {
  const d = addD(today, -i), k = key(d), e = hist[k];
  if (k === tk) continue;
  if (!e) { out.最近.push(md(k) + ' 週' + WD[d.getDay()] + '：沒紀錄'); continue; }
  let a = 0, dn = 0; if (e.cat) Object.values(e.cat).forEach((c) => { a += c.a || 0; dn += c.d || 0; }); else { a = e.a || 0; dn = e.d || 0; }
  const m = studyMin(k, (+e.m || 0) + Math.round((+vrev[k] || 0) / 60)), pc = plog.filter((x) => x && x.k === k).length;
  out.最近.push(md(k) + ' 週' + WD[d.getDay()] + '：讀書 ' + m + ' 分、任務 ' + dn + '/' + a + '、番茄鐘 ' + pc + (easy[k] ? '（降級日）' : ''));
}

// 檢查
const late = (it) => (it.st === 'pass' || it.old || !it.ls) ? 0 : Math.max(0, days(pk(it.ls), today) + 1);
out.檢查 = Object.values(items).filter((it) => it && it.k && it.st !== 'pass' && !it.old).sort((a, b) => pk(a.k) - pk(b.k)).map((it) => {
  const n = late(it);
  if (n > 0) return md(it.k) + '｜' + it.n + '：逾期第 ' + n + ' 天，已扣 ' + (it.pt || 0) + ' 點' + (it.st === 'dead' ? '，樹苗已枯' : '');
  const left = 3 - days(pk(it.k), today);
  return md(it.k) + '｜' + it.n + '：' + (left >= 0 ? '等檢查（還剩 ' + left + ' 天）' : '過期限（還沒用新版網站開過）');
});
out.最近過關 = Object.values(items).filter((it) => it && it.st === 'pass' && pk(it.k) >= addD(today, -nDays)).sort((a, b) => pk(b.k) - pk(a.k))
  .map((it) => md(it.k) + '｜' + it.n + '：' + (it.g || '') + (it.pt ? '（逾期扣 ' + it.pt + '）' : ''));

if (args.includes('--json')) { console.log(JSON.stringify(out, null, 2)); process.exit(0); }
console.log('資料時間：' + out.資料時間 + (out.幾小時前 != null ? '（' + out.幾小時前 + ' 小時前）' : '') + '　點數：' + out.點數);
if (typeof out.今天 === 'string') console.log('今天：' + out.今天);
else {
  console.log('今天：完成 ' + out.今天.完成 + '、讀書 ' + out.今天.讀書分鐘 + ' 分、番茄鐘 ' + out.今天.番茄鐘 + ' 顆');
  out.今天.已完成.forEach((n) => console.log('  ✓ ' + n));
  out.今天.還沒做.forEach((n) => console.log('  ○ ' + n));
}
console.log('最近 ' + nDays + ' 天：'); out.最近.forEach((s) => console.log('  ' + s));
console.log('還沒過關的檢查（' + out.檢查.length + '）：'); out.檢查.forEach((s) => console.log('  ' + s));
if (out.最近過關.length) { console.log('最近過關：'); out.最近過關.forEach((s) => console.log('  ' + s)); }
