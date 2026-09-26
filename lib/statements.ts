// Statement layouts and ratio series built from the normalized EDGAR records.
import type { Co } from "./api";
import { clamp, dLabel, div, fN, fP, ok } from "./format";

type Row = [label: string, fn: (r: any, p?: any) => number | null, kind: "m" | "p" | "d", cls?: string];

export function statementRows(kind: "IS" | "BS" | "CF", fin: boolean): Row[] {
  const g = (k: string) => (r: any) => r[k];
  const yoy = (k: string) => (r: any, p: any) => (p && ok(p[k]) && p[k] > 0 && ok(r[k]) ? r[k] / p[k] - 1 : null);
  if (kind === "IS" && fin)
    return [
      ["Total net revenue", g("rev"), "m", "tot"], ["YoY growth", yoy("rev"), "p", "sub"], ["Net interest income", g("nii"), "m"], ["Noninterest income", g("nonii"), "m"],
      ["Pre-tax income", g("pretax"), "m", "tot"], ["Pre-tax margin", (r) => div(r.pretax, r.rev), "p", "sub"], ["Income tax", g("tax"), "m"], ["Effective tax rate", (r) => div(r.tax, r.pretax), "p", "sub"],
      ["Net income", g("ni"), "m", "tot"], ["Net margin", (r) => div(r.ni, r.rev), "p", "sub"], ["YoY growth", yoy("ni"), "p", "sub"], ["Diluted EPS ($)", g("eps"), "d"], ["Diluted shares (M)", g("dil"), "m"],
    ];
  if (kind === "IS")
    return [
      ["Revenue", g("rev"), "m", "tot"], ["YoY growth", yoy("rev"), "p", "sub"], ["Cost of revenue", g("cogs"), "m"], ["Gross profit", g("gp"), "m", "tot"], ["Gross margin", (r) => div(r.gp, r.rev), "p", "sub"],
      ["Research & development", g("rnd"), "m"], ["Selling, general & admin.", g("sga"), "m"], ["Operating income (EBIT)", g("op"), "m", "tot"], ["Operating margin", (r) => div(r.op, r.rev), "p", "sub"],
      ["Depreciation & amortization", g("da"), "m"], ["EBITDA", g("ebitda"), "m", "tot"], ["EBITDA margin", (r) => div(r.ebitda, r.rev), "p", "sub"],
      ["Interest expense", g("int"), "m"], ["Pre-tax income", g("pretax"), "m"], ["Income tax", g("tax"), "m"], ["Effective tax rate", (r) => div(r.tax, r.pretax), "p", "sub"],
      ["Net income", g("ni"), "m", "tot"], ["Net margin", (r) => div(r.ni, r.rev), "p", "sub"], ["YoY growth", yoy("ni"), "p", "sub"], ["Diluted EPS ($)", g("eps"), "d"], ["Diluted shares (M)", g("dil"), "m"],
    ];
  if (kind === "BS" && fin)
    return [
      ["Cash & equivalents", g("cash"), "m"], ["Total assets", g("ta"), "m", "tot"], ["Deposits", g("deposits"), "m"], ["Long-term debt", g("debt"), "m"], ["Total liabilities", g("tl"), "m", "tot"],
      ["Shareholders' equity", g("eq"), "m", "tot"], ["Goodwill & intangibles", (r) => (ok(r.gw) || ok(r.intang) ? (r.gw || 0) + (r.intang || 0) : null), "m"], ["Tangible book value", g("tbv"), "m"], ["Equity / assets", (r) => div(r.eq, r.ta), "p", "sub"],
    ];
  if (kind === "BS")
    return [
      ["Cash & equivalents", g("cash"), "m"], ["Short-term investments", g("stinv"), "m"], ["Accounts receivable", g("recv"), "m"], ["Inventory", g("inv"), "m"], ["Total current assets", g("ca"), "m", "tot"],
      ["Goodwill", g("gw"), "m"], ["Total assets", g("ta"), "m", "tot"], ["Total current liabilities", g("cl"), "m"], ["Total debt", g("debt"), "m"], ["Total liabilities", g("tl"), "m", "tot"],
      ["Shareholders' equity", g("eq"), "m", "tot"], ["Net debt / (net cash)", g("netDebt"), "m"],
    ];
  return [
    ["Operating cash flow", g("ocf"), "m", "tot"], ["Capital expenditures", (r) => (ok(r.capex) ? -r.capex : null), "m"], ["Free cash flow", g("fcf"), "m", "tot"], ["FCF margin", (r) => div(r.fcf, r.rev), "p", "sub"], ["YoY growth", yoy("fcf"), "p", "sub"],
    ["Investing cash flow", g("cfi"), "m"], ["Financing cash flow", g("cff"), "m"], ["Dividends paid", (r) => (ok(r.divp) ? -r.divp : null), "m"], ["Share repurchases", (r) => (ok(r.buyback) ? -r.buyback : null), "m"], ["Stock-based compensation", g("sbc"), "m"],
  ];
}

export function fmtKind(v: any, k: string) {
  if (k === "m") {
    if (!ok(v)) return "—";
    const s = Math.abs(v / 1e6).toLocaleString("en-US", { maximumFractionDigits: 0 });
    return v < 0 ? `(${s})` : s;
  }
  if (k === "p") return fP(v);
  return ok(v) ? fN(v, 2) : "—";
}

