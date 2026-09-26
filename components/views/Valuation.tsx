"use client";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Plot from "@/components/Plot";
import { Badge, Card, Delta, KV, Kpi, Note, Tw } from "@/components/ui";
import { figValuation } from "@/lib/charts";
import { useCompany } from "@/lib/company-context";
import { div, fB, fD, fM, fP, fX, ok, fPS } from "@/lib/format";
import { capm, scenario, sensGrid } from "@/lib/models";
import { MarginOfSafety, ValuationBands } from "./ValuationExtras";

type FieldSpec = { key: string; label: string; step: number; pct?: boolean; hint?: string };

function Num({ spec, value, onChange }: { spec: FieldSpec; value: number | null; onChange: (v: number | null) => void }) {
  const shown = value == null ? "" : spec.pct ? +(value * 100).toFixed(2) : value;
  const ref = useRef<HTMLInputElement>(null);
  // Follow changes made elsewhere (FRED rate arriving, filters) unless the user is typing here.
  useEffect(() => {
    const el = ref.current;
    if (el && document.activeElement !== el && el.value !== String(shown)) el.value = String(shown);
  }, [shown]);
  return (
    <>
      <label htmlFor={`a_${spec.key}`}>{spec.label}{spec.hint && <small>{spec.hint}</small>}</label>
      <input
        ref={ref} id={`a_${spec.key}`} type="number" step={spec.step} defaultValue={shown}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (e.target.value === "") onChange(null);
          else if (isFinite(v)) onChange(spec.pct ? v / 100 : v);
        }}
      />
    </>
  );
}

const RO = ({ label, children }: { label: string; children: ReactNode }) => (<><label>{label}</label><div className="px-2 py-1 text-right font-semibold">{children}</div></>);

