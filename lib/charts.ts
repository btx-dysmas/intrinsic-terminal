// Plotly figure builders. Each returns { data, layout } so the same figure renders on screen and in the PDF.
// Colors are written in the light palette; <Plot> swaps them for their validated dark equivalents in dark mode.
// Every chart uses a single y-axis: measures on different scales get separate charts.
import type { Co } from "./api";
import { dLabel, median, ok } from "./format";
import type { Risk, Tech } from "./risk";

export const PAL = {
  ink: "#1A2233", ink2: "#4B5568", ink3: "#737D91", ink4: "#A9B1C0", line: "#CDD3DE", grid: "#EDF0F5", white: "#FFFFFF",
  c0: "#B4BAC6", c1: "#2F5FBF", c2: "#0E9B95", c3: "#C27812", c4: "#C23F68",
  b1: "#A3B7E3", b2: "#5E83D0", b3: "#2A4E9C", pos: "#1E7F4E", neg: "#C0392B",
};
/** Dark-mode equivalents, each validated against the dark card surface. */
export const DARK_MAP: Record<string, string> = {
  "#1A2233": "#E3E8F1", "#4B5568": "#AEB8CA", "#737D91": "#8A96AB", "#A9B1C0": "#5B6780", "#CDD3DE": "#33405A", "#EDF0F5": "#1E2940", "#FFFFFF": "#131B2B",
  "#B4BAC6": "#4A5468", "#2F5FBF": "#6A80E3", "#0E9B95": "#1FA395", "#C27812": "#C4862A", "#C23F68": "#CF5F83",
  "#A3B7E3": "#34457A", "#5E83D0": "#5E7ED8", "#2A4E9C": "#9BB2F2", "#1E7F4E": "#4CC38A", "#C0392B": "#F07A70",
};
const A = (hex: string, a: number) => hex + Math.round(a * 255).toString(16).padStart(2, "0").toUpperCase(); // 8-digit hex keeps DARK_MAP working
export type Fig = { data: any[]; layout: any };

type LO = { xTitle?: string; yTitle?: string; grid?: boolean; legend?: "right" | "bottom" | "none"; yFmt?: string; xType?: string; ySuffix?: string; yPrefix?: string; hover?: string; barmode?: string };

export function base(o: LO = {}): any {
  const title = (t?: string) => (t ? { text: t, font: { color: PAL.ink3, size: 12 }, standoff: 8 } : undefined);
  const legend =
    o.legend === "none" ? undefined
      : o.legend === "right" ? { orientation: "v", x: 1.02, xanchor: "left", y: 0.5, yanchor: "middle", font: { size: 12.5, color: PAL.ink2 } }
      : { orientation: "h", x: 0.5, xanchor: "center", y: -0.16, yanchor: "top", font: { size: 12.5, color: PAL.ink2 } };
  return {
    font: { family: '"IBM Plex Sans", "Segoe UI", Arial, sans-serif', size: 12, color: PAL.ink2 },
    paper_bgcolor: PAL.white, plot_bgcolor: PAL.white,
    margin: { l: 58, r: 14, t: 10, b: o.legend === "none" ? 40 : 72 },
    showlegend: o.legend !== "none", legend,
    barmode: o.barmode ?? "group", bargap: 0.3, bargroupgap: 0.08, barcornerradius: 3,
    hovermode: o.hover ?? "x unified", hoverlabel: { bgcolor: PAL.ink, bordercolor: PAL.ink, font: { color: PAL.white, size: 12 } },
    xaxis: { showgrid: false, showline: true, linecolor: PAL.line, ticks: "", title: title(o.xTitle), type: o.xType, automargin: true, fixedrange: true, tickfont: { color: PAL.ink3 } },
    yaxis: { showgrid: o.grid !== false, gridcolor: PAL.grid, zeroline: true, zerolinecolor: PAL.line, showline: false, title: title(o.yTitle), tickformat: o.yFmt, ticksuffix: o.ySuffix, tickprefix: o.yPrefix, automargin: true, fixedrange: true, tickfont: { color: PAL.ink3 } },
  };
}

