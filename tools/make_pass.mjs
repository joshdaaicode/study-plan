// 產生「Claude 檢查過關」連結（使用者把訂正、題本拍照給 Claude，Claude 檢查後執行這支程式）。
// 私鑰只放在筆電本機：%USERPROFILE%\.claude\study-pass\pass_key.pem（不在 OneDrive、不在 repo）。
// 用法：
//   node tools/make_pass.mjs --day 2026-10-27 --task "科班考古｜台南一中 112 化學 訂正（考古題 A 本 p.33–41）" --grade A --note "訂正完整"
//   node tools/make_pass.mjs --init        # 第一次：產生金鑰，印出要放進 index.html 的公鑰
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const KEY_DIR = path.join(os.homedir(), '.claude', 'study-pass');
const KEY_FILE = path.join(KEY_DIR, 'pass_key.pem');
const SITE = 'https://joshdaaicode.github.io/study-plan/';

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith('--')) { const k = a.slice(2); const v = process.argv[i + 1]; if (!v || v.startsWith('--')) args[k] = true; else { args[k] = v; i++; } }
}
const b64u = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

if (args.init) {
  if (fs.existsSync(KEY_FILE)) { console.error('金鑰已經存在：' + KEY_FILE + '（不覆蓋）'); process.exit(1); }
  fs.mkdirSync(KEY_DIR, { recursive: true });
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  fs.writeFileSync(KEY_FILE, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
  const jwk = publicKey.export({ format: 'jwk' });
  console.log(JSON.stringify({ kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y }));
  process.exit(0);
}

if (!args.day || !args.task) { console.error('要給 --day 和 --task'); process.exit(1); }
if (!/^\d{4}-\d{1,2}-\d{1,2}$/.test(args.day)) { console.error('--day 格式是 2026-10-27'); process.exit(1); }
const grade = String(args.grade || 'A').toUpperCase();
if (!['A', 'B'].includes(grade)) { console.error('--grade 只能是 A 或 B（沒過就不要發連結）'); process.exit(1); }
const day = args.day.split('-').map(Number).join('-');   // 2026-10-27 → 2026-10-27（月日不補零，和網站的日期鍵一致）
const payload = { v: 1, i: b64u(crypto.randomBytes(6)), k: day, n: String(args.task), g: grade, m: String(args.note || ''), t: Date.now() };
const body = b64u(Buffer.from(JSON.stringify(payload), 'utf8'));
const key = crypto.createPrivateKey(fs.readFileSync(KEY_FILE));
const sig = crypto.sign('sha256', Buffer.from(body, 'utf8'), { key, dsaEncoding: 'ieee-p1363' });
console.log(SITE + '#pass=' + body + '.' + b64u(sig));
