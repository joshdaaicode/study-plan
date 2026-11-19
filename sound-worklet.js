/* 讀書網站「專注聲音」的產生器（AudioWorklet，2026-11-19）
   每一種聲音都在音訊執行緒裡一個樣本一個樣本即時算：不用音檔、不連網，亂數一直往下走，所以永遠不會循環重複（他聽得出舊版 10 秒一圈）。
   左右聲道用各自獨立的亂數，雨滴、敲擊、劈啪聲這些事件每一個都隨機擺在不同位置，所以是真的立體聲。
   起伏（雨變大變小、陣風、浪的大小）用「隨機漫步」：每隔隨機的時間挑新目標、平滑滑過去，不用固定週期的振盪器。
   做法參考 Andy Farnell《Designing Sound》的程序化音效（火、氣泡、流水、雨）和顆粒合成；研究筆記在 claude 科班\Claude工作資料\20261119_白噪音研究。
   index.html 用 new AudioWorkletNode(ctx,'sp-gen',{processorOptions:{kind, seed}}) 建立；port 收到 {stop:1} 就結束。 */
const SR = sampleRate, TAU = Math.PI * 2;

// 亂數：xorshift32（整數運算，很快）
class Rng {
  constructor(s) { this.x = (s >>> 0) || 0x9E3779B9; }
  u() { let x = this.x; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; this.x = x >>> 0; return this.x / 4294967296; }
  n() { return this.u() * 2 - 1; }
  r(a, b) { return a + (b - a) * this.u(); }
  lg(a, b) { return a * Math.pow(b / a, this.u()); }   // 對數均勻：頻率、時間這種東西用這個比較自然
}
// 隨機漫步：在 lo～hi 之間、每 tmin～tmax 秒換一個目標，平滑滑過去（smoothstep），不會週期性重複
class Drift {
  constructor(r, lo, hi, tmin, tmax) { this.r = r; this.lo = lo; this.hi = hi; this.a = tmin; this.b = tmax; this.v = r.r(lo, hi); this.pick(); }
  pick() { this.f = this.v; this.t = this.r.r(this.lo, this.hi); this.i = 0; this.n = Math.max(1, Math.round(SR * this.r.r(this.a, this.b))); }
  step(k) { this.i += k; if (this.i >= this.n) this.pick(); const x = this.i / this.n, s = x * x * (3 - 2 * x); this.v = this.f + (this.t - this.f) * s; return this.v; }
}
const lpA = (f) => 1 - Math.exp(-TAU * f / SR);   // 一階低通的係數
// 粉紅噪音（Paul Kellet 濾波）
class Pink {
  constructor() { this.b = [0, 0, 0, 0, 0, 0, 0]; }
  s(w) { const b = this.b;
    b[0] = .99886 * b[0] + w * .0555179; b[1] = .99332 * b[1] + w * .0750759; b[2] = .969 * b[2] + w * .153852;
    b[3] = .8665 * b[3] + w * .3104856; b[4] = .55 * b[4] + w * .5329522; b[5] = -.7616 * b[5] - w * .016898;
    const p = b[0] + b[1] + b[2] + b[3] + b[4] + b[5] + b[6] + w * .5362; b[6] = w * .115926; return p * .11; }
}
// 帶通濾波器（RBJ，峰值增益 0 dB）
class BP {
  constructor(f, q) { this.x1 = this.x2 = this.y1 = this.y2 = 0; this.set(f, q); }
  set(f, q) { const w = TAU * Math.min(f, SR * .45) / SR, al = Math.sin(w) / (2 * q), a0 = 1 + al;
    this.b0 = al / a0; this.a1 = -2 * Math.cos(w) / a0; this.a2 = (1 - al) / a0; }
  s(x) { const y = this.b0 * (x - this.x2) - this.a1 * this.y1 - this.a2 * this.y2; this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y; return y; }
}
const panL = (p) => Math.cos((p + 1) * Math.PI / 4), panR = (p) => Math.sin((p + 1) * Math.PI / 4);
const dk = (sec) => Math.exp(-1 / (SR * sec));   // 每個樣本乘這個數＝衰減時間常數 sec 秒
const soft = (x) => { const a = x < 0 ? -x : x; if (a <= .8) return x; const y = .8 + .2 * Math.tanh((a - .8) / .2); return x < 0 ? -y : y; };