export function statementData(co: Co, kind: "IS" | "BS" | "CF", per: "A" | "Q") {
  const R = per === "Q" ? co.Q : co.A, lag = per === "Q" ? 4 : 1, rows = statementRows(kind, co.fin);
  const heads = R.map((r: any) => (per === "Q" ? "Q " : "FY ") + dLabel(r.end));
  const body = rows
    .map(([label, fn, k, c]) => ({ label, c, k, fn, vals: R.map((r: any, i: number) => fn(r, R[i - lag])) }))
    .filter((b) => b.vals.some(ok));
  if (kind !== "BS" && per === "A" && co.L.end !== R[R.length - 1]?.end) {
    heads.push("LTM " + dLabel(co.L.end));
    body.forEach((b) => b.vals.push(b.fn(co.L, co.LP)));
  }
  return { heads, body };
}

export function ratioSeries(co: Co) {
  return co.A.map((r: any, i: number) => {
    const p = co.A[i - 1] || null, av = (k: string) => (p && ok(p[k]) && ok(r[k]) ? (p[k] + r[k]) / 2 : r[k]);
    const t = clamp(div(r.tax, r.pretax) ?? co.taxEff, 0, 0.4);
    const ic = (x: any) => (x && ok(x.eq) ? x.eq + (x.debt || 0) - (x.cash || 0) - (x.stinv || 0) : null);
    const icv = p && ok(ic(p)) ? (ic(p)! + ic(r)!) / 2 : ic(r);
    return {
      end: r.end, gm: div(r.gp, r.rev), om: div(r.op, r.rev), em: div(r.ebitda, r.rev), nm: div(r.ni, r.rev), fm: div(r.fcf, r.rev), ptm: div(r.pretax, r.rev),
      roe: r.eq > 0 && av("eq") > 0 ? r.ni / av("eq") : null, roa: div(r.ni, av("ta")), roic: !co.fin && ok(icv) && icv > 0 && ok(r.op) ? (r.op * (1 - t)) / icv : null,
      de: r.eq > 0 ? div(r.debt, r.eq) : null, nde: r.ebitda > 0 ? div(r.netDebt, r.ebitda) : null, cov: r.int > 0 && ok(r.op) ? div(r.op, r.int) : null,
      cr: div(r.ca, r.cl), qr: ok(r.ca) && ok(r.cl) ? (r.ca - (r.inv || 0)) / r.cl : null, at: div(r.rev, av("ta")), ea: div(r.eq, r.ta), tbvg: p && p.tbv > 0 ? r.tbv / p.tbv - 1 : null,
      rg: p && p.rev > 0 ? r.rev / p.rev - 1 : null, eg: p && p.eps > 0 && ok(r.eps) ? r.eps / p.eps - 1 : null, ng: p && p.ni > 0 ? r.ni / p.ni - 1 : null, fg: p && p.fcf > 0 && ok(r.fcf) ? r.fcf / p.fcf - 1 : null,
      conv: r.ni > 0 ? div(r.fcf, r.ni) : null, payout: r.ni > 0 ? div((r.divp || 0) + (r.buyback || 0), r.ni) : null,
    } as Record<string, any>;
  });
}

export function ratioRows(fin: boolean): [string, string, string?][] {
  return fin
    ? [["sec", "Profitability"], ["roe", "Return on equity", "p"], ["roa", "Return on assets", "p"], ["ptm", "Pre-tax margin", "p"], ["nm", "Net margin", "p"],
      ["sec", "Growth"], ["rg", "Revenue growth", "p"], ["ng", "Net income growth", "p"], ["eg", "Diluted EPS growth", "p"], ["tbvg", "Tangible book value growth", "p"],
      ["sec", "Capital"], ["ea", "Equity / assets", "p"], ["payout", "Total payout ratio (dividends + buybacks)", "x"]]
    : [["sec", "Profitability"], ["gm", "Gross margin", "p"], ["om", "Operating margin", "p"], ["em", "EBITDA margin", "p"], ["nm", "Net margin", "p"], ["fm", "FCF margin", "p"],
      ["sec", "Returns"], ["roe", "Return on equity", "p"], ["roic", "Return on invested capital", "p"], ["roa", "Return on assets", "p"],
      ["sec", "Growth"], ["rg", "Revenue growth", "p"], ["ng", "Net income growth", "p"], ["eg", "Diluted EPS growth", "p"], ["fg", "Free cash flow growth", "p"],
      ["sec", "Leverage & liquidity"], ["de", "Debt / equity", "x"], ["nde", "Net debt / EBITDA", "x"], ["cov", "Interest coverage (EBIT / interest)", "x"], ["cr", "Current ratio", "x"], ["qr", "Quick ratio", "x"],
      ["sec", "Efficiency"], ["at", "Asset turnover", "x"], ["conv", "Cash conversion (FCF / net income)", "x"], ["payout", "Total payout ratio", "x"]];
}

export function ltmRatios(co: Co) {
  const L = co.L, LB = co.LB;
  return {
    gm: co.gm, om: co.om, em: co.em, nm: co.nm, fm: co.fm, ptm: div(L.pretax, L.rev), roe: co.roe, roic: co.roic, roa: co.roa, rg: co.ltmGrowth, ng: co.niGrowth,
    eg: co.LP && co.LP.eps > 0 ? (div(L.eps, co.LP.eps) ?? 1) - 1 : null, fg: co.fcfGrowth, de: co.de, nde: co.ndEbitda, cov: L.int > 0 && ok(L.op) ? div(L.op, L.int) : null,
    cr: div(L.ca, L.cl), qr: ok(L.ca) && ok(L.cl) ? (L.ca - (L.inv || 0)) / L.cl : null, at: div(L.rev, LB?.ta ? (L.ta + LB.ta) / 2 : L.ta),
    conv: L.ni > 0 ? div(L.fcf, L.ni) : null, ea: co.eqAssets, tbvg: LB?.tbv > 0 ? L.tbv / LB.tbv - 1 : null, payout: L.ni > 0 ? div((L.divp || 0) + (L.buyback || 0), L.ni) : null,
  } as Record<string, any>;
}
