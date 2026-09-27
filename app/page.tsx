"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import Plot from "@/components/Plot";
import { Content, Section, TitleBar } from "@/components/Shell";
import { Card, Delta, ErrorCard, Kpi } from "@/components/ui";
import { figGroupPE, figGroupReturn } from "@/lib/charts";
import { cls, dLong, fB, fD, fN, fP, fX, median, ok } from "@/lib/format";
import universe from "@/data/universe.json";

const TOOLS: [string, string, string][] = [
  ["/portfolio", "Portfolio builder", "Weights, position sizing, risk metrics and sector exposure"],
  ["/retirement", "Retirement simulator", "Monte Carlo probability that savings last"],
  ["/macro", "Macro & regime", "Economic regime, yield curve and portfolio implications"],
  ["/screener", "Peer screener", "Every metric side by side, with comparison"],
];

const CAPS: [string, string, (m: number) => boolean][] = [
  ["all", "All market caps", () => true],
  ["t", "Over $1 trillion", (m) => m >= 1e12],
  ["large", "$200B to $1T", (m) => m >= 200e9 && m < 1e12],
  ["mid", "Under $200B", (m) => m < 200e9],
];

type Row = { ticker: string; name: string; group: string; price: number; prev: number; mcap: number; pe: number | null; fin: boolean; spark: number[]; evEbitda?: number | null; r1y?: { cum: number }; street?: { target: number; up: number; n: number } };
const SORTS: [string, string, (a: Row, b: Row) => number][] = [
  ["group", "Peer group", () => 0],
  ["r1y", "1-year return", (a, b) => (b.r1y?.cum ?? -9) - (a.r1y?.cum ?? -9)],
  ["up", "Street upside", (a, b) => (b.street?.up ?? -9) - (a.street?.up ?? -9)],
  ["pe", "P/E, low to high", (a, b) => (a.pe != null && a.pe > 0 ? a.pe : 1e9) - (b.pe != null && b.pe > 0 ? b.pe : 1e9)],
  ["mcap", "Market cap", (a, b) => b.mcap - a.mcap],
  ["ticker", "Ticker", (a, b) => a.ticker.localeCompare(b.ticker)],
];

function Spark({ c }: { c: number[] }) {
  if (!c || c.length < 5) return null;
  const w = 84, h = 22, mn = Math.min(...c), mx = Math.max(...c);
  const pts = c.map((v, i) => `${((i / (c.length - 1)) * w).toFixed(1)},${(h - 2 - ((v - mn) / (mx - mn || 1)) * (h - 4)).toFixed(1)}`).join(" ");
  return <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" className="inline-block"><polyline fill="none" stroke={c[c.length - 1] >= c[0] ? "var(--pos)" : "var(--neg)"} strokeWidth={1.3} points={pts} /></svg>;
}

