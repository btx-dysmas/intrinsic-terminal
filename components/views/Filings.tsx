"use client";
import { useEffect, useState } from "react";
import { Card, ErrorCard, KV, Note, Tw } from "@/components/ui";
import { api } from "@/lib/api";
import { useCompany } from "@/lib/company-context";
import { dLong, fB, fD, monthName, ok } from "@/lib/format";

const FORM_DESC: Record<string, string> = {
  "10-K": "Annual report", "10-Q": "Quarterly report", "8-K": "Current report", "DEF 14A": "Proxy statement",
  "10-K/A": "Annual report (amended)", "10-Q/A": "Quarterly report (amended)", "S-1": "Registration statement", "S-3": "Shelf registration",
};

function useApi<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    setData(null);
    setErr(null);
    api<T>(path).then(setData).catch((e) => setErr(e.message));
  }, [path]);
  return { data, err };
}

function Insiders({ tk }: { tk: string }) {
  const { data, err } = useApi<any[]>(`/company/${tk}/insiders`);
  if (err) return <div className="px-5 pb-5"><ErrorCard title="Insider filings unavailable" message={err} /></div>;
  if (!data) return <div className="px-5 pb-6 text-ink-3">Reading recent Form 4 filings from EDGAR…</div>;
  if (!data.length) return <div className="px-5 pb-6 text-ink-3">No Form 4 transactions in the most recent filings.</div>;
  // Six months back from the most recent filing, so the window does not depend on today's date.
  const latest = data.reduce((m, t) => ((t.date ?? t.filed) > m ? t.date ?? t.filed : m), "");
  const cut = new Date(Date.parse(latest) - 182 * 864e5).toISOString().slice(0, 10);
  const recent = data.filter((t) => (t.date ?? t.filed) >= cut);
  const flow = (code: string) => recent.filter((t) => t.code === code).reduce((s, t) => s + (t.shares ?? 0) * (t.price ?? 0), 0);
  const buys = flow("P"), sells = flow("S");
  return (
    <>
      <div className="grid gap-4 px-5 pb-3 sm:grid-cols-3">
        <div><div className="card-sub">Open-market buys, 6 months</div><div className="text-[20px] font-semibold text-pos">{fB(buys)}</div></div>
        <div><div className="card-sub">Open-market sales, 6 months</div><div className="text-[20px] font-semibold text-neg">{fB(sells)}</div></div>
        <div><div className="card-sub">Net insider flow</div><div className={`text-[20px] font-semibold ${buys - sells >= 0 ? "text-pos" : "text-neg"}`}>{fB(buys - sells)}</div></div>
      </div>
      <Tw>
        <table className="t dense">
          <thead><tr><th>Insider</th><th>Role</th><th>Date</th><th>Transaction</th><th>Shares</th><th>Price</th><th>Value</th><th>Owned after</th></tr></thead>
          <tbody>
            {data.slice(0, 30).map((t, i) => (
              <tr key={i}>
                <td className="l"><a href={t.url} target="_blank" rel="noopener noreferrer" className="hover:underline">{t.owner}</a></td>
                <td className="l text-ink-2">{t.role || "—"}</td>
                <td>{dLong(t.date ?? t.filed)}</td>
                <td className={`l ${t.code === "P" ? "text-pos" : t.code === "S" ? "text-neg" : "text-ink-2"}`}>{t.type}</td>
                <td>{ok(t.shares) ? `${t.acquired ? "+" : "-"}${Math.round(t.shares).toLocaleString("en-US")}` : "—"}</td>
                <td>{fD(t.price)}</td>
                <td>{ok(t.shares) && ok(t.price) ? fB(t.shares * t.price) : "—"}</td>
                <td>{ok(t.after) ? Math.round(t.after).toLocaleString("en-US") : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Tw>
      <Note>From the 25 most recent Form 4 filings. Open-market purchases (code P) and sales (S) are the signal most analysts watch; grants, option exercises and tax withholding are routine compensation events.</Note>
    </>
  );
}

function Headlines({ tk }: { tk: string }) {
  const { data } = useApi<any[]>(`/company/${tk}/news`);
  if (!data?.length) return <div className="px-5 pb-5 text-[13px] text-ink-3">{data ? "No recent headlines." : "Loading headlines…"}</div>;
  return (
    <ul className="px-5 pb-4">
      {data.map((n, i) => (
        <li key={i} className="border-b border-line py-2 last:border-0">
          <a href={n.link} target="_blank" rel="noopener noreferrer" className="text-[13.5px] text-ink hover:text-accent hover:underline">{n.title}</a>
          {n.date && <div className="text-[11.5px] text-ink-3">{new Date(n.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>}
        </li>
      ))}
    </ul>
  );
}

export default function Filings() {
  const { co } = useCompany();
  const filings = useApi<any[]>(`/company/${co.tk}/filings`);
  const cik10 = String(co.raw.cik).padStart(10, "0");
  return (
    <>
      <Card title="Insider transactions" unit="SEC Form 4">
        <Insiders tk={co.tk} />
      </Card>
      <div className="grid gap-3.5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card title="Recent filings" unit="10-K, 10-Q, 8-K and proxy statements">
          {filings.err ? <div className="px-5 pb-5"><ErrorCard title="Filings unavailable" message={filings.err} /></div> : !filings.data ? <div className="px-5 pb-6 text-ink-3">Loading filings…</div> : (
            <Tw>
              <table className="t dense">
                <thead><tr><th>Form</th><th>Description</th><th>Filed</th><th>Accession number</th><th>Links</th></tr></thead>
                <tbody>
                  {filings.data.map((f) => (
                    <tr key={f.accession}>
                      <td><b className="text-c1">{f.form}</b></td>
                      <td className="l">{FORM_DESC[f.form] ?? f.description}</td>
                      <td>{dLong(f.date)}</td>
                      <td className="font-mono text-[12px]">{f.accession}</td>
                      <td className="space-x-3">
                        {f.doc && <a href={f.doc} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">Document</a>}
                        <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">Index</a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Tw>
          )}
        </Card>
        <div className="grid content-start gap-3.5">
          <Card title="Registrant">
            <KV rows={[
              ["Legal name", co.raw.name], ["CIK", String(co.raw.cik)], ["SIC", `${co.raw.sic ?? "n/a"} · ${co.raw.sicDesc ?? ""}`], ["Exchange", co.raw.exchange || "n/a"],
              ["State of incorporation", co.raw.state || "n/a"], ["Fiscal year end", co.raw.fye ? `${monthName(+co.raw.fye.slice(0, 2))} ${+co.raw.fye.slice(2)}` : "n/a"],
              ["Latest 10-K / 10-Q", `${co.raw.lastForm ?? ""} ${dLong(co.raw.lastFiled)}`], ["XBRL data through", dLong(co.Q[co.Q.length - 1]?.end ?? co.L.end)],
            ]} />
            <div className="px-5 pb-4 text-[13px]">
              <a className="text-accent hover:underline" href={`https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik10}&type=&dateb=&owner=include&count=40`} target="_blank" rel="noopener noreferrer">All filings on EDGAR</a>
            </div>
          </Card>
          <Card title="Headlines" unit="Yahoo Finance news feed">
            <Headlines tk={co.tk} />
          </Card>
        </div>
      </div>
    </>
  );
}