/** Pick billions or millions so axes read naturally for large and small companies. */
export function unitFor(vals: any[]) {
  const mx = Math.max(0, ...vals.filter(ok).map((v: number) => Math.abs(v)));
  return mx >= 5e9 ? { k: 1e9, s: "B", label: "USD billions" } : { k: 1e6, s: "M", label: "USD millions" };
}
const sc = (v: any, k: number) => (ok(v) ? v / k : null);
const hollow = (color: string, extra: any = {}) => ({ type: "scatter", mode: "lines+markers", line: { color, width: 2 }, marker: { symbol: "circle", size: 8, color: PAL.white, line: { width: 2, color } }, ...extra });
const line = (name: string, x: any[], y: any[], color: string, extra: any = {}) => ({ type: "scatter", mode: "lines", name, x, y, line: { color, width: 2 }, ...extra });
const bar = (name: string, x: any[], y: any[], color: any, extra: any = {}) => ({ type: "bar", name, x, y, marker: { color, line: { width: 0 } }, ...extra });

export function figScenario(co: Co, s: any[]): Fig {
  const x = s[1].rows.map((r: any) => String(r.year));
  const u = unitFor(s.flatMap((v) => v.rows.map((r: any) => r.flow)));
  const tip = `%{y:$,.1f}${u.s}`;
  return {
    data: [
      bar("Bear case", x, s[0].rows.map((r: any) => sc(r.flow, u.k)), PAL.b1, { hovertemplate: tip }),
      bar("Base case", x, s[1].rows.map((r: any) => sc(r.flow, u.k)), PAL.b2, { hovertemplate: tip }),
      bar("Bull case", x, s[2].rows.map((r: any) => sc(r.flow, u.k)), PAL.b3, { hovertemplate: tip }),
    ],
    layout: base({ yTitle: u.label, yFmt: ",.0f" }),
  };
}

export function figRevEarn(co: Co): Fig {
  const Ar = co.A, est = co.est || [], sh = co.L.dil || co.shares, n = Ar.length;
  const x = [...Ar.map((r: any) => "FY" + r.end.slice(2, 4)), ...est.map((e: any) => e.label)];
  const rev = [...Ar.map((r: any) => r.rev), ...est.map((e: any) => e.rev?.avg ?? null)];
  const niE = est.map((e: any) => (ok(e.eps?.avg) && ok(sh) ? e.eps.avg * sh : null));
  const u = unitFor(rev), tip = `%{y:$,.1f}${u.s}`, pad = est.map(() => null);
  const data: any[] = [bar("Revenue", x, rev.map((v) => sc(v, u.k)), rev.map((_, i) => (i >= n ? A(PAL.c1, 0.4) : PAL.c1)), { hovertemplate: tip })];
  if (!co.fin) data.push(hollow(PAL.c3, { name: "EBITDA", x, y: [...Ar.map((r: any) => sc(r.ebitda, u.k)), ...pad], hovertemplate: tip }));
  data.push(hollow(PAL.c4, { name: "Net income", x, y: [...Ar.map((r: any) => sc(r.ni, u.k)), ...niE.map((v: any) => sc(v, u.k))], hovertemplate: tip }));
  if (!co.fin) data.push(hollow(PAL.c2, { name: "Free cash flow", x, y: [...Ar.map((r: any) => sc(r.fcf, u.k)), ...pad], hovertemplate: tip }));
  return { data, layout: base({ yTitle: u.label, yFmt: ",.0f" }) };
}

export function figPrice(co: Co, range: string): Fig {
  const D = co.px.dates;
  const n = ({ "1M": 21, "6M": 126, YTD: D.length - D.findIndex((d: string) => d >= D[D.length - 1].slice(0, 4) + "-01-01"), "1Y": 252, "3Y": 756, "5Y": 1260 } as any)[range] || 252;
  const s = Math.max(0, D.length - n - 1), c = co.px.t.a.slice(s), m = co.px.bench.slice(s), i0 = c.findIndex(ok), x = D.slice(s);
  const lay = base({ yTitle: "Rebased to 100", xType: "date" });
  lay.yaxis.zeroline = false;
  return {
    data: [
      line(`${co.tk} total return`, x, c.map((v: any) => (ok(v) ? (v / c[i0]) * 100 : null)), PAL.c1, { fill: "tozeroy", fillcolor: A(PAL.c1, 0.06), hovertemplate: "%{y:.1f}" }),
      line("S&P 500 (SPY)", x, m.map((v: any) => (ok(v) ? (v / m[i0]) * 100 : null)), PAL.ink3, { line: { color: PAL.ink3, width: 1.6, dash: "dot" }, hovertemplate: "%{y:.1f}" }),
    ],
    layout: { ...lay, yaxis: { ...lay.yaxis, rangemode: "normal" } },
  };
}

