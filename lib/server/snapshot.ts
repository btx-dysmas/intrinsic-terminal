// Market and fundamental metrics for one company: multiples, margins, returns, growth, beta.
import type { Fundamentals } from "./fundamentals";
import type { Profile } from "./yahoo";

const RF = 0.0425;
const ok = (v: unknown): v is number => typeof v === "number" && isFinite(v);
const div = (a: any, b: any) => (ok(a) && ok(b) && b !== 0 ? a / b : null);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const mean = (xs: any[]) => {
  const v = xs.filter(ok);
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
};
const median = (xs: number[]) => {
  const v = [...xs].sort((a, b) => a - b);
  return v.length % 2 ? v[v.length >> 1] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2;
};
const stdev = (xs: number[]) => {
  const m = mean(xs)!;
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
};
const days = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 864e5;

function betaWeekly(a: (number | null)[], m: (number | null)[], weeks = 104) {
  const pairs = a.map((x, i) => [x, m[i]] as const).filter(([x, y]) => ok(x) && ok(y)).slice(-(weeks * 5 + 1)) as [number, number][];
  const w = pairs.filter((_, i) => (pairs.length - 1 - i) % 5 === 0);
  const r = w.slice(1).map((p, i) => p[0] / w[i][0] - 1), q = w.slice(1).map((p, i) => p[1] / w[i][1] - 1);
  if (r.length < 20) return null;
  const mr = mean(r)!, mq = mean(q)!;
  const cov = r.reduce((s, x, i) => s + (x - mr) * (q[i] - mq), 0), vq = q.reduce((s, y) => s + (y - mq) ** 2, 0);
  return vq ? cov / vq : null;
}

function windowStats(a: (number | null)[], m: (number | null)[], n: number) {
  const px = a.map((x, i) => [x, m[i]] as const).filter(([x, y]) => ok(x) && ok(y)).slice(-(n + 1)) as [number, number][];
  if (px.length < 30) return null;
  const r = px.slice(1).map((p, i) => p[0] / px[i][0] - 1);
  const cum = px[px.length - 1][0] / px[0][0] - 1, ann = (1 + cum) ** (252 / r.length) - 1, vol = stdev(r) * Math.sqrt(252);
  // Sharpe: annualized mean daily return over the T-bill rate, divided by annualized volatility.
  const excess = (mean(r)! - ((1 + RF) ** (1 / 252) - 1)) * 252;
  return { cum, ann, vol, sharpe: vol ? excess / vol : null };
}

/** Map Yahoo's "current year" and "next year" consensus onto fiscal years after the last 10-K. */
function consensusYears(fund: Fundamentals, y: Profile) {
  const e = y.est ?? ({} as any), r0 = e.rev?.["0y"], e0 = e.eps?.["0y"];
  if (!r0 && !e0) return null;
  const last = fund.A[fund.A.length - 1], y0 = Number(last.end.slice(0, 4));
  let off = 1;
  if (ok(r0?.yearAgo) && ok(last.rev) && Math.abs(r0.yearAgo / last.rev - 1) > 0.06) off = 2;
  else if (ok(e0?.yearAgo) && ok(last.eps) && last.eps > 0 && Math.abs(e0.yearAgo / last.eps - 1) > 0.12) off = 2;
  return [
    { label: `FY${String(y0 + off).slice(2)}E`, eps: e0, rev: r0 },
    { label: `FY${String(y0 + off + 1).slice(2)}E`, eps: e.eps?.["+1y"], rev: e.rev?.["+1y"] },
  ];
}

