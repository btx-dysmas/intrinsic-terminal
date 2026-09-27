"use client";
import { use, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter, useSelectedLayoutSegment } from "next/navigation";
import { COMPANY_VIEWS, Content, Filter, TitleBar } from "@/components/Shell";
import { CURATED_TICKERS } from "@/lib/universe";
import { ErrorCard, Loading } from "@/components/ui";
import { getCompany, getMacro, type Co } from "@/lib/api";
import { CompanyCtx } from "@/lib/company-context";
import { ago, cls, dLong, fD, fN, fP, ok } from "@/lib/format";
import { capm, defaults, peerStats, rating, RF_DEFAULT, valuation, type Assumptions } from "@/lib/models";

export default function CompanyLayout({ children, params }: { children: ReactNode; params: Promise<{ ticker: string }> }) {
  const { ticker } = use(params);
  const tk = decodeURIComponent(ticker).toUpperCase();
  const seg = useSelectedLayoutSegment();
  const router = useRouter();
  const [co, setCo] = useState<Co | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [a, setAState] = useState<Assumptions | null>(null);
  const [peers, setPeers] = useState<string[]>([]);
  const [peerMap, setPeerMap] = useState<Record<string, Co>>({});
  const [peersLoading, setPeersLoading] = useState(false);
  const [loadedAt, setLoadedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);
  const [rf, setRf] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    setCo(null);
    setErr(null);
    getCompany(tk)
      .then((c) => {
        if (!alive) return;
        setCo(c);
        setLoadedAt(Date.now());
        setAState(defaults(c));
        setPeers(c.defaultPeers);
      })
      .catch((e) => alive && setErr(e.message));
    return () => { alive = false; };
  }, [tk]);

  // Use the current 10-year Treasury yield from FRED as the risk-free rate once it arrives.
  useEffect(() => {
    getMacro().then((m) => ok(m?.riskFree) && setRf(m.riskFree)).catch(() => {});
  }, []);
  useEffect(() => {
    if (ok(rf)) setAState((p: Assumptions | null) => (p && p.rf === RF_DEFAULT ? { ...p, rf: +rf.toFixed(4) } : p));
  }, [rf, co]);

  useEffect(() => {
    const missing = peers.filter((p) => !peerMap[p]);
    if (!missing.length) return;
    setPeersLoading(true);
    Promise.allSettled(missing.map((p) => getCompany(p).then((c) => [p, c] as const))).then((rs) => {
      const add: Record<string, Co> = {};
      rs.forEach((r) => r.status === "fulfilled" && (add[r.value[0]] = r.value[1]));
      setPeerMap((m) => ({ ...m, ...add }));
      setPeersLoading(false);
    });
  }, [peers]); // eslint-disable-line react-hooks/exhaustive-deps

  const addPeer = useCallback(async (p: string) => {
    const t = p.trim().toUpperCase().replace(".", "-");
    if (!t || t === tk) return;
    const c = await getCompany(t);
    setPeerMap((m) => ({ ...m, [t]: c }));
    setPeers((ps) => (ps.includes(t) ? ps : [...ps, t]));
  }, [tk]);

  const peerCos = useMemo(() => peers.map((p) => peerMap[p]).filter(Boolean), [peers, peerMap]);
  const d = useMemo(() => (co && a ? valuation(co, a) : null), [co, a]);
  const comp = useMemo(() => (co ? peerStats(co, peerCos) : null), [co, peerCos]);
  const rt = useMemo(() => (co && d && comp ? rating(co, d, comp) : null), [co, d, comp]);

  if (err) return <><TitleBar title={tk} back="/" /><Content><ErrorCard title={`Could not load ${tk}`} message={err} /></Content></>;
  if (!co || !a || !d || !comp || !rt) return <><TitleBar title={tk} back="/" /><Content><Loading text={`Retrieving SEC EDGAR filings and Yahoo Finance market data for ${tk}`} /></Content></>;

  const chg = ok(co.prev) ? co.price / co.prev - 1 : null;
  const viewLabel = COMPANY_VIEWS.find(([v]) => v === (seg ?? "overview"))?.[1];
  const resetA = () => setAState({ ...defaults(co), ...(ok(rf) ? { rf: +rf.toFixed(4) } : {}) });
  const value = {
    co, a, setA: (fn: any) => setAState((p: Assumptions) => fn(p)), resetA,
    peers, setPeers, peerCos, peersLoading, addPeer, d, comp, rt, rf,
  };
  const companies = Array.from(new Set([co.tk, ...peers, ...CURATED_TICKERS]));
  const spread = co.fin ? a.sc.roe : a.sc.g;
  const basis = a.discOv != null ? "override" : (co.fin ? capm(co, a).ke : capm(co, a).w) < a.floor ? "floor" : "capm";
  return (
    <CompanyCtx.Provider value={value}>
      <TitleBar
        back="/"
        title={co.name}
        sub={<><b className="tracking-wide text-c1">{co.tk}</b><span>{co.y.exchange || co.raw.exchange}</span><span>{co.sector} · {co.industry}</span><span className="text-ink-2">{viewLabel}</span><span title="Latest 10-K or 10-Q on EDGAR">{co.raw.lastForm} filed {dLong(co.raw.lastFiled)}</span><span>Close {dLong(co.priceDate)}{loadedAt ? ` · loaded ${ago(loadedAt, now)}` : ""}</span></>}
        right={<><b className="text-[22px] font-semibold text-ink">{fD(co.price)}</b><span className={`text-[13px] ${cls(chg)}`}>{ok(chg) ? `${co.price - co.prev >= 0 ? "+" : ""}${fN(co.price - co.prev)} (${fP(chg, 2, true)})` : ""}</span></>}
        filters={<>
          <Filter label="Company">
            <select className="fsel min-w-[150px]" value={co.tk} onChange={(e) => router.push(`/company/${e.target.value}${seg ? "/" + seg : ""}`)}>
              {companies.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Filter>
          <Filter label="Projection">
            <select className="fsel" value={a.years} onChange={(e) => setAState((p: Assumptions) => ({ ...p, years: +e.target.value }))}>
              {[5, 7, 10].map((n) => <option key={n} value={n}>{n} years</option>)}
            </select>
          </Filter>
          <Filter label={co.fin ? "Scenario ROE spread" : "Scenario growth spread"}>
            <select className="fsel" value={spread} onChange={(e) => setAState((p: Assumptions) => ({ ...p, sc: { ...p.sc, [co.fin ? "roe" : "g"]: +e.target.value } }))}>
              {Array.from(new Set([0.02, 0.04, 0.06, spread])).sort((x, y) => x - y).map((v) => <option key={v} value={v}>± {(v * 100).toFixed(1)} pp</option>)}
            </select>
          </Filter>
          <Filter label="Discount basis">
            <select className="fsel" value={basis === "override" ? "override" : "capm"} onChange={(e) => e.target.value === "capm" && setAState((p: Assumptions) => ({ ...p, discOv: null }))}>
              <option value="capm">CAPM {co.fin ? "cost of equity" : "WACC"} (floor {fP(a.floor, 0)})</option>
              {basis === "override" && <option value="override">Manual override</option>}
            </select>
          </Filter>
          <Filter label="Peer set">
            <span className="flex h-[30px] items-center text-[13px] text-ink-2">{peers.length ? peers.join(", ") : "None"}{peersLoading ? " …" : ""}</span>
          </Filter>
          <button className="mb-1 ml-auto text-[13px] font-semibold text-accent hover:underline" onClick={resetA}>Reset assumptions</button>
        </>}
      />
      <Content>{children}</Content>
    </CompanyCtx.Provider>
  );
}
