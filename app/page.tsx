"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Plot from "@/components/Plot";
import { Content, Filter, Section, TitleBar } from "@/components/Shell";
import { Card, Delta, ErrorCard, Kpi, Tw } from "@/components/ui";
import { figGroupPE, figGroupReturn } from "@/lib/charts";
import { cls, dLong, fB, fD, fN, fP, fX, median, ok } from "@/lib/format";
import universe from "@/data/universe.json";

const TOOLS: [string, string, string][] = [
  ["/portfolio", "Portfolio builder", "Weights, position sizing, risk metrics and sector exposure"],
  ["/retirement", "Retirement simulator", "Monte Carlo probability that savings last"],
  ["/macro", "Macro & regime", "Economic regime, yield curve and portfolio implications"],
  ["/screener", "Peer screener", "Sort and compare the coverage universe"],
];

function Spark({ c }: { c: number[] }) {
  if (!c || c.length < 5) return null;
  const w = 96, h = 24, mn = Math.min(...c), mx = Math.max(...c);
  const pts = c.map((v, i) => `${((i / (c.length - 1)) * w).toFixed(1)},${(h - 2 - ((v - mn) / (mx - mn || 1)) * (h - 4)).toFixed(1)}`).join(" ");
  return <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" className="inline-block"><polyline fill="none" stroke={c[c.length - 1] >= c[0] ? "var(--pos)" : "var(--neg)"} strokeWidth={1.4} points={pts} /></svg>;
}

export default function Home() {
  const router = useRouter();
  const u: any = universe.rows.length ? universe : null;
  const [q, setQ] = useState("");
  const go = (t: string) => t.trim() && router.push(`/company/${encodeURIComponent(t.trim().toUpperCase().replace(".", "-"))}`);
  const rows: any[] = u?.rows ?? [];
  const by = (tk: string) => rows.find((r) => r.ticker === tk);
  const medR = median(rows.map((r) => r.r1y?.cum)), medPE = median(rows.map((r) => r.pe)), medEV = median(rows.map((r) => r.evEbitda)), medUp = median(rows.map((r) => r.street?.up));
  const b = u?.bench;
  return (
    <>
      <TitleBar
        title="Coverage universe"
        sub={<><span>{rows.length} featured companies</span>{u?.asOf && <span>Prices as of {dLong(u.asOf)}</span>}<span>Any SEC-registered U.S. ticker can be analyzed</span></>}
        filters={<>
          <Filter label="Ticker">
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); go(q); }}>
              <input className="fsel w-[150px] bg-none uppercase placeholder:normal-case" style={{ backgroundImage: "none" }} placeholder="e.g. ORCL" aria-label="Ticker" value={q} onChange={(e) => setQ(e.target.value)} />
              <button className="btn primary h-[30px] py-0">Analyze</button>
            </form>
          </Filter>
          <Filter label="Peer group">
            <select className="fsel min-w-[230px]" defaultValue="" onChange={(e) => document.getElementById(`g-${e.target.value}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}>
              <option value="" disabled>Jump to group</option>
              {Object.keys(u?.groups ?? {}).map((g) => <option key={g} value={g.replace(/\W+/g, "")}>{g}</option>)}
            </select>
          </Filter>
          <Filter label="Benchmark"><span className="flex h-[30px] items-center text-[13px] text-ink-2">S&amp;P 500 (SPY), total return</span></Filter>
        </>}
      />
      <Content>
        <div className="kpis sm:grid-cols-2 xl:grid-cols-4">
          <Kpi title="S&P 500" unit="SPY, last close" value={fN(b?.last)} delta={<Delta v={ok(b?.last) && ok(b?.prev) ? b.last / b.prev - 1 : null} dp={2} vs="1 day" />} />
          <Kpi title="Coverage return" unit="Median 1-year total return" value={fP(medR, 1, true)} delta={<Delta v={ok(medR) && ok(b?.r1y) ? medR - b.r1y : null} vs="vs S&P 500" />} />
          <Kpi title="Coverage P/E" unit="Median, trailing twelve months" value={fX(medPE)} delta={<Delta v={null} text={`EV/EBITDA ${fX(medEV)}`} vs="non-financials" />} />
          <Kpi title="Street upside" unit="Median, to mean price target" value={fP(medUp, 1, true)} delta={<Delta v={medUp} vs={`${rows.filter((r) => ok(r.street?.up)).length} covered`} />} />
        </div>
        <p className="-mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-ink-3">
          <span>Also in Intrinsic:</span>
          {TOOLS.map(([href, t, d]) => <Link key={href} href={href} title={d} className="text-ink-2 underline decoration-line-2 underline-offset-2 hover:text-accent hover:decoration-accent">{t}</Link>)}
        </p>
        {!u ? <ErrorCard title="No universe snapshot yet" message="Run npm run universe to build data/universe.json, then reload." /> : <>
          <Section>Peer groups</Section>
          <div className="grid gap-3.5 xl:grid-cols-2">
            <Card title="1-year total return" unit="Median of constituents"><div className="px-2 pb-2"><Plot fig={figGroupReturn(rows, u.groups)} height={290} /></div></Card>
            <Card title="Price / earnings" unit="Median LTM P/E of constituents"><div className="px-2 pb-2"><Plot fig={figGroupPE(rows, u.groups)} height={290} /></div></Card>
          </div>
          <Section>Universe</Section>
          <Card title="Featured companies" unit={`Grouped by peer set · prices as of ${dLong(u.asOf)}`}>
            <Tw>
              <table className="t dense">
                <thead><tr><th>Ticker</th><th>Company</th><th>Price</th><th>1D</th><th>1Y trend</th><th>Mkt cap</th><th>P/E<br />LTM</th><th>P/E<br />NTM</th><th>EV/EBITDA<br />(P/B for financials)</th><th>1Y total<br />return</th><th>Street<br />upside</th></tr></thead>
                <tbody>
                  {Object.entries(u.groups as Record<string, string[]>).map(([g, tks]) => (
                    <FragmentRows key={g} id={`g-${g.replace(/\W+/g, "")}`} title={g}>
                      {tks.map((t) => {
                        const r = by(t);
                        if (!r) return <tr key={t}><td><b className="text-c1">{t}</b></td><td className="l text-ink-3" colSpan={10}>Loading…</td></tr>;
                        const chg = ok(r.prev) ? r.price / r.prev - 1 : null;
                        return (
                          <tr key={t} className="click" onClick={() => go(t)}>
                            <td><b className="text-c1">{t}</b></td><td className="l">{r.name}</td><td>{fD(r.price)}</td><td className={cls(chg)}>{fP(chg, 2, true)}</td>
                            <td className="c"><Spark c={r.spark} /></td><td>{fB(r.mcap)}</td><td>{fX(r.pe)}</td><td>{fX(r.fpe)}</td><td>{r.fin ? fX(r.pb) : fX(r.evEbitda)}</td>
                            <td className={cls(r.r1y?.cum)}>{fP(r.r1y?.cum, 1, true)}</td><td className={cls(r.street?.up)}>{fP(r.street?.up, 0, true)}</td>
                          </tr>
                        );
                      })}
                    </FragmentRows>
                  ))}
                </tbody>
              </table>
            </Tw>
          </Card>
        </>}
      </Content>
    </>
  );
}

function FragmentRows({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <>
      <tr className="sec" id={id}><td colSpan={11}>{title}</td></tr>
      {children}
    </>
  );
}
