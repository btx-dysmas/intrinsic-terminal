"use client";
import Plot from "@/components/Plot";
import { Card, Note, Tw } from "@/components/ui";
import { figMargins, figReturns } from "@/lib/charts";
import { useCompany } from "@/lib/company-context";
import { cls, dLabel, fR, mean, ok } from "@/lib/format";
import { ltmRatios, ratioRows, ratioSeries } from "@/lib/statements";

// Percentages beyond ±1,000% (early-stage revenue bases) say nothing useful and would swamp the averages.
const extreme = (v: any, f?: string) => f === "p" && ok(v) && Math.abs(v) > 10;
const show = (v: any, f?: string) => (extreme(v, f) ? "n.m." : fR(v, f!));

export default function Ratios() {
  const { co } = useCompany();
  const R = ratioSeries(co), rows = ratioRows(co.fin), ltm = ltmRatios(co);
  return (
    <>
      <div className="grid gap-3.5 lg:grid-cols-2">
        <Card title={co.fin ? "Profitability" : "Margin Structure"} unit="(fiscal years)"><div className="px-3 pb-3"><Plot fig={figMargins(co, R)} height={300} /></div></Card>
        <Card title="Returns on Capital" unit="(fiscal years)"><div className="px-3 pb-3"><Plot fig={figReturns(co, R)} height={300} /></div></Card>
      </div>
      <Card title="Ratio Analysis" unit="(historical average spans the fiscal years shown)">
        <Tw>
          <table className="t dense">
            <thead><tr><th className="sticky-col">Ratio</th>{R.map((r: any) => <th key={r.end}>FY {dLabel(r.end)}</th>)}<th>Historical<br />average</th><th>LTM<br />{dLabel(co.L.end)}</th><th>LTM vs<br />average</th></tr></thead>
            <tbody>
              {rows.map(([k, label, f], i) => {
                if (k === "sec") return <tr key={i} className="sec"><td colSpan={R.length + 4}>{label}</td></tr>;
                const vals = R.map((r: any) => r[k]), av = mean(vals.filter((v: any) => !extreme(v, f))), lv = ltm[k], dlt = ok(lv) && ok(av) ? lv - av : null;
                const better = dlt == null ? null : ["de", "nde"].includes(k) ? -dlt : dlt;
                return (
                  <tr key={i}>
                    <td className="sticky-col">{label}</td>
                    {vals.map((v: any, j: number) => <td key={j}>{show(v, f)}</td>)}
                    <td className="text-ink-3">{fR(av, f!)}</td>
                    <td><b>{show(lv, f)}</b></td>
                    <td className={cls(better)}>{ok(dlt) ? (f === "p" ? `${dlt >= 0 ? "+" : ""}${(dlt * 100).toFixed(1)} pp` : `${dlt >= 0 ? "+" : ""}${dlt.toFixed(2)}x`) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Tw>
        <Note>ROE and ROIC use average balances. ROIC = EBIT x (1 - effective tax rate) / (equity + debt - cash - short-term investments). Green marks a favorable change versus the historical average; for leverage, lower is treated as favorable. n.m. = not meaningful.</Note>
      </Card>
    </>
  );
}