export function figStmt(co: Co, per: "A" | "Q"): Fig {
  const R = per === "Q" ? co.Q : co.A, x = R.map((r: any) => (per === "Q" ? "Q " : "FY ") + dLabel(r.end));
  const u = unitFor(R.map((r: any) => r.rev)), tip = `%{y:$,.1f}${u.s}`;
  const data: any[] = [bar("Revenue", x, R.map((r: any) => sc(r.rev, u.k)), PAL.c1, { hovertemplate: tip }), hollow(PAL.c4, { name: "Net income", x, y: R.map((r: any) => sc(r.ni, u.k)), hovertemplate: tip })];
  if (!co.fin) data.push(hollow(PAL.c2, { name: "Free cash flow", x, y: R.map((r: any) => sc(r.fcf, u.k)), hovertemplate: tip }));
  return { data, layout: base({ yTitle: u.label, yFmt: ",.0f" }) };
}

export function figCap(co: Co, per: "A" | "Q"): Fig {
  const R = per === "Q" ? co.Q : co.A, x = R.map((r: any) => (per === "Q" ? "Q " : "FY ") + dLabel(r.end));
  const u = unitFor(R.flatMap((r: any) => [r.eq, r.debt, r.tbv])), tip = `%{y:$,.1f}${u.s}`;
  const data = co.fin
    ? [bar("Shareholders' equity", x, R.map((r: any) => sc(r.eq, u.k)), PAL.c1, { hovertemplate: tip }), bar("Tangible book value", x, R.map((r: any) => sc(r.tbv, u.k)), PAL.c2, { hovertemplate: tip })]
    : [bar("Cash & ST investments", x, R.map((r: any) => sc((r.cash || 0) + (r.stinv || 0), u.k)), PAL.c2, { hovertemplate: tip }), bar("Total debt", x, R.map((r: any) => sc(r.debt, u.k)), PAL.c3, { hovertemplate: tip }), bar("Shareholders' equity", x, R.map((r: any) => sc(r.eq, u.k)), PAL.c1, { hovertemplate: tip })];
  return { data, layout: base({ yTitle: u.label, yFmt: ",.0f" }) };
}

export function figMargins(co: Co, R: any[]): Fig {
  const sets: [string, string, string][] = co.fin ? [["ROE", "roe", PAL.c1], ["ROA", "roa", PAL.c2], ["Net margin", "nm", PAL.c4]] : [["Gross", "gm", PAL.c1], ["EBITDA", "em", PAL.c3], ["Operating", "om", PAL.c2], ["Net", "nm", PAL.c4]];
  const x = R.map((r) => "FY " + dLabel(r.end));
  const lay = base({ yFmt: ".0%" });
  const all = sets.flatMap(([, k]) => R.map((r) => r[k])).filter(ok);
  // Keep one deeply negative early year from flattening every other line.
  if (all.some((v) => v < -1)) lay.yaxis.range = [-1, Math.max(0.1, ...all) * 1.15];
  return { data: sets.map(([n, k, c]) => hollow(c, { name: n, x, y: R.map((r) => r[k]), hovertemplate: "%{y:.1%}" })), layout: lay };
}

export function figReturns(co: Co, R: any[]): Fig {
  const x = R.map((r) => "FY " + dLabel(r.end));
  return {
    data: [bar("ROE", x, R.map((r) => r.roe), PAL.c1, { hovertemplate: "%{y:.1%}" }), bar(co.fin ? "ROA" : "ROIC", x, R.map((r) => (co.fin ? r.roa : r.roic)), PAL.c2, { hovertemplate: "%{y:.1%}" })],
    layout: base({ yFmt: ".0%" }),
  };
}