/* ---------- 共用的小事件 ---------- */
// 脈衝：雜訊乘上很快衰減的包絡；可以接一個帶通（有共振＝「滴」「叮」「喀」）
function burst(r, amp, tau, pan, f, q, life) {
  return { r, a: amp, e: 1, k: dk(tau), gl: panL(pan), gr: panR(pan), bp: f ? new BP(f, q) : null, life: Math.round(SR * (life || tau * 8)) };
}
function runBursts(list, L, R, n) {
  for (let j = list.length - 1; j >= 0; j--) {
    const v = list[j], r = v.r, m = Math.min(n, v.life);
    for (let i = 0; i < m; i++) {
      let x = r.n() * v.e * v.a; v.e *= v.k;
      if (v.bp) x = v.bp.s(x) * 6;
      L[i] += x * v.gl; R[i] += x * v.gr;
    }
    v.life -= m; if (v.life <= 0) list.splice(j, 1);
  }
}
// 模態合成（敲擊）：幾個頻率比例不整齊的衰減正弦波
function modal(fs, taus, amps, amp, pan) {
  return { p: fs.map(() => 0), w: fs.map((f) => TAU * f / SR), e: amps.map((a) => a * amp), k: taus.map(dk), gl: panL(pan), gr: panR(pan), life: Math.round(SR * Math.max(...taus) * 7) };
}
function runModal(list, L, R, n) {
  for (let j = list.length - 1; j >= 0; j--) {
    const v = list[j], m = Math.min(n, v.life), M = v.p.length;
    for (let i = 0; i < m; i++) {
      let x = 0;
      for (let q = 0; q < M; q++) { x += Math.sin(v.p[q]) * v.e[q]; v.p[q] += v.w[q]; v.e[q] *= v.k[q]; }
      L[i] += x * v.gl; R[i] += x * v.gr;
    }
    v.life -= m; if (v.life <= 0) list.splice(j, 1);
  }
}

