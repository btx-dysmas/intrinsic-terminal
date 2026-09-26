// Valuation models, scenarios, sensitivities, comparables and the rating scorecard.
import type { Co } from "./api";
import { clamp, div, fN, fP, mean, median, ok, quant } from "./format";

export const RF_DEFAULT = 0.0425;
export const ERP_DEFAULT = 0.05;

export type Assumptions = any;

export function defaults(co: Co, rf = RF_DEFAULT): Assumptions {
  const L = co.L, e = co.est;
  const base = { years: 5, rf: +rf.toFixed(4), erp: ERP_DEFAULT, beta: +(+co.beta).toFixed(2), floor: co.fin ? 0.08 : 0.07, discOv: null, tg: 0.025, mid: false, sc: { g: 0.04, m: 0.03, w: 0.01, roe: 0.02 } };
  if (co.fin) {
    const roes = co.A.slice(-5).map((r: any) => {
      const i = co.A.indexOf(r), p = co.A[i - 1];
      const eq = p && p.eq > 0 ? (p.eq + r.eq) / 2 : r.eq;
      return eq > 0 ? r.ni / eq : null;
    });
    const pay = div((L.divp || 0) + (L.buyback || 0), L.ni);
    return { ...base, roe0: +(co.roe ?? 0.1).toFixed(3), roeT: +clamp(mean([...roes, co.roe]) ?? 0.1, 0.02, 0.35).toFixed(3), payout: +clamp(ok(pay) ? pay : 0.5, 0, 1).toFixed(2), tax: co.taxEff, gSrc: "" };
  }
  const m0 = div(L.op, L.rev);
  const ms = [...co.A.slice(-5).map((r: any) => div(r.op, r.rev)), m0];
  // A company that is not yet profitable gets a longer runway and a modest long-run margin,
  // rather than an average of deeply negative historical margins.
  const unprofitable = !ok(m0) || m0 < 0;
  const mT = unprofitable ? 0.08 : clamp(mean(ms) ?? m0 ?? 0.1, -0.05, 0.6);
  const cx = co.A.slice(-3).map((r: any) => div(r.capex, r.rev)).filter((v: any) => v > 0);
  const daP = div(L.da, L.rev) ?? 0.04;
  const cg = e ? mean([e[0].rev?.growth, e[1].rev?.growth]) : null;
  const g1 = ok(cg) ? cg : ok(co.cagr3) ? co.cagr3 : co.ltmGrowth ?? 0.04;
  return {
    ...base,
    years: unprofitable ? 10 : 5,
    g1: +clamp(g1, -0.05, 0.35).toFixed(3),
    gSrc: ok(cg) ? "Default: Street revenue growth, next two fiscal years" : "Default: 3-yr revenue CAGR",
    gN: 0.03, mT: +mT.toFixed(3), mSrc: unprofitable ? "Default: 8% long-run margin (currently unprofitable)" : "Default: 5-yr normalized", tax: +co.taxEff.toFixed(3), daPct: +daP.toFixed(3),
    capexPct: +(mean(cx) ?? daP).toFixed(3), cxSrc: cx.length ? "Default: 3-yr average" : "Not tagged in XBRL; default set equal to D&A",
    nwcPct: 0.05, kd: +co.kd.toFixed(3),
  };
}

export function capm(co: Co, a: Assumptions) {
  const ke = a.rf + a.beta * a.erp;
  if (co.fin) return { ke, w: ke, We: 1, Wd: 0, kdAT: null as number | null };
  const E = co.mcap || 0, D = co.L.debt || 0, V = E + D || 1, kdAT = a.kd * (1 - a.tax);
  return { ke, kdAT, We: E / V, Wd: D / V, w: (E / V) * ke + (D / V) * kdAT };
}
export const discRate = (co: Co, a: Assumptions) => a.discOv ?? Math.max(capm(co, a).w, a.floor ?? 0);
export const valuation = (co: Co, a: Assumptions) => (co.fin ? residualIncome(co, a) : dcf(co, a));

export function dcf(co: Co, a: Assumptions): any {
  const L = co.L, N = Math.round(clamp(a.years, 3, 10)), m0 = div(L.op, L.rev) ?? 0, w = discRate(co, a);
  const rows: any[] = [];
  let rev = L.rev, pvSum = 0;
  for (let i = 1; i <= N; i++) {
    const g = a.g1 + ((a.gN - a.g1) * (i - 1)) / (N - 1), prev = rev;
    rev = prev * (1 + g);
    const m = m0 + ((a.mT - m0) * i) / N, ebit = rev * m, tax = Math.max(0, ebit) * a.tax, nopat = ebit - tax;
    const da = rev * a.daPct, capex = rev * a.capexPct, dnwc = (rev - prev) * a.nwcPct, fcf = nopat + da - capex - dnwc;
    const df = 1 / (1 + w) ** (a.mid ? i - 0.5 : i), pv = fcf * df;
    pvSum += pv;
    rows.push({ i, year: +L.end.slice(0, 4) + i, g, rev, m, ebit, ebitda: ebit + da, tax, nopat, da, capex, dnwc, fcf, df, pv, flow: fcf });
  }
  const last = rows[N - 1], valid = w > a.tg + 0.001;
  const tv = valid ? (last.fcf * (1 + a.tg)) / (w - a.tg) : null, pvTv = valid ? tv! / (1 + w) ** N : null;
  const ev = valid ? pvSum + pvTv! : null, eqv = valid ? ev! - L.netDebt : null;
  // Shareholders cannot be worth less than zero: a negative equity value means the model is not meaningful.
  const nm = valid && eqv! <= 0, ps = valid && !nm ? eqv! / co.shares : null;
  return { kind: "dcf", w, rows, pvSum, tv, pvTv, ev, eqv, ps, nm, up: ok(ps) && co.price ? ps / co.price - 1 : null, tvShare: valid ? pvTv! / ev! : null, exitMult: valid ? tv! / last.ebitda : null, valid, N, finalRev: last.rev, finalMargin: last.m };
}

