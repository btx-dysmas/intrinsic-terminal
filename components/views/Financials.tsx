"use client";
import { useState } from "react";
import Plot from "@/components/Plot";
import { Card, Note, Seg, Tw } from "@/components/ui";
import { figCap, figStmt } from "@/lib/charts";
import { useCompany } from "@/lib/company-context";
import { cls } from "@/lib/format";
import { fmtKind, statementData } from "@/lib/statements";

function Statement({ kind, per }: { kind: "IS" | "BS" | "CF"; per: "A" | "Q" }) {
  const { co } = useCompany();
  const { heads, body } = statementData(co, kind, per);
  return (
    <Tw>
      <table className="t dense">
        <thead><tr><th className="sticky-col">USD millions</th>{heads.map((h: string) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>
          {body.map((b, i) => (
            <tr key={i} className={b.c || ""}>
              <td className="sticky-col">{b.label}</td>
              {b.vals.map((v: any, j: number) => <td key={j} className={b.c === "sub" && /growth/i.test(b.label) ? cls(v) : ""}>{fmtKind(v, b.k)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </Tw>
  );
}

export default function Financials() {
  const { co } = useCompany();
  const [per, setPer] = useState<"A" | "Q">("A");
  const kinds: [string, "IS" | "BS" | "CF"][] = [["Income statement", "IS"], ["Balance sheet", "BS"], ["Cash flow statement", "CF"]];
  return (
    <>
      <div className="grid gap-3.5 lg:grid-cols-2">
        <Card title={`Revenue, earnings${co.fin ? "" : " and cash flow"}`} unit={per === "A" ? "Fiscal years" : "Fiscal quarters"}><div className="px-3 pb-3"><Plot fig={figStmt(co, per)} height={300} /></div></Card>
        <Card title={co.fin ? "Book value" : "Capital structure"} unit="Period end"><div className="px-3 pb-3"><Plot fig={figCap(co, per)} height={300} /></div></Card>
      </div>
      <div className="card flex flex-wrap items-center gap-3 px-5 py-3">
        <Seg value={per} options={[["A", "Annual"], ["Q", "Quarterly"]]} onChange={setPer} />
        <span className="text-[12.5px] text-ink-3">Standardized from SEC EDGAR XBRL filings, using the most recently filed value for each period.</span>
      </div>
      {kinds.map(([title, k]) => (
        <Card key={k} title={title} unit={k === "BS" ? "$ millions, period end" : "$ millions, except per share"}>
          <Statement kind={k} per={per} />
          {k === "CF" && (
            <Note>
              Negatives in parentheses. Quarterly cash flows are derived from year-to-date filings. EBITDA = operating income + depreciation &amp; amortization from the cash flow statement.
              {co.opDerived && " This company does not tag operating income, so EBIT is derived as pre-tax income plus interest expense."} Rows a company does not report are omitted.
            </Note>
          )}
        </Card>
      ))}
    </>
  );
}
