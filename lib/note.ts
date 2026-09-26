// Research note assembled entirely from the model's own figures: filings, consensus, peers and valuation.
// No language model is involved, so every sentence traces to a number on screen.
import type { Co } from "./api";
import { fB, fD, fN, fP, fX, median, monthName, ok, fPS } from "./format";
import { scenario, type Assumptions } from "./models";

// Split on sentence ends followed by a capital letter, so "Inc.," or "U.S." do not end a sentence.
const sentences = (s: string, n: number) => s.split(/(?<=[.!?])\s+(?=[A-Z])/).slice(0, n).join(" ").trim();

export function researchNote(co: Co, d: any, a: Assumptions, comp: any, rt: any, peers: string[]): string {
  const L = co.L, st = co.street, ps: Co[] = comp.ps, sc = [scenario(co, a, -1), d, scenario(co, a, 1)];
  const med = (k: string) => median(ps.map((p) => p[k]));
  const vs = (v: any, m: any, hi = "above", lo = "below") => (!ok(v) || !ok(m) ? "" : Math.abs(v - m) < 0.005 ? "in line with" : v > m ? hi : lo);
  const gap = (v: any, m: any) => (ok(v) && ok(m) ? `${Math.abs((v - m) * 100).toFixed(1)} pp ${v >= m ? "above" : "below"}` : "");
  const peerList = peers.length ? peers.join(", ") : "";

  // Business overview
  const overview = [
    co.y.summary ? sentences(co.y.summary, 3) : `${co.name} is classified by the SEC under ${co.raw.sicDesc || "an unspecified industry"}.`,
    co.y.hq || ok(co.y.employees)
      ? [co.y.hq && `The company is headquartered in ${co.y.hq}`, ok(co.y.employees) && `employs approximately ${co.y.employees.toLocaleString("en-US")} people`].filter(Boolean).join(" and ") + "."
      : "",
    `It files under SIC ${co.raw.sic ?? "n/a"} (${co.raw.sicDesc ?? "n/a"})${co.raw.fye ? `, with a fiscal year ending ${monthName(+co.raw.fye.slice(0, 2))} ${+co.raw.fye.slice(2)}` : ""}.`,
  ].filter(Boolean).join(" ");

  // Industry positioning against the peer set
  const pos: string[] = [];
  if (ps.length) {
    const rank = [co, ...ps].sort((x, y) => (y.L.rev ?? 0) - (x.L.rev ?? 0)).findIndex((x) => x.tk === co.tk) + 1;
    pos.push(`Against a peer set of ${peerList}, ${co.tk} ranks ${rank} of ${ps.length + 1} by LTM revenue (${fB(L.rev)}).`);
    if (co.fin) {
      if (ok(co.roe) && ok(med("roe"))) pos.push(`Return on equity of ${fP(co.roe)} is ${gap(co.roe, med("roe"))} the peer median, and equity funds ${fP(co.eqAssets)} of assets against a median of ${fP(med("eqAssets"))}.`);
    } else {
      if (ok(co.gm) && ok(med("gm"))) pos.push(`Gross margin of ${fP(co.gm)} is ${gap(co.gm, med("gm"))} the peer median, and operating margin of ${fP(co.om)} is ${vs(co.om, med("om"))} the median of ${fP(med("om"))}.`);
      if (ok(co.roic) && ok(med("roic"))) pos.push(`ROIC of ${fP(co.roic)} compares with a peer median of ${fP(med("roic"))}, ${co.roic > (med("roic") as number) ? "indicating more efficient use of invested capital than the group" : "indicating lower capital efficiency than the group"}.`);
    }
    if (ok(co.cagr3) && ok(med("cagr3"))) pos.push(`Three-year revenue growth of ${fP(co.cagr3)} a year is ${vs(co.cagr3, med("cagr3"), "faster than", "slower than")} the peer median of ${fP(med("cagr3"))}.`);
  } else pos.push("No peer set is selected, so relative positioning is not assessed.");

  // Growth drivers: history, consensus, reinvestment
  const est = co.est || [], e0 = est[0], e1 = est[1];
  const gr: string[] = [`Revenue grew ${fP(co.cagr3)} a year over the last three fiscal years and ${fP(co.ltmGrowth, 1, true)} over the latest twelve months.`];
  if (e0?.rev?.avg) gr.push(`Street consensus calls for ${fB(e0.rev.avg)} of revenue in ${e0.label} (${fP(e0.rev.growth, 1, true)})${e1?.rev?.avg ? ` and ${fB(e1.rev.avg)} in ${e1.label} (${fP(e1.rev.growth, 1, true)})` : ""}.`);
  if (e0?.eps?.avg) gr.push(`Consensus EPS is ${fD(e0.eps.avg)} for ${e0.label}${e1?.eps?.avg ? ` and ${fD(e1.eps.avg)} for ${e1.label}` : ""}.`);
  const rnd = ok(L.rnd) && L.rev ? L.rnd / L.rev : null, cx = ok(L.capex) && L.rev ? L.capex / L.rev : null;
  if (!co.fin && (ok(rnd) || ok(cx))) gr.push(`Reinvestment runs at ${[ok(rnd) && `${fP(rnd)} of revenue in R&D`, ok(cx) && `${fP(cx)} in capital expenditure`].filter(Boolean).join(" and ")}; the model assumes capex of ${fP(a.capexPct)} of revenue.`);

  // Financial performance
  const perf = co.fin
    ? `LTM total net revenue was ${fB(L.rev)} (${fP(co.ltmGrowth, 1, true)}) and net income ${fB(L.ni)} (${fP(co.niGrowth, 1, true)}), a net margin of ${fP(co.nm)}. Return on equity was ${fP(co.roe)} against a cost of equity of ${fP(d.w)}, and tangible book value was ${fB(L.tbv)}.`
    : `LTM revenue was ${fB(L.rev)} (${fP(co.ltmGrowth, 1, true)}), with a gross margin of ${fP(co.gm)}, operating margin of ${fP(co.om)} and net margin of ${fP(co.nm)}. Net income was ${fB(L.ni)} (${fP(co.niGrowth, 1, true)}). Free cash flow was ${fB(L.fcf)}, or ${fP(co.fm)} of revenue${L.ni > 0 && ok(L.fcf) ? `, converting ${fP(L.fcf / L.ni, 0)} of net income` : ""}. The balance sheet carries ${fB(L.debt)} of debt against ${fB(L.debt - L.netDebt)} of cash and investments (${L.netDebt < 0 ? "a net cash position" : `${fX(co.ndEbitda)} net debt to EBITDA`}).`;

  // Strengths and risks
  const S: string[] = [], R: string[] = [];
  rt.factors.forEach((f: any) => {
    if (f.s >= 1) S.push(`${f.name}: ${f.disp}.`);
    if (f.s != null && f.s <= -1) R.push(`${f.name}: ${f.disp}.`);
  });
  if (co.gm > 0.5) S.push(`Gross margin of ${fP(co.gm)} indicates pricing power or a favorable cost structure.`);
  if (co.fm > 0.15) S.push(`Free cash flow of ${fP(co.fm)} of revenue funds reinvestment and shareholder returns internally.`);
  if (!co.fin && L.netDebt < 0 && !S.some((s) => s.startsWith("Balance sheet"))) S.push(`Net cash of ${fB(-L.netDebt)} provides balance sheet flexibility.`);
  if (ok(st.up) && st.up > 0.1) S.push(`The Street mean target of ${fD(st.target)} sits ${fP(st.up, 0)} above the current price.`);
  if (co.r3y && co.r3y.vol > 0.35) R.push(`Share price volatility of ${fP(co.r3y.vol)} annualized over three years, with a beta of ${fN(co.beta, 2)}.`);
  if (d.tvShare > 0.75) R.push(`${fP(d.tvShare, 0)} of modeled value sits in the terminal value, so the result depends heavily on long-run assumptions.`);
  if (!co.fin && ok(L.fcf) && L.fcf < 0) R.push(`Free cash flow was negative over the last twelve months (${fB(L.fcf)}).`);
  if (ok(co.niGrowth) && co.niGrowth < -0.1) R.push(`Net income declined ${fP(-co.niGrowth, 0)} over the last twelve months.`);
  if (co.stale) R.push(`EDGAR's structured data does not yet include the latest ${co.raw.lastForm}, so reported figures lag by one quarter.`);
  if (co.opDerived) R.push("Operating income is not tagged in XBRL; EBIT is approximated as pre-tax income plus interest expense.");

  // Valuation
  const relK = co.fin ? "pb" : "evEbitda", relName = co.fin ? "price to book" : "EV/EBITDA";
  const impl = comp.implied.map((r: any) => `${r.label} ${fD(r.mid)}`).join("; ");
  const val = [
    d.nm
      ? `The base-case ${co.fin ? "residual income" : "DCF"} model does not produce a meaningful value: projected cash flows over ${a.years} years, discounted at ${fP(d.w)}, do not cover net debt, so the implied equity value is negative. For a company that is not yet profitable the result depends almost entirely on when and whether margins turn positive.`
      : `The base-case ${co.fin ? "residual income" : "DCF"} model values the shares at ${fPS(d.ps)}, ${fP(d.up, 1, true)} against the ${fD(co.price)} price, discounting at ${fP(d.w)} with ${fP(a.tg)} terminal growth over ${a.years} years.`,
    co.fin ? `Return on equity moves from ${fP(a.roe0)} to ${fP(a.roeT)} with a ${fP(a.payout, 0)} payout.` : `Revenue growth fades from ${fP(a.g1)} to ${fP(a.gN)} and operating margin moves to ${fP(a.mT)}.`,
    sc[0].nm && sc[2].nm ? "" : `The bear and bull cases span ${fPS(sc[0].ps)} to ${fPS(sc[2].ps)}.`,
    `On trading multiples the shares are at ${fX(co.pe)} LTM earnings${co.fpeSrc === "consensus" ? ` and ${fX(co.fpe)} NTM consensus earnings` : ""}, and ${fX(co[relK])} ${relName}${ok(comp.st[relK].med) ? ` against a peer median of ${fX(comp.st[relK].med)}` : ""}.`,
    impl ? `Peer medians imply ${impl}.` : "",
  ].filter(Boolean).join(" ");

  // Thesis: strongest and weakest factor, and where price sits against value
  const scored = rt.factors.filter((f: any) => f.s != null);
  const top = [...scored].sort((x: any, y: any) => y.s - x.s)[0], low = [...scored].sort((x: any, y: any) => x.s - y.s)[0];
  const thesis = `${co.name} pairs ${top ? `its strongest factor, ${top.name} (${top.disp}),` : "mixed fundamentals"} with ${low && low !== top ? `its weakest, ${low.name} (${low.disp})` : "no single dominant weakness"}. At ${fD(co.price)} the shares trade ${d.nm ? "without support from the base-case cash flow model" : `${d.up > 0 ? "below" : "above"} the base-case value of ${fPS(d.ps)}`}${ok(st.target) ? ` and ${co.price < st.target ? "below" : "above"} the Street mean target of ${fD(st.target)}` : ""}. The case rests on whether ${co.fin ? "returns on equity hold above the cost of equity" : `growth and margins follow the modeled path to a ${fP(a.mT)} operating margin`}.`;

  const rec = `The model rating is **${rt.rating}** (composite ${(rt.total >= 0 ? "+" : "") + rt.total.toFixed(2)} on a -2 to +2 scale; Buy at +0.50 or above, Sell at -0.50 or below).${st.key ? ` For reference, the Street consensus is ${st.key.replace("_", " ")}${ok(st.n) ? ` across ${st.n} analysts` : ""}.` : ""}`;
  const factors = rt.factors.map((f: any) => `${f.name} (${(f.w * 100).toFixed(0)}% weight): ${f.disp}; score ${f.s == null ? "n/a" : (f.s > 0 ? "+" : "") + f.s}.`);

  const list = (xs: string[], empty: string) => (xs.length ? xs : [empty]).map((s) => `- ${s}`).join("\n");
  return [
    `## Business Overview\n${overview}`,
    `## Industry Positioning\n${pos.join(" ")}`,
    `## Growth Drivers\n${gr.join(" ")}`,
    `## Financial Performance\n${perf}`,
    `## Strengths\n${list(S, "No factor scores in the favorable range.")}`,
    `## Risks\n${list(R, "No factor scores in the unfavorable range.")}`,
    `## Valuation\n${val}`,
    `## Investment Thesis\n${thesis}`,
    `## Recommendation\n${rec}\n${list(factors, "")}`,
  ].join("\n\n");
}
