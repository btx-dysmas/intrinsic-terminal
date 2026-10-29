// Return-based risk statistics and technical indicators computed from daily prices.
import type { Co } from "./api";
import { div, mean, ok, sd } from "./format";
import { RF_DEFAULT } from "./models";

export function aligned(co: Co, n: number) {
  const a = co.px.t.a, s = co.px.bench, D = co.px.dates, N = a.length, out: [string, number, number][] = [];
  for (let i = Math.max(0, N - n - 1); i < N; i++) if (ok(a[i]) && ok(s[i])) out.push([D[i], a[i], s[i]]);
  return out;
}

export function risk(co: Co, n: number, rf = RF_DEFAULT) {
  const al = aligned(co, n);
  if (al.length < 30) return null;
  const r: number[] = [], m: number[] = [];
  for (let i = 1; i < al.length; i++) {
    r.push(al[i][1] / al[i - 1][1] - 1);
    m.push(al[i][2] / al[i - 1][2] - 1);
  }
  const N = r.length, yrs = N / 252;
  const cum = al[al.length - 1][1] / al[0][1] - 1, mcum = al[al.length - 1][2] / al[0][2] - 1;
  const ann = (1 + cum) ** (1 / yrs) - 1, mann = (1 + mcum) ** (1 / yrs) - 1;
  const vol = sd(r) * Math.sqrt(252), mvol = sd(m) * Math.sqrt(252);
  const mr = mean(r)!, mm = mean(m)!;
  let cov = 0, vm = 0, vr = 0;
  for (let i = 0; i < N; i++) {
    cov += (r[i] - mr) * (m[i] - mm);
    vm += (m[i] - mm) ** 2;
    vr += (r[i] - mr) ** 2;
  }
  const beta = cov / vm, corr = cov / Math.sqrt(vm * vr);
  // Ratios use annualized arithmetic means of daily returns, the standard definitions; CAGR is shown separately.
  const rfd = (1 + rf) ** (1 / 252) - 1, dd = Math.sqrt(r.reduce((s, x) => s + Math.min(0, x - rfd) ** 2, 0) / N) * Math.sqrt(252);
  const ex = (mr - rfd) * 252, mex = (mm - rfd) * 252, active = (mr - mm) * 252;
  const srt = [...r].sort((x, y) => x - y), k = Math.floor(0.05 * N);
  const te = sd(r.map((x, i) => x - m[i])) * Math.sqrt(252);
  const mdd = (t: 1 | 2) => {
    let pk = -Infinity, md = 0;
    for (const row of al) {
      pk = Math.max(pk, row[t]);
      md = Math.min(md, row[t] / pk - 1);
    }
    return md;
  };
  const up = r.filter((_, i) => m[i] > 0), dn = r.filter((_, i) => m[i] < 0);
  return {
    n: N, start: al[0][0], end: al[al.length - 1][0], cum, mcum, ann, mann, vol, mvol, beta, corr,
    sharpe: ex / vol, msharpe: mex / mvol, sortino: ex / dd,
    var95: -srt[k], cvar95: -mean(srt.slice(0, k + 1))!, pvar95: -(mr - 1.645 * sd(r)),
    mdd: mdd(1), mmdd: mdd(2), alpha: ex - beta * mex, te, ir: active / te,
    upCap: mean(up)! / mean(m.filter((x) => x > 0))!, dnCap: mean(dn)! / mean(m.filter((x) => x < 0))!,
    series: al, rets: r,
  };
}
export type Risk = NonNullable<ReturnType<typeof risk>>;

export function sma(a: number[], n: number) {
  const o: (number | null)[] = Array(a.length).fill(null);
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    s += a[i];
    if (i >= n) s -= a[i - n];
    if (i >= n - 1) o[i] = s / n;
  }
  return o;
}
export function ema(a: (number | null)[], n: number) {
  const o: (number | null)[] = Array(a.length).fill(null), k = 2 / (n + 1);
  let e: number | null = null;
  for (let i = 0; i < a.length; i++) {
    if (i === n - 1) e = mean(a.slice(0, n));
    else if (i >= n && e != null) e = (a[i] as number) * k + e * (1 - k);
    o[i] = e;
  }
  return o;
}
export function rsi(a: number[], n = 14) {
  const o: (number | null)[] = Array(a.length).fill(null);
  let g = 0, l = 0;
  for (let i = 1; i < a.length; i++) {
    const d = a[i] - a[i - 1], up = Math.max(d, 0), dn = Math.max(-d, 0);
    if (i <= n) {
      g += up / n;
      l += dn / n;
      if (i === n) o[i] = 100 - 100 / (1 + g / (l || 1e-9));
    } else {
      g = (g * (n - 1) + up) / n;
      l = (l * (n - 1) + dn) / n;
      o[i] = 100 - 100 / (1 + g / (l || 1e-9));
    }
  }
  return o;
}

