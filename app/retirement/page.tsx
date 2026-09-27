"use client";
import { useEffect, useMemo, useState } from "react";
import Plot from "@/components/Plot";
import { Content, Section, TitleBar } from "@/components/Shell";
import { Card, Donut, KV, Kpi, Note } from "@/components/ui";
import { figFan, figWealthHist } from "@/lib/charts";
import { fB, fD, fP } from "@/lib/format";
import { CMA, DEFAULT_PLAN, requiredSaveRate, simulate, type Plan } from "@/lib/montecarlo";

type Field = { key: keyof Plan; label: string; hint?: string; pct?: boolean; step: number; min?: number; max?: number };
const FIELDS: [string, Field[]][] = [
  ["You", [
    { key: "age", label: "Current age", step: 1, min: 16, max: 80 },
    { key: "retireAge", label: "Retirement age", step: 1, min: 30, max: 85 },
    { key: "endAge", label: "Plan to age", hint: "Longevity assumption", step: 1, min: 60, max: 110 },
  ]],
  ["Saving", [
    { key: "savings", label: "Current savings", step: 1000, min: 0 },
    { key: "income", label: "Annual income", step: 1000, min: 0 },
    { key: "saveRate", label: "Savings rate", hint: "Share of income invested each year", pct: true, step: 0.01, min: 0, max: 0.9 },
    { key: "incomeGrowth", label: "Real income growth", hint: "Raises above inflation", pct: true, step: 0.005, min: -0.05, max: 0.1 },
  ]],
  ["Retirement", [
    { key: "spending", label: "Annual spending goal", hint: "Today's dollars", step: 1000, min: 0 },
    { key: "otherIncome", label: "Social Security and pensions", hint: "Today's dollars per year", step: 1000, min: 0 },
  ]],
  ["Allocation and costs", [
    { key: "stocks", label: "Stocks", pct: true, step: 0.05, min: 0, max: 1 },
    { key: "bonds", label: "Bonds", pct: true, step: 0.05, min: 0, max: 1 },
    { key: "cash", label: "Cash", pct: true, step: 0.05, min: 0, max: 1 },
    { key: "inflation", label: "Inflation", pct: true, step: 0.005, min: 0, max: 0.1 },
    { key: "fee", label: "Fund fees", hint: "Expense ratio", pct: true, step: 0.001, min: 0, max: 0.03 },
  ]],
];

