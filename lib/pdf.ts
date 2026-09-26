// PDF exports: the full research report and a one-page tear sheet (jsPDF + autotable),
// with Plotly charts rendered to images.
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { figImage } from "@/components/Plot";
import type { Co } from "./api";
import { figCum, figDrawdown, figMargins, figRevEarn, figScenario, type Fig } from "./charts";
import { dLabel, dLong, fB, fD, fM, fN, fP, fR, fX, mean, ok, fPS } from "./format";
import { capm, scenarios, sensGrid, type Assumptions } from "./models";
import { mdBlocks } from "./markdown";
import { risk, technicals } from "./risk";
import { fmtKind, ratioRows, ratioSeries, statementData } from "./statements";

type RGB = [number, number, number];
const NAVY: RGB = [22, 35, 63], BLUE: RGB = [47, 95, 191], TEAL: RGB = [11, 127, 122], INK: RGB = [26, 34, 51], GREY: RGB = [115, 125, 145], LINE: RGB = [226, 230, 238];
const ratingColor = (r: string): RGB => (r === "BUY" ? [30, 127, 78] : r === "SELL" ? [192, 57, 43] : [168, 105, 15]);

// The built-in PDF fonts only cover Latin-1, so typographic characters are mapped to ASCII.
const ascii = (s: any) => String(s).replace(/[—–−]/g, "-").replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/…/g, "...").replace(/≥/g, ">=").replace(/≤/g, "<=").replace(/±/g, "+/-").replace(/∓/g, "-/+").replace(/Δ/g, "chg ").replace(/·/g, "|").replace(/[^\x00-\x7E]/g, "");

