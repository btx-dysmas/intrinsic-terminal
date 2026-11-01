// Historical valuation multiples: each trading day's price against the trailing-twelve-month
// fundamentals that were public at the time (quarter end plus a 45-day filing lag).
import type { Co } from "./api";
import { mean, ok, sd } from "./format";

export type Band = { key: string; label: string; x: string[]; y: number[]; avg: number; sd: number; now: number; z: number };

export function valuationHistory(co: Co): Band[] {
  const Q = co.Q;
  if (!co.hasPx || Q.length < 5) return [];
  const sum = (qs: any[], k: string) => (qs.every((q) => ok(q[k])) ? qs.reduce((s, q) => s + q[k], 0) : null);
  // Yahoo's closes are split-adjusted, so share counts filed before a split are restated on today's basis. A filing may
  // already be restated; the split is applied only if that brings the count closer to the latest one.
  const splits: [string, number][] = co.px.splits ?? [], latest = Q[Q.length - 1]?.dil;
  const basis = (end: string, n: number) => {
    const f = splits.filter(([d]) => d > end).reduce((p, [, r]) => p * r, 1);
    return f !== 1 && ok(latest) && Math.abs(Math.log((n * f) / latest)) < Math.abs(Math.log(n / latest)) ? n * f : n;
  };
  // Four consecutive quarters only (about nine months from the first quarter's end to the last).
  const span = (qs: any[]) => (Date.parse(qs[3].end) - Date.parse(qs[0].end)) / 864e5;
  const points = Q.slice(3).map((q: any, j: number) => {
    const qs = Q.slice(j, j + 4), whole = span(qs) >= 250 && span(qs) <= 300;
    return { from: new Date(Date.parse(q.end) + 45 * 864e5).toISOString().slice(0, 10), ni: whole ? sum(qs, "ni") : null, ebitda: whole ? sum(qs, "ebitda") : null, rev: whole ? sum(qs, "rev") : null, eq: q.eq, netDebt: q.netDebt, shares: ok(q.dil) ? basis(q.end, q.dil) : null };
  });
  const defs: [string, string, (m: number, p: any) => number | null][] = co.fin
    ? [["pe", "P / E", (m, p) => (p.ni > 0 ? m / p.ni : null)], ["pb", "P / Book", (m, p) => (p.eq > 0 ? m / p.eq : null)]]
    : [["pe", "P / E", (m, p) => (p.ni > 0 ? m / p.ni : null)], ["evEbitda", "EV / EBITDA", (m, p) => (p.ebitda > 0 ? (m + p.netDebt) / p.ebitda : null)], ["ps", "P / Sales", (m, p) => (p.rev > 0 ? m / p.rev : null)]];
  const out = defs.map(([key, label]) => ({ key, label, x: [] as string[], y: [] as number[] }));
  const { dates, t } = co.px;
  let pi = -1;
  for (let i = 0; i < dates.length; i += 5) {
    while (pi + 1 < points.length && points[pi + 1].from <= dates[i]) pi++;
    const p = points[pi], c = t.c[i];
    if (!p || !ok(c) || !ok(p.shares)) continue;
    const mcap = c * p.shares;
    defs.forEach(([, , f], k) => {
      const v = f(mcap, p);
      if (ok(v) && v > 0 && v < 500) {
        out[k].x.push(dates[i]);
        out[k].y.push(v);
      }
    });
  }
  return out
    .filter((s) => s.y.length > 20)
    .map((s) => {
      const avg = mean(s.y)!, dev = sd(s.y), now = s.y[s.y.length - 1];
      return { ...s, avg, sd: dev, now, z: dev ? (now - avg) / dev : 0 };
    });
}
