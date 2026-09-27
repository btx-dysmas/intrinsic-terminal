"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Content, TitleBar } from "@/components/Shell";
import { Card, Note, Tw } from "@/components/ui";
import { cls, fB, fN, fP, fX, ok, quant } from "@/lib/format";
import universe from "@/data/universe.json";

type Col = [key: string, label: string, fmt: (r: any) => string, align?: "l"];
const COLS: Col[] = [
  ["ticker", "Ticker", (r) => r.ticker], ["name", "Company", (r) => String(r.name).slice(0, 26), "l"], ["group", "Peer group", (r) => r.group.replace(" & Diversified Financials", ""), "l"],
  ["mcap", "Mkt cap", (r) => fB(r.mcap)], ["rev", "Revenue LTM", (r) => fB(r.rev)], ["ltmGrowth", "Rev growth", (r) => fP(r.ltmGrowth)], ["cagr3", "3Y CAGR", (r) => fP(r.cagr3)],
  ["om", "EBIT margin", (r) => fP(r.om)], ["nm", "Net margin", (r) => fP(r.nm)], ["roe", "ROE", (r) => fP(r.roe)], ["roic", "ROIC", (r) => fP(r.roic)],
  ["pe", "P/E LTM", (r) => fX(r.pe)], ["fpe", "P/E NTM", (r) => fX(r.fpe)], ["evEbitda", "EV/EBITDA", (r) => fX(r.evEbitda)], ["pb", "P/B", (r) => fX(r.pb)],
  ["divYld", "Div yield", (r) => fP(r.divYld, 2)], ["r1", "1Y TR", (r) => fP(r.r1y?.cum, 1, true)], ["vol", "Vol 1Y", (r) => fP(r.r1y?.vol)], ["up", "Street upside", (r) => fP(r.street?.up, 0, true)],
];
const val = (r: any, k: string) => ({ r1: r.r1y?.cum, vol: r.r1y?.vol, up: r.street?.up } as any)[k] ?? r[k];
const HEAT = ["ltmGrowth", "cagr3", "om", "nm", "roe", "roic", "r1", "up"];
const CMP: [string, (r: any) => string][] = [
  ["Market cap", (r) => fB(r.mcap)], ["Revenue (LTM)", (r) => fB(r.rev)], ["Revenue growth (LTM)", (r) => fP(r.ltmGrowth)], ["3-yr revenue CAGR", (r) => fP(r.cagr3)], ["Gross margin", (r) => fP(r.gm)],
  ["Operating margin", (r) => fP(r.om)], ["Net margin", (r) => fP(r.nm)], ["Return on equity", (r) => fP(r.roe)], ["Return on invested capital", (r) => fP(r.roic)],
  ["Debt / equity", (r) => (ok(r.de) ? `${r.de.toFixed(2)}x` : "n.m.")], ["Net debt / EBITDA", (r) => (ok(r.ndEbitda) ? `${r.ndEbitda.toFixed(2)}x` : "n.m.")],
  ["P/E (LTM)", (r) => fX(r.pe)], ["P/E (NTM)", (r) => fX(r.fpe)], ["EV / EBITDA", (r) => fX(r.evEbitda)], ["Price / book", (r) => fX(r.pb)], ["FCF yield", (r) => fP(r.fcfYld)],
  ["Dividend yield", (r) => fP(r.divYld, 2)], ["1-yr total return", (r) => fP(r.r1y?.cum, 1, true)], ["1-yr volatility", (r) => fP(r.r1y?.vol)], ["3-yr Sharpe", (r) => fN(r.r3y?.sharpe, 2)], ["Beta", (r) => fN(r.beta, 2)], ["Street upside", (r) => fP(r.street?.up, 0, true)],
];