/** Page furniture and text/table helpers shared by both exports. */
function layout(co: Co) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 40;
  const s = { y: M };
  const header = () => {
    doc.setFillColor(...NAVY); doc.rect(0, 0, W, 24, "F");
    doc.setFillColor(...BLUE); doc.triangle(W * 0.62, 0, W * 0.62 + 14, 0, W * 0.62 + 14, 24, "F"); doc.rect(W * 0.62 + 14, 0, W, 24, "F");
    doc.setTextColor(255); doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.text("INTRINSIC RESEARCH TERMINAL", M, 15.5);
    doc.setFont("helvetica", "normal"); doc.text(ascii(`${co.name} (${co.tk})  |  ${dLong(co.priceDate)}`), W - M, 15.5, { align: "right" }); doc.setTextColor(...INK);
  };
  const newPage = () => { doc.addPage(); header(); s.y = 50; };
  const need = (h: number) => { if (s.y + h > H - 46) newPage(); };
  const h1 = (x: string) => { need(40); doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(...INK); doc.text(ascii(x), M, s.y); s.y += 6; doc.setDrawColor(...TEAL); doc.setLineWidth(1.2); doc.line(M, s.y, M + 60, s.y); s.y += 16; };
  const h2 = (x: string, left = M) => { need(26); doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...TEAL); doc.text(ascii(x).toUpperCase(), left, s.y); s.y += 12; doc.setTextColor(...INK); };
  const para = (x: string, size = 9.6, font = "times", left = M, width = W - 2 * M) => {
    doc.setFont(font, "normal"); doc.setFontSize(size); doc.setTextColor(...INK);
    for (const l of doc.splitTextToSize(ascii(x.replace(/\*\*/g, "")), width)) { need(size + 3); doc.text(l, left, s.y); s.y += size + 3.6; }
    s.y += 4;
  };
  const bullet = (x: string, size = 9.6, left = M, width = W - 2 * M) => {
    doc.setFont("times", "normal"); doc.setFontSize(size);
    doc.splitTextToSize(ascii(x.replace(/\*\*/g, "")), width - 12).forEach((l: string, i: number) => { need(size + 3.4); if (!i) doc.text("-", left + 2, s.y); doc.text(l, left + 12, s.y); s.y += size + 3.4; });
    s.y += 1;
  };
  const table = (head: string[], body: any[][], o: any = {}) => {
    autoTable(doc, {
      head: [head.map(ascii)], body: body.map((r) => r.map(ascii)), startY: s.y, margin: { left: o.left ?? M, right: o.right ?? M, top: 50, bottom: 46 }, theme: "grid",
      styles: { font: "helvetica", fontSize: o.size ?? 7.4, cellPadding: { top: 2.4, bottom: 2.4, left: 4, right: 4 }, textColor: INK, halign: "right", lineColor: LINE, lineWidth: 0.4 },
      headStyles: { fillColor: [246, 248, 251], textColor: [75, 85, 104], fontStyle: "bold", fontSize: (o.size ?? 7.4) - 0.2, halign: "center" },
      columnStyles: { 0: { halign: "left", cellWidth: o.first || "auto" }, ...(o.cols || {}) }, tableWidth: o.width,
      didParseCell: (h: any) => {
        if (h.section !== "body") return;
        if (o.bold?.includes(h.row.index)) h.cell.styles.fontStyle = "bold";
        if (o.italic?.includes(h.row.index)) { h.cell.styles.textColor = GREY; if (h.column.index === 0) h.cell.styles.fontStyle = "italic"; }
        if (o.hl?.includes(h.row.index)) h.cell.styles.fillColor = [227, 243, 242];
      },
      didDrawPage: () => header(),
    });
    s.y = (doc as any).lastAutoTable.finalY + 14;
  };
  const chart = async (fig: Fig, h = 190) => {
    need(h + 8);
    const w = W - 2 * M, url = await figImage(fig, 900, Math.round((900 * h) / w));
    doc.addImage(url, "JPEG", M, s.y, w, h);
    s.y += h + 12;
  };
  const footer = () => {
    const n = doc.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
      doc.setPage(i); doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(...GREY);
      doc.text("Sources: SEC EDGAR; Yahoo Finance; FRED; model calculations. Not investment advice.", M, H - 22);
      doc.text(`Page ${i} of ${n}`, W - M, H - 22, { align: "right" });
    }
  };
  /** Rating box followed by five figure cards (price, base, bear, bull, Street target). */
  const figureRow = (rt: any, d: any, sc: any[], height = 76) => {
    const cards: [string, string, number | null][] = [["Share price", fD(co.price), null], ["Base case", fPS(d.ps), d.up], ["Bear case", fPS(sc[0].ps), sc[0].up], ["Bull case", fPS(sc[2].ps), sc[2].up], ["Street target", fD(co.street.target), co.street.up]];
    const cw = (W - 2 * M - 110 - 4 * 8) / 5, y = s.y;
    doc.setFillColor(...ratingColor(rt.rating)); doc.rect(M, y, 102, height, "F"); doc.setTextColor(255); doc.setFont("helvetica", "bold"); doc.setFontSize(20);
    doc.text(rt.rating, M + 51, y + height / 2 + 2, { align: "center" });
    doc.setFontSize(7.5); doc.setFont("helvetica", "normal"); doc.text(`MODEL RATING ${(rt.total >= 0 ? "+" : "") + rt.total.toFixed(2)}`, M + 51, y + height / 2 + 18, { align: "center" });
    cards.forEach(([k, v, u], i) => {
      const cx = M + 110 + i * (cw + 8);
      doc.setDrawColor(...LINE); doc.setLineWidth(0.6); doc.rect(cx, y, cw, height); doc.setTextColor(...GREY); doc.setFontSize(7.5); doc.setFont("helvetica", "normal"); doc.text(k.toUpperCase(), cx + 8, y + 14);
      doc.setTextColor(...INK); doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.text(ascii(v), cx + cw / 2, y + height / 2 + 4, { align: "center" });
      if (ok(u)) {
        const c: RGB = u > 0.005 ? [30, 127, 78] : u < -0.005 ? [192, 57, 43] : GREY;
        doc.setTextColor(...c); doc.setFontSize(8.5); doc.text(ascii(`${u > 0 ? "+" : ""}${(u * 100).toFixed(1)}% vs price`), cx + cw / 2, y + height - 10, { align: "center" });
      }
    });
    s.y = y + height + 20;
  };
  return { doc, W, H, M, s, header, newPage, need, h1, h2, para, bullet, table, chart, footer, figureRow };
}

const firstSentences = (x: string, n: number) => x.split(/(?<=[.!?])\s+(?=[A-Z])/).slice(0, n).join(" ");

