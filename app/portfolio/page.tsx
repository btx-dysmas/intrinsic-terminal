"use client";
import { useEffect, useMemo, useState } from "react";
import Plot from "@/components/Plot";
import { Content, Section, TitleBar } from "@/components/Shell";
import { Card, ErrorCard, Kpi, Loading, Note, Seg, Tw } from "@/components/ui";
import { api, getMacro } from "@/lib/api";
import { figCorr, figDrawdowns, figGrowth, figShares, PAL } from "@/lib/charts";
import { cls, fB, fD, fN, fP, ok } from "@/lib/format";
import { analyze, PRESETS, type Holding } from "@/lib/portfolio";

const KEY = "irt-portfolio";
const PERIODS: [number, string][] = [[252, "1Y"], [756, "3Y"], [1260, "5Y"], [2520, "10Y"]];

function load(): { holdings: Holding[]; value: number } {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? "");
    if (Array.isArray(s.holdings)) return s;
  } catch {}
  return { holdings: PRESETS["Balanced 40/30/20/10"], value: 100000 };
}

export default function Portfolio() {
  const [holdings, setHoldings] = useState<Holding[]>(PRESETS["Balanced 40/30/20/10"]);
  const [value, setValue] = useState(100000);
  const [days, setDays] = useState(1260);
  const [add, setAdd] = useState("");
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [rf, setRf] = useState(0.0425);

  useEffect(() => {
    const s = load();
    setHoldings(s.holdings);
    setValue(s.value);
    getMacro().then((m) => ok(m?.riskFree) && setRf(m.riskFree)).catch(() => {});
  }, []);
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify({ holdings, value })); } catch {}
  }, [holdings, value]);

  const symbols = holdings.map((h) => h.symbol).sort().join(",");
  useEffect(() => {
    if (!symbols) return;
    setErr(null);
    api(`/prices?symbols=${encodeURIComponent(symbols)}`).then(setData).catch((e) => setErr(e.message));
  }, [symbols]);

  const r = useMemo(() => (data ? analyze(holdings, data, days, rf) : null), [data, holdings, days, rf]);
  const total = holdings.reduce((s, h) => s + (h.weight || 0), 0);
  const missing = data ? holdings.filter((h) => !data.series[h.symbol]?.a).map((h) => h.symbol) : [];

  const setWeight = (sym: string, w: number) => setHoldings((hs) => hs.map((h) => (h.symbol === sym ? { ...h, weight: Math.max(0, w) } : h)));
  const addSymbol = () => {
    const s = add.trim().toUpperCase();
    if (s && !holdings.some((h) => h.symbol === s) && holdings.length < 15) setHoldings([...holdings, { symbol: s, weight: 5 }]);
    setAdd("");
  };
  const normalize = () => total > 0 && setHoldings(holdings.map((h) => ({ ...h, weight: +((h.weight / total) * 100).toFixed(1) })));
  const period = PERIODS.find(([d]) => d === days)?.[1];

  return (
    <>
      <TitleBar title="Portfolio builder" back="/" sub={<><span>Adjusted daily closes, Yahoo Finance</span><span>Rebalanced daily to target weights</span><span>Benchmark S&amp;P 500 (SPY)</span></>} />
      <Content>
        <div className="grid gap-3.5 xl:grid-cols-[400px_minmax(0,1fr)]">
          <Card title="Holdings" unit="Target weights, up to 15 positions">
            <div className="flex flex-wrap gap-1.5 px-5 pb-3">
              {Object.keys(PRESETS).map((p) => <button key={p} className="btn !px-2.5 !py-1 text-[12px]" onClick={() => setHoldings(PRESETS[p])}>{p}</button>)}
            </div>
            <div className="inp">
              <label>Portfolio value<small>Used for position sizing</small></label>
              <input type="number" value={value} step={1000} min={0} onChange={(e) => setValue(+e.target.value)} />
              <h4>Weights (%)</h4>
              {holdings.map((h) => (
                <div key={h.symbol} className="contents">
                  <label className="flex items-center justify-between">
                    <span><b>{h.symbol}</b><small>{data?.series[h.symbol]?.name ?? (missing.includes(h.symbol) ? "No price data" : "")}</small></span>
                    <button aria-label={`Remove ${h.symbol}`} className="px-2 text-ink-3 hover:text-neg" onClick={() => setHoldings(holdings.filter((x) => x.symbol !== h.symbol))}>×</button>
                  </label>
                  <input type="number" value={h.weight} step={1} min={0} onChange={(e) => setWeight(h.symbol, +e.target.value)} />
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 px-5 pb-3">
              <input className="fsel flex-1 uppercase placeholder:normal-case" style={{ backgroundImage: "none" }} placeholder="Add ticker, e.g. QQQ" value={add} onChange={(e) => setAdd(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addSymbol()} />
              <button className="btn" onClick={addSymbol}>Add</button>
            </div>
            <div className="flex items-center justify-between px-5 pb-4 text-[13px]">
              <span className={Math.abs(total - 100) < 0.05 ? "text-ink-2" : "text-neg"}>Total {fN(total, 1)}%{Math.abs(total - 100) >= 0.05 && " (weights are scaled to 100%)"}</span>
              <button className="btn !py-1 text-[12px]" onClick={normalize} disabled={Math.abs(total - 100) < 0.05}>Scale to 100%</button>
            </div>
          </Card>

          <div className="grid content-start gap-3.5">
            <div className="flex items-center justify-between">
              <Section>Performance and risk, trailing {period}</Section>
              <Seg value={days} options={PERIODS} onChange={setDays} />
            </div>
            {err && <ErrorCard title="Prices unavailable" message={err} />}
            {!data && !err && <Loading text="Loading daily price history" />}
            {data && !r && <ErrorCard title="Not enough history" message="The selected holdings do not share at least 30 trading days of prices. Remove recently listed tickers or shorten the period." />}
            {r && <>
              <div className="kpis sm:grid-cols-2 2xl:grid-cols-4">
                <Kpi title="Annualized return" unit={`SPY ${fP(r.bench.ann)}`} value={<span className={cls(r.port.ann)}>{fP(r.port.ann)}</span>} />
                <Kpi title="Volatility" unit={`SPY ${fP(r.bench.vol)}`} value={fP(r.port.vol)} />
                <Kpi title="Sharpe ratio" unit={`SPY ${fN(r.bench.sharpe)} · risk-free ${fP(rf, 2)}`} value={fN(r.port.sharpe)} />
                <Kpi title="Maximum drawdown" unit={`SPY ${fP(r.bench.mdd)}`} value={<span className="text-neg">{fP(r.port.mdd)}</span>} />
              </div>
              <Card title="Growth of $10,000" unit={`Portfolio ${fD(r.growth.port.at(-1), 0)} vs S&P 500 ${fD(r.growth.bench.at(-1), 0)}`}>
                <div className="px-2 pb-2"><Plot fig={figGrowth(r.dates, r.growth.port, r.growth.bench, "Portfolio")} height={300} /></div>
              </Card>
            </>}
          </div>
        </div>

        {r && <>
          <div className="grid gap-3.5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <Card title="Risk metrics" unit="Daily returns, annualized where noted">
              <Tw>
                <table className="t">
                  <thead><tr><th className="l">Measure</th><th>Portfolio</th><th>S&amp;P 500</th></tr></thead>
                  <tbody>
                    {([
                      ["Cumulative return", fP(r.port.cum), fP(r.bench.cum)], ["Annualized return", fP(r.port.ann), fP(r.bench.ann)],
                      ["Annualized volatility", fP(r.port.vol), fP(r.bench.vol)], ["Sharpe ratio", fN(r.port.sharpe), fN(r.bench.sharpe)],
                      ["Sortino ratio", fN(r.port.sortino), fN(r.bench.sortino)], ["Beta to S&P 500", fN(r.port.beta), "1.00"],
                      ["Maximum drawdown", fP(r.port.mdd), fP(r.bench.mdd)], ["1-day VaR, 95%", fP(r.port.var95, 2), fP(r.bench.var95, 2)],
                      ["1-day CVaR, 95%", fP(r.port.cvar95, 2), fP(r.bench.cvar95, 2)], ["1-day VaR on portfolio value", fB(r.port.var95 * value), ""],
                    ] as const).map(([k, a, b]) => <tr key={k}><td className="l">{k}</td><td className="font-semibold">{a}</td><td className="text-ink-2">{b}</td></tr>)}
                  </tbody>
                </table>
              </Tw>
              <Note>VaR and CVaR are historical: the 5th-percentile daily loss and the average loss beyond it over the selected period.</Note>
            </Card>
            <Card title="Drawdown" unit="Decline from previous peak">
              <div className="px-2 pb-2"><Plot fig={figDrawdowns(r.dates, r.drawdown.port, r.drawdown.bench, "Portfolio")} height={330} /></div>
            </Card>
          </div>

          <Card title="Positions" unit="Sizing, return contribution and share of portfolio risk">
            <Tw>
              <table className="t">
                <thead><tr><th className="l">Holding</th><th className="l">Asset class</th><th className="l">Sector</th><th>Weight</th><th>Amount</th><th>Last price</th><th>Shares</th><th>Ann. return</th><th>Volatility</th><th>Beta</th><th>Return contribution</th><th>Risk share</th></tr></thead>
                <tbody>
                  {r.positions.map((p) => (
                    <tr key={p.symbol}>
                      <td className="l"><b>{p.symbol}</b> <span className="text-ink-3">{p.name}</span></td>
                      <td className="l">{p.cls}</td><td className="l text-ink-2">{p.sector}</td>
                      <td>{fP(p.weight)}</td><td>{fD(p.weight * value, 0)}</td><td>{fD(p.last)}</td><td>{fN(Math.floor((p.weight * value) / p.last), 0)}</td>
                      <td className={cls(p.ann)}>{fP(p.ann)}</td><td>{fP(p.vol)}</td><td>{fN(p.beta)}</td>
                      <td className={cls(p.contribution)}>{fP(p.contribution, 2)}</td>
                      <td className={p.riskShare > p.weight * 1.5 ? "text-neg font-semibold" : ""}>{fP(p.riskShare)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Tw>
            <Note>Risk share is each holding&apos;s contribution to portfolio variance (weight × covariance with the portfolio ÷ portfolio variance). Shares round down to whole units. Highlighted rows carry well over their weight in risk.</Note>
          </Card>

          <div className="grid gap-3.5 lg:grid-cols-3">
            <Card title="Asset allocation"><div className="px-2 pb-2"><Plot fig={figShares(r.byClass, PAL.c1)} height={Math.max(160, r.byClass.length * 38 + 50)} /></div></Card>
            <Card title="Sector exposure" unit="Stocks by GICS sector; funds by type"><div className="px-2 pb-2"><Plot fig={figShares(r.bySector, PAL.c2)} height={Math.max(160, r.bySector.length * 38 + 50)} /></div></Card>
            <Card title="Correlation" unit="Daily returns">
              <div className="px-2 pb-2"><Plot fig={figCorr(r.positions.map((p) => p.symbol), r.corr)} height={Math.max(220, r.positions.length * 42 + 60)} /></div>
            </Card>
          </div>
          {missing.length > 0 && <Card><Note>No price history found for {missing.join(", ")}; excluded from the analysis.</Note></Card>}
        </>}
      </Content>
    </>
  );
}
