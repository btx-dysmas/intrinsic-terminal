"use client";
import { useMemo, useState } from "react";
import Plot from "@/components/Plot";
import { Card, Chip, KV, Note, Seg } from "@/components/ui";
import { figMacd, figRsi, figTech, figVolume } from "@/lib/charts";
import { useCompany } from "@/lib/company-context";
import { cls, dLong, fD, fN, fP, ok } from "@/lib/format";
import { technicals } from "@/lib/risk";

export default function Technicals() {
  const { co } = useCompany();
  const [win, setWin] = useState(252);
  const T = useMemo(() => (co.hasPx ? technicals(co) : null), [co]);
  if (!T) return <div className="card px-6 py-8 text-center text-ink-3">Technical analysis needs daily price history, which is not available for this company.</div>;
  const trend = T.px > T.s50Now && T.s50Now > T.s200Now ? <Chip kind="buy">UPTREND</Chip> : T.px < T.s50Now && T.s50Now < T.s200Now ? <Chip kind="sell">DOWNTREND</Chip> : <Chip kind="hold">MIXED</Chip>;
  const rsiC = (T.rsiNow ?? 50) > 70 ? <Chip kind="sell">OVERBOUGHT</Chip> : (T.rsiNow ?? 50) < 30 ? <Chip kind="buy">OVERSOLD</Chip> : <Chip kind="hold">NEUTRAL</Chip>;
  const pct = (v: any) => <span className={cls(v)}>{fP(v, 1, true)}</span>;
  return (
    <>
      <Card><Note>Technical indicators are supplemental. They describe price behavior and do not enter the valuation models or the rating.</Note></Card>
      <div className="grid gap-3.5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card title="Price, Moving Averages and Support / Resistance" right={<Seg value={win} options={[[126, "6M"], [252, "1Y"], [504, "2Y"], [1255, "5Y"]]} onChange={setWin} />}>
          <div className="px-3"><Plot fig={figTech(co, T, win)} height={380} /></div>
          <div className="grid border-t border-line lg:grid-cols-3">
            <div><div className="card-sub px-6 pt-2.5">RSI (14)</div><div className="px-2"><Plot fig={figRsi(T, win)} height={170} /></div></div>
            <div><div className="card-sub px-6 pt-2.5">MACD (12, 26, 9)</div><div className="px-2"><Plot fig={figMacd(T, win)} height={170} /></div></div>
            <div><div className="card-sub px-6 pt-2.5">Volume</div><div className="px-2"><Plot fig={figVolume(T, win)} height={170} /></div></div>
          </div>
        </Card>
        <div className="grid content-start gap-3.5">
          <Card title="Signals"><KV rows={[["Trend (50 / 200-day)", trend], [`RSI (14): ${fN(T.rsiNow, 1)}`, rsiC], ["MACD vs signal", (T.macdNow ?? 0) > (T.sigNow ?? 0) ? <Chip kind="buy">BULLISH</Chip> : <Chip kind="sell">BEARISH</Chip>], ["Last MA cross", T.cross ? `${T.cross.type}, ${dLong(T.cross.date)}` : "None in 12 months"]]} /></Card>
          <Card title="Levels"><KV rows={[
            ["Last close", fD(T.px)], ["EMA 20", fD(T.s20Now)], ["SMA 50", <span key="a">{fD(T.s50Now)} {pct(T.px / T.s50Now - 1)}</span>], ["SMA 200", <span key="b">{fD(T.s200Now)} {pct(T.px / T.s200Now - 1)}</span>],
            ["Resistance", T.res.map((v) => fD(v)).join(" · ") || "None nearby"], ["Support", T.sup.map((v) => fD(v)).join(" · ") || "—"],
            ["Pivot / R1 / S1 (21-day)", `${fN(T.pp)} / ${fN(T.r1)} / ${fN(T.s1)}`], ["ATR (14)", `${fD(T.atr)} (${fP(T.atr / T.px, 1)})`],
          ]} /></Card>
          <Card title="Momentum"><KV rows={[
            ["1 month", pct(T.ret1m)], ["3 months", pct(T.ret3m)], ["6 months", pct(T.ret6m)], ["12 months", pct(T.ret12m)], ["12-1 month momentum", pct(T.mom121)], ["Off 52-week high", pct(T.offHi)],
            ["10-day / 50-day volume", ok(T.vRatio) ? `${T.vRatio.toFixed(2)}x` : "—"],
          ]} /></Card>
        </div>
      </div>
      <Card><Note>Support and resistance are clusters of 5-session swing highs and lows within 2% over the last six months. Classic pivots use the 21-session high, low and last close.</Note></Card>
    </>
  );
}