/* ---------- 各種聲音 ---------- */
// 每個產生器：fill(L, R, n) 把這一段的聲音「加」進 L、R（已經清成 0）
const GEN = {
  white(r1, r2) { return { fill(L, R, n) { for (let i = 0; i < n; i++) { L[i] = r1.n() * .35; R[i] = r2.n() * .35; } } }; },
  pink(r1, r2) { const a = new Pink(), b = new Pink(); return { fill(L, R, n) { for (let i = 0; i < n; i++) { L[i] = a.s(r1.n()) * 1.6; R[i] = b.s(r2.n()) * 1.6; } } }; },
  brown(r1, r2) { let x = 0, y = 0; return { fill(L, R, n) { for (let i = 0; i < n; i++) { x = (x + .02 * r1.n()) / 1.02; y = (y + .02 * r2.n()) / 1.02; L[i] = x * 3.4; R[i] = y * 3.4; } } }; },

  rain(r1, r2, r, o) {
    o = o || {};
    const pa = new Pink(), pb = new Pink(), I = new Drift(r, o.lo || .45, o.hi || 1, 6, 22), drops = [];
    let la = 0, lb = 0, ha = 0, hb = 0, ba = 0, bb = 0;
    const a8 = lpA(800), a7 = lpA(7000), rate = o.rate || 70;
    return { fill(L, R, n) {
      const it = I.step(n), pr = rate * it / SR;
      for (let i = 0; i < n; i++) {
        const x = pa.s(r1.n()), y = pb.s(r2.n());
        ha += a8 * (x - ha); hb += a8 * (y - hb);           // 去掉 800 Hz 以下
        la += a7 * (x - ha - la); lb += a7 * (y - hb - lb); // 再去掉 7 kHz 以上的刺耳聲
        ba = (ba + .02 * r1.n()) / 1.02; bb = (bb + .02 * r2.n()) / 1.02;
        L[i] = la * 1.5 * it + ba * .5; R[i] = lb * 1.5 * it + bb * .5;
        if (r.u() < pr) {   // 一滴雨
          const big = r.u(), amp = .15 + .9 * big * big * big * big, p = r.n() * .95;
          drops.push(r.u() < .7 ? burst(r, amp * .6, r.r(.0012, .004), p) : burst(r, amp * .5, .0015, p, r.lg(1800, 5500), r.r(5, 12), .05));
        }
      }
      runBursts(drops, L, R, n);
    } };
  },
  window(r1, r2, r) {
    const pa = new Pink(), pb = new Pink(), I = new Drift(r, .4, 1, 8, 25), drops = [];
    let la = 0, lb = 0, run = 0, runP = 0, next = 0;
    const a = lpA(2200);
    return { fill(L, R, n) {
      const it = I.step(n), pr = 9 * it / SR;
      for (let i = 0; i < n; i++) {
        la += a * (pa.s(r1.n()) - la); lb += a * (pb.s(r2.n()) - lb);   // 外面悶悶的雨
        L[i] = la * 1.1 * it; R[i] = lb * 1.1 * it;
        let hit = false, p = 0;
        if (run > 0) { if (--next <= 0) { hit = true; p = runP + r.n() * .05; run--; next = Math.round(SR * r.r(.03, .12)); } }
        else if (r.u() < pr) { hit = true; p = r.n() * .9; if (r.u() < .12) { run = 2 + (r.u() * 5 | 0); runP = p; next = Math.round(SR * r.r(.03, .1)); } }
        if (hit) {
          const amp = r.r(.25, 1);
          if (r.u() < .65) drops.push(burst(r, amp * .45, .0004, p, r.lg(2400, 5200), r.r(14, 30), .09));   // 打在玻璃上：叮
          else drops.push(burst(r, amp * .5, .0025, p, r.lg(600, 1400), r.r(2, 4), .05));                  // 打在窗框上：咚
        }
      }
      runBursts(drops, L, R, n);
    } };
  },
  storm(r1, r2, r) {
    const rain = GEN.rain(r1, r2, r, { lo: .8, hi: 1.25, rate: 120 }), th = [];
    let wait = Math.round(SR * r.r(8, 25));
    const t1 = new Rng(r.x ^ 0x51ed27), t2 = new Rng(r.x ^ 0x2545f491);
    return { fill(L, R, n) {
      rain.fill(L, R, n);
      if ((wait -= n) <= 0) {   // 打雷：近的起音短、有劈裂聲；遠的慢慢滾進來
        wait = Math.round(SR * r.r(20, 80));
        const near = r.u() < .35, dur = r.r(4, 10);
        th.push({ t: 0, at: SR * (near ? r.r(.01, .06) : r.r(.2, .7)), k: dk(dur / 3.2), e: 0, g: near ? 2.2 : r.r(1, 1.7),
          f: near ? r.r(250, 400) : r.r(110, 220), x1: 0, y1: 0, x2: 0, y2: 0, rough: new Drift(r, .35, 1, .08, .5),
          crack: near ? 1 : 0, ck: dk(.07), p: r.n() * .8, life: Math.round(SR * dur * 2.5) });
      }
      for (let j = th.length - 1; j >= 0; j--) {
        const v = th[j], a = lpA(v.f), rg = v.rough.step(n), gl = panL(v.p) * 1.2, gr = panR(v.p) * 1.2, m = Math.min(n, v.life);
        for (let i = 0; i < m; i++) {
          v.t++; v.e = v.t < v.at ? v.t / v.at : v.e * v.k;
          v.x1 = (v.x1 + .02 * t1.n()) / 1.02; v.x2 = (v.x2 + .02 * t2.n()) / 1.02;
          v.y1 += a * (v.x1 - v.y1); v.y2 += a * (v.x2 - v.y2);
          let cl = 0; if (v.crack > .001) { cl = t1.n() * v.crack * .5; v.crack *= v.ck; }
          const e = v.e * rg * v.g * 9;
          L[i] += (v.y1 * e + cl) * gl; R[i] += (v.y2 * e + cl) * gr;
        }
        v.life -= m; if (v.life <= 0) th.splice(j, 1);
      }
    } };
  },
  wave(r1, r2, r) {
    const pa = new Pink(), pb = new Pink(), W = [];
    let ba = 0, bb = 0, wa = 0, wb = 0, wait = 0;
    const aw = lpA(260);
    return { fill(L, R, n) {
      if ((wait -= n) <= 0) {   // 新的一道浪：長短、大小、位置都隨機；上一道還沒退完就來，會重疊
        const D = r.r(6, 13); wait = Math.round(SR * D * r.r(.65, 1));
        W.push({ t: 0, D: Math.round(SR * D), up: r.r(.3, .5), pk: r.r(.5, 1), p: r.n() * .7, ya: 0, yb: 0 });
      }
      for (let i = 0; i < n; i++) {
        ba = (ba + .02 * r1.n()) / 1.02; bb = (bb + .02 * r2.n()) / 1.02;
        const xa = ba * 3 + pa.s(r1.n()) * .5, xb = bb * 3 + pb.s(r2.n()) * .5;
        wa += aw * (xa - wa); wb += aw * (xb - wb);
        L[i] = wa * .55; R[i] = wb * .55;   // 遠處一直都有的低沉海聲
        for (let j = 0; j < W.length; j++) {
          const v = W[j], x = v.t / v.D; v.t++;
          let e = x < v.up ? x / v.up : 1 - (x - v.up) / (1 - v.up); e = e * e * (3 - 2 * e); e *= v.pk;
          const c = lpA(220 + 2600 * e * e);   // 浪越高，聲音越亮（嘩）；退的時候變暗（沙）
          v.ya += c * (xa - v.ya); v.yb += c * (xb - v.yb);
          L[i] += v.ya * e * panL(v.p) * 1.5; R[i] += v.yb * e * panR(v.p) * 1.5;
        }
      }
      for (let j = W.length - 1; j >= 0; j--) if (W[j].t >= W[j].D) W.splice(j, 1);
    } };
  },
  stream(r1, r2, r) {
    const pa = new Pink(), pb = new Pink(), I = new Drift(r, .6, 1.2, 4, 14), bub = [];
    let ha = 0, hb = 0, la = 0, lb = 0;
    const a4 = lpA(400), a25 = lpA(2500);
    return { fill(L, R, n) {
      const it = I.step(n), pr = 140 * it / SR;
      for (let i = 0; i < n; i++) {
        const x = pa.s(r1.n()), y = pb.s(r2.n());
        ha += a4 * (x - ha); hb += a4 * (y - hb); la += a25 * (x - ha - la); lb += a25 * (y - hb - lb);
        L[i] = la * .9 * it; R[i] = lb * .9 * it;
        if (r.u() < pr && bub.length < 60) {   // 一顆氣泡：頻率往上滑的衰減正弦波，越小顆越高、越短
          const f = Math.min(2600, Math.max(220, 420 * Math.exp(1.1 * r.n()))), tau = Math.min(.03, Math.max(.003, 5 / f)), am = r.r(.05, .35), p = r.n() * .9;
          bub.push({ ph: 0, f, df: f * r.r(.4, 1.6) / (SR * tau * 4), e: am, k: dk(tau), at: 0, gl: panL(p), gr: panR(p), life: Math.round(SR * tau * 6) });
        }
      }
      for (let j = bub.length - 1; j >= 0; j--) {
        const v = bub[j], m = Math.min(n, v.life);
        for (let i = 0; i < m; i++) {
          const a = v.at < 1 ? (v.at += 1 / (SR * .0004)) : 1;
          const x = Math.sin(v.ph) * v.e * Math.min(a, 1); v.ph += TAU * v.f / SR; v.f += v.df; v.e *= v.k;
          L[i] += x * v.gl; R[i] += x * v.gr;
        }
        v.life -= m; if (v.life <= 0) bub.splice(j, 1);
      }
    } };
  },
  fire(r1, r2, r) {
    const pa = new Pink(), pb = new Pink(), F = new Drift(r, .35, 1, .15, .8), H = new Drift(r, .2, 1, .3, 1.5), C = new Drift(r, 2, 22, 1, 4), cr = [];
    let ba = 0, bb = 0, ya = 0, yb = 0, ha = 0, hb = 0, sput = 0, sp = 0, pop = Math.round(SR * r.r(1.5, 6));
    const a18 = lpA(180), a2k = lpA(2000);
    return { fill(L, R, n) {
      const f = F.step(n), h = H.step(n), pr = C.step(n) / SR;
      for (let i = 0; i < n; i++) {
        ba = (ba + .02 * r1.n()) / 1.02; bb = (bb + .02 * r2.n()) / 1.02;
        ya += a18 * (ba - ya); yb += a18 * (bb - yb);                 // 低沉的燃燒聲
        const xa = pa.s(r1.n()), xb = pb.s(r2.n()); ha += a2k * (xa - ha); hb += a2k * (xb - hb);
        L[i] = ya * 9 * f + (xa - ha) * .25 * h; R[i] = yb * 9 * f + (xb - hb) * .25 * h;
        let go = r.u() < pr; if (sput > 0 && --sp <= 0) { go = true; sput--; sp = Math.round(SR * r.r(.005, .04)); }
        if (go) {   // 劈啪：極短的脈衝，有時候會成串
          const p = r.n() * .5; cr.push(burst(r, r.r(.2, 1) * r.r(.3, 1), r.r(.00015, .0006), p, r.lg(1800, 6000), 1.2, .01));
          if (!sput && r.u() < .3) { sput = 2 + (r.u() * 5 | 0); sp = Math.round(SR * r.r(.005, .04)); }
        }
        if (--pop <= 0) { pop = Math.round(SR * r.lg(1.5, 9)); cr.push(burst(r, r.r(.6, 1.2), .003, r.n() * .4, r.lg(250, 900), r.r(2, 5), .08)); }   // 偶爾一聲較大的爆裂
      }
      runBursts(cr, L, R, n);
    } };
  },
  wind(r1, r2, r) {
    const pa = new Pink(), pb = new Pink(), pc = new Pink(), FC = new Drift(r, 180, 800, 2, 7), Q = new Drift(r, .7, 2.6, 3, 9), G = new Drift(r, .12, 1, 2, 9), FW = new Drift(r, 700, 1600, 3, 8);
    const ba = new BP(400, 1), bb = new BP(400, 1), bw = new BP(1000, 25);
    return { fill(L, R, n) {
      const fc = FC.step(n), q = Q.step(n), g = G.step(n), w = Math.max(0, g - .55) * 2.2;
      ba.set(fc * .94, q); bb.set(fc * 1.06, q); bw.set(FW.step(n), 25);
      for (let i = 0; i < n; i++) {
        const s = bw.s(pc.s(r.n())) * w * 2.5;
        L[i] = ba.s(pa.s(r1.n())) * g * 3.2 + s; R[i] = bb.s(pb.s(r2.n())) * g * 3.2 + s * .8;
      }
    } };
  },
  pencil(r1, r2, r) {   // 鉛筆在紙上寫字：一筆一筆、一個字一個字從左寫到右，換行停一下，偶爾翻頁
    const bpS = new BP(4000, 1.1), ev = [];
    let st = 'gap', left = Math.round(SR * .5), x = -.45, nStroke = 0, nChar = 0, nLine = 0, perLine = 12, lines = 6,
        env = 0, pres = .8, gr = 0, dur = 0, t = 0, p = 0, fl = null, room = 0;
    const ag = lpA(320);
    function nextChar() {
      if (++nChar >= perLine) { nChar = 0; x = -.45; perLine = 8 + (r.u() * 9 | 0);
        if (++nLine >= lines) { nLine = 0; lines = 4 + (r.u() * 5 | 0); st = 'flip'; return; }
        st = 'gap'; left = Math.round(SR * r.r(.8, 2.4)); nStroke = 2 + (r.u() * 7 | 0); return; }
      x += .9 / perLine; nStroke = 2 + (r.u() * 7 | 0); st = 'gap'; left = Math.round(SR * r.r(.12, .4));
    }
    nStroke = 3;
    return { fill(L, R, n) {
      for (let i = 0; i < n; i++) {
        room = (room + .02 * r1.n()) / 1.02; L[i] = room * .08; R[i] = room * .08;
        if (st === 'gap') { env *= .995; if (--left <= 0) {
            if (nStroke > 0) { st = 'stroke'; dur = Math.round(SR * r.r(.05, .3)); t = 0; pres = r.r(.55, 1); p = x + r.n() * .04; bpS.set(r.lg(3000, 5500), r.r(.8, 1.5)); nStroke--; }
            else nextChar(); } }
        else if (st === 'stroke') { t++; const k = t / dur; env += ((k < .9 ? pres : 0) - env) * (k < .9 ? .006 : .004);
          if (t >= dur) { st = 'gap'; left = Math.round(SR * r.r(.03, .12)); } }
        else if (st === 'flip') { fl = { t: 0, D: Math.round(SR * r.r(.5, .9)), p0: .45, p1: -.45, c: 0 }; st = 'flipping'; }
        else if (st === 'flipping') { const v = fl, k = v.t++ / v.D, e = Math.sin(Math.PI * k);
          v.c += .03 * (Math.abs(r.n()) - v.c);   // 紙張翻動的沙沙、皺皺的感覺
          const s = r1.n() * e * (.4 + v.c * 2) * .35, pp = v.p0 + (v.p1 - v.p0) * k;
          L[i] += s * panL(pp); R[i] += s * panR(pp);
          if (v.t >= v.D) { st = 'gap'; left = Math.round(SR * r.r(1, 2.2)); nStroke = 3; } }
        if (env > .002) { gr += ag * (Math.abs(r2.n()) - gr);   // 紙的顆粒感
          const s = bpS.s(r.n()) * env * (.5 + gr * 1.4) * 1.6; L[i] += s * panL(p); R[i] += s * panR(p); }
      }
      runBursts(ev, L, R, n);
    } };
  },
  keys(r1, r2, r) {   // 打字：按下（塑膠喀）＋放開（小聲），空白鍵比較低沉，句子之間停頓
    const ev = [];
    let wait = Math.round(SR * .4), word = 3 + (r.u() * 5 | 0), words = 6, room = 0;
    const ups = [];
    function key(space) {
      const p = space ? r.n() * .05 : r.n() * .35, amp = r.r(.6, 1);
      ev.push(burst(r, amp * .55, .0006, p, space ? r.r(350, 650) : r.lg(2000, 4500), space ? 2 : r.r(2, 4), .04));
      ev.push(burst(r, amp * .35, .0012, p, space ? r.r(160, 260) : r.r(300, 700), 3, .05));
      ups.push({ t: Math.round(SR * r.r(.05, .11)), p, amp: amp * (space ? .5 : .35), space });
    }
    return { fill(L, R, n) {
      for (let i = 0; i < n; i++) {
        room = (room + .02 * r1.n()) / 1.02; L[i] = room * .06; R[i] = room * .06;
        if (--wait <= 0) {
          if (word > 0) { key(false); word--; wait = Math.round(SR * r.r(.07, .19) * (r.u() < .1 ? 2.2 : 1)); }
          else { key(true); word = 2 + (r.u() * 8 | 0);
            if (--words <= 0) { words = 4 + (r.u() * 9 | 0); wait = Math.round(SR * r.r(.8, 3.5)); }
            else wait = Math.round(SR * r.r(.1, .25)); }
        }
        for (let j = ups.length - 1; j >= 0; j--) if (--ups[j].t <= 0) { const u = ups[j]; ev.push(burst(r, u.amp, .0005, u.p, u.space ? r.r(400, 700) : r.lg(2500, 5000), 2.5, .03)); ups.splice(j, 1); }
      }
      runBursts(ev, L, R, n);
    } };
  },
  tap(r1, r2, r) {   // ASMR 敲擊：指甲連敲一串，換位置、換材質（木頭、塑膠、玻璃罐）
    const md = [], ev = [];
    let wait = Math.round(SR * .3), left = 0, gap = 0, p = 0, f1 = 500, ra = 2.5, rb = 4.6, tau = .05, room = 0;
    function surface() { f1 = r.lg(180, 1400); ra = r.r(2.2, 2.95); rb = r.r(3.8, 5.6); tau = r.lg(.018, .09); }
    surface();
    return { fill(L, R, n) {
      for (let i = 0; i < n; i++) {
        room = (room + .02 * r1.n()) / 1.02; L[i] = room * .05; R[i] = room * .05;
        if (--wait > 0) continue;
        if (left <= 0) {   // 新的一串
          if (r.u() < .7) surface();
          p = r.n() * .95; left = 3 + (r.u() * 7 | 0); gap = r.r(.055, .16);
          if (r.u() < .2) gap = r.r(.035, .05);   // 指甲快速輪敲
        }
        const a = r.r(.45, 1), fj = f1 * r.r(.97, 1.03);
        md.push(modal([fj, fj * ra, fj * rb], [tau, tau * .6, tau * .35], [1, .45, .22], a * .5, p));
        ev.push(burst(r, a * .25, .0003, p, r.lg(2500, 6000), 1.5, .01));
        p = Math.max(-1, Math.min(1, p + r.n() * .08));
        if (--left > 0) wait = Math.round(SR * gap * r.r(.85, 1.15)); else wait = Math.round(SR * r.r(.4, 1.8));
      }
      runModal(md, L, R, n); runBursts(ev, L, R, n);
    } };
  },
  brush(r1, r2, r) {   // ASMR 刷子：每一刷從一邊耳朵掃到另一邊
    const bp = new BP(2500, .7);
    let st = 0, t = 0, D = 1, p0 = 0, p1 = 0, wait = Math.round(SR * .3), gr = 0, room = 0;
    const ag = lpA(150);
    return { fill(L, R, n) {
      for (let i = 0; i < n; i++) {
        room = (room + .02 * r1.n()) / 1.02; L[i] = room * .05; R[i] = room * .05;
        if (!st) { if (--wait <= 0) { st = 1; t = 0; D = Math.round(SR * r.r(.35, 1.2)); const s = r.u() < .5 ? -1 : 1; p0 = s * r.r(.5, .95); p1 = -p0 * r.r(.5, .9); bp.set(r.lg(1500, 3500), r.r(.6, .9)); } continue; }
        const k = t++ / D, e = Math.pow(Math.sin(Math.PI * k), 1.5), pp = p0 + (p1 - p0) * k;
        gr += ag * (Math.abs(r2.n()) - gr);   // 刷毛一根一根的顆粒感
        const s = bp.s(r.n()) * e * (.6 + gr) * 1.5;
        L[i] += s * panL(pp); R[i] += s * panR(pp);
        if (t >= D) { st = 0; wait = Math.round(SR * r.r(.08, .5)); }
      }
    } };
  },
  earpick(r1, r2, r) {   // ASMR 掏耳／耳根刮：貼近麥克風的來回刮擦＋細碎的劈啪聲（他給的範本：每秒 1–2 下、低頻很厚）
    const pk = new Pink(), bp = new BP(800, .8), cr = [], SC = new Drift(r, 3, 7, .5, 2);
    let st = 0, t = 0, D = 1, wait = Math.round(SR * .3), ph = 0, p = 0, rate = 60, room = 0, rl = 0;
    const a12 = lpA(120);
    return { fill(L, R, n) {
      const sc = SC.step(n);
      for (let i = 0; i < n; i++) {
        room = (room + .02 * r1.n()) / 1.02; rl += a12 * (room - rl); L[i] = rl * 2.2; R[i] = rl * 2.2;   // 很低的手部、麥克風摩擦聲
        if (!st) { if (--wait <= 0) { st = 1; t = 0; D = Math.round(SR * r.r(.25, .9)); bp.set(r.lg(300, 1500), r.r(.6, 1.1)); p = r.n() * .5; rate = r.r(30, 120); } continue; }
        const k = t++ / D, e = Math.pow(Math.sin(Math.PI * k), 1.2);
        ph += sc / SR; const scrub = .55 + .45 * Math.abs(Math.sin(Math.PI * ph));   // 來回刮
        const s = bp.s(pk.s(r2.n())) * e * scrub * 5;
        L[i] += s * panL(p); R[i] += s * panR(p);
        if (r.u() < rate * e / SR) cr.push(burst(r, r.r(.15, .7) * e, r.r(.0002, .0008), p + r.n() * .1, r.lg(1500, 5000), 1.5, .01));
        if (t >= D) { st = 0; wait = Math.round(SR * (r.u() < .7 ? r.r(.05, .25) : r.r(.4, 1.2))); }
      }
      runBursts(cr, L, R, n);
    } };
  },
  thump(r1, r2, r) {   // ASMR 捶背按摩：低沉的「咚咚」，左右手輪流，一串一串
    const md = [], ev = [];
    let wait = Math.round(SR * .3), left = 0, gap = .3, f = 110, hand = 0, soft = 1, room = 0;
    return { fill(L, R, n) {
      for (let i = 0; i < n; i++) {
        room = (room + .02 * r1.n()) / 1.02; L[i] = room * .05; R[i] = room * .05;
        if (--wait > 0) continue;
        if (left <= 0) {   // 新的一串：一般捶背、或比較輕快的剁（chopping）
          const chop = r.u() < .25; left = chop ? 10 + (r.u() * 14 | 0) : 4 + (r.u() * 13 | 0);
          gap = chop ? r.r(.12, .17) : r.r(.2, .4); soft = chop ? .55 : 1; f = r.lg(70, 160);
        }
        hand ^= 1; const p = (hand ? .3 : -.3) + r.n() * .05, a = r.r(.7, 1) * soft * (hand ? 1 : .9);
        md.push(modal([f * r.r(.95, 1.05), f * 2.3], [r.r(.06, .14), .03], [1, .3], a * .9, p));
        ev.push(burst(r, a * .5, .008, p, r.r(200, 400), 1, .06));          // 身體悶悶的一下
        ev.push(burst(r, a * .12, .004, p, r.lg(1000, 3000), 1.2, .02));    // 手和衣服摩擦
        if (--left > 0) wait = Math.round(SR * gap * r.r(.9, 1.1)); else wait = Math.round(SR * r.r(.6, 2));
      }
      runModal(md, L, R, n); runBursts(ev, L, R, n);
    } };
  },
  purr(r1, r2, r) {   // 貓呼嚕：每秒 22–28 下的低沉脈衝，吸氣小聲、吐氣大聲
    const FR = new Drift(r, 22, 28, 1.5, 4);
    let ph = 0, br = 0, bL = 0, bR = 0, yL = 0, yR = 0, inh = true, t = 0, D = Math.round(SR * 1.8);
    const a = lpA(260);
    return { fill(L, R, n) {
      const fr = FR.step(n) * (inh ? 1.04 : .96);
      for (let i = 0; i < n; i++) {
        if (++t >= D) { t = 0; inh = !inh; D = Math.round(SR * r.r(1.2, 2.4)); }
        const k = t / D, breath = Math.sin(Math.PI * k) * (inh ? .55 : 1);
        ph += fr / SR; if (ph >= 1) ph -= 1;
        const pulse = ph < .45 ? Math.pow(Math.sin(Math.PI * ph / .45), 2) : 0;
        bL = (bL + .02 * r1.n()) / 1.02; bR = (bR + .02 * r2.n()) / 1.02;
        yL += a * (bL - yL); yR += a * (bR - yR);
        const g = pulse * breath * 14;
        L[i] = yL * g; R[i] = yR * g;
      }
    } };
  },
};
// 每種聲音的音量校正（量過平均音量之後調的，讓每種差不多大聲）
const GAIN = { white: .35, pink: .29, brown: .51, rain: 1, window: .77, storm: .74, wave: .55, stream: .85, fire: .4, wind: .84, pencil: .44, keys: 1, tap: 1, brush: .6, earpick: .55, thump: .7, purr: .7 };   // 11-19 用 OfflineAudioContext 各算 20 秒量平均音量：連續的聲音調到約 0.07–0.11；打字、敲擊是一下一下的，照最大聲調

class SpGen extends AudioWorkletProcessor {
  constructor(opt) {
    super();
    const po = (opt && opt.processorOptions) || {}, seed = (po.seed >>> 0) || 12345;
    this.kind = GEN[po.kind] ? po.kind : 'pink';
    const r = new Rng(seed), r1 = new Rng(seed ^ 0x6a09e667), r2 = new Rng(seed ^ 0xbb67ae85);
    this.g = GEN[this.kind](r1, r2, r);
    this.k = GAIN[this.kind] || 1; this.alive = true;
    this.port.onmessage = (e) => { if (e.data && e.data.stop) this.alive = false; };
  }
  process(inputs, outputs) {
    if (!this.alive) return false;
    const o = outputs[0], L = o[0], R = o[1] || o[0], n = L.length;
    L.fill(0); if (R !== L) R.fill(0);
    this.g.fill(L, R, n);
    const k = this.k;
    for (let i = 0; i < n; i++) {   // 保險：超過 0.8 才慢慢壓（連續、不會突然跳），不會破音
      L[i] = soft(L[i] * k); if (R !== L) R[i] = soft(R[i] * k);
    }
    return true;
  }
}
registerProcessor('sp-gen', SpGen);