export default function Valuation() {
  const { co, a, setA, resetA, d } = useCompany();
  const [rev, setRev] = useState(0);
  const cp = capm(co, a), L = co.L;
  const set = (k: string) => (v: number | null) => setA((p) => {
    if (k === "discOv") return { ...p, discOv: v };
    if (v == null) return p;
    if (k.startsWith("sc.")) return { ...p, sc: { ...p.sc, [k.slice(3)]: v } };
    return { ...p, [k]: k === "years" ? Math.round(Math.min(10, Math.max(3, v))) : v };
  });
  const val = (k: string) => (k.startsWith("sc.") ? a.sc[k.slice(3)] : a[k]);
  const F = (spec: FieldSpec) => <Num key={spec.key} spec={spec} value={val(spec.key)} onChange={set(spec.key)} />;
  const sc = useMemo(() => [scenario(co, a, -1), d, scenario(co, a, 1)], [co, a, d]);
  const sg = useMemo(() => (d.valid ? sensGrid(co, a, d) : null), [co, a, d]);

  const cell = (v: any, base: boolean, k: number) => <td key={k} className={`${base ? "base " : ""}${ok(v) && v > co.price * 1.05 ? "up" : ok(v) && v < co.price * 0.95 ? "dn" : ""}`}>{fPS(v)}</td>;
  const grid = (rv: number[], cv: number[], M: any[][], rl: string, cl: string, cf = 1) => (
    <Tw>
      <table className="t dense">
        <thead><tr><th>{rl} ↓ / {cl} →</th>{cv.map((c, i) => <th key={i}>{fP(c, cf)}</th>)}</tr></thead>
        <tbody>{rv.map((r, i) => <tr key={i}><td>{fP(r, 1)}</td>{M[i].map((v, j) => cell(v, i === 2 && j === 2, j))}</tr>)}</tbody>
      </table>
    </Tw>
  );
  const tr = (label: string, fn: (r: any) => any, c = "", f: (v: any) => string = fM) => (
    <tr key={label} className={c}><td className="sticky-col">{label}</td>{d.rows.map((r: any) => <td key={r.i}>{f(fn(r))}</td>)}</tr>
  );
  const ruleLabel = a.discOv != null ? "Override" : (co.fin ? cp.ke : cp.w) < a.floor ? "Floor" : "CAPM";

  return (
    <div className="grid gap-3.5 lg:grid-cols-[330px_minmax(0,1fr)]">
      <Card title="Assumptions" unit="(blue = input)" right={<button className="text-[15px] text-accent" onClick={() => { resetA(); setRev((r) => r + 1); }}>Reset</button>} className="self-start">
        <div className="inp" key={`${co.tk}-${rev}`}>
          {co.fin ? <>
            <h4>Return on equity</h4>
            {F({ key: "years", label: "Projection period (years)", step: 1, hint: "3 to 10" })}
            <RO label="Return on equity, LTM">{fP(co.roe)}</RO>
            {F({ key: "roe0", label: "Starting ROE (%)", step: 0.5, pct: true })}
            {F({ key: "roeT", label: "Final-year ROE (%)", step: 0.5, pct: true, hint: "Default: 5-yr average" })}
            {F({ key: "payout", label: "Payout ratio (%)", step: 5, pct: true, hint: "Dividends + buybacks / net income" })}
          </> : <>
            <h4>Operating forecast</h4>
            {F({ key: "years", label: "Projection period (years)", step: 1, hint: "3 to 10" })}
            {F({ key: "g1", label: "Revenue growth, year 1 (%)", step: 0.5, pct: true, hint: a.gSrc })}
            {F({ key: "gN", label: "Revenue growth, final year (%)", step: 0.5, pct: true, hint: "Linear fade between years" })}
            <RO label="Operating margin, LTM">{fP(div(L.op, L.rev))}</RO>
            {F({ key: "mT", label: "Operating margin, final year (%)", step: 0.5, pct: true, hint: a.mSrc ?? "Default: 5-yr normalized" })}
            {F({ key: "tax", label: "Tax rate (%)", step: 0.5, pct: true, hint: "Default: median effective rate" })}
            {F({ key: "daPct", label: "D&A (% of revenue)", step: 0.25, pct: true })}
            {F({ key: "capexPct", label: "Capex (% of revenue)", step: 0.25, pct: true, hint: a.cxSrc })}
            {F({ key: "nwcPct", label: "Change in NWC (% of Δ revenue)", step: 1, pct: true })}
          </>}
          <h4>{co.fin ? "Cost of equity (CAPM)" : "Discount rate (CAPM)"}</h4>
          {F({ key: "rf", label: "Risk-free rate (%)", step: 0.05, pct: true, hint: "Default: FRED 10-yr Treasury (DGS10)" })}
          {F({ key: "erp", label: "Equity risk premium (%)", step: 0.25, pct: true })}
          {F({ key: "beta", label: "Beta (adjusted)", step: 0.05, hint: ok(co.betaRaw) ? `Raw 2-yr weekly vs SPY: ${co.betaRaw.toFixed(2)}` : "Yahoo Finance beta" })}
          {!co.fin && F({ key: "kd", label: "Pre-tax cost of debt (%)", step: 0.25, pct: true, hint: "Default: interest / avg. debt" })}
          <RO label="Cost of equity">{fP(cp.ke, 2)}</RO>
          {!co.fin && <><RO label="Weights E / D">{fP(cp.We, 0)} / {fP(cp.Wd, 0)}</RO><RO label="WACC (CAPM)">{fP(cp.w, 2)}</RO></>}
          {F({ key: "floor", label: "Discount rate floor (%)", step: 0.25, pct: true, hint: "Applied when CAPM is lower" })}
          <Num spec={{ key: "discOv", label: "Discount rate override (%)", step: 0.1, pct: true, hint: "Leave blank to use CAPM" }} value={a.discOv} onChange={set("discOv")} />
          <h4>Terminal value &amp; scenarios</h4>
          {F({ key: "tg", label: "Terminal growth (%)", step: 0.25, pct: true })}
          <label htmlFor="a_mid">Mid-year discounting</label>
          <input id="a_mid" type="checkbox" className="justify-self-end" checked={a.mid} onChange={(e) => setA((p) => ({ ...p, mid: e.target.checked }))} />
          {co.fin ? F({ key: "sc.roe", label: "Scenario ROE shift (± pp)", step: 0.5, pct: true }) : <>{F({ key: "sc.g", label: "Scenario growth shift (± pp)", step: 0.5, pct: true })}{F({ key: "sc.m", label: "Scenario margin shift (± pp)", step: 0.5, pct: true })}</>}
          {F({ key: "sc.w", label: "Scenario discount shift (∓ pp)", step: 0.25, pct: true })}
        </div>
      </Card>

      {!d.valid ? (
        <div className="card self-start px-6 py-8 text-center text-ink-3">The discount rate ({fP(d.w, 2)}) must exceed terminal growth ({fP(a.tg, 2)}) for the terminal value to be defined.</div>
      ) : (
        <div className="grid content-start gap-3.5">
          <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi title="Intrinsic value" unit="Base case, per share" value={fPS(d.ps)} delta={<Delta v={d.up} vs={`vs ${fD(co.price)}`} />} />
            <Kpi title="Bear case" unit="Per share" value={fPS(sc[0].ps)} delta={<Delta v={sc[0].up} vs="vs price" />} />
            <Kpi title="Bull case" unit="Per share" value={fPS(sc[2].ps)} delta={<Delta v={sc[2].up} vs="vs price" />} />
            <Kpi title={co.fin ? "Cost of equity" : "WACC applied"} unit="Discount rate" value={fP(d.w, 2)} extra={<Badge text={ruleLabel} tone="flat" />} />
          </div>
          {d.nm && (
            <div className="card border-l-4 border-l-warn px-5 py-3 text-[13px] text-ink-2">
              The projected cash flows do not cover net debt, so the implied equity value is negative ({fB(d.eqv)}) and a per-share value is not meaningful.
              This is typical for a company that is not yet profitable. Try a later break-even by raising the final-year margin or extending the projection period.
            </div>
          )}
          <div className="grid gap-3.5 xl:grid-cols-2">
            <MarginOfSafety price={co.price} fair={d.ps} label={`the ${co.fin ? "residual income" : "DCF"} base case`} />
            <ValuationBands co={co} />
          </div>
          <div className="grid gap-3.5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Card title={co.fin ? "Residual Income Projection" : "Unlevered Free Cash Flow Projection"} unit="($m)">
              <Tw>
                <table className="t dense">
                  <thead><tr><th className="sticky-col">Item</th>{d.rows.map((r: any) => <th key={r.i}>{r.year}E</th>)}</tr></thead>
                  <tbody>
                    {co.fin ? <>
                      {tr("Opening book value", (r) => r.bv0, "tot")}{tr("Return on equity", (r) => r.roe, "sub", fP)}{tr("Net income", (r) => r.ni)}
                      {tr("Less: equity charge (ke x BV)", (r) => -r.charge)}{tr("Residual income", (r) => r.ri, "tot hl")}{tr("Distributions", (r) => -r.dist)}
                      {tr("Closing book value", (r) => r.bv1)}{tr("Discount factor", (r) => r.df, "sub", (v) => v.toFixed(3))}{tr("PV of residual income", (r) => r.pv)}
                    </> : <>
                      {tr("Revenue", (r) => r.rev, "tot")}{tr("Growth", (r) => r.g, "sub", fP)}{tr("EBITDA", (r) => r.ebitda)}{tr("EBIT", (r) => r.ebit)}{tr("Operating margin", (r) => r.m, "sub", fP)}
                      {tr("Less: taxes on EBIT", (r) => -r.tax)}{tr("NOPAT", (r) => r.nopat, "tot")}{tr("Plus: D&A", (r) => r.da)}{tr("Less: capital expenditures", (r) => -r.capex)}{tr("Less: change in NWC", (r) => -r.dnwc)}
                      {tr("Unlevered free cash flow", (r) => r.fcf, "tot hl")}{tr("Discount factor", (r) => r.df, "sub", (v) => v.toFixed(3))}{tr("PV of free cash flow", (r) => r.pv)}
                    </>}
                  </tbody>
                </table>
              </Tw>
            </Card>
            <Card title={co.fin ? "Equity Value Bridge" : "Enterprise to Equity Bridge"}>
              <KV rows={co.fin ? [
                ["Opening book value", fB(L.eq)], ["PV of residual income", fB(d.pvSum)], ["PV of terminal value", fB(d.pvTv)], [<b key="e">Equity value</b>, <b key="ev">{fB(d.eqv)}</b>],
                ["Shares outstanding", `${(co.shares / 1e6).toFixed(0)}M`], [<b key="p">Value per share</b>, <b key="pv">{fPS(d.ps)}</b>], ["Implied P / book", fX(d.impliedPB, 2)], ["Cost of equity applied", fP(d.w, 2)],
              ] : [
                ["PV of forecast FCF", fB(d.pvSum)], ["PV of terminal value", fB(d.pvTv)], [<b key="e">Enterprise value</b>, <b key="ev">{fB(d.ev)}</b>], ["Less: total debt", fB(-L.debt)],
                [co.ins ? "Plus: cash" : "Plus: cash & ST investments", fB(L.debt - L.netDebt)], [<b key="q">Equity value</b>, <b key="qv">{fB(d.eqv)}</b>], ["Shares outstanding", `${(co.shares / 1e6).toFixed(0)}M`],
                [<b key="p">Value per share</b>, <b key="pv">{fPS(d.ps)}</b>], ["Implied exit EV / EBITDA", fX(d.exitMult)], ["Terminal value share of EV", fP(d.tvShare, 0)],
              ]} />
            </Card>
          </div>
          <Card title={co.fin ? "Book Value and Earnings" : "Revenue and Free Cash Flow"} unit="(shaded = projected)"><div className="px-3 pb-3"><Plot fig={figValuation(co, d)} height={280} /></div></Card>
          {sg && (
            <div className="grid gap-3.5 xl:grid-cols-2">
              <Card title={`Sensitivity: ${co.fin ? "Cost of Equity" : "WACC"} vs Terminal Growth`} unit="($ per share)">{grid(sg.gs, sg.ws, sg.A, "g", co.fin ? "ke" : "WACC")}</Card>
              <Card title={`Sensitivity: ${sg.rl} vs ${sg.cl}`} unit="($ per share)">{grid(sg.rows2, sg.cols2, sg.B, sg.rl, sg.cl, co.fin ? 0 : 1)}</Card>
            </div>
          )}
          <Card><Note>{co.fin ? "Residual income = net income - cost of equity x opening book value. Book value compounds at retained earnings. Terminal value = RI(N) x (1 + g) / (ke - g), discounted from year N." : "FCFF = EBIT x (1 - tax) + D&A - capex - change in NWC. Terminal value = FCF(N) x (1 + g) / (WACC - g), discounted from year N. Stock-based compensation is not deducted as a cash cost."} Shaded sensitivity cells are more than 5% above (green) or below (red) the current price.</Note></Card>
        </div>
      )}
    </div>
  );
}