export default function Retirement() {
  const [plan, setPlan] = useState<Plan>(DEFAULT_PLAN);
  const [need, setNeed] = useState<number | null | undefined>(undefined);
  const valid = plan.retireAge > plan.age && plan.endAge > plan.retireAge;
  const r = useMemo(() => (valid ? simulate(plan) : null), [plan, valid]);

  // The savings-rate search runs ~9 simulations, so it waits until the inputs settle.
  useEffect(() => {
    setNeed(undefined);
    if (!valid) return;
    const t = setTimeout(() => setNeed(requiredSaveRate(plan)), 400);
    return () => clearTimeout(t);
  }, [plan, valid]);

  const set = (k: keyof Plan, v: number) => setPlan((p) => ({ ...p, [k]: v }));
  const tone = !r ? "var(--c0)" : r.success >= 0.8 ? "var(--pos)" : r.success >= 0.6 ? "var(--c3)" : "var(--neg)";
  const verdict = !r ? "" : r.success >= 0.9 ? "On track" : r.success >= 0.75 ? "Mostly on track" : r.success >= 0.5 ? "At risk" : "Off track";

  return (
    <>
      <TitleBar title="Retirement simulator" back="/" sub={<><span>Monte Carlo, {plan.runs.toLocaleString("en-US")} paths</span><span>Annual steps, results in today&apos;s dollars</span></>} />
      <Content>
        <div className="grid gap-3.5 xl:grid-cols-[360px_minmax(0,1fr)]">
          <Card title="Assumptions">
            <div className="inp">
              {FIELDS.map(([group, fields]) => (
                <div key={group} className="contents">
                  <h4>{group}</h4>
                  {fields.map((f) => (
                    <div key={f.key} className="contents">
                      <label>{f.label}{f.hint && <small>{f.hint}</small>}</label>
                      <input type="number" step={f.pct ? +(f.step * 100).toFixed(2) : f.step} min={f.min != null ? (f.pct ? f.min * 100 : f.min) : undefined} max={f.max != null ? (f.pct ? f.max * 100 : f.max) : undefined}
                        value={f.pct ? +(plan[f.key] * 100).toFixed(2) : plan[f.key]}
                        onChange={(e) => set(f.key, f.pct ? +e.target.value / 100 : +e.target.value)} />
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div className="px-5 pb-4"><button className="btn text-[12px]" onClick={() => setPlan(DEFAULT_PLAN)}>Reset to defaults</button></div>
          </Card>

          <div className="grid content-start gap-3.5">
            {!r && <Card><div className="px-5 py-4 text-neg">Retirement age must be after your current age, and the plan must run past retirement.</div></Card>}
            {r && <>
              <div className="grid gap-3.5 md:grid-cols-[220px_minmax(0,1fr)]">
                <Card title="Probability of success">
                  <div className="flex flex-col items-center px-5 pb-4">
                    <div className="relative">
                      <Donut value={r.success} label={`${verdict}: ${fP(r.success, 1)}`} color={tone} />
                      <span className="absolute inset-0 flex items-center justify-center text-[19px] font-semibold">{fP(r.success, 1)}</span>
                    </div>
                    <div className="mt-1 text-[14px] font-semibold" style={{ color: tone }}>{verdict}</div>
                    <p className="mt-1 text-center text-[12.5px] text-ink-3">Share of paths where savings last to age {plan.endAge}</p>
                  </div>
                </Card>
                <div className="kpis sm:grid-cols-3">
                  <Kpi title="Median at retirement" unit={`Age ${plan.retireAge}`} value={fD(r.atRetire.p50, 0)}
                    delta={<span className="text-[12.5px] text-ink-3">90% range {fB(r.atRetire.p5)} to {fB(r.atRetire.p95)}</span>} />
                  <Kpi title="Worst case" unit={`5th percentile, wealth at ${plan.endAge}`} value={<span className={r.end.p5 > 0 ? "" : "text-neg"}>{fD(r.end.p5, 0)}</span>}
                    delta={<span className="text-[12.5px] text-ink-3">{r.medianDepletionAge != null ? `Failed paths run out around age ${r.medianDepletionAge}` : "No path runs out of money"}</span>} />
                  <Kpi title="Best case" unit={`95th percentile, wealth at ${plan.endAge}`} value={fD(r.end.p95, 0)}
                    delta={<span className="text-[12.5px] text-ink-3">Median outcome {fB(r.end.p50)}</span>} />
                </div>
              </div>
              <Card title="Projected wealth" unit="Today's dollars; shaded bands hold 50% and 90% of simulated paths">
                <div className="px-2 pb-2"><Plot fig={figFan(r.ages, r.bands, plan.retireAge)} height={400} /></div>
              </Card>
            </>}
          </div>
        </div>

        {r && <>
          <Section>Distribution and sensitivity</Section>
          <div className="grid gap-3.5 xl:grid-cols-2">
            <Card title="Ending wealth distribution" unit={`Top 3% of paths trimmed for scale; best single path ${fD(r.end.best, 0)}`}>
              <div className="px-2 pb-2"><Plot fig={figWealthHist(r.endWealth)} height={280} /></div>
            </Card>
            <Card title="What it takes">
              <KV rows={[
                ["Savings rate for 80% success", need === undefined ? "Calculating…" : need == null ? "Above 60%: adjust spending or retirement age" : `${fP(need)} (currently ${fP(plan.saveRate)})`],
                ["Annual gap funded by savings", fD(Math.max(0, plan.spending - plan.otherIncome), 0)],
                ["Savings needed under the 4% rule", fD(r.needed, 0)],
                ["Median savings at retirement vs. 4% rule", r.needed > 0 ? `${fP(r.atRetire.p50 / r.needed, 0)} of target` : "No withdrawals needed"],
                ["Years of saving / years of retirement", `${plan.retireAge - plan.age} / ${plan.endAge - plan.retireAge}`],
              ]} />
              <Note>
                Returns are drawn each year from correlated lognormal distributions: stocks {fP(CMA.mean[0])} mean / {fP(CMA.vol[0])} volatility,
                bonds {fP(CMA.mean[1])} / {fP(CMA.vol[1])}, cash {fP(CMA.mean[2])} / {fP(CMA.vol[2])} (nominal, before fees), rebalanced annually.
                Taxes are ignored. This is an educational model, not financial advice.
              </Note>
            </Card>
          </div>
        </>}
      </Content>
    </>
  );
}