export async function buildPdf(co: Co, a: Assumptions, d: any, comp: any, rt: any, noteText: string): Promise<Blob> {
  const L = co.L, cp = capm(co, a), sc = scenarios(co, a);
  const { doc, M, s, header, newPage, need, h1, h2, para, bullet, table, chart, footer, figureRow } = layout(co);
  // ---- cover
  header(); s.y = 66;
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...GREY); doc.text(ascii(`EQUITY RESEARCH  |  ${co.sector.toUpperCase()}  |  ${co.industry.toUpperCase()}`), M, s.y);
  s.y += 26; doc.setFont("helvetica", "bold"); doc.setFontSize(23); doc.setTextColor(...INK); doc.text(ascii(co.name), M, s.y);
  s.y += 17; doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...GREY);
  doc.text(ascii(`${co.tk}  |  ${co.y.exchange || co.raw.exchange || ""}  |  CIK ${co.raw.cik}  |  ${co.fin ? "Residual income framework" : "DCF framework"}`), M, s.y);
  s.y += 20;
  figureRow(rt, d, sc);
  h2("Key statistics");
  table(["Metric", "Value", "Metric", "Value"], [
    ["Market capitalization", fB(co.mcap), "P/E (LTM / NTM)", `${fX(co.pe)} / ${fX(co.fpe)}`], ["Enterprise value", co.fin ? "n.m." : fB(co.ev), co.fin ? "Price / book" : "EV / EBITDA", co.fin ? fX(co.pb) : fX(co.evEbitda)],
    ["52-week range", ok(co.lo52) ? `${fD(co.lo52)} - ${fD(co.hi52)}` : "n/a", co.fin ? "Price / tangible book" : "FCF yield", co.fin ? fX(co.ptbv) : fP(co.fcfYld)], ["Beta (adj.)", fN(co.beta, 2), "Dividend yield", fP(co.divYld, 2)],
    ["LTM revenue", `${fB(L.rev)} (${fP(co.ltmGrowth, 1, true)})`, "Return on equity", fP(co.roe)], ["LTM net income", fB(L.ni), co.fin ? "Equity / assets" : "ROIC", co.fin ? fP(co.eqAssets) : fP(co.roic)],
    ["Street consensus", `${(co.street.key || "n/a").replace("_", " ")}${ok(co.street.n) ? ` (${co.street.n} analysts)` : ""}`, "Institutional ownership", fP(co.y.instPct)],
  ], { cols: { 2: { halign: "left" } } });
  const blocks = mdBlocks(noteText);
  const ti = blocks.findIndex((b) => b.t === "h" && /thesis/i.test(b.x)), si = ti >= 0 ? ti : blocks.findIndex((b) => b.t === "h" && /summary/i.test(b.x));
  const thesis = si >= 0 ? blocks.slice(si + 1).find((b) => b.t === "p") : blocks.find((b) => b.t === "p");
  if (thesis) { h2(ti >= 0 ? "Investment thesis" : "Summary"); para(thesis.x); }
  if (co.y.summary) { h2("Business description"); const s = co.y.summary; para(s.length > 900 ? s.slice(0, s.lastIndexOf(".", 900) + 1) : s, 8.8, "helvetica"); }

  // ---- financials
  newPage(); h1("Financial statements");
  for (const [k, t] of [["IS", "Income statement (USD millions)"], ["BS", "Balance sheet (USD millions)"], ["CF", "Cash flow statement (USD millions)"]] as const) {
    const s = statementData(co, k, "A");
    h2(t);
    table(["", ...s.heads], s.body.map((b) => [b.label, ...b.vals.map((v: any) => fmtKind(v, b.k))]), { bold: s.body.map((b, i) => (b.c?.includes("tot") ? i : -1)).filter((i) => i >= 0), italic: s.body.map((b, i) => (b.c === "sub" ? i : -1)).filter((i) => i >= 0), first: 150 });
  }
  h2("Revenue and earnings"); await chart(figRevEarn(co), 190);

  // ---- ratios
  newPage(); h1("Ratio analysis");
  const R = ratioSeries(co), rb: string[][] = [], rs: number[] = [];
  ratioRows(co.fin).forEach(([k, l, f]) => {
    if (k === "sec") { rs.push(rb.length); rb.push([l.toUpperCase(), ...R.map(() => ""), ""]); return; }
    const v = R.map((r: any) => r[k]);
    rb.push([l, ...v.map((z: any) => fR(z, f!)), fR(mean(v), f!)]);
  });
  table(["Ratio", ...R.map((r: any) => `FY ${dLabel(r.end)}`), "Hist. avg"], rb, { bold: rs, first: 170 });
  h2(co.fin ? "Profitability" : "Margin structure"); await chart(figMargins(co, R), 180);

  // ---- valuation
  newPage(); h1(co.fin ? "Residual income valuation" : "Discounted cash flow valuation");
  table(["Assumption", "Value", "Assumption", "Value"], co.fin
    ? [["Projection period", `${a.years} years`, "Risk-free rate", fP(a.rf, 2)], ["Starting ROE", fP(a.roe0), "Equity risk premium", fP(a.erp, 2)], ["Final-year ROE", fP(a.roeT), "Beta (adjusted)", a.beta.toFixed(2)], ["Payout ratio", fP(a.payout, 0), "Cost of equity applied", fP(d.w, 2)], ["Terminal growth", fP(a.tg, 2), "Discount floor", fP(a.floor, 2)]]
    : [["Projection period", `${a.years} years`, "Risk-free rate", fP(a.rf, 2)], ["Revenue growth, year 1", fP(a.g1), "Equity risk premium", fP(a.erp, 2)], ["Revenue growth, final year", fP(a.gN), "Beta (adjusted)", a.beta.toFixed(2)], ["Operating margin, final year", fP(a.mT), "Cost of equity", fP(cp.ke, 2)], ["Tax rate", fP(a.tax), "Pre-tax cost of debt", fP(a.kd, 2)], ["D&A / revenue", fP(a.daPct), "WACC (CAPM) / floor", `${fP(cp.w, 2)} / ${fP(a.floor, 2)}`], ["Capex / revenue", fP(a.capexPct), "WACC applied", fP(d.w, 2)], ["Change in NWC / chg revenue", fP(a.nwcPct), "Terminal growth", fP(a.tg, 2)]],
    { cols: { 2: { halign: "left" } } });
  if (d.valid) {
    const pr = (l: string, f: (r: any) => string) => [l, ...d.rows.map(f)];
    h2(co.fin ? "Residual income projection (USD millions)" : "Unlevered free cash flow projection (USD millions)");
    if (co.fin) table(["", ...d.rows.map((r: any) => `${r.year}E`)], [pr("Opening book value", (r) => fM(r.bv0)), pr("ROE", (r) => fP(r.roe)), pr("Net income", (r) => fM(r.ni)), pr("Equity charge", (r) => fM(-r.charge)), pr("Residual income", (r) => fM(r.ri)), pr("Distributions", (r) => fM(-r.dist)), pr("Closing book value", (r) => fM(r.bv1)), pr("Discount factor", (r) => r.df.toFixed(3)), pr("PV of residual income", (r) => fM(r.pv))], { bold: [0, 4], italic: [1, 7], hl: [4], first: 120 });
    else table(["", ...d.rows.map((r: any) => `${r.year}E`)], [pr("Revenue", (r) => fM(r.rev)), pr("Growth", (r) => fP(r.g)), pr("EBITDA", (r) => fM(r.ebitda)), pr("EBIT", (r) => fM(r.ebit)), pr("Operating margin", (r) => fP(r.m)), pr("Less: taxes", (r) => fM(-r.tax)), pr("NOPAT", (r) => fM(r.nopat)), pr("Plus: D&A", (r) => fM(r.da)), pr("Less: capex", (r) => fM(-r.capex)), pr("Less: chg NWC", (r) => fM(-r.dnwc)), pr("Unlevered FCF", (r) => fM(r.fcf)), pr("Discount factor", (r) => r.df.toFixed(3)), pr("PV of FCF", (r) => fM(r.pv))], { bold: [0, 6, 10], italic: [1, 4, 11], hl: [10], first: 110 });
    h2("Scenario valuation");
    table(["", "Bear", "Base", "Bull"], [
      ...(co.fin ? [["Final-year ROE", ...sc.map((s: any) => fP(s.finalRoe))]] : [["Final-year revenue ($m)", ...sc.map((s: any) => fM(s.finalRev))], ["Final-year EBIT margin", ...sc.map((s: any) => fP(s.finalMargin))], ["Enterprise value", ...sc.map((s: any) => fB(s.ev))]]),
      ["Discount rate", ...sc.map((s: any) => fP(s.w, 2))], ["Equity value", ...sc.map((s: any) => fB(s.eqv))], ["Value per share", ...sc.map((s: any) => fPS(s.ps))], ["vs current price", ...sc.map((s: any) => fP(s.up, 1, true))],
    ], { bold: [co.fin ? 3 : 5], width: 360 });
    h2(`${co.fin ? "Residual income" : "Free cash flow"} by scenario`); await chart(figScenario(co, sc), 160);
    const sg = sensGrid(co, a, d);
    h2(`Sensitivity: value per share, terminal growth (rows) vs ${co.fin ? "cost of equity" : "WACC"} (columns)`);
    table(["g \\ rate", ...sg.ws.map((w) => fP(w, 1))], sg.gs.map((g, i) => [fP(g, 1), ...sg.A[i].map((v: any) => fD(v))]), { hl: [2], width: 380 });
    h2(`Sensitivity: value per share, ${sg.rl.toLowerCase()} (rows) vs ${sg.cl.toLowerCase()} (columns)`);
    table([`${sg.rl} \\ ${sg.cl}`, ...sg.cols2.map((c) => fP(c, co.fin ? 0 : 1))], sg.rows2.map((r, i) => [fP(r, 1), ...sg.B[i].map((v: any) => fD(v))]), { hl: [2], width: 380 });
  }

  // ---- comps
  newPage(); h1("Comparable company analysis");
  const K = co.fin ? ["pe", "fpe", "pb", "ptbv"] : ["pe", "fpe", "evEbitda", "evRev", "ps", "pb"];
  const KL: Record<string, string> = { pe: "P/E LTM", fpe: "P/E NTM", evEbitda: "EV/EBITDA", evRev: "EV/Rev", ps: "P/S", pb: "P/B", ptbv: "P/TBV" };
  const vr = (c: any) => [c.tk, fB(c.mcap), ...K.map((k) => fX(c[k], ["evRev", "ps"].includes(k) ? 2 : 1)), fP(c.street.up, 0, true)];
  table(["Company", "Mkt cap", ...K.map((k) => KL[k]), "Street upside"], [vr(co), ...comp.ps.map(vr), ["Peer median", "", ...K.map((k) => fX(comp.st[k].med, ["evRev", "ps"].includes(k) ? 2 : 1)), ""]], { hl: [0], bold: [comp.ps.length + 1] });
  const or = (c: any) => [c.tk, fB(c.L.rev), fP(c.ltmGrowth), fP(c.cagr3), co.fin ? fP(c.nm) : fP(c.om), fP(c.roe), co.fin ? fP(c.eqAssets) : fP(c.roic)];
  h2("Operating benchmarking");
  table(["Company", "Revenue", "Rev growth", "3Y CAGR", co.fin ? "Net margin" : "EBIT margin", "ROE", co.fin ? "Equity/assets" : "ROIC"], [or(co), ...comp.ps.map(or)], { hl: [0] });
  h2("Implied value per share");
  table(["Method", "Peer median", "25th pct", "Median", "75th pct", "vs price"], [
    ...comp.implied.map((r: any) => [r.label, fX(r.med, 2), fD(r.lo), fD(r.mid), fD(r.hi), fP(r.mid / co.price - 1, 0, true)]),
    [`${co.fin ? "Residual income" : "DCF"} (base)`, "", "", fPS(d.ps), "", fP(d.up, 0, true)],
    ...(ok(co.street.target) ? [["Street targets", "", fD(co.street.lo), fD(co.street.target), fD(co.street.hi), fP(co.street.up, 0, true)]] : []),
  ], { bold: [comp.implied.length] });

  // ---- risk
  if (co.hasPx) {
    const R1 = risk(co, 252, a.rf), R3 = risk(co, 756, a.rf), R5 = risk(co, 1260, a.rf);
    if (R3) {
      newPage(); h1("Risk and performance");
      const rr = (l: string, k: string, f: (v: any) => string) => [l, ...[R1, R3, R5].map((r: any) => (r ? f(r[k]) : "n/a"))];
      const pc = (v: any) => fP(v, 1), n2 = (v: any) => (ok(v) ? v.toFixed(2) : "n/a");
      table(["Measure", "1 year", "3 years", "5 years"], [rr("Cumulative return", "cum", pc), rr("S&P 500 cumulative return", "mcum", pc), rr("Annualized return", "ann", pc), rr("Annualized volatility", "vol", pc), rr("Beta", "beta", n2), rr("Sharpe ratio", "sharpe", n2), rr("Sortino ratio", "sortino", n2), rr("Jensen's alpha", "alpha", pc), rr("Maximum drawdown", "mdd", pc), rr("1-day VaR 95% (historical)", "var95", (v) => fP(v, 2)), rr("1-day CVaR 95%", "cvar95", (v) => fP(v, 2))], { width: 400 });
      h2("Cumulative total return vs S&P 500, 3 years"); await chart(figCum(co, R3), 160);
      h2("Drawdown, 3 years"); await chart(figDrawdown(co, R3), 130);
      const Tc = technicals(co);
      h2("Technical snapshot (supplemental)");
      table(["Indicator", "Reading"], [["Last close", fD(Tc.px)], ["SMA 50 / SMA 200", `${fD(Tc.s50Now)} / ${fD(Tc.s200Now)}`], ["RSI (14)", fN(Tc.rsiNow, 1)], ["MACD vs signal", (Tc.macdNow ?? 0) > (Tc.sigNow ?? 0) ? "Above (bullish)" : "Below (bearish)"], ["12-1 month momentum", fP(Tc.mom121, 1, true)], ["ATR (14)", fD(Tc.atr)]], { width: 380 });
    }
  }

  // ---- note
  newPage(); h1("Research note");
  for (const b of blocks) {
    if (b.t === "h") h2(b.x);
    else if (b.t === "h3") { need(16); doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.text(ascii(b.x), M, s.y); s.y += 12; }
    else if (b.t === "li") bullet(b.x);
    else para(b.x);
  }

  // ---- rating & disclosures
  need(260); h1("Model rating and methodology");
  table(["Factor", "Weight", "Reading", "Score"], [
    ...rt.factors.map((f: any) => [f.name, `${(f.w * 100).toFixed(0)}%`, f.disp, f.s == null ? "n/a" : `${f.s > 0 ? "+" : ""}${f.s}`]),
    ["Composite (-2 to +2)", "100%", "Buy >= +0.50, Sell <= -0.50", (rt.total >= 0 ? "+" : "") + rt.total.toFixed(2)],
  ], { bold: [rt.factors.length], cols: { 2: { halign: "left" } } });
  h2("Data sources and disclosures");
  para(`Fundamentals: SEC EDGAR XBRL company facts, CIK ${co.raw.cik}; latest filing ${co.raw.lastForm || ""} ${dLong(co.raw.lastFiled)}. Market data, company profile and Street consensus: Yahoo Finance, daily data through ${dLong(co.priceDate)}; S&P 500 represented by SPY. Risk-free rate: ${fP(a.rf, 2)} (FRED 10-year Treasury where available). Share count: ${co.sharesSrc}. ${co.fin ? "Valued with a residual income model; enterprise-value measures are not meaningful for financial institutions." : "Enterprise value = market capitalization + total debt - cash and short-term investments."}`, 8, "helvetica");
  para("Generated by a quantitative model from public data. The rating is a rules-based screen and the research note is compiled from the figures shown. Neither is investment advice or a recommendation to buy or sell any security. Verify figures against the underlying filings.", 8, "helvetica");
  footer();
  return doc.output("blob");
}