export default function Screener() {
  const u: any = universe;
  const router = useRouter();
  const [group, setGroup] = useState("All");
  const [sort, setSort] = useState<[string, number]>(["mcap", -1]);
  const [sel, setSel] = useState<string[]>(["AAPL", "MSFT", "GOOGL", "META"]);
  const rows = useMemo(() => {
    const rs = (u?.rows ?? []).filter((r: any) => group === "All" || r.group === group);
    const [k, dir] = sort;
    return [...rs].sort((a: any, b: any) => {
      const x = val(a, k), y = val(b, k);
      if (typeof x === "string") return x.localeCompare(y) * dir;
      return ((ok(x) ? x : -Infinity) - (ok(y) ? y : -Infinity)) * dir;
    });
  }, [u, group, sort]);
  const heat = useMemo(() => Object.fromEntries(HEAT.map((k) => { const v = rows.map((r: any) => val(r, k)); return [k, { lo: quant(v, 0.2), hi: quant(v, 0.8) }]; })), [rows]);
  const chosen = sel.map((t) => (u?.rows ?? []).find((r: any) => r.ticker === t)).filter(Boolean);
  return (
    <>
      <TitleBar title="Peer screener" back="/" sub={<span>Featured universe · sort, filter and compare</span>} />
      <Content>
        {!u.rows.length ? <div className="card px-5 py-8 text-center text-ink-3">Run npm run universe to build the featured-company snapshot.</div> : <>
          <Card title="Universe screen" unit={`(${rows.length} companies; click a column to sort, tick to compare, click a name to open)`}
            right={<span className="inline-block"><select className="fsel min-w-[220px]" aria-label="Filter by peer group" value={group} onChange={(e) => setGroup(e.target.value)}>{["All", ...Object.keys(u.groups)].map((g) => <option key={g}>{g}</option>)}</select></span>}>
            <Tw>
              <table className="t dense">
                <thead><tr><th>Cmp</th>{COLS.map(([k, l]) => <th key={k} className="cursor-pointer select-none hover:text-accent" onClick={() => setSort(([sk, sd]) => [k, sk === k ? -sd : ["ticker", "name", "group"].includes(k) ? 1 : -1])}>{l}{sort[0] === k ? (sort[1] > 0 ? " ▲" : " ▼") : ""}</th>)}</tr></thead>
                <tbody>
                  {rows.map((r: any) => (
                    <tr key={r.ticker}>
                      <td className="c"><input type="checkbox" aria-label={`Compare ${r.ticker}`} checked={sel.includes(r.ticker)} onChange={(e) => setSel((s) => (e.target.checked ? [...s, r.ticker] : s.filter((x) => x !== r.ticker)))} /></td>
                      {COLS.map(([k, , f, al]) => {
                        const v = val(r, k), h = (heat as any)[k];
                        const bg = h && ok(v) ? (v >= h.hi ? "bg-pos-soft" : v <= h.lo ? "bg-neg-soft" : "") : "";
                        return <td key={k} className={`${al ?? ""} ${bg} ${k === "ticker" || k === "name" ? "cursor-pointer" : ""}`} onClick={k === "ticker" || k === "name" ? () => router.push(`/company/${r.ticker}`) : undefined}>{k === "ticker" ? <b className="text-c1">{f(r)}</b> : f(r)}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </Tw>
            <Note>Growth, margin, return and upside columns are shaded for the top (green) and bottom (red) quintile of the current screen.</Note>
          </Card>
          <Card title="Side-by-side comparison" unit={`(${chosen.length} selected)`}>
            {chosen.length ? (
              <Tw>
                <table className="t dense">
                  <thead><tr><th>Metric</th>{chosen.map((r: any) => <th key={r.ticker}>{r.ticker}</th>)}</tr></thead>
                  <tbody>{CMP.map(([l, f]) => <tr key={l}><td>{l}</td>{chosen.map((r: any) => <td key={r.ticker} className={l.includes("return") || l.includes("upside") ? cls(val(r, l.includes("upside") ? "up" : "r1")) : ""}>{f(r)}</td>)}</tr>)}</tbody>
                </table>
              </Tw>
            ) : <div className="px-6 pb-6 text-ink-3">Tick companies in the screen to compare them here.</div>}
          </Card>
        </>}
      </Content>
    </>
  );
}
