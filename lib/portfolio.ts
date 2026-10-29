// Portfolio analytics: daily-rebalanced returns, risk metrics, risk contribution and exposures.
import { mean, sd } from "./format";

export type Holding = { symbol: string; weight: number };
export type PriceSeries = { a: (number | null)[] | null; name?: string; type?: string | null; sector?: string | null };

// Common ETFs by asset class; individual stocks count as equities.
const ETF_CLASS: Record<string, string> = {
  SPY: "Equities", VOO: "Equities", IVV: "Equities", VTI: "Equities", QQQ: "Equities", IWM: "Equities", DIA: "Equities", EFA: "Equities", VEA: "Equities",
  IEFA: "Equities", EEM: "Equities", VWO: "Equities", VT: "Equities", VUG: "Equities", VTV: "Equities", SCHD: "Equities", XLK: "Equities", XLF: "Equities",
  XLE: "Equities", XLV: "Equities", XLY: "Equities", XLP: "Equities", XLI: "Equities", XLU: "Equities",
  AGG: "Bonds", BND: "Bonds", TLT: "Bonds", IEF: "Bonds", SHY: "Bonds", LQD: "Bonds", HYG: "Bonds", TIP: "Bonds", MUB: "Bonds", BNDX: "Bonds", VCIT: "Bonds", GOVT: "Bonds",
  GLD: "Alternatives", IAU: "Alternatives", SLV: "Alternatives", DBC: "Alternatives", PDBC: "Alternatives", VNQ: "Alternatives", IYR: "Alternatives", GSG: "Alternatives",
  BIL: "Cash", SHV: "Cash", SGOV: "Cash", USFR: "Cash",
};
export const assetClass = (symbol: string, s?: PriceSeries) => ETF_CLASS[symbol] ?? (s?.type === "EQUITY" ? "Equities" : s?.type === "ETF" ? "Funds (other)" : "Equities");
const sectorOf = (symbol: string, s?: PriceSeries) => (s?.type === "EQUITY" ? s.sector || "Other" : ETF_CLASS[symbol] === "Equities" ? "Diversified (index fund)" : "Non-equity");

export const PRESETS: Record<string, Holding[]> = {
  "Balanced 40/30/20/10": [{ symbol: "SPY", weight: 25 }, { symbol: "EFA", weight: 15 }, { symbol: "AGG", weight: 30 }, { symbol: "GLD", weight: 10 }, { symbol: "VNQ", weight: 10 }, { symbol: "BIL", weight: 10 }],
  "Classic 60/40": [{ symbol: "VTI", weight: 60 }, { symbol: "BND", weight: 40 }],
  "Conservative income": [{ symbol: "SCHD", weight: 25 }, { symbol: "AGG", weight: 40 }, { symbol: "TIP", weight: 15 }, { symbol: "BIL", weight: 20 }],
  "Mega-cap equities": [{ symbol: "AAPL", weight: 20 }, { symbol: "MSFT", weight: 20 }, { symbol: "NVDA", weight: 15 }, { symbol: "AMZN", weight: 15 }, { symbol: "GOOGL", weight: 15 }, { symbol: "JPM", weight: 15 }],
};

export function analyze(holdings: Holding[], data: { dates: string[]; bench: (number | null)[]; series: Record<string, PriceSeries> }, days: number, rf: number) {
  const hs = holdings.filter((h) => h.weight > 0 && data.series[h.symbol]?.a);
  const total = hs.reduce((s, h) => s + h.weight, 0);
  if (!hs.length || !total) return null;
  const w = hs.map((h) => h.weight / total);
  // Keep only days where every holding and the benchmark has a price.
  const idx = data.dates.map((_, i) => i).filter((i) => data.bench[i] != null && hs.every((h) => data.series[h.symbol].a![i] != null)).slice(-(days + 1));
  if (idx.length < 30) return null;
  const px = (h: Holding, i: number) => data.series[h.symbol].a![i] as number;
  const rets = hs.map((h) => idx.slice(1).map((i, k) => px(h, i) / px(h, idx[k]) - 1));
  const bench = idx.slice(1).map((i, k) => (data.bench[i] as number) / (data.bench[idx[k]] as number) - 1);
  const port = bench.map((_, t) => rets.reduce((s, r, j) => s + w[j] * r[t], 0));
  const N = port.length, yrs = N / 252;

  const growth = (r: number[]) => { const g = [10000]; for (const x of r) g.push(g[g.length - 1] * (1 + x)); return g; };
  const gP = growth(port), gB = growth(bench);
  const drawdown = (g: number[]) => { let pk = -Infinity; return g.map((v) => { pk = Math.max(pk, v); return v / pk - 1; }); };
  const stats = (r: number[], g: number[]) => {
    const ann = (g[g.length - 1] / g[0]) ** (1 / yrs) - 1, vol = sd(r) * Math.sqrt(252);
    const rfd = (1 + rf) ** (1 / 252) - 1, excess = (mean(r)! - rfd) * 252;
    const down = Math.sqrt(r.reduce((s, x) => s + Math.min(0, x - rfd) ** 2, 0) / r.length) * Math.sqrt(252);
    const sorted = [...r].sort((a, b) => a - b), k = Math.floor(0.05 * r.length);
    return { ann, vol, sharpe: excess / vol, sortino: excess / down, mdd: Math.min(...drawdown(g)), var95: -sorted[k], cvar95: -mean(sorted.slice(0, k + 1))!, cum: g[g.length - 1] / g[0] - 1 };
  };
  const cov = (a: number[], b: number[]) => { const ma = mean(a)!, mb = mean(b)!; return a.reduce((s, x, i) => s + (x - ma) * (b[i] - mb), 0) / (a.length - 1); };
  const varP = cov(port, port), varB = cov(bench, bench);

  const positions = hs.map((h, j) => {
    const g = growth(rets[j]);
    const ann = (g[g.length - 1] / g[0]) ** (1 / yrs) - 1;
    return {
      symbol: h.symbol, name: data.series[h.symbol].name ?? h.symbol, cls: assetClass(h.symbol, data.series[h.symbol]), sector: sectorOf(h.symbol, data.series[h.symbol]),
      weight: w[j], ann, vol: sd(rets[j]) * Math.sqrt(252), beta: cov(rets[j], bench) / varB,
      contribution: w[j] * ann, riskShare: (w[j] * cov(rets[j], port)) / varP, last: px(h, idx[idx.length - 1]),
    };
  });
  const sum = (key: "cls" | "sector") => {
    const m = new Map<string, number>();
    positions.forEach((p) => m.set(p[key], (m.get(p[key]) ?? 0) + p.weight));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  const corr = rets.map((a) => rets.map((b) => cov(a, b) / Math.sqrt(cov(a, a) * cov(b, b))));
  return {
    dates: idx.map((i) => data.dates[i]), growth: { port: gP, bench: gB }, drawdown: { port: drawdown(gP), bench: drawdown(gB) },
    port: { ...stats(port, gP), beta: cov(port, bench) / varB }, bench: stats(bench, gB), positions, byClass: sum("cls"), bySector: sum("sector"), corr,
  };
}