export function figValuation(co: Co, d: any): Fig {
  const H = co.A.slice(-4);
  if (co.fin) {
    const x = [...H.map((r: any) => "FY" + r.end.slice(2, 4)), ...d.rows.map((r: any) => `${r.year}E`)];
    const bv = [...H.map((r: any) => r.eq), ...d.rows.map((r: any) => r.bv1)], u = unitFor(bv), tip = `%{y:$,.1f}${u.s}`;
    return {
      data: [
        bar("Book value (period end)", x, bv.map((v) => sc(v, u.k)), bv.map((_, i) => (i >= H.length ? A(PAL.c1, 0.4) : PAL.c1)), { hovertemplate: tip }),
        hollow(PAL.c4, { name: "Net income", x, y: [...H.map((r: any) => sc(r.ni, u.k)), ...d.rows.map((r: any) => sc(r.ni, u.k))], hovertemplate: tip }),
      ],
      layout: base({ yTitle: u.label, yFmt: ",.0f" }),
    };
  }
  const x = [...H.map((r: any) => "FY" + r.end.slice(2, 4)), "LTM", ...d.rows.map((r: any) => `${r.year}E`)];
  const rev = [...H.map((r: any) => r.rev), co.L.rev, ...d.rows.map((r: any) => r.rev)], u = unitFor(rev), tip = `%{y:$,.1f}${u.s}`;
  return {
    data: [
      bar("Revenue", x, rev.map((v) => sc(v, u.k)), rev.map((_, i) => (i > H.length ? A(PAL.c1, 0.4) : PAL.c1)), { hovertemplate: tip }),
      hollow(PAL.c2, { name: "Free cash flow (reported)", x, y: [...H.map((r: any) => sc(r.fcf, u.k)), sc(co.L.fcf, u.k), ...d.rows.map(() => null)], hovertemplate: tip }),
      hollow(PAL.c3, { name: "Unlevered FCF (projected)", x, y: [...H.map(() => null), sc(co.L.fcf, u.k), ...d.rows.map((r: any) => sc(r.fcf, u.k))], line: { color: PAL.c3, width: 2, dash: "dash" }, hovertemplate: tip }),
    ],
    layout: base({ yTitle: u.label, yFmt: ",.0f" }),
  };
}

export function figFootball(co: Co, rows: any[]): Fig {
  const color = (k: string) => (k === "model" ? PAL.c1 : k === "mkt" ? PAL.c0 : k === "street" ? PAL.c3 : PAL.c2);
  const lay = base({ legend: "none", hover: "closest" });
  return {
    data: [{
      type: "bar", orientation: "h", y: rows.map((r) => r.label), x: rows.map((r) => r.hi - r.lo), base: rows.map((r) => r.lo), marker: { color: rows.map((r) => color(r.kind)) },
      customdata: rows.map((r) => [r.lo, r.hi]), hovertemplate: "$%{customdata[0]:,.2f} – $%{customdata[1]:,.2f}<extra></extra>", width: 0.5,
    }],
    layout: {
      ...lay,
      margin: { l: 14, r: 14, t: 26, b: 34 },
      xaxis: { ...lay.xaxis, showgrid: true, gridcolor: PAL.grid, tickprefix: "$", showline: false },
      yaxis: { ...lay.yaxis, showgrid: false, autorange: "reversed", tickfont: { color: PAL.ink, size: 12 } },
      shapes: [{ type: "line", xref: "x", yref: "paper", x0: co.price, x1: co.price, y0: 0, y1: 1, line: { color: PAL.ink, width: 1.5, dash: "dash" } }],
      annotations: [{ xref: "x", yref: "paper", x: co.price, y: 1.02, yanchor: "bottom", text: `Price $${co.price.toFixed(2)}`, showarrow: false, font: { color: PAL.ink, size: 12 } }],
    },
  };
}

export function figCum(co: Co, R: Risk): Fig {
  const s = R.series, a0 = s[0][1], m0 = s[0][2], x = s.map((r) => r[0]);
  return {
    data: [line(co.tk, x, s.map((r) => r[1] / a0 - 1), PAL.c1, { hovertemplate: "%{y:.1%}" }), line("S&P 500 (SPY)", x, s.map((r) => r[2] / m0 - 1), PAL.ink3, { line: { color: PAL.ink3, width: 1.6, dash: "dot" }, hovertemplate: "%{y:.1%}" })],
    layout: base({ yFmt: ".0%", xType: "date" }),
  };
}

