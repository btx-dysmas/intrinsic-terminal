"use client";
import { useMemo, useState } from "react";
import Plot from "@/components/Plot";
import { Card, Delta, Kpi, Note, Seg, Tw } from "@/components/ui";
import { figCum, figDrawdown, figHist } from "@/lib/charts";
import { useCompany } from "@/lib/company-context";
import { fN, fP, ok } from "@/lib/format";
import { risk } from "@/lib/risk";

export default function Risk() {
  const { co, a } = useCompany();
  const [win, setWin] = useState(756);
  const rf = a.rf;
  const R1 = useMemo(() => (co.hasPx ? risk(co, 252, rf) : null), [co, rf]);
  const R3 = useMemo(() => (co.hasPx ? risk(co, 756, rf) : null), [co, rf]);
  const R5 = useMemo(() => (co.hasPx ? risk(co, 1260, rf) : null), [co, rf]);
  const R = win === 252 ? R1 : win === 756 ? R3 : R5;
  if (!co.hasPx || !R3 || !R) return <div className="card px-6 py-8 text-center text-ink-3">Risk analysis needs daily price history, which is not available for this company.</div>;
  const pc = (v: any) => fP(v, 1), n2 = (v: any) => (ok(v) ? v.toFixed(2) : "—");
  const row = (l: string, f: (v: any) => string, k: string, bk?: string) => (
    <tr key={l}><td>{l}</td>{[R1, R3, R5].map((r: any, i) => <td key={i}>{r ? f(r[k]) : "—"}</td>)}<td className="text-ink-3">{bk ? [R1, R3, R5].map((r: any) => (r ? f(r[bk]) : "—")).join(" / ") : ""}</td></tr>
  );
  const sharpeGap = R3.sharpe - R3.msharpe;
  return (
    <>
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi title="Volatility" unit="Annualized, 3 years" value={fP(R3.vol, 1)} delta={<Delta v={null} text={`S&P 500 ${fP(R3.mvol, 1)}`} />} />
        <Kpi title="Sharpe ratio" unit="3 years" value={fN(R3.sharpe, 2)} delta={<Delta v={sharpeGap} text={`${sharpeGap >= 0 ? "+" : ""}${sharpeGap.toFixed(2)}`} vs="vs S&P 500" />} />
        <Kpi title="Max drawdown" unit="3 years" value={fP(R3.mdd, 1)} delta={<Delta v={null} text={`S&P 500 ${fP(R3.mmdd, 1)}`} />} />
        <Kpi title="Beta" unit="vs S&P 500, 3-yr daily" value={fN(R3.beta, 2)} delta={<Delta v={null} text={`Correlation ${fN(R3.corr, 2)}`} />} />
      </div>
      <Card title="Risk and Return Statistics" unit={`(daily total returns; risk-free rate ${fP(rf, 2)})`}>
        <Tw>
          <table className="t dense">
            <thead><tr><th>Measure</th><th>1 year</th><th>3 years</th><th>5 years</th><th>S&amp;P 500 1Y / 3Y / 5Y</th></tr></thead>
            <tbody>
              {row("Cumulative return", pc, "cum", "mcum")}{row("Annualized return", pc, "ann", "mann")}{row("Annualized volatility", pc, "vol", "mvol")}
              {row("Beta", n2, "beta")}{row("Correlation", n2, "corr")}{row("Sharpe ratio", n2, "sharpe", "msharpe")}{row("Sortino ratio", n2, "sortino")}
              {row("Jensen's alpha", pc, "alpha")}{row("Tracking error", pc, "te")}{row("Information ratio", n2, "ir")}{row("Upside capture", n2, "upCap")}{row("Downside capture", n2, "dnCap")}
              {row("Maximum drawdown", pc, "mdd", "mmdd")}{row("1-day VaR 95% (historical)", (v) => fP(v, 2), "var95")}{row("1-day VaR 95% (parametric)", (v) => fP(v, 2), "pvar95")}{row("1-day CVaR 95%", (v) => fP(v, 2), "cvar95")}
            </tbody>
          </table>
        </Tw>
      </Card>
      <Card title="Performance vs S&P 500" right={<Seg value={win} options={[[252, "1Y"], [756, "3Y"], [1260, "5Y"]]} onChange={setWin} />}>
        <div className="grid lg:grid-cols-2">
          <div><div className="card-sub px-6">Cumulative total return</div><div className="px-3"><Plot fig={figCum(co, R)} height={260} /></div></div>
          <div><div className="card-sub px-6">Drawdown from running peak</div><div className="px-3"><Plot fig={figDrawdown(co, R)} height={260} /></div></div>
        </div>
        <div className="card-sub px-6">Distribution of daily returns (rose = beyond the 95% historical VaR of {fP(R.var95, 2)})</div>
        <div className="px-3"><Plot fig={figHist(R)} height={190} /></div>
        <Note>Parametric VaR assumes normally distributed returns. Sortino uses downside deviation below the daily risk-free rate. Capture ratios compare average returns on up and down market days.</Note>
      </Card>
    </>
  );
}