export function residualIncome(co: Co, a: Assumptions): any {
  const L = co.L, N = Math.round(clamp(a.years, 3, 10)), ke = discRate(co, a);
  const rows: any[] = [];
  let bv = L.eq, pvSum = 0;
  for (let i = 1; i <= N; i++) {
    const roe = a.roe0 + ((a.roeT - a.roe0) * i) / N, ni = roe * bv, charge = ke * bv, ri = ni - charge, dist = ni * a.payout, bv1 = bv + ni - dist;
    const df = 1 / (1 + ke) ** (a.mid ? i - 0.5 : i), pv = ri * df;
    pvSum += pv;
    rows.push({ i, year: +L.end.slice(0, 4) + i, bv0: bv, roe, ni, charge, ri, dist, bv1, df, pv, flow: ri });
    bv = bv1;
  }
  const last = rows[N - 1], valid = ke > a.tg + 0.001;
  const tv = valid ? (last.ri * (1 + a.tg)) / (ke - a.tg) : null, pvTv = valid ? tv! / (1 + ke) ** N : null;
  const eqv = valid ? L.eq + pvSum + pvTv! : null, nm = valid && eqv! <= 0, ps = valid && !nm ? eqv! / co.shares : null;
  return { kind: "ri", w: ke, rows, pvSum, tv, pvTv, ev: null, eqv, ps, nm, up: ok(ps) && co.price ? ps / co.price - 1 : null, tvShare: valid ? pvTv! / (eqv! - L.eq || 1) : null, impliedPB: valid ? eqv! / L.eq : null, valid, N, finalRoe: last.roe };
}

export function scenario(co: Co, a: Assumptions, k: -1 | 0 | 1) {
  const b = { ...a, discOv: discRate(co, a) - k * a.sc.w };
  if (co.fin) b.roeT = a.roeT + k * a.sc.roe;
  else {
    b.g1 = a.g1 + k * a.sc.g;
    b.mT = a.mT + k * a.sc.m;
  }
  return valuation(co, b);
}
export const scenarios = (co: Co, a: Assumptions) => [scenario(co, a, -1), valuation(co, a), scenario(co, a, 1)];

export function sensGrid(co: Co, a: Assumptions, d: any) {
  const st = [-0.01, -0.005, 0, 0.005, 0.01];
  const ws = st.map((x) => d.w + x), gs = st.map((x) => a.tg + x);
  const A = gs.map((g) => ws.map((w) => valuation(co, { ...a, discOv: w, tg: g }).ps));
  let rows2: number[], cols2: number[], B: any[][], rl: string, cl: string;
  if (co.fin) {
    rows2 = [-0.04, -0.02, 0, 0.02, 0.04].map((x) => a.roeT + x);
    cols2 = [-0.2, -0.1, 0, 0.1, 0.2].map((x) => clamp(a.payout + x, 0, 1));
    B = rows2.map((r) => cols2.map((p) => valuation(co, { ...a, roeT: r, payout: p }).ps));
    rl = "Target ROE"; cl = "Payout";
  } else {
    rows2 = [-0.04, -0.02, 0, 0.02, 0.04].map((x) => a.mT + x);
    cols2 = [-0.04, -0.02, 0, 0.02, 0.04].map((x) => a.g1 + x);
    B = rows2.map((m) => cols2.map((g) => valuation(co, { ...a, mT: m, g1: g }).ps));
    rl = "Final margin"; cl = "Yr-1 growth";
  }
  return { ws, gs, A, rows2, cols2, B, rl, cl };
}