/** One-page analyst tear sheet: summary, valuation, highlights, peers, risks and thesis. */
export async function buildTearSheet(co: Co, a: Assumptions, d: any, comp: any, rt: any, noteText: string): Promise<Blob> {
  const L = co.L, sc = scenarios(co, a);
  const { doc, W, M, s, header, h2, para, bullet, table, footer, figureRow } = layout(co);
  header();
  s.y = 60;
  doc.setFont("helvetica", "bold"); doc.setFontSize(19); doc.setTextColor(...INK); doc.text(ascii(co.name), M, s.y);
  s.y += 14; doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...GREY);
  doc.text(ascii(`${co.tk}  |  ${co.sector}  |  ${co.industry}  |  Market cap ${fB(co.mcap)}  |  Prices as of ${dLong(co.priceDate)}`), M, s.y);
  s.y += 14;
  figureRow(rt, d, sc, 58);

  const blocks = mdBlocks(noteText);
  const section = (name: RegExp) => {
    const i = blocks.findIndex((b) => b.t === "h" && name.test(b.x));
    const out: ReturnType<typeof mdBlocks> = [];
    for (let j = i + 1; i >= 0 && j < blocks.length && blocks[j].t !== "h"; j++) out.push(blocks[j]);
    return out;
  };
  const gutter = 16, leftW = (W - 2 * M - gutter) * 0.52, rightX = M + leftW + gutter, rightW = W - M - rightX, top = s.y;

  // Left column: narrative
  h2("Business summary");
  para(firstSentences(co.y.summary || section(/business overview/i).map((b) => b.x).join(" "), 3), 8.3, "helvetica", M, leftW);
  h2("Investment thesis");
  para(section(/investment thesis/i).map((b) => b.x).join(" "), 8.3, "times", M, leftW);
  h2("Key risks");
  section(/^risks/i).filter((b) => b.t === "li").slice(0, 4).forEach((b) => bullet(b.x, 8.3, M, leftW));
  h2("Strengths");
  section(/strengths/i).filter((b) => b.t === "li").slice(0, 3).forEach((b) => bullet(b.x, 8.3, M, leftW));
  const leftEnd = s.y;

  // Right column: tables
  s.y = top;
  const col = { left: rightX, right: M, width: rightW, size: 7 };
  h2("Valuation", rightX);
  const impl = comp.implied.slice(0, 3).map((r: any) => [r.label, fD(r.mid), fP(r.mid / co.price - 1, 0, true)]);
  table(["Method", "Per share", "vs price"], [
    [`${co.fin ? "Residual income" : "DCF"} base`, fPS(d.ps), fP(d.up, 0, true)], ["Bear / bull", `${fPS(sc[0].ps)} / ${fPS(sc[2].ps)}`, ""],
    ["Street mean target", fD(co.street.target), fP(co.street.up, 0, true)], ...impl,
  ], col);
  h2("Financial highlights ($m)", rightX);
  const yrs = co.A.slice(-3), cols = [...yrs.map((r: any) => `FY${r.end.slice(2, 4)}`), "LTM"], recs = [...yrs, L];
  table(["", ...cols], [
    ["Revenue", ...recs.map((r: any) => fM(r.rev))],
    [co.fin ? "Pre-tax income" : "Operating income", ...recs.map((r: any) => fM(co.fin ? r.pretax : r.op))],
    ["Net income", ...recs.map((r: any) => fM(r.ni))],
    ...(co.fin ? [] : [["Free cash flow", ...recs.map((r: any) => fM(r.fcf))]]),
    ["Diluted EPS", ...recs.map((r: any) => (ok(r.eps) ? r.eps.toFixed(2) : "-"))],
  ], col);
  h2("Peers", rightX);
  const relK = co.fin ? "pb" : "evEbitda";
  table(["", "P/E", co.fin ? "P/B" : "EV/EBITDA", "Rev growth"], [co, ...comp.ps.slice(0, 5)].map((c: any) => [c.tk, fX(c.pe), fX(c[relK]), fP(c.ltmGrowth, 0)]), { ...col, hl: [0] });
  s.y = Math.max(leftEnd, s.y);

  doc.setFont("helvetica", "normal"); doc.setFontSize(7.2); doc.setTextColor(...GREY);
  doc.text(doc.splitTextToSize(ascii(`Rating: ${rt.factors.map((f: any) => `${f.name} ${f.s == null ? "n/a" : (f.s > 0 ? "+" : "") + f.s}`).join("; ")}. Composite ${(rt.total >= 0 ? "+" : "") + rt.total.toFixed(2)}; Buy at +0.50 or above, Sell at -0.50 or below.`), W - 2 * M), M, s.y);
  footer();
  return doc.output("blob");
}