export function figDrawdown(co: Co, R: Risk): Fig {
  const s = R.series, x = s.map((r) => r[0]);
  let pk = -Infinity, pm = -Infinity;
  const dd = s.map((r) => { pk = Math.max(pk, r[1]); return r[1] / pk - 1; });
  const dm = s.map((r) => { pm = Math.max(pm, r[2]); return r[2] / pm - 1; });
  return {
    data: [line(`${co.tk} drawdown`, x, dd, PAL.c4, { fill: "tozeroy", fillcolor: A(PAL.c4, 0.12), hovertemplate: "%{y:.1%}" }), line("S&P 500 drawdown", x, dm, PAL.ink3, { line: { color: PAL.ink3, width: 1.4, dash: "dot" }, hovertemplate: "%{y:.1%}" })],
    layout: base({ yFmt: ".0%", xType: "date" }),
  };
}

export function figHist(R: Risk): Fig {
  const r = R.rets, cut = -R.var95, bins = { start: -0.1, end: 0.1, size: 0.004 };
  const lay = base({ legend: "none", xTitle: "Daily return", hover: "closest", barmode: "overlay" });
  lay.bargap = 0.06;
  lay.xaxis = { ...lay.xaxis, tickformat: ".0%", range: [-0.08, 0.08] };
  return {
    data: [
      { type: "histogram", x: r.filter((v) => v > cut), xbins: bins, marker: { color: PAL.c1 }, name: "Trading days", hovertemplate: "%{x:.1%}: %{y} days<extra></extra>" },
      { type: "histogram", x: r.filter((v) => v <= cut), xbins: bins, marker: { color: PAL.c4 }, name: "Beyond 95% VaR", hovertemplate: "%{x:.1%}: %{y} days<extra></extra>" },
    ],
    layout: lay,
  };
}

export function figTech(co: Co, T: Tech, win: number): Fig {
  const s = Math.max(0, T.c.length - win), x = T.d.slice(s), sl = (a: any[]) => a.slice(s);
  const flat = (v: number, name: string, color: string, show: boolean) => ({ type: "scatter", mode: "lines", name, x: [x[0], x[x.length - 1]], y: [v, v], line: { color, width: 1.2, dash: "dash" }, showlegend: show, hovertemplate: `${name} $%{y:,.2f}<extra></extra>` });
  const lay = base({ xType: "date", yPrefix: "$" });
  lay.xaxis.rangeslider = { visible: false };
  lay.yaxis.zeroline = false;
  return {
    data: [
      { type: "candlestick", name: "Price", x, open: sl(T.o), high: sl(T.h), low: sl(T.l), close: sl(T.c), increasing: { line: { color: PAL.c2, width: 1 }, fillcolor: PAL.c2 }, decreasing: { line: { color: PAL.c4, width: 1 }, fillcolor: PAL.c4 } },
      line("EMA 20", x, sl(T.s20), PAL.c3, { line: { color: PAL.c3, width: 1.2 } }),
      line("SMA 50", x, sl(T.s50), PAL.c1, { line: { color: PAL.c1, width: 1.5 } }),
      line("SMA 200", x, sl(T.s200), PAL.ink3, { line: { color: PAL.ink3, width: 1.6 } }),
      ...T.res.map((v, i) => flat(v, "Resistance", PAL.neg, i === 0)),
      ...T.sup.map((v, i) => flat(v, "Support", PAL.pos, i === 0)),
    ],
    layout: lay,
  };
}
function mini(xType = "date") {
  const lay = base({ legend: "none", xType });
  lay.margin = { l: 42, r: 10, t: 6, b: 28 };
  return lay;
}
export function figRsi(T: Tech, win: number): Fig {
  const s = Math.max(0, T.c.length - win), lay = mini();
  lay.yaxis = { ...lay.yaxis, range: [0, 100], tickvals: [30, 50, 70], zeroline: false };
  lay.shapes = [70, 30].map((v) => ({ type: "line", xref: "paper", x0: 0, x1: 1, y0: v, y1: v, line: { color: v === 70 ? PAL.neg : PAL.pos, width: 1, dash: "dot" } }));
  return { data: [line("RSI (14)", T.d.slice(s), T.r.slice(s), PAL.c1, { line: { color: PAL.c1, width: 1.4 } })], layout: lay };
}
export function figMacd(T: Tech, win: number): Fig {
  const s = Math.max(0, T.c.length - win), x = T.d.slice(s), h = T.hist.slice(s), lay = mini();
  lay.bargap = 0;
  return {
    data: [
      { type: "bar", name: "Histogram", x, y: h, marker: { color: h.map((v) => ((v ?? 0) >= 0 ? A(PAL.c2, 0.7) : A(PAL.c4, 0.7))) } },
      line("MACD", x, T.macd.slice(s), PAL.c1, { line: { color: PAL.c1, width: 1.4 } }),
      line("Signal", x, T.sig.slice(s), PAL.c3, { line: { color: PAL.c3, width: 1.2 } }),
    ],
    layout: lay,
  };
}
export function figVolume(T: Tech, win: number): Fig {
  const s = Math.max(0, T.c.length - win), x = T.d.slice(s), lay = mini();
  lay.bargap = 0;
  lay.yaxis.tickformat = ".2s";
  return { data: [{ type: "bar", name: "Volume", x, y: T.v.slice(s), marker: { color: PAL.c0 } }, line("50-day average", x, T.v50.slice(s), PAL.c3, { line: { color: PAL.c3, width: 1.4 } })], layout: lay };
}

