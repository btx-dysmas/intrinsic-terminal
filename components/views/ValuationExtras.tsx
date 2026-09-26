"use client";
import { useMemo, useState } from "react";
import Plot from "@/components/Plot";
import { Card, Note, Seg } from "@/components/ui";
import type { Co } from "@/lib/api";
import { figValBand } from "@/lib/charts";
import { fD, fP, ok } from "@/lib/format";
import { valuationHistory } from "@/lib/history";

/** Price against fair value, with a buy-below price for a chosen margin of safety. */
export function MarginOfSafety({ price, fair, label }: { price: number; fair: number | null; label: string }) {
  const [req, setReq] = useState(25);
  if (!ok(fair)) return null;
  const mos = 1 - price / fair, buyBelow = fair * (1 - req / 100);
  const hi = Math.max(price, fair) * 1.15, pos = (v: number) => `${Math.min(100, (v / hi) * 100)}%`;
  return (
    <Card title="Margin of safety" unit={`Price against ${label}`}>
      <div className="grid gap-4 px-5 pb-5 sm:grid-cols-3">
        <div><div className="card-sub">Fair value</div><div className="text-[22px] font-semibold text-ink">{fD(fair)}</div></div>
        <div>
          <div className="card-sub">Current margin of safety</div>
          {mos >= 0
            ? <div className="text-[22px] font-semibold text-pos">{fP(mos, 1)}</div>
            : <><div className="text-[22px] font-semibold text-neg">None</div><div className="text-[12.5px] text-ink-3">Price is {fP(price / fair - 1, 0)} above fair value</div></>}
        </div>
        <div><div className="card-sub">Buy below ({req}% margin)</div><div className="text-[22px] font-semibold text-ink">{fD(buyBelow)}</div></div>
      </div>
      <div className="px-5 pb-2">
        <div className="relative h-2.5 rounded-sm bg-line">
          <span className="absolute top-0 bottom-0 left-0 rounded-sm bg-[var(--c2)] opacity-60" style={{ width: pos(buyBelow) }} />
          <span className="absolute -top-1.5 h-5 w-0.5 bg-ink" style={{ left: pos(price) }} title={`Price ${fD(price)}`} />
          <span className="absolute -top-1.5 h-5 w-0.5 bg-[var(--c1)]" style={{ left: pos(fair) }} title={`Fair value ${fD(fair)}`} />
        </div>
        <div className="mt-1.5 flex flex-wrap gap-x-5 text-[12px] text-ink-3">
          <span><i className="mr-1 inline-block h-2.5 w-0.5 bg-ink align-middle" />Price {fD(price)}</span>
          <span><i className="mr-1 inline-block h-2.5 w-0.5 bg-[var(--c1)] align-middle" />Fair value {fD(fair)}</span>
          <span><i className="mr-1 inline-block h-2.5 w-3 bg-[var(--c2)] opacity-60 align-middle" />Buy zone</span>
        </div>
      </div>
      <label className="flex items-center gap-3 px-5 pt-2 pb-4 text-[13px] text-ink-2">
        Required margin
        <input type="range" min={0} max={50} step={5} value={req} onChange={(e) => setReq(+e.target.value)} className="flex-1 accent-[var(--c1)]" aria-label="Required margin of safety" />
        <b className="w-10 text-right text-ink">{req}%</b>
      </label>
    </Card>
  );
}

/** How today's multiples compare with the company's own history. */
export function ValuationBands({ co }: { co: Co }) {
  const bands = useMemo(() => valuationHistory(co), [co]);
  const [key, setKey] = useState<string | null>(null);
  if (!bands.length) return null;
  const b = bands.find((x) => x.key === key) ?? bands[0];
  const read = b.z > 1 ? "expensive against its own history" : b.z < -1 ? "cheap against its own history" : "within its normal range";
  return (
    <Card title="Historical valuation" unit={`${b.label} since ${b.x[0].slice(0, 7)} · shaded band = average ±1 standard deviation`} right={<Seg value={b.key} options={bands.map((x) => [x.key, x.label] as [string, string])} onChange={setKey} />}>
      <div className="px-5 text-[13.5px] text-ink-2">
        Currently <b className="text-ink">{b.now.toFixed(1)}x</b> against an average of <b className="text-ink">{b.avg.toFixed(1)}x</b> ({b.z >= 0 ? "+" : ""}{b.z.toFixed(1)} standard deviations): {read}.
      </div>
      <div className="px-2 pb-1"><Plot fig={figValBand(b)} height={260} /></div>
      <Note>Each point divides the market value on that day by the trailing twelve-month figure from filings public at the time (quarter end plus 45 days).</Note>
    </Card>
  );
}
