"use client";
import { useMemo, useState } from "react";
import Plot from "@/components/Plot";
import { Card, Note, Tw } from "@/components/ui";
import { figFootball } from "@/lib/charts";
import { useCompany } from "@/lib/company-context";
import { CURATED_TICKERS } from "@/lib/universe";
import { cls, fB, fD, fP, fX, median, ok, fPS } from "@/lib/format";
import { sensGrid } from "@/lib/models";

export default function Comps() {
  const { co, a, d, comp, peers, setPeers, addPeer, peersLoading } = useCompany();
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const fin = co.fin, med = (k: string) => comp.st[k].med;
  const K = fin ? ["pe", "fpe", "pb", "ptbv"] : ["pe", "fpe", "evEbitda", "evRev", "ps", "pb"];
  const KL: Record<string, string> = { pe: "P/E LTM", fpe: "P/E NTM", evEbitda: "EV / EBITDA", evRev: "EV / Revenue", ps: "P / Sales", pb: "P / Book", ptbv: "P / TBV" };
  const dp = (k: string) => (["evRev", "ps"].includes(k) ? 2 : 1);
  const fk = (c: any, k: string) => fX(c[k], dp(k)) + (k === "fpe" && c.fpeSrc === "model" && ok(c.fpe) ? "*" : "");
  const prem = (k: string) => (ok(co[k]) && co[k] > 0 && ok(med(k)) ? co[k] / med(k)! - 1 : null);
  const OP: [string, string, "p" | "x"][] = fin
    ? [["ltmGrowth", "Revenue growth", "p"], ["cagr3", "3-yr CAGR", "p"], ["nm", "Net margin", "p"], ["roe", "ROE", "p"], ["roa", "ROA", "p"], ["eqAssets", "Equity / assets", "p"]]
    : [["ltmGrowth", "Revenue growth", "p"], ["cagr3", "3-yr CAGR", "p"], ["gm", "Gross margin", "p"], ["om", "EBIT margin", "p"], ["nm", "Net margin", "p"], ["roe", "ROE", "p"], ["roic", "ROIC", "p"], ["de", "Debt / equity", "x"], ["ndEbitda", "Net debt / EBITDA", "x"]];
  const fo = (v: any, f: string) => (f === "p" ? fP(v) : ok(v) ? `${v.toFixed(2)}x` : "n.m.");
  const ff = useMemo(() => {
    const sg = d.valid ? sensGrid(co, a, d) : null;
    const inner = sg ? [1, 2, 3].flatMap((i) => [1, 2, 3].map((j) => sg.A[i][j])).filter(ok) : [];
    const rows: any[] = [];
    if (ok(co.lo52)) rows.push({ label: "52-week trading range", lo: co.lo52, hi: co.hi52, kind: "mkt" });
    if (ok(co.street.lo)) rows.push({ label: "Street price targets", lo: co.street.lo, hi: co.street.hi, kind: "street" });
    if (inner.length) rows.push({ label: `${fin ? "Residual income" : "DCF"} sensitivity`, lo: Math.min(...inner), hi: Math.max(...inner), kind: "model" });
    comp.implied.forEach((r: any) => rows.push({ label: `${r.label} (peer IQR)`, lo: r.lo, hi: r.hi, kind: "mult" }));
    return rows.filter((r) => ok(r.lo) && ok(r.hi) && r.hi > 0).map((r) => ({ ...r, lo: Math.max(0, r.lo) }));
  }, [co, a, d, comp, fin]);
  const suggestions = CURATED_TICKERS.filter((t) => t !== co.tk && !peers.includes(t));
  const onAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = q.trim().toUpperCase();
    if (!t) return;
    setMsg(`Retrieving ${t}…`);
    try {
      await addPeer(t);
      setMsg(null);
      setQ("");
    } catch (err: any) {
      setMsg(err.message);
    }
  };
  return (
    <>
      <Card title="Peer Set" unit="(add any U.S. ticker; click a peer to remove it)">
        <div className="flex flex-wrap items-center gap-1.5 px-6 pb-4.5">
          <span className="rounded-[14px] border border-accent bg-accent px-3 py-0.5 text-[13px] font-semibold text-white">{co.tk}</span>
          {peers.map((t) => (
            <button key={t} onClick={() => setPeers(peers.filter((p) => p !== t))} title={`Remove ${t}`} className="rounded-[14px] border border-accent bg-accent-soft px-3 py-0.5 text-[13px] font-semibold text-accent">
              {t} ×
            </button>
          ))}
          <form onSubmit={onAdd} className="ml-2 flex gap-1.5">
            <input list="peerList" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Add ticker" aria-label="Add peer ticker" className="w-28 rounded-[14px] border border-line-2 px-2.5 py-0.5 text-[13px] uppercase" />
            <datalist id="peerList">{suggestions.map((t) => <option key={t} value={t} />)}</datalist>
            <button className="btn py-0.5">Add</button>
          </form>
          {(msg || peersLoading) && <span className="text-[12.5px] text-ink-3">{msg ?? "Loading peers…"}</span>}
        </div>
      </Card>
      {!comp.ps.length ? (
        <div className="card px-6 py-8 text-center text-ink-3">{peersLoading ? "Loading peer data…" : "Add at least one peer to build the comparison."}</div>
      ) : (
        <>
          <Card title="Trading Multiples" unit="(LTM unless noted; NTM = next twelve months consensus)">
            <Tw>
              <table className="t dense">
                <thead><tr><th>Company</th><th>Market cap</th>{K.map((k) => <th key={k}>{KL[k]}</th>)}<th>{fin ? "Dividend yield" : "FCF yield"}</th><th>Street upside</th></tr></thead>
                <tbody>
                  {[co, ...comp.ps].map((c: any, i: number) => (
                    <tr key={c.tk} className={i === 0 ? "hl" : ""}>
                      <td><b className="text-c1">{c.tk}</b> <span className="text-[12.5px] text-ink-3">{String(c.name).slice(0, 26)}</span></td>
                      <td>{fB(c.mcap)}</td>{K.map((k) => <td key={k}>{fk(c, k)}</td>)}
                      <td>{fin ? fP(c.divYld, 2) : fP(c.fcfYld)}</td><td className={cls(c.street.up)}>{fP(c.street.up, 0, true)}</td>
                    </tr>
                  ))}
                  <tr className="tot"><td>Peer median</td><td />{K.map((k) => <td key={k}>{fX(med(k), dp(k))}</td>)}<td>{fin ? "" : fP(med("fcfYld"))}</td><td /></tr>
                  <tr className="hl"><td>{co.tk} premium / (discount)</td><td />{K.map((k) => <td key={k} className={cls(prem(k) == null ? null : -prem(k)!)}>{fP(prem(k), 0, true)}</td>)}<td /><td /></tr>
                </tbody>
              </table>
            </Tw>
            <Note>* Model-derived where no consensus EPS is available: LTM earnings grown at the 3-year revenue CAGR. Multiples above 999x or on negative denominators show as n.m.{fin && " EV-based multiples are not meaningful for financial institutions."}</Note>
          </Card>
          <Card title="Operating Benchmarking" unit="(LTM)">
            <Tw>
              <table className="t dense">
                <thead><tr><th>Company</th><th>Revenue</th>{OP.map(([k, l]) => <th key={k}>{l}</th>)}</tr></thead>
                <tbody>
                  {[co, ...comp.ps].map((c: any, i: number) => (
                    <tr key={c.tk} className={i === 0 ? "hl" : ""}><td><b className="text-c1">{c.tk}</b></td><td>{fB(c.L.rev)}</td>{OP.map(([k, , f]) => <td key={k}>{fo(c[k], f)}</td>)}</tr>
                  ))}
                  <tr className="tot"><td>Peer median</td><td />{OP.map(([k, , f]) => <td key={k}>{fo(median(comp.ps.map((p: any) => p[k])), f)}</td>)}</tr>
                </tbody>
              </table>
            </Tw>
          </Card>
          <div className="grid gap-3.5 xl:grid-cols-2">
            <Card title="Implied Value per Share" unit={`($, peer multiples applied to ${co.tk})`}>
              <Tw>
                <table className="t dense">
                  <thead><tr><th>Method</th><th>Peer median</th><th>25th pct</th><th>Median</th><th>75th pct</th><th>vs price</th></tr></thead>
                  <tbody>
                    {comp.implied.map((r: any) => (
                      <tr key={r.label}><td>{r.label}</td><td>{fX(r.med, 2)}</td><td>{fD(r.lo)}</td><td><b>{fD(r.mid)}</b></td><td>{fD(r.hi)}</td><td className={cls(r.mid / co.price - 1)}>{fP(r.mid / co.price - 1, 0, true)}</td></tr>
                    ))}
                    <tr className="tot"><td>{fin ? "Residual income" : "DCF"} (base case)</td><td /><td /><td>{fPS(d.ps)}</td><td /><td className={cls(d.up)}>{fP(d.up, 0, true)}</td></tr>
                    {ok(co.street.target) && <tr><td>Street mean target</td><td /><td>{fD(co.street.lo)}</td><td>{fD(co.street.target)}</td><td>{fD(co.street.hi)}</td><td className={cls(co.street.up)}>{fP(co.street.up, 0, true)}</td></tr>}
                  </tbody>
                </table>
              </Tw>
            </Card>
            <Card title="Valuation Summary" unit="($ per share; dashed line = current price)">
              <div className="px-3 pb-3"><Plot fig={figFootball(co, ff)} height={70 + ff.length * 40} /></div>
            </Card>
          </div>
        </>
      )}
    </>
  );
}
