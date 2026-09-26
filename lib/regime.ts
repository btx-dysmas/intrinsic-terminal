// Economic regime classification from FRED series: growth, inflation, labor market and yield curve.
type Obs = [string, number][];

export type Regime = "Expansion" | "Recovery" | "Slowdown" | "Recession" | "Stagflation";

export const REGIME_COLOR: Record<Regime, string> = {
  Expansion: "var(--c2)", Recovery: "var(--c1)", Slowdown: "var(--c0)", Recession: "var(--c4)", Stagflation: "var(--c3)",
};

export const IMPLICATIONS: Record<Regime, { summary: string; equities: string; bonds: string; real: string; cash: string; sectors: string }> = {
  Expansion: {
    summary: "Growth above trend with contained inflation. Earnings are rising and credit is available.",
    equities: "Overweight; cyclical and growth earnings benefit most.", bonds: "Underweight duration; yields tend to drift higher.",
    real: "Neutral; commodities firm with demand.", cash: "Underweight; opportunity cost is high.", sectors: "Technology, industrials, consumer discretionary, financials.",
  },
  Recovery: {
    summary: "Growth has turned positive while unemployment is still elevated but falling. Policy is usually supportive.",
    equities: "Overweight, especially small caps and value, which lead early in a cycle.", bonds: "Neutral; credit spreads tighten, favor corporate over Treasuries.",
    real: "Neutral to overweight real estate as rates stabilize.", cash: "Underweight.", sectors: "Financials, industrials, materials, consumer discretionary.",
  },
  Slowdown: {
    summary: "Growth below trend without an outright contraction. Late-cycle conditions; margins come under pressure.",
    equities: "Neutral; rotate toward quality balance sheets and stable earnings.", bonds: "Add duration as rate expectations fall.",
    real: "Underweight cyclical commodities.", cash: "Neutral.", sectors: "Health care, consumer staples, utilities, quality technology.",
  },
  Recession: {
    summary: "Output is contracting or unemployment is rising quickly. Earnings estimates fall and defaults rise.",
    equities: "Underweight; favor defensive sectors and low leverage.", bonds: "Overweight high-quality duration; Treasuries rally as rates are cut.",
    real: "Underweight commodities; gold can hold up.", cash: "Overweight for liquidity.", sectors: "Consumer staples, utilities, health care.",
  },
  Stagflation: {
    summary: "Weak growth with inflation above target. Both stocks and nominal bonds tend to struggle.",
    equities: "Underweight; favor pricing power and real assets.", bonds: "Underweight nominal duration; prefer TIPS and short maturities.",
    real: "Overweight commodities, energy and gold.", cash: "Neutral to overweight; short rates are usually high.", sectors: "Energy, materials, consumer staples.",
  },
};

const lastBefore = (obs: Obs | undefined, date: string) => {
  if (!obs) return null;
  let v: number | null = null;
  for (const [d, x] of obs) {
    if (d > date) break;
    v = x;
  }
  return v;
};
const window = (obs: Obs | undefined, from: string, to: string) => (obs ?? []).filter(([d]) => d > from && d <= to).map(([, v]) => v);
const shift = (date: string, months: number) => {
  const t = new Date(date);
  t.setUTCMonth(t.getUTCMonth() + months);
  return t.toISOString().slice(0, 10);
};
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export type Reading = { date: string; regime: Regime; gdp: number | null; cpi: number | null; unemp: number | null; sahm: number | null; unempTrend: number | null; curve: number | null; reasons: string[] };

/** Classify the regime as of `date`, using only data published by then. */
export function classify(series: Record<string, { obs?: Obs }>, date: string): Reading {
  const gdp = lastBefore(series.A191RL1Q225SBEA?.obs, date), cpi = lastBefore(series.CPIAUCSL?.obs, date), unemp = lastBefore(series.UNRATE?.obs, date);
  const curve = lastBefore(series.T10Y2Y?.obs, date);
  const u = series.UNRATE?.obs;
  // Sahm rule: 3-month average unemployment against its low over the prior 12 months.
  const u3 = avg(window(u, shift(date, -3), date)), low12 = Math.min(...window(u, shift(date, -15), shift(date, -3)));
  const sahm = u3 != null && isFinite(low12) ? u3 - low12 : null;
  const u3prior = avg(window(u, shift(date, -9), shift(date, -6)));
  const unempTrend = u3 != null && u3prior != null ? u3 - u3prior : null;
  const low24 = Math.min(...window(u, shift(date, -24), date));
  const reasons: string[] = [];
  let regime: Regime;
  const hot = cpi != null && cpi > 3.5, weak = (gdp != null && gdp < 1) || (sahm != null && sahm >= 0.3);
  if (hot && weak) {
    regime = "Stagflation";
    reasons.push(`CPI inflation of ${cpi!.toFixed(1)}% alongside weak growth`);
  } else if ((sahm != null && sahm >= 0.5) || (gdp != null && gdp < 0)) {
    regime = "Recession";
    if (gdp != null && gdp < 0) reasons.push(`real GDP contracting at ${gdp.toFixed(1)}% annualized`);
    if (sahm != null && sahm >= 0.5) reasons.push(`Sahm rule triggered (unemployment +${sahm.toFixed(2)} pp above its 12-month low)`);
  } else if (gdp != null && gdp > 0 && unemp != null && isFinite(low24) && unemp - low24 >= 0.5 && unempTrend != null && unempTrend < 0) {
    regime = "Recovery";
    reasons.push(`growth positive while unemployment (${unemp.toFixed(1)}%) is still above its 2-year low but falling`);
  } else if (gdp != null && gdp >= 1.5) {
    regime = "Expansion";
    reasons.push(`real GDP growing ${gdp.toFixed(1)}% annualized`);
    if (cpi != null && cpi > 3) reasons.push(`inflation elevated at ${cpi.toFixed(1)}%, a late-cycle sign`);
  } else {
    regime = "Slowdown";
    reasons.push(`real GDP growth of ${gdp?.toFixed(1) ?? "n/a"}% is below trend`);
  }
  if (curve != null && curve < 0) reasons.push(`yield curve inverted (10y less 2y at ${curve.toFixed(2)} pp), historically a recession warning`);
  return { date, regime, gdp, cpi, unemp, sahm, unempTrend, curve, reasons };
}

/** Quarter-end regime history, for the timeline strip. */
export function history(series: Record<string, { obs?: Obs }>, from = "2008-03-31"): Reading[] {
  const out: Reading[] = [];
  const today = new Date().toISOString().slice(0, 10);
  for (let d = from; d <= today; d = shift(d, 3)) out.push(classify(series, d));
  return out;
}