const shortGroup = (g: string) => g.replace(" & Diversified Financials", "").replace("Mega-Cap ", "Mega-cap ");
function hbar(name: string, gs: string[], v: (number | null)[], colors: any, fmt: string, suffix = ""): Fig {
  const lay = base({ legend: "none", hover: "closest" });
  lay.margin = { l: 12, r: 16, t: 6, b: 34 };
  lay.xaxis = { ...lay.xaxis, showgrid: true, gridcolor: PAL.grid, showline: false, tickformat: fmt, ticksuffix: suffix, zeroline: true, zerolinecolor: PAL.line };
  lay.yaxis = { ...lay.yaxis, showgrid: false, autorange: "reversed", automargin: true, tickfont: { color: PAL.ink2, size: 12 } };
  return { data: [{ type: "bar", orientation: "h", name, y: gs.map(shortGroup), x: v, marker: { color: colors }, hovertemplate: `%{x:${fmt}}${suffix}<extra></extra>`, width: 0.62 }], layout: lay };
}
export function figGroupReturn(rows: any[], groups: Record<string, string[]>): Fig {
  const gs = Object.keys(groups), v = gs.map((g) => median(rows.filter((r) => r.group === g).map((r) => r.r1y?.cum)));
  return hbar("Median 1-yr total return", gs, v, v.map((x) => ((x ?? 0) >= 0 ? PAL.c1 : PAL.c4)), ".0%");
}
export function figGroupPE(rows: any[], groups: Record<string, string[]>): Fig {
  const gs = Object.keys(groups), v = gs.map((g) => median(rows.filter((r) => r.group === g).map((r) => r.pe)));
  return hbar("Median P/E (LTM)", gs, v, PAL.c2, ".1f", "x");
}

export function figMacro(series: any, ids: string[], colors: string[]): Fig {
  return {
    data: ids.filter((id) => series[id]?.obs).map((id, i) => line(series[id].title, series[id].obs.map((o: any) => o[0]), series[id].obs.map((o: any) => o[1]), colors[i % colors.length], { hovertemplate: `%{y:.2f}${series[id].units === "index" ? "" : "%"}` })),
    layout: base({ xType: "date" }),
  };
}

export function figValBand(b: { label: string; x: string[]; y: number[]; avg: number; sd: number }): Fig {
  const x0 = b.x[0], x1 = b.x[b.x.length - 1];
  const lay = base({ legend: "bottom", xType: "date", ySuffix: "x" });
  lay.yaxis.zeroline = false;
  lay.shapes = [
    { type: "rect", xref: "x", yref: "y", x0, x1, y0: b.avg - b.sd, y1: b.avg + b.sd, fillcolor: A(PAL.c2, 0.1), line: { width: 0 }, layer: "below" },
  ];
  const flat = (name: string, v: number, dash: string) => line(name, [x0, x1], [v, v], PAL.ink3, { line: { color: PAL.ink3, width: 1.2, dash }, hovertemplate: `${name} %{y:.1f}x<extra></extra>` });
  return {
    data: [
      line(b.label, b.x, b.y, PAL.c1, { hovertemplate: "%{y:.1f}x" }),
      flat("Average", b.avg, "dash"),
      flat("±1 standard deviation", b.avg + b.sd, "dot"),
      { ...flat("-1 sd", b.avg - b.sd, "dot"), showlegend: false },
    ],
    layout: lay,
  };
}

