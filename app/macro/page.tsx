"use client";
import { useEffect, useMemo, useState } from "react";
import Plot from "@/components/Plot";
import { Content, Section, TitleBar } from "@/components/Shell";
import { Card, KV, Loading, Note, Sparkline, Tw } from "@/components/ui";
import { getMacro } from "@/lib/api";
import { figMacro, figYieldCurve, PAL } from "@/lib/charts";
import { dLong, fN, ok } from "@/lib/format";
import { classify, history, IMPLICATIONS, REGIME_COLOR, type Regime } from "@/lib/regime";

function RegimeStrip({ readings }: { readings: ReturnType<typeof history> }) {
  return (
    <div className="px-5 pb-4">
      <div className="flex h-7 overflow-hidden rounded-sm" role="img" aria-label="Regime history by quarter">
        {readings.map((r) => (
          <span key={r.date} className="flex-1" style={{ background: REGIME_COLOR[r.regime] }} title={`${r.date.slice(0, 7)}: ${r.regime}`} />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11.5px] text-ink-3">
        {readings.filter((_, i) => i % 8 === 0).map((r) => <span key={r.date}>{r.date.slice(0, 4)}</span>)}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-2">
        {(Object.keys(REGIME_COLOR) as Regime[]).map((k) => (
          <span key={k} className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: REGIME_COLOR[k] }} />{k}</span>
        ))}
      </div>
    </div>
  );
}