export default function Home() {
  const router = useRouter();
  const u = universe.rows.length ? (universe as unknown as { rows: Row[]; groups: Record<string, string[]>; asOf: string; bench: { last: number; prev: number; r1y: number } }) : null;
  const rows = useMemo(() => u?.rows ?? [], [u]);
  const groups = useMemo(() => Object.keys(u?.groups ?? {}), [u]);
  const [q, setQ] = useState("");
  const [find, setFind] = useState("");
  const [group, setGroup] = useState("all");
  const [cap, setCap] = useState("all");
  const [sort, setSort] = useState("group");
  const open = (t: string) => router.push(`/company/${encodeURIComponent(t.trim().toUpperCase().replace(".", "-"))}`);

  const shown = useMemo(() => {
    const f = find.trim().toLowerCase();
    const capTest = CAPS.find((c) => c[0] === cap)![2];
    const list = rows.filter((r) => (group === "all" || r.group === group) && capTest(r.mcap) && (!f || r.ticker.toLowerCase().includes(f) || r.name.toLowerCase().includes(f)));
    // "Peer group" keeps the curated order; every other sort is a flat ranking.
    if (sort === "group") return list.sort((a, b) => groups.indexOf(a.group) - groups.indexOf(b.group));
    return list.sort(SORTS.find((s) => s[0] === sort)![2]);
  }, [rows, find, group, cap, sort, groups]);

  const medR = median(rows.map((r) => r.r1y?.cum)), medPE = median(rows.map((r) => r.pe)), medEV = median(rows.map((r) => r.evEbitda)), medUp = median(rows.map((r) => r.street?.up));
  const b = u?.bench;
  const filtered = find || group !== "all" || cap !== "all";

  return (
    <>
      <TitleBar
        title="Coverage universe"
        sub={<><span>{rows.length} featured companies in {groups.length} peer groups</span>{u?.asOf && <span>Prices as of {dLong(u.asOf)}</span>}<span>Benchmark: S&amp;P 500 (SPY), total return</span></>}
        filters={
          <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (q.trim()) open(q); }}>
            <label className="sr-only" htmlFor="analyze">Ticker to analyze</label>
            <input id="analyze" className="fsel h-[34px] w-[240px] bg-none text-[14px] uppercase placeholder:normal-case" style={{ backgroundImage: "none" }}
              placeholder="Any U.S. ticker, e.g. ORCL" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
            <button className="btn primary h-[34px] px-4 py-0" disabled={!q.trim()}>Analyze company →</button>
            <span className="text-[12px] text-ink-3">Press Enter · builds statements, a DCF and a research note from SEC filings</span>
          </form>
        }
      />
      <Content>
        <div className="kpis sm:grid-cols-2 xl:grid-cols-4">
          <Kpi title="S&P 500" unit="SPY, last close" value={fN(b?.last)} delta={<Delta v={b && ok(b.last) && ok(b.prev) ? b.last / b.prev - 1 : null} dp={2} vs="1 day" />} />
          <Kpi title="Coverage return" unit="Median 1-year total return" value={fP(medR, 1, true)} delta={<Delta v={ok(medR) && b && ok(b.r1y) ? medR - b.r1y : null} vs="vs S&P 500" />} />
          <Kpi title="Coverage P/E" unit="Median, trailing twelve months" value={fX(medPE)} delta={<Delta v={null} text={`EV/EBITDA ${fX(medEV)}`} vs="non-financials" />} />
          <Kpi title="Street upside" unit="Median, to mean price target" value={fP(medUp, 1, true)} delta={<Delta v={medUp} vs={`${rows.filter((r) => ok(r.street?.up)).length} covered`} />} />
        </div>

        {!u ? <ErrorCard title="No universe snapshot yet" message="Run npm run universe to build data/universe.json, then reload." /> : <>
          <Section>Companies</Section>
          <Card>
            <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
              <div className="relative">
                <svg viewBox="0 0 24 24" className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 fill-none stroke-[var(--ink-3)]" strokeWidth={2}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
                <input className="fsel w-[220px] bg-none pl-8" style={{ backgroundImage: "none" }} placeholder="Search companies…" aria-label="Search companies" value={find} onChange={(e) => setFind(e.target.value)} />
              </div>
              <select className="fsel" aria-label="Peer group" value={group} onChange={(e) => setGroup(e.target.value)}>
                <option value="all">All groups</option>
                {groups.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
              <select className="fsel" aria-label="Market cap" value={cap} onChange={(e) => setCap(e.target.value)}>
                {CAPS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
              <label className="flex items-center gap-1.5 text-[12.5px] text-ink-3">Sort
                <select className="fsel" aria-label="Sort by" value={sort} onChange={(e) => setSort(e.target.value)}>
                  {SORTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </label>
              <span className="ml-auto text-[12px] text-ink-3">
                {shown.length === rows.length ? `${rows.length} companies` : `${shown.length} of ${rows.length}`}
                {filtered && <button className="ml-2 text-accent hover:underline" onClick={() => { setFind(""); setGroup("all"); setCap("all"); }}>Clear</button>}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="t dense">
                <thead><tr><th>Ticker</th><th className="!text-left">Company</th><th className="!text-left">Group</th><th>Price</th><th>1D</th><th className="!text-center">12 months</th><th>1Y return</th><th>P/E</th><th>Mkt cap</th><th>Target</th><th>Upside</th></tr></thead>
                <tbody>
                  {shown.map((r) => {
                    const chg = ok(r.prev) ? r.price / r.prev - 1 : null;
                    return (
                      <tr key={r.ticker} className="click" tabIndex={0} onClick={() => open(r.ticker)} onKeyDown={(e) => e.key === "Enter" && open(r.ticker)} title={`Open ${r.name}`}>
                        <td><b className="text-c1">{r.ticker}</b></td>
                        <td className="l max-w-[220px] truncate">{r.name}</td>
                        <td className="l text-ink-3">{r.group}</td>
                        <td>{fD(r.price)}</td>
                        <td className={cls(chg)}>{fP(chg, 2, true)}</td>
                        <td className="c"><Spark c={r.spark} /></td>
                        <td className={cls(r.r1y?.cum)}>{fP(r.r1y?.cum, 1, true)}</td>
                        <td>{fX(r.pe)}</td>
                        <td>{fB(r.mcap)}</td>
                        <td className="text-ink-2">{fD(r.street?.target)}</td>
                        <td className={cls(r.street?.up)}>{fP(r.street?.up, 1, true)}</td>
                      </tr>
                    );
                  })}
                  {!shown.length && (
                    <tr><td colSpan={11} className="!py-8 !text-center text-ink-3">
                      No featured company matches.{find.trim() && <> <button className="text-accent hover:underline" onClick={() => open(find)}>Analyze “{find.trim().toUpperCase()}” directly</button>; any SEC-registered ticker works.</>}
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="note">Select a row to open the company. Target is the Street mean price target; P/E is trailing twelve months. Prices refresh each weekday after the close.</div>
          </Card>

          <Section>Peer groups</Section>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <Card title="1-year total return" unit="Median of constituents"><div className="px-2 pb-2"><Plot fig={figGroupReturn(rows, u.groups)} height={290} /></div></Card>
            <Card title="Price / earnings" unit="Median LTM P/E of constituents"><div className="px-2 pb-2"><Plot fig={figGroupPE(rows, u.groups)} height={290} /></div></Card>
          </div>
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-ink-3">
            <span>Also in Intrinsic:</span>
            {TOOLS.map(([href, t, d]) => <Link key={href} href={href} title={d} className="text-ink-2 underline decoration-line-2 underline-offset-2 hover:text-accent hover:decoration-accent">{t}</Link>)}
          </p>
        </>}
      </Content>
    </>
  );
}