export function figYieldCurve(curve: { tenors: string[]; latest: any; monthAgo: any; yearAgo: any }): Fig {
  const x = curve.tenors.map((t) => t.replace(" Mo", "M").replace(" Yr", "Y"));
  const series: [any, string, string, string][] = [[curve.latest, PAL.c1, "solid", "Latest"], [curve.monthAgo, PAL.c2, "dash", "1 month ago"], [curve.yearAgo, PAL.ink3, "dot", "1 year ago"]];
  const lay = base({ ySuffix: "%", hover: "x unified" });
  lay.yaxis.zeroline = false;
  return {
    data: series.filter(([c]) => c).map(([c, color, dash, name]) => hollow(color, { name: `${name} (${c.date})`, x, y: c.yields, line: { color, width: 2, dash }, hovertemplate: "%{y:.2f}%" })),
    layout: lay,
  };
}

export function figGrowth(dates: string[], a: number[], b: number[], labelA: string, labelB = "S&P 500 (SPY)"): Fig {
  return {
    data: [
      line(labelA, dates, a, PAL.c1, { hovertemplate: "$%{y:,.0f}" }),
      line(labelB, dates, b, PAL.ink3, { line: { color: PAL.ink3, width: 1.6, dash: "dot" }, hovertemplate: "$%{y:,.0f}" }),
    ],
    layout: { ...base({ xType: "date", yPrefix: "$" }), yaxis: { ...base().yaxis, tickprefix: "$", tickformat: ",.0f", zeroline: false, rangemode: "normal" } },
  };
}

export function figDrawdowns(dates: string[], a: number[], b: number[], labelA: string): Fig {
  return {
    data: [
      line(labelA, dates, a, PAL.c4, { fill: "tozeroy", fillcolor: A(PAL.c4, 0.12), hovertemplate: "%{y:.1%}" }),
      line("S&P 500 (SPY)", dates, b, PAL.ink3, { line: { color: PAL.ink3, width: 1.4, dash: "dot" }, hovertemplate: "%{y:.1%}" }),
    ],
    layout: base({ yFmt: ".0%", xType: "date" }),
  };
}

/** Horizontal bars for a share-of-total breakdown (asset class, sector). */
export function figShares(rows: [string, number][], color: string = PAL.c1): Fig {
  const lay = base({ legend: "none", hover: "closest" });
  lay.margin = { l: 12, r: 16, t: 6, b: 30 };
  lay.xaxis = { ...lay.xaxis, showgrid: true, gridcolor: PAL.grid, tickformat: ".0%", showline: false };
  lay.yaxis = { ...lay.yaxis, showgrid: false, autorange: "reversed", tickfont: { color: PAL.ink2, size: 12 } };
  return { data: [{ type: "bar", orientation: "h", y: rows.map((r) => r[0]), x: rows.map((r) => r[1]), marker: { color }, hovertemplate: "%{x:.1%}<extra></extra>", width: 0.6 }], layout: lay };
}

export function figCorr(labels: string[], m: number[][]): Fig {
  const lay = base({ legend: "none", hover: "closest" });
  lay.margin = { l: 12, r: 12, t: 6, b: 40 };
  lay.xaxis = { ...lay.xaxis, showline: false, side: "bottom" };
  lay.yaxis = { ...lay.yaxis, showgrid: false, autorange: "reversed", zeroline: false };
  return {
    data: [{
      type: "heatmap", x: labels, y: labels, z: m, zmin: -1, zmax: 1, colorscale: [[0, PAL.c4], [0.5, PAL.white], [1, PAL.c1]], xgap: 2, ygap: 2,
      text: m.map((r) => r.map((v) => v.toFixed(2))), texttemplate: "%{text}", textfont: { size: 11, color: PAL.ink }, hovertemplate: "%{y} / %{x}: %{z:.2f}<extra></extra>", showscale: false,
    }],
    layout: lay,
  };
}

