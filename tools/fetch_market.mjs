// 抓台股收盤資料，寫進 market.json（科目股 v2 用；2026-11-10）
// 由 GitHub Actions（.github/workflows/market.yml）每天自動跑，也可以手動：node tools/fetch_market.mjs
// 資料來源：證交所 OpenAPI STOCK_DAY_ALL（公開資料、不用帳號）。只存我們用到的幾支股票的漲跌百分比。
// 每一天的資料都記下抓到的時間 _at：網站只採用「在那天之後隔天晚上 20:00 開盤前就抓到」的資料，
// 這樣不管手機幾點打開，算出來的股價都一樣（漲跌順序開盤前就固定）。
import fs from 'node:fs';
import path from 'node:path';

const TICKERS = { '2330': '台積電', '2454': '聯發科', '6505': '台塑化', '2618': '長榮航', '2412': '中華電', '1216': '統一', '0050': '元大台灣50' };
const FILE = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', 'market.json');
const URL_ = 'https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL';

function load() {
  try { return JSON.parse(fs.readFileSync(decodeURIComponent(FILE), 'utf8')); } catch { return { src: '證交所 OpenAPI STOCK_DAY_ALL', tickers: TICKERS, days: {} }; }
}
function twNow() {   // 台灣時間的 ISO 字串（Actions 主機是 UTC）
  const d = new Date(Date.now() + 8 * 3600e3);
  return d.toISOString().replace('Z', '+08:00').replace(/\.\d+/, '');
}

const res = await fetch(URL_, { headers: { 'Accept': 'application/json', 'User-Agent': 'study-plan-market' } });
if (!res.ok) { console.error('證交所回應 ' + res.status); process.exit(0); }   // 抓不到就算了，網站那天把這項當 0
const rows = await res.json();
const out = load();
out.tickers = TICKERS;
let added = 0;
for (const r of rows) {
  if (!TICKERS[r.Code]) continue;
  const m = String(r.Date || '').match(/^(\d{3})(\d{2})(\d{2})$/);   // 民國年 1151109 → 2026-11-9
  if (!m) continue;
  const k = (+m[1] + 1911) + '-' + (+m[2]) + '-' + (+m[3]);
  const close = parseFloat(r.ClosingPrice), chg = parseFloat(r.Change);
  if (!isFinite(close) || !isFinite(chg) || close - chg <= 0) continue;
  const pct = Math.round(chg / (close - chg) * 10000) / 100;
  const day = out.days[k] || (out.days[k] = {});
  if (day[r.Code] === undefined) { day[r.Code] = pct; added++; }
  if (!day._at) day._at = twNow();
}
const keys = Object.keys(out.days).sort((a, b) => new Date(a) - new Date(b));
for (const k of keys.slice(0, Math.max(0, keys.length - 400))) delete out.days[k];   // 只留最近 400 天
fs.writeFileSync(decodeURIComponent(FILE), JSON.stringify(out, null, 1) + '\n');
console.log('新增 ' + added + ' 筆；最新：' + keys[keys.length - 1]);
