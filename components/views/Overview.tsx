"use client";
import { useMemo, useState } from "react";
import Plot from "@/components/Plot";
import { Section } from "@/components/Shell";
import { Card, Chip, Delta, Donut, KV, Kpi, Seg, Sparkline, Tw, Var } from "@/components/ui";
import { figPrice, figRevEarn, figScenario } from "@/lib/charts";
import { useCompany } from "@/lib/company-context";
import { dLong, fB, fD, fM1, fN, fP, fVol, fX, monthName, ok, fPS } from "@/lib/format";
import { scenarios } from "@/lib/models";

/** Column header rendered as a colored chip, as in management-report variance tables. */
const ChipTh = ({ children, color, ink }: { children: string; color: string; ink?: boolean }) => <th className="chip-h" style={{ background: color, color: ink ? "var(--ink)" : "#fff" }}>{children}</th>;

export default function Overview() {
  const { co, a, d, rt, comp } = useCompany();
  const [range, setRange] = useState("1Y");
  const sc = useMemo(() => scenarios(co, a), [co, a]);
  const L = co.L, st = co.street, recs = st.recs, rn = recs ? (Object.values(recs) as number[]).reduce((x, y) => x + y, 0) : 0;
  const dayChg = ok(co.prev) ? co.price / co.prev - 1 : null;
  const closes1y: number[] = co.hasPx ? co.px.t.c.slice(-252).filter(ok) : [];
  const ret1y = closes1y.length > 1 ? closes1y[closes1y.length - 1] / closes1y[0] - 1 : null;
  const rangePos = ok(co.hi52) && ok(co.lo52) && co.hi52 > co.lo52 ? (co.price - co.lo52) / (co.hi52 - co.lo52) : null;
  const cols = [{ ev: co.ev, eqv: co.mcap, ps: co.price }, ...sc];
  const row = (label: string, fn: (s: any, i: number) => string, tot = false) => (
    <tr className={tot ? "tot" : ""} key={label}><td>{label}</td>{cols.map((s, i) => <td key={i}>{fn(s, i)}</td>)}</tr>
  );
  const fye = co.raw.fye ? `${monthName(+co.raw.fye.slice(0, 2))} ${+co.raw.fye.slice(2)}` : "n/a";
  const med = (k: string) => comp.implied.find((r: any) => r.k === k)?.mid;
  const cross: [string, number | null | undefined][] = [
    [`${co.fin ? "Residual income" : "DCF"}, base case`, d.ps], ["Bear case", sc[0].ps], ["Bull case", sc[2].ps],
    ["Street mean target", st.target],
    ...(co.fin ? [["Peer median P/B", med("pb")], ["Peer median P/E", med("pe")]] : [["Peer median EV/EBITDA", med("evEbitda")], ["Peer median P/E", med("pe")]]) as [string, number | undefined][],
  ];
  return (
    <>
      {d.nm && (
        <div className="card border-l-4 border-l-warn px-5 py-3 text-[13px] text-ink-2">
          {co.name} is not yet profitable, and the base-case cash flow model produces a negative equity value, so per-share model values show as n.m.
          The Valuation page lets you test a faster path to profitability.
        </div>
      )}
      {co.stale && (
        <div className="card border-l-4 border-l-warn px-5 py-3 text-[13px] text-ink-2">
          EDGAR&apos;s structured XBRL data for {co.tk} runs through {dLong(co.Q[co.Q.length - 1].end)}. The {co.raw.lastForm} filed {dLong(co.raw.lastFiled)} is not yet in the SEC data feed, so figures reflect the prior quarter.
        </div>
      )}
      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi title="Share price" unit={co.priceDate ? `Close ${dLong(co.priceDate)}` : "Yahoo Finance"} value={fD(co.price)} delta={<Delta v={dayChg} dp={2} vs="1 day" />} />
        <Kpi title="Base case" unit={`${co.fin ? "Residual income" : "DCF"}, per share`} value={fPS(d.ps)} delta={<Delta v={d.up} vs="vs price" />} />
        <Kpi title="Bear case" unit="Per share" value={fPS(sc[0].ps)} delta={<Delta v={sc[0].up} vs="vs price" />} />
        <Kpi title="Bull case" unit="Per share" value={fPS(sc[2].ps)} delta={<Delta v={sc[2].up} vs="vs price" />} />
      </div>

      <Section>Valuation</Section>
      <div className="grid gap-3.5 xl:grid-cols-[minmax(250px,0.9fr)_minmax(0,1.2fr)_minmax(0,1.5fr)]">
        <div className="grid content-start gap-3.5">
          <Card title="Price, 1 year" unit="Daily close">
            <div className="flex items-end justify-between gap-3 px-5 pb-4">
              <div>
                <div className="text-[26px] leading-none font-semibold text-ink">{fD(co.price)}</div>
                <div className="mt-2"><Delta v={ret1y} vs="1 yr" /></div>
              </div>
              <Sparkline data={closes1y.filter((_, i) => i % 3 === 0 || i === closes1y.length - 1)} />
            </div>
          </Card>
          <Card title="52-week range" unit="Position of the current price">
            <div className="flex items-center justify-between gap-3 px-5 pb-4">
              <div>
                <div className="text-[26px] leading-none font-semibold text-ink">{ok(rangePos) ? `${Math.round(rangePos * 100)}%` : "—"}</div>
                <div className="mt-2 text-[13px] text-ink-3">{fD(co.lo52)} low · {fD(co.hi52)} high</div>
              </div>
              <Donut value={rangePos} label="Position in 52-week range" color="var(--c2)" />
            </div>
          </Card>
          <Card title="Street view" unit={ok(st.n) ? `${st.n} analysts` : "No coverage data"}>
            <div className="px-5 pb-4">
              {recs && rn > 0 ? (
                <>
                  {([["Buy", recs.strongBuy + recs.buy, "var(--c1)"], ["Hold", recs.hold, "var(--c0)"], ["Sell", recs.sell + recs.strongSell, "var(--c4)"]] as const).map(([l, n, c]) => (
                    <div key={l} className="mb-1.5 grid grid-cols-[42px_1fr_28px] items-center gap-2 text-[12.5px]">
                      <span className="text-ink-2">{l}</span>
                      <span className="h-2.5 rounded-sm bg-line"><i className="block h-full rounded-sm" style={{ width: `${(n / rn) * 100}%`, background: c }} /></span>
                      <span className="text-right font-semibold text-ink">{n}</span>
                    </div>
                  ))}
                  <div className="mt-2 text-[13px] text-ink-2">Mean target {fD(st.target)} <Var v={st.up} /></div>
                </>
              ) : <div className="text-[13px] text-ink-3">No rating distribution available.</div>}
            </div>
          </Card>
        </div>
        <Card title={`Scenario ${co.fin ? "residual income" : "free cash flow"} by year`} unit={`Bear / base / bull · ${co.fin ? `target ROE ±${fP(a.sc.roe, 0)}` : `growth ±${fP(a.sc.g, 0)}, margin ±${fP(a.sc.m, 0)}`}, discount rate ∓${fP(a.sc.w, 0)}`}>
          <div className="px-2 pb-2"><Plot fig={figScenario(co, sc)} height={420} /></div>
        </Card>
        <Card title="Revenue and earnings" unit={co.est ? "Fiscal years · lighter bars are Street consensus" : "Fiscal years"}>
          <div className="px-2 pb-2"><Plot fig={figRevEarn(co)} height={420} /></div>
        </Card>
      </div>

      <div className="grid gap-3.5 xl:grid-cols-2">
        <Card title="Scenario valuation" unit="$ millions, except per share">
          <Tw>
            <table className="t">
              <thead><tr><th>Item</th><ChipTh color="var(--ink-2)">Market</ChipTh><ChipTh color="var(--c0)" ink>Bear</ChipTh><ChipTh color="var(--c1)">Base</ChipTh><ChipTh color="var(--c2)">Bull</ChipTh></tr></thead>
              <tbody>
                {co.fin ? <>
                  {row("Opening book value", () => fM1(L.eq))}
                  {row("Final-year ROE", (s, i) => (i ? fP(s.finalRoe) : fP(co.roe)))}
                  {row("Cost of equity", (s, i) => (i ? fP(s.w) : "—"))}
                  {row("PV of residual income", (s, i) => (i ? fM1(s.pvSum) : "—"))}
                  {row("PV of terminal value", (s, i) => (i ? fM1(s.pvTv) : "—"))}
                  {row("Equity value", (s) => fM1(s.eqv))}
                  {row("Implied P / book", (s, i) => (i ? fX(s.impliedPB, 2) : fX(co.pb, 2)))}
                </> : <>
                  {row("Final-year revenue", (s, i) => (i ? fM1(s.finalRev) : fM1(L.rev)))}
                  {row("Final-year EBIT margin", (s, i) => (i ? fP(s.finalMargin) : fP(co.om)))}
                  {row("Discount rate (WACC)", (s, i) => (i ? fP(s.w) : "—"))}
                  {row("PV of forecast FCF", (s, i) => (i ? fM1(s.pvSum) : "—"))}
                  {row("PV of terminal value", (s, i) => (i ? fM1(s.pvTv) : "—"))}
                  {row("Enterprise value", (s) => fM1(s.ev))}
                  {row("Equity value", (s) => fM1(s.eqv))}
                </>}
                {row("Value per share", (s) => fPS(s.ps), true)}
              </tbody>
            </table>
          </Tw>
        </Card>
        <Card title="Valuation cross-check" unit="Per share, against the current price">
          <Tw>
            <table className="t">
              <thead><tr><th>Method</th><ChipTh color="var(--ink-2)">Price</ChipTh><ChipTh color="var(--c1)">Value</ChipTh><th>Variance %</th><th>Variance</th></tr></thead>
              <tbody>
                {cross.map(([l, v]) => (
                  <tr key={l}><td>{l}</td><td>{fD(co.price)}</td><td className="font-semibold">{fD(v)}</td><td><Var v={ok(v) ? v / co.price - 1 : null} /></td><td>{ok(v) ? <Var v={v - co.price} pct={false} /> : "—"}</td></tr>
                ))}
                <tr className="tot"><td>Model rating</td><td /><td><Chip kind={rt.rating.toLowerCase() as any}>{rt.rating}</Chip></td><td colSpan={2} className="text-ink-2">Composite {(rt.total >= 0 ? "+" : "") + rt.total.toFixed(2)} of ±2</td></tr>
              </tbody>
            </table>
          </Tw>
        </Card>
      </div>

      <Section>Company</Section>
      <div className="grid gap-3.5 md:grid-cols-2 2xl:grid-cols-4">
        <Card title="Profile" unit={co.sector}>
          <div className="max-h-[150px] overflow-auto px-5 pb-2 text-[13.5px] leading-relaxed text-ink-2">{co.y.summary || "No business description available for this issuer."}</div>
          <KV rows={[
            ["Industry", co.industry], ["SEC industry (SIC)", co.raw.sicDesc || "n/a"], ["Headquarters", co.y.hq || "n/a"],
            ["Employees", ok(co.y.employees) ? co.y.employees.toLocaleString("en-US") : "n/a"], ["Fiscal year end", fye],
            ["Latest filing", `${co.raw.lastForm ?? ""} ${dLong(co.raw.lastFiled)}`], ["Next earnings", dLong(co.y.nextEarnings) || "n/a"],
          ]} />
        </Card>
        <Card title="Market data" unit="Yahoo Finance">
          <KV rows={[
            ["Market capitalization", fB(co.mcap)], ["Enterprise value", co.fin ? "n.m. (financial)" : fB(co.ev)],
            ["Shares outstanding", ok(co.shares) ? `${(co.shares / 1e6).toLocaleString("en-US", { maximumFractionDigits: 0 })}M` : "—"],
            ["Average volume (3M)", fVol(co.avgVol)], ["Beta (2-yr weekly, adj.)", fN(co.beta, 2)], ["Dividend yield (TTM)", fP(co.divYld, 2)],
            ["P/E LTM / NTM", `${fX(co.pe)} / ${fX(co.fpe)}`], ["Institutional ownership", fP(co.y.instPct, 1)], ["Short interest (% float)", fP(co.y.shortPct, 2)],
          ]} />
        </Card>
        <Card title="Consensus estimates" unit={ok(st.n) ? `${st.n} analysts` : "No coverage data"}>
          <KV rows={[
            ["Consensus rating", st.key ? `${st.key.replace("_", " ").replace(/\b\w/g, (m: string) => m.toUpperCase())}${ok(st.mean) ? ` (${st.mean.toFixed(2)})` : ""}` : "n/a"],
            ["Mean price target", fD(st.target)], ["Target range", ok(st.lo) ? `${fD(st.lo, 0)} – ${fD(st.hi, 0)}` : "—"],
            ...((co.est || []).flatMap((e: any) => [[`${e.label} EPS`, ok(e.eps?.avg) ? fD(e.eps.avg) : "—"], [`${e.label} revenue`, fB(e.rev?.avg)]]) as [string, string][]),
          ]} />
        </Card>
        <Card title="Earnings" unit={co.y.nextEarnings ? `Next report ${dLong(co.y.nextEarnings)}` : "No scheduled date"}>
          {co.y.surprises?.length ? (
            <Tw>
              <table className="t dense">
                <thead><tr><th>Quarter</th><th>EPS est.</th><th>EPS actual</th><th>Surprise</th></tr></thead>
                <tbody>
                  {[...co.y.surprises].reverse().map((s: any) => (
                    <tr key={s.quarter}>
                      <td>{s.quarter ? `Q ${s.quarter.slice(5, 7)}/${s.quarter.slice(2, 4)}` : "—"}</td>
                      <td>{fD(s.estimate)}</td>
                      <td className="font-semibold">{fD(s.actual)}</td>
                      <td><Var v={s.surprise} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Tw>
          ) : <div className="px-5 pb-5 text-[13px] text-ink-3">No earnings history available.</div>}
          <div className="note pt-0">Reported EPS against the consensus estimate before each release. Revenue surprise history is not available from free sources.</div>
        </Card>
      </div>

      <Card title="Total return vs S&P 500" unit="Dividend-adjusted, rebased to 100" right={<Seg value={range} options={["1M", "6M", "YTD", "1Y", "3Y", "5Y"].map((r) => [r, r] as [string, string])} onChange={setRange} />}>
        {co.hasPx ? <div className="px-2 pb-2"><Plot fig={figPrice(co, range)} height={290} /></div> : <div className="px-5 py-8 text-center text-ink-3">No price history available.</div>}
      </Card>
    </>
  );
}