/** Percentile fan for simulated wealth paths: 5-95 and 25-75 bands around the median. */
export function figFan(ages: number[], b: number[][], retireAge: number): Fig {
  const lay = base({ xTitle: "Age", yPrefix: "$" });
  // The 95th percentile can dwarf everything else; scale to the upper quartile so the median stays readable.
  lay.yaxis = { ...lay.yaxis, tickformat: "~s", zeroline: false, range: [0, Math.max(...b[3]) * 1.35] };
  lay.shapes = [{ type: "line", x0: retireAge, x1: retireAge, yref: "paper", y0: 0, y1: 1, line: { color: PAL.ink3, width: 1, dash: "dot" } }];
  lay.annotations = [{ x: retireAge, yref: "paper", y: 1, text: "Retirement", showarrow: false, xanchor: "left", xshift: 4, font: { color: PAL.ink3, size: 11 } }];
  const h = "$%{y:,.0f}";
  return {
    data: [
      line("95th percentile", ages, b[4], A(PAL.c1, 0), { hovertemplate: h, showlegend: false }),
      line("5th to 95th", ages, b[0], A(PAL.c1, 0), { fill: "tonexty", fillcolor: A(PAL.c1, 0.12), hovertemplate: h }),
      line("75th percentile", ages, b[3], A(PAL.c1, 0), { hovertemplate: h, showlegend: false }),
      line("25th to 75th", ages, b[1], A(PAL.c1, 0), { fill: "tonexty", fillcolor: A(PAL.c1, 0.25), hovertemplate: h }),
      line("Median", ages, b[2], PAL.c1, { line: { color: PAL.c1, width: 2.4 }, hovertemplate: h }),
    ],
    layout: lay,
  };
}

export function figWealthHist(values: number[]): Fig {
  const cap = values[Math.floor(values.length * 0.97)] || 1;
  const lay = base({ legend: "none", xTitle: "Wealth at end of plan (today's dollars)", yTitle: "Simulations" });
  lay.xaxis = { ...lay.xaxis, tickprefix: "$", tickformat: "~s" };
  lay.bargap = 0.04;
  return { data: [{ type: "histogram", x: values.filter((v) => v <= cap), nbinsx: 40, marker: { color: PAL.c2 }, hovertemplate: "%{y} runs<extra></extra>" }], layout: lay };
}

// ---- Segments -------------------------------------------------------------
type SegBreakdown = { years: string[]; rows: { label: string; parent: string | null; revenue: (number | null)[]; operatingIncome: (number | null)[] | null }[] };
const SEG_COLORS = [PAL.c1, PAL.c2, PAL.c3, PAL.c4, PAL.ink3, PAL.b1, PAL.b3, PAL.c0];
const fyLabel = (end: string) => `FY${end.slice(0, 4)}`;

/** Revenue by segment, stacked when the segments add up to the total. */
export function figSegments(b: SegBreakdown, stacked: boolean): Fig {
  const top = b.rows.filter((r) => !r.parent).slice(0, 8);
  const x = b.years.map(fyLabel);
  return {
    data: top.map((r, i) => ({
      type: "bar", name: r.label, x, y: r.revenue.map((v) => (ok(v) ? v / 1e9 : null)), marker: { color: SEG_COLORS[i % SEG_COLORS.length] },
      hovertemplate: `${r.label}: $%{y:,.1f}B<extra></extra>`,
    })),
    layout: { ...base({ yPrefix: "$", ySuffix: "B", barmode: stacked ? "stack" : "group" }), legend: { ...base().legend, traceorder: "normal" } },
  };
}

/** Operating margin by segment. */
export function figSegmentMargins(b: SegBreakdown): Fig {
  const top = b.rows.filter((r) => !r.parent && r.operatingIncome).slice(0, 8);
  const x = b.years.map(fyLabel);
  return {
    data: top.map((r, i) => ({
      type: "scatter", mode: "lines+markers", name: r.label, x,
      y: r.revenue.map((v, k) => (ok(v) && v && ok(r.operatingIncome![k]) ? (r.operatingIncome![k]! / v) * 100 : null)),
      line: { color: SEG_COLORS[i % SEG_COLORS.length], width: 2 }, marker: { size: 6 },
      hovertemplate: `${r.label}: %{y:.1f}%<extra></extra>`,
    })),
    layout: base({ ySuffix: "%" }),
  };
}
