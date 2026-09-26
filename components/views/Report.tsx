"use client";
import { Fragment, useMemo, useState } from "react";
import { Badge, Card, Chip, Delta, Kpi, Note, Tw } from "@/components/ui";
import { useCompany } from "@/lib/company-context";
import { cls, dLong, fD, fPS } from "@/lib/format";
import { mdBlocks } from "@/lib/markdown";
import { researchNote } from "@/lib/note";

function Doc({ text }: { text: string }) {
  const inline = (s: string) => s.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : <Fragment key={i}>{p}</Fragment>));
  const out: React.ReactNode[] = [];
  let list: React.ReactNode[] = [];
  const flush = () => {
    if (list.length) out.push(<ul key={`u${out.length}`}>{list}</ul>);
    list = [];
  };
  mdBlocks(text).forEach((b, i) => {
    if (b.t === "li") return void list.push(<li key={i}>{inline(b.x)}</li>);
    flush();
    out.push(b.t === "h" ? <h2 key={i}>{b.x}</h2> : <p key={i}>{inline(b.x)}</p>);
  });
  flush();
  return <div className="doc">{out}</div>;
}

async function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob), el = document.createElement("a");
  el.href = url;
  el.download = name;
  document.body.appendChild(el);
  el.click();
  el.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export default function Report() {
  const { co, a, d, comp, rt, peers } = useCompany();
  const [msg, setMsg] = useState<string | null>(null);
  const text = useMemo(() => researchNote(co, d, a, comp, rt, peers), [co, d, a, comp, rt, peers]);

  const exportPdf = async (kind: "full" | "tear") => {
    setMsg("Building PDF…");
    try {
      const pdf = await import("@/lib/pdf");
      const blob = kind === "full" ? await pdf.buildPdf(co, a, d, comp, rt, text) : await pdf.buildTearSheet(co, a, d, comp, rt, text);
      const name = `${co.tk}_${kind === "full" ? "Equity_Research" : "Tear_Sheet"}_${co.priceDate}.pdf`;
      await download(blob, name);
      setMsg(`Downloaded ${name}.`);
    } catch (e: any) {
      console.error(e);
      setMsg(`The PDF could not be built: ${e.message}`);
    }
  };

  const tone = rt.rating === "BUY" ? "pos" : rt.rating === "SELL" ? "neg" : "warn";
  return (
    <>
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi title="Model rating" unit="Composite, -2 to +2" value={(rt.total >= 0 ? "+" : "") + rt.total.toFixed(2)} extra={<Badge text={rt.rating} tone={tone} />} />
        <Kpi title="Intrinsic value" unit="Per share" value={fPS(d.ps)} delta={<Delta v={d.up} vs="vs price" />} />
        <Kpi title="Street target" unit={co.street.n ? `Mean of ${co.street.n} analysts` : "No coverage data"} value={fD(co.street.target)} delta={<Delta v={co.street.up} vs="vs price" />} />
        <Kpi title="Share price" unit={co.priceDate ? `Close ${dLong(co.priceDate)}` : "Yahoo Finance"} value={fD(co.price)} />
      </div>
      <div className="grid gap-3.5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card title="Research note" unit="Compiled from SEC filings, Street consensus, the peer set and the valuation model">
          <Doc text={text} />
        </Card>
        <div className="grid content-start gap-3.5">
          <Card title="Rating scorecard" unit="Hover a row for its thresholds">
            <Tw>
              <table className="t dense">
                <thead><tr><th>Factor</th><th>Weight</th><th>Score</th><th /></tr></thead>
                <tbody>
                  {rt.factors.map((f: any) => (
                    <tr key={f.name} title={f.basis}>
                      <td className="whitespace-normal">{f.name}<div className="text-[12.5px] text-ink-3">{f.disp}</div></td>
                      <td>{(f.w * 100).toFixed(0)}%</td>
                      <td className={cls(f.s)}>{f.s == null ? "n/a" : `${f.s > 0 ? "+" : ""}${f.s}`}</td>
                      <td>
                        {f.s != null && (
                          <span className="relative inline-block h-1.5 w-[110px] bg-line align-middle">
                            <b className="absolute top-[-3px] bottom-[-3px] left-1/2 w-px bg-ink-3" />
                            <i className="absolute top-0 bottom-0 bg-c1" style={f.s >= 0 ? { left: "50%", width: `${f.s * 25}%` } : { left: `${50 + f.s * 25}%`, width: `${-f.s * 25}%` }} />
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  <tr className="tot"><td>Composite</td><td>100%</td><td>{(rt.total >= 0 ? "+" : "") + rt.total.toFixed(2)}</td><td><Chip kind={rt.rating.toLowerCase() as "buy" | "sell" | "hold"}>{rt.rating}</Chip></td></tr>
                </tbody>
              </table>
            </Tw>
            <Note>Buy at +0.50 or above, Sell at -0.50 or below. Factors without data are dropped and the weights rescaled. The rating moves with the valuation inputs and the peer set.</Note>
          </Card>
          <Card title="Export">
            <div className="grid gap-3 px-5 pb-5">
              <div>
                <button className="btn primary w-full" onClick={() => exportPdf("tear")}>Tear sheet (1 page)</button>
                <div className="mt-1 text-[12.5px] text-ink-3">Business summary, valuation, financial highlights, peers, risks and thesis on one page.</div>
              </div>
              <div>
                <button className="btn w-full" onClick={() => exportPdf("full")}>Full research report</button>
                <div className="mt-1 text-[12.5px] text-ink-3">Statements, ratios, DCF and sensitivities, comparables, risk, charts and the complete note.</div>
              </div>
              {msg && <div className="text-[12.5px] text-ink-2" role="status">{msg}</div>}
            </div>
          </Card>
          <Card><Note>The rating and note come from rules applied to the figures shown. They are not investment advice.</Note></Card>
        </div>
      </div>
    </>
  );
}