export function technicals(co: Co) {
  const t = co.px.t, idx = t.c.map((v: any, i: number) => (ok(v) && ok(t.h[i]) && ok(t.l[i]) ? i : -1)).filter((i: number) => i >= 0);
  const c: number[] = idx.map((i: number) => t.c[i]), h: number[] = idx.map((i: number) => t.h[i]), l: number[] = idx.map((i: number) => t.l[i]);
  const o: number[] = idx.map((i: number) => t.o[i] ?? t.c[i]), v: number[] = idx.map((i: number) => t.v[i] || 0), d: string[] = idx.map((i: number) => co.px.dates[i]);
  const s20 = ema(c, 20), s50 = sma(c, 50), s200 = sma(c, 200), e12 = ema(c, 12), e26 = ema(c, 26);
  const macd = c.map((_, i) => (ok(e12[i]) && ok(e26[i]) ? e12[i]! - e26[i]! : null));
  const f0 = macd.findIndex(ok), sig = [...Array(f0).fill(null), ...ema(macd.slice(f0), 9)];
  const hist = macd.map((x, i) => (ok(x) && ok(sig[i]) ? x - sig[i] : null));
  const r = rsi(c, 14), v50 = sma(v, 50), N = c.length, last = c[N - 1];
  const tr = c.map((_, i) => (i ? Math.max(h[i] - l[i], Math.abs(h[i] - c[i - 1]), Math.abs(l[i] - c[i - 1])) : h[i] - l[i]));
  const lo = Math.max(5, N - 126), piv: number[] = [];
  for (let i = lo; i < N - 5; i++) {
    if (h[i] === Math.max(...h.slice(i - 5, i + 6))) piv.push(h[i]);
    if (l[i] === Math.min(...l.slice(i - 5, i + 6))) piv.push(l[i]);
  }
  const cl: { lv: number; n: number; sum: number }[] = [];
  piv.sort((a, b) => a - b).forEach((p) => {
    const g = cl.find((k) => Math.abs(k.lv - p) / p < 0.02);
    if (g) {
      g.n++;
      g.sum += p;
      g.lv = g.sum / g.n;
    } else cl.push({ lv: p, n: 1, sum: p });
  });
  const res = cl.filter((k) => k.lv > last * 1.005).sort((a, b) => a.lv - b.lv).slice(0, 2).map((k) => k.lv);
  const sup = cl.filter((k) => k.lv < last * 0.995).sort((a, b) => b.lv - a.lv).slice(0, 2).map((k) => k.lv);
  const H = Math.max(...h.slice(-21)), Lo = Math.min(...l.slice(-21)), pp = (H + Lo + last) / 3;
  const ret = (k: number) => (N > k ? c[N - 1] / c[N - 1 - k] - 1 : null);
  let cross: { type: string; date: string } | null = null;
  for (let i = N - 1; i > N - 260 && i > 0; i--) {
    if (!ok(s50[i - 1]) || !ok(s200[i - 1])) break;
    const a = s50[i]! - s200[i]!, b = s50[i - 1]! - s200[i - 1]!;
    if (a > 0 && b <= 0) { cross = { type: "Golden cross", date: d[i] }; break; }
    if (a < 0 && b >= 0) { cross = { type: "Death cross", date: d[i] }; break; }
  }
  return {
    c, h, l, o, v, d, s20, s50, s200, macd, sig, hist, r, v50, res, sup, pp, r1: 2 * pp - Lo, s1: 2 * pp - H, px: last, atr: mean(tr.slice(-14))!,
    ret1m: ret(21), ret3m: ret(63), ret6m: ret(126), ret12m: ret(252), mom121: N > 252 ? c[N - 22] / c[N - 253] - 1 : null, cross,
    rsiNow: r[N - 1], macdNow: macd[N - 1], sigNow: sig[N - 1], s50Now: s50[N - 1]!, s200Now: s200[N - 1]!, s20Now: s20[N - 1]!,
    vRatio: div(mean(v.slice(-10)), v50[N - 1]), offHi: last / Math.max(...h.slice(-252)) - 1,
  };
}
export type Tech = ReturnType<typeof technicals>;