export function snapshot(meta: { lastFiled?: string | null }, fund: Fundamentals, y: Profile, px: any) {
  const { A, Q, L, LP, LB, fin } = fund;
  const last = A[A.length - 1];
  const s: Record<string, any> = {};
  const t = px?.t;
  if (t) {
    const idx = t.c.map((v: any, i: number) => (ok(v) ? i : -1)).filter((i: number) => i >= 0);
    const i = idx[idx.length - 1];
    s.price = t.c[i];
    s.prev = idx.length > 1 ? t.c[idx[idx.length - 2]] : null;
    const w = Math.max(0, t.c.length - 252);
    s.hi52 = Math.max(...t.h.slice(w).filter(ok));
    s.lo52 = Math.min(...t.l.slice(w).filter(ok));
    s.avgVol = mean(t.v.slice(-63));
    s.priceDate = px.dates[i];
  } else Object.assign(s, { price: y.price, prev: null, hi52: null, lo52: null, avgVol: null, priceDate: null });
  const price = s.price;

  // Market cap / price captures every share class; the EDGAR cover page is the fallback.
  if (ok(y.mcap) && ok(y.price) && y.price > 0) {
    s.shares = y.mcap / y.price;
    s.sharesSrc = "Market capitalization / price (Yahoo Finance; all share classes)";
  } else {
    const lastDil = Q.length ? Q[Q.length - 1].dil : L.dil;
    s.shares = fund.coverShares;
    s.sharesSrc = "EDGAR cover page shares outstanding";
    if (!ok(s.shares) || (ok(lastDil) && (s.shares / lastDil < 0.8 || s.shares / lastDil > 1.25))) {
      s.shares = lastDil;
      s.sharesSrc = "EDGAR diluted weighted-average shares";
    }
  }
  const mcap = ok(price) && ok(s.shares) ? price * s.shares : null;
  s.mcap = mcap;
  s.ev = ok(mcap) && !fin ? mcap + L.netDebt : null;
  const cut = s.priceDate ? new Date(Date.parse(s.priceDate) - 365 * 864e5).toISOString().slice(0, 10) : "0000";
  const d12 = (px?.divs ?? []).filter(([d]: [string]) => d > cut).reduce((acc: number, [, v]: [string, number]) => acc + v, 0);
  s.divYld = ok(price) && price ? (d12 > 0 ? d12 / price : ok(last.dps) ? last.dps / price : 0) : null;

  const cagr = (a: any, b: any, n: number) => (ok(a) && ok(b) && a > 0 && b > 0 ? (b / a) ** (1 / n) - 1 : null);
  s.cagr3 = A.length >= 4 ? cagr(A[A.length - 4].rev, last.rev, 3) : A.length >= 2 ? cagr(A[0].rev, last.rev, A.length - 1) : null;
  s.ltmGrowth = LP && div(L.rev, LP.rev) != null ? div(L.rev, LP.rev)! - 1 : null;
  s.niGrowth = LP && ok(LP.ni) && LP.ni > 0 && ok(L.ni) ? L.ni / LP.ni - 1 : null;
  s.fcfGrowth = LP && ok(LP.fcf) && LP.fcf > 0 && ok(L.fcf) ? L.fcf / LP.fcf - 1 : null;
  const taxes = A.slice(-3).map((r: any) => div(r.tax, r.pretax)).filter((v): v is number => ok(v) && v > 0 && v < 0.5);
  s.taxEff = taxes.length ? clamp(median(taxes), 0.1, 0.28) : 0.21;

  const avg = (k: string) => (LB && ok(LB[k]) && ok(L[k]) ? (L[k] + LB[k]) / 2 : L[k]);
  const ic = (r: any) => (r && ok(r.eq) ? r.eq + (r.debt || 0) - (r.cash || 0) - (r.stinv || 0) : null);
  const icAvg = LB && ok(ic(LB)) && ok(ic(L)) ? (ic(L)! + ic(LB)!) / 2 : ic(L);
  s.roe = ok(L.eq) && L.eq > 0 && ok(avg("eq")) && avg("eq") > 0 && ok(L.ni) ? L.ni / avg("eq") : null;
  s.roic = !fin && ok(icAvg) && icAvg > 0 && ok(L.op) ? (L.op * (1 - s.taxEff)) / icAvg : null;
  const kd = div(L.int, avg("debt"));
  s.kd = ok(kd) && kd > 0 ? clamp(kd, 0.03, 0.09) : 0.05;

  s.pe = ok(L.ni) && L.ni > 0 ? div(mcap, L.ni) : null;
  if (ok(y.fwdEps) && y.fwdEps > 0 && ok(price)) {
    s.fpe = price / y.fwdEps;
    s.fpeSrc = "consensus";
  } else {
    const g = clamp(ok(s.cagr3) ? s.cagr3 : ok(s.ltmGrowth) ? s.ltmGrowth : 0.03, -0.05, 0.35);
    s.fpe = ok(L.ni) && L.ni > 0 ? div(mcap, L.ni * (1 + g)) : null;
    s.fpeSrc = "model";
  }
  s.evEbitda = !fin && ok(L.ebitda) && L.ebitda > 0 ? div(s.ev, L.ebitda) : null;
  s.evRev = fin ? null : div(s.ev, L.rev);
  s.ps = div(mcap, L.rev);
  s.pb = ok(L.eq) && L.eq > 0 ? div(mcap, L.eq) : null;
  s.ptbv = ok(L.tbv) && L.tbv > 0 ? div(mcap, L.tbv) : null;
  s.fcfYld = fin ? null : div(L.fcf, mcap);
  s.de = !fin && ok(L.eq) && L.eq > 0 ? div(L.debt, L.eq) : null;
  s.ndEbitda = !fin && ok(L.ebitda) && L.ebitda > 0 ? div(L.netDebt, L.ebitda) : null;
  s.gm = fin ? null : div(L.gp, L.rev);
  s.om = fin ? null : div(L.op, L.rev);
  s.em = fin ? null : div(L.ebitda, L.rev);
  s.nm = div(L.ni, L.rev);
  s.fm = fin ? null : div(L.fcf, L.rev);
  s.eqAssets = div(L.eq, L.ta);
  s.roa = div(L.ni, avg("ta"));
  s.street = {
    target: y.targetMean, hi: y.targetHigh, lo: y.targetLow, n: y.nAnalysts, key: y.recKey, mean: y.recMean, recs: y.recs,
    up: ok(y.targetMean) && ok(price) && price ? y.targetMean / price - 1 : null,
  };
  s.est = consensusYears(fund, y);
  if (t) {
    const b = betaWeekly(t.a, px.bench);
    s.betaRaw = b;
    s.betaAdj = ok(b) ? 0.67 * b + 0.33 : null;
    s.r1y = windowStats(t.a, px.bench, 252);
    s.r3y = windowStats(t.a, px.bench, 756);
  } else Object.assign(s, { betaRaw: null, betaAdj: null, r1y: null, r3y: null });
  s.beta = ok(s.betaAdj) ? s.betaAdj : ok(y.beta) ? y.beta : 1;
  s.stale = !!(meta.lastFiled && Q.length && days(Q[Q.length - 1].end, meta.lastFiled) > 100);
  return s;
}