export function peerStats(co: Co, peers: Co[]) {
  const keys = ["pe", "fpe", "evEbitda", "evRev", "ps", "pb", "ptbv", "fcfYld"], st: Record<string, any> = {};
  for (const k of keys) {
    const vals = peers.map((p) => p[k]).filter((v) => ok(v) && (k === "fcfYld" || (v > 0 && v < 999)));
    st[k] = { med: median(vals), mean: mean(vals), p25: quant(vals, 0.25), p75: quant(vals, 0.75), n: vals.length };
  }
  const implied: any[] = [], sh = co.shares, nd = co.L.netDebt;
  const add = (label: string, k: string, fn: (m: number) => number, base: any) => {
    const s = st[k];
    if (!ok(s.med) || !ok(base) || base <= 0) return;
    implied.push({ label, k, lo: fn(s.p25), mid: fn(s.med), hi: fn(s.p75), med: s.med });
  };
  if (!co.fin) {
    add("EV / EBITDA (LTM)", "evEbitda", (m) => (m * co.L.ebitda - nd) / sh, co.L.ebitda);
    add("EV / Revenue (LTM)", "evRev", (m) => (m * co.L.rev - nd) / sh, co.L.rev);
  }
  add("P / E (LTM)", "pe", (m) => (m * co.L.ni) / sh, co.L.ni);
  if (co.fpeSrc === "consensus") add("P / E (NTM consensus)", "fpe", (m) => m * co.y.fwdEps, co.y.fwdEps);
  add("P / Book", "pb", (m) => (m * co.L.eq) / sh, co.L.eq);
  if (co.fin) add("P / Tangible book", "ptbv", (m) => (m * co.L.tbv) / sh, co.L.tbv);
  else add("P / Sales (LTM)", "ps", (m) => (m * co.L.rev) / sh, co.L.rev);
  return { ps: peers, st, implied };
}

function score(v: any, cuts: number[]) {
  if (!ok(v)) return null;
  if (v > cuts[0]) return 2;
  if (v > cuts[1]) return 1;
  if (v > cuts[2]) return 0;
  if (v > cuts[3]) return -1;
  return -2;
}

export function rating(co: Co, d: any, comp: ReturnType<typeof peerStats>) {
  const relK = co.fin ? "pb" : "evEbitda", relLbl = co.fin ? "P/B" : "EV/EBITDA";
  const prem = ok(co[relK]) && ok(comp.st[relK].med) ? co[relK] / comp.st[relK].med - 1 : null;
  const spread = co.fin ? (ok(co.roe) ? co.roe - d.w : null) : ok(co.roic) ? co.roic - d.w : null;
  const neg = (v: number | null) => (v == null ? null : -v);
  const F: any[] = [
    { name: co.fin ? "Intrinsic value (residual income)" : "Intrinsic value (DCF)", w: 0.3, disp: d.nm ? "Negative equity value" : `${fP(d.up, 1, true)} vs price`, s: d.nm ? -2 : score(d.up, [0.15, 0.05, -0.05, -0.15]), basis: "Upside >15% = +2; 5 to 15% = +1; within 5% = 0; -5 to -15% = -1; below -15% = -2" },
    { name: "Relative valuation", w: 0.15, disp: ok(prem) ? `${fP(prem, 0, true)} ${relLbl} vs peer median` : "n.m.", s: neg(score(prem, [0.3, 0.1, -0.1, -0.3])), basis: "Discount >30% = +2 through premium >30% = -2" },
    { name: "Growth", w: 0.15, disp: `${fP(co.cagr3)} 3-yr revenue CAGR`, s: score(co.cagr3, [0.15, 0.08, 0.02, -0.03]), basis: ">15% = +2; >8% = +1; >2% = 0; >-3% = -1" },
    { name: "Returns on capital", w: 0.15, disp: ok(spread) ? `${fP(spread, 1, true)}${co.fin ? " ROE less cost of equity" : " ROIC less WACC"}` : "n.m.", s: score(spread, [0.1, 0.03, -0.01, -0.05]), basis: "Spread >10pp = +2; >3pp = +1; >-1pp = 0; >-5pp = -1" },
    co.fin
      ? { name: "Capital strength", w: 0.1, disp: `${fP(co.eqAssets, 1)} equity / assets`, s: score(co.eqAssets, [0.12, 0.09, 0.07, 0.05]), basis: ">12% = +2; >9% = +1; >7% = 0; >5% = -1" }
      : { name: "Balance sheet", w: 0.1, disp: co.L.ebitda > 0 ? (co.L.netDebt < 0 ? "Net cash" : `${fN(co.ndEbitda, 1)}x net debt / EBITDA`) : "Negative EBITDA", s: co.L.ebitda > 0 ? (co.L.netDebt < 0 ? 2 : neg(score(co.ndEbitda, [4, 2.5, 1, 0]))) : -2, basis: "Net cash = +2; <1x = +1; <2.5x = 0; <4x = -1; above = -2" },
    { name: "Risk-adjusted return", w: 0.15, disp: co.r3y ? `${fN(co.r3y.sharpe, 2)} Sharpe ratio (3-yr)` : "No price history", s: co.r3y ? score(co.r3y.sharpe, [1, 0.6, 0.2, -0.2]) : null, basis: ">1.0 = +2; >0.6 = +1; >0.2 = 0; >-0.2 = -1" },
  ];
  const act = F.filter((f) => f.s != null), wsum = act.reduce((s, f) => s + f.w, 0) || 1;
  const total = act.reduce((s, f) => s + f.w * f.s, 0) / wsum;
  F.forEach((f) => (f.contrib = f.s != null ? (f.w * f.s) / wsum : null));
  return { factors: F, total, rating: total >= 0.5 ? "BUY" : total <= -0.5 ? "SELL" : "HOLD", prem, spread, relLbl };
}
