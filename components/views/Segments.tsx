"use client";
import { useEffect, useState } from "react";
import Plot from "@/components/Plot";
import { Card, ErrorCard, Loading, Note, Seg, Tw } from "@/components/ui";
import { api } from "@/lib/api";
import { figSegmentMargins, figSegments } from "@/lib/charts";
import { useCompany } from "@/lib/company-context";
import { cls, DASH, dLong, fP, ok } from "@/lib/format";
import type { Breakdown, Segments as Data } from "@/lib/server/segments";

const fy = (end: string) => `FY${end.slice(0, 4)}`;
const mil = (v: number | null | undefined) => (ok(v) ? Math.round(v / 1e6).toLocaleString("en-US") : DASH);
const growth = (a: number | null, b: number | null) => (ok(a) && ok(b) && b > 0 ? a / b - 1 : null);
const cagr = (a: number | null, b: number | null, n: number) => (ok(a) && ok(b) && a > 0 && b > 0 && n > 0 ? (a / b) ** (1 / n) - 1 : null);

export default function Segments() {
  const { co } = useCompany();
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sel, setSel] = useState<string>("segment");

  useEffect(() => {
    let alive = true;
    setD(null);
    setErr(null);
    api<Data>(`/company/${co.tk}/segments`)
      .then((r) => { if (alive) { setD(r); if (r.breakdowns.length && !r.breakdowns.some((b) => b.key === sel)) setSel(r.breakdowns[0].key); } })
      .catch((e) => alive && setErr(e.message));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [co.tk]);

  if (err) return <ErrorCard title="Segment data unavailable" message={err} />;
  if (!d) return <Loading text="Reading segment disclosures from the last three 10-K filings" />;
  if (!d.breakdowns.length) return <Card title="Segments"><div className="px-5 pb-5 text-ink-3">{d.reason} Companies with a single reportable segment often report no breakdown.</div></Card>;
  const b = d.breakdowns.find((x) => x.key === sel) ?? d.breakdowns[0];
  return (
    <>
      <div className="card flex flex-wrap items-center gap-3 px-5 py-3">
        <span className="text-[13px] text-ink-2">From XBRL in {d.filings.length} annual reports, latest filed {dLong(d.filings[0].filed)}</span>
        <span className="ml-auto"><Seg value={b.key} options={d.breakdowns.map((x) => [x.key, x.title] as [string, string])} onChange={setSel} /></span>
      </div>
      <View b={b} />
    </>
  );
}

function View({ b }: { b: Breakdown }) {
  const n = b.years.length, L = n - 1;
  const top = b.rows.filter((r) => !r.parent);
  const overlap = b.coverage.some((c) => ok(c) && c > 1.03);
  const hasOi = b.rows.some((r) => r.operatingIncome?.some(ok));
  const oiTotal = hasOi ? top.reduce((s, r) => s + (r.operatingIncome?.[L] ?? 0), 0) : null;
  const noun = b.axis === "geography" ? "Region" : b.axis === "product" ? "Product line" : "Segment";
  return (
    <>
      {overlap && <Card><Note>This company tags subtotals and their components on the same axis in a way that could not be separated, so the lines below overlap and their shares add up to more than 100%. Figures are as filed.</Note></Card>}
      <div className="grid gap-3.5 lg:grid-cols-2">
        <Card title={`Revenue by ${noun.toLowerCase()}`} unit="$ billions, fiscal years"><div className="px-3 pb-3"><Plot fig={figSegments(b, !overlap)} height={300} /></div></Card>
        {hasOi
          ? <Card title="Segment operating margin" unit="Operating income / revenue"><div className="px-3 pb-3"><Plot fig={figSegmentMargins(b)} height={300} /></div></Card>
          : <Card title="Mix" unit={`${fy(b.years[L])} share of revenue`}>
              <div className="px-5 pb-5">{top.map((r) => {
                const s = ok(r.revenue[L]) && ok(b.total[L]) ? r.revenue[L]! / b.total[L]! : null;
                return <div key={r.member} className="mb-2"><div className="flex justify-between text-[13px]"><span>{r.label}</span><span>{overlap ? "—" : fP(s)}</span></div>
                  <div className="mt-1 h-1.5 rounded bg-[var(--line)]"><div className="h-1.5 rounded bg-[var(--c1)]" style={{ width: `${Math.min(100, (s ?? 0) * 100)}%` }} /></div></div>;
              })}</div>
            </Card>}
      </div>
      <Card title={`${noun} detail`} unit="USD millions">
        <Tw>
          <table className="t dense">
            <thead><tr><th className="sticky-col">{noun}</th>{b.years.map((y) => <th key={y}>{fy(y)}</th>)}<th>YoY</th><th>{n - 1}-yr CAGR</th><th>Share</th>{hasOi && <><th>Op. income</th><th>Margin</th></>}</tr></thead>
            <tbody>
              {b.rows.map((r) => {
                const oi = r.operatingIncome?.[L] ?? null, rev = r.revenue[L];
                return (
                  <tr key={r.member} className={r.parent ? "sub" : ""}>
                    <td className="sticky-col">{r.parent ? <span className="pl-4">{r.label}</span> : r.label}</td>
                    {r.revenue.map((v, i) => <td key={i}>{mil(v)}</td>)}
                    <td className={cls(growth(rev, r.revenue[L - 1]))}>{fP(growth(rev, r.revenue[L - 1]), 1, true)}</td>
                    <td className={cls(cagr(rev, r.revenue[0], n - 1))}>{fP(cagr(rev, r.revenue[0], n - 1), 1, true)}</td>
                    <td>{overlap ? "—" : fP(ok(rev) && ok(b.total[L]) ? rev / b.total[L]! : null)}</td>
                    {hasOi && <><td>{mil(oi)}</td><td>{fP(ok(oi) && ok(rev) && rev ? oi / rev : null)}</td></>}
                  </tr>
                );
              })}
              <tr className="tot">
                <td className="sticky-col">Consolidated revenue</td>{b.total.map((v, i) => <td key={i}>{mil(v)}</td>)}
                <td className={cls(growth(b.total[L], b.total[L - 1]))}>{fP(growth(b.total[L], b.total[L - 1]), 1, true)}</td>
                <td className={cls(cagr(b.total[L], b.total[0], n - 1))}>{fP(cagr(b.total[L], b.total[0], n - 1), 1, true)}</td><td>100.0%</td>
                {hasOi && <><td>{mil(oiTotal)}</td><td>{fP(ok(oiTotal) && ok(b.total[L]) ? oiTotal / b.total[L]! : null)}</td></>}
              </tr>
            </tbody>
          </table>
        </Tw>
        <Note>
          {b.restated && "The company changed how it reports this breakdown; earlier years filed under the old structure are not mixed in. "}
          Read from the XBRL instance of each 10-K (concept {b.concept}{b.operatingConcept ? ` and ${b.operatingConcept}` : ""}), full fiscal years only.
          Where a later 10-K recasts earlier years, the recast figures are used. Segment operating income excludes corporate costs and eliminations.
        </Note>
      </Card>
    </>
  );
}