export default function Macro() {
  const [m, setM] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    getMacro().then(setM).catch((e) => setErr(e.message));
  }, []);
  const s = useMemo(() => m?.series ?? {}, [m]);
  const asOf = s.UNRATE?.latest?.[0] ?? s.DGS10?.latest?.[0];
  const now = useMemo(() => (m?.available && asOf ? classify(s, new Date().toISOString().slice(0, 10)) : null), [m, s, asOf]);
  const past = useMemo(() => (m?.available ? history(s) : []), [m, s]);
  const imp = now ? IMPLICATIONS[now.regime] : null;
  // How long the current classification has held, from the quarterly history.
  const since = useMemo(() => {
    if (!past.length) return null;
    const cur = past[past.length - 1].regime;
    let k = past.length - 1;
    while (k > 0 && past[k - 1].regime === cur) k--;
    return new Date(past[k].date + "T12:00:00").toLocaleDateString("en-US", { month: "short", year: "numeric" });
  }, [past]);
  const INDICATORS: [string, string, string][] = [
    ["DGS10", "10-year Treasury", "risk-free rate"], ["DGS2", "2-year Treasury", ""], ["DFF", "Fed funds", "effective"],
    ["CPIAUCSL", "CPI inflation", "y/y"], ["UNRATE", "Unemployment", ""], ["BAA10Y", "Baa credit spread", "vs 10-year"],
  ];
  return (
    <>
      <TitleBar title="Macro dashboard" back="/" sub={<><span>FRED (Federal Reserve Bank of St. Louis)</span><span>U.S. Treasury yield curve</span><span>Federal Reserve press releases</span></>} />
      <Content>
        {!m && !err && <Loading text="Retrieving FRED series and the Treasury yield curve" />}
        {(err || (m && !m.available)) && (
          <Card title="FRED data unavailable">
            <div className="px-5 pb-5 text-ink-2">
              {m && !m.keyConfigured
                ? <>Set <code>FRED_API_KEY</code> in <code>.env.local</code> (or in the Vercel project settings). Keys are free and issued instantly at <a className="text-accent underline" href="https://fred.stlouisfed.org/docs/api/api_key.html" target="_blank" rel="noopener noreferrer">fred.stlouisfed.org</a>. Until then, valuations use a 4.25% risk-free rate.</>
                : err ?? (Object.values(s).find((x: any) => x.error) as any)?.error ?? "FRED did not respond. Try again shortly."}
            </div>
          </Card>
        )}
        {now && imp && <>
          <div className="grid items-start gap-3.5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <Card title="Economic regime" unit="Rules-based classification from growth, inflation, labor and the yield curve">
              <div className="px-5 pb-3">
                <div className="flex items-baseline gap-2.5">
                  <span className="inline-block h-2.5 w-2.5 -translate-y-[2px] rounded-full" style={{ background: REGIME_COLOR[now.regime] }} />
                  <span className="font-serif text-[23px] leading-none font-semibold">{now.regime}</span>
                  {since && <span className="text-[12.5px] text-ink-3">since {since}</span>}
                </div>
                <p className="mt-2.5 max-w-[60ch] text-[13.5px] leading-relaxed text-ink-2">{imp.summary}</p>
                <ul className="mt-3 space-y-1 text-[13px] leading-relaxed text-ink-2">
                  {now.reasons.map((r) => <li key={r} className="flex gap-2"><span className="text-ink-4">–</span>{r.charAt(0).toUpperCase() + r.slice(1)}</li>)}
                </ul>
              </div>
              <KV rows={[
                ["Real GDP growth (annualized)", ok(now.gdp) ? `${now.gdp.toFixed(1)}%` : "—"], ["CPI inflation (y/y)", ok(now.cpi) ? `${now.cpi.toFixed(1)}%` : "—"],
                ["Unemployment", ok(now.unemp) ? `${now.unemp.toFixed(1)}%` : "—"], ["Sahm rule reading", ok(now.sahm) ? <span key="s">{now.sahm >= 0 ? "+" : ""}{now.sahm.toFixed(2)} pts <span className="font-normal text-ink-3">(recession at 0.50)</span></span> : "—"],
                ["10y less 2y Treasury", ok(now.curve) ? `${now.curve.toFixed(2)} pts${now.curve < 0 ? " (inverted)" : ""}` : "—"],
              ]} />
            </Card>
            <Card title="Portfolio implications" unit={`Typical positioning in ${now.regime.toLowerCase()}`}>
              <Tw>
                <table className="t">
                  <tbody>
                    {([["Equities", imp.equities], ["Bonds", imp.bonds], ["Real assets", imp.real], ["Cash", imp.cash], ["Sector tilts", imp.sectors]] as const).map(([k, v]) => (
                      <tr key={k}><td className="w-[120px] font-semibold">{k}</td><td className="l whitespace-normal text-ink-2">{v}</td></tr>
                    ))}
                  </tbody>
                </table>
              </Tw>
              <Note>Historical tendencies, not forecasts. Regimes are identified with a lag because GDP is reported quarterly and revised.</Note>
            </Card>
          </div>
          <Card title="Regime history" unit="Quarter-end classification since 2008, using the same rules">
            <RegimeStrip readings={past} />
          </Card>
        </>}
        {m?.available && <>
          <Section>Indicators</Section>
          <Card>
            <Tw>
              <table className="t dense">
                <thead><tr><th>Series</th><th>Latest</th><th>1-yr change</th><th className="!text-center">12 months</th><th>As of</th></tr></thead>
                <tbody>
                  {INDICATORS.map(([id, label, note]) => {
                    const x = s[id], latest = x?.latest, from = latest ? `${Number(latest[0].slice(0, 4)) - 1}${latest[0].slice(4)}` : "";
                    const pts = (x?.obs ?? []).filter((o: [string, number]) => o[0] >= from).map((o: [string, number]) => o[1]);
                    return (
                      <tr key={id}>
                        <td>{label}{note && <span className="ml-1.5 text-[12px] text-ink-3">{note}</span>}</td>
                        <td className="font-semibold">{latest ? `${fN(latest[1], 2)}${id === "BAA10Y" ? " pts" : "%"}` : "—"}</td>
                        <td className="text-ink-2">{ok(x?.chg1y) ? `${x.chg1y >= 0 ? "+" : ""}${x.chg1y.toFixed(2)} pts` : "—"}</td>
                        <td className="c">{pts.length > 3 && <Sparkline data={pts} width={110} height={22} color="var(--c1)" />}</td>
                        <td className="text-ink-3">{latest ? dLong(latest[0]) : ""}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Tw>
          </Card>
          <div className="grid gap-3.5 xl:grid-cols-2">
            {m.curve && <Card title="Treasury yield curve" unit="Daily par yields, U.S. Department of the Treasury"><div className="px-2 pb-2"><Plot fig={figYieldCurve(m.curve)} height={290} /></div></Card>}
            <Card title="Rates" unit="%"><div className="px-2 pb-2"><Plot fig={figMacro(s, ["DGS10", "DGS2", "DFF", "T10Y2Y"], [PAL.c1, PAL.c2, PAL.c3, PAL.c4])} height={290} /></div></Card>
          </div>
          <Card title="Growth, inflation and employment" unit="%"><div className="px-2 pb-2"><Plot fig={figMacro(s, ["A191RL1Q225SBEA", "CPIAUCSL", "UNRATE"], [PAL.c1, PAL.c4, PAL.c2])} height={280} /></div></Card>
          <div className="grid gap-3.5 lg:grid-cols-3">
            <Card title="Credit spread" unit="Baa yield less 10-year Treasury, pts"><div className="px-2 pb-2"><Plot fig={figMacro(s, ["BAA10Y"], [PAL.c3])} height={240} /></div></Card>
            <Card title="Equity volatility" unit="CBOE Volatility Index"><div className="px-2 pb-2"><Plot fig={figMacro(s, ["VIXCLS"], [PAL.c1])} height={240} /></div></Card>
            <Card title="Federal Reserve" unit="Latest press releases">
              <ul className="px-5 pb-4">
                {(m.fed ?? []).map((n: any, i: number) => (
                  <li key={i} className="border-b border-line py-2 last:border-0">
                    <a href={n.link} target="_blank" rel="noopener noreferrer" className="text-[13px] text-ink hover:text-accent hover:underline">{n.title}</a>
                    {n.date && <div className="text-[11.5px] text-ink-3">{new Date(n.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>}
                  </li>
                ))}
              </ul>
            </Card>
          </div>
          <Card><Note>FRED series DGS10, DGS2, T10Y2Y, DFF, CPIAUCSL (as year-over-year change), UNRATE, A191RL1Q225SBEA, BAA10Y and VIXCLS; daily series thinned to weekly points. Treasury par yield curve from home.treasury.gov.</Note></Card>
        </>}
      </Content>
    </>
  );
}
