// Historical valuation multiples: each trading day's price against the trailing-twelve-month
// fundamentals that were public at the time (quarter end plus a 45-day filing lag).
import type { Co } from "./api";
import { mean, ok, sd } from "./format";

export type Band = { key: string; label: string; x: string[]; y: number[]; avg: number; sd: number; now: number; z: number };

export function valuationHistory(co: Co): Band[] {
  const Q = co.Q;
  if (!co.hasPx || Q.length < 5) return [];
  const sum = (qs: any[], k: string) => (qs.every((q) => ok(q[k])) ? qs.reduce((s, q) => s + q[k], 0) : null);
  const points = Q.slice(3).map((q: any, j: number) => {
    const qs = Q.slice(j, j + 4);
    return { from: new Date(Date.parse(q.end) + 45 * 864e5).toISOString().slice(0, 10), ni: sum(qs, "ni"), ebitda: sum(qs, "ebitda"), rev: sum(qs, "rev"), eq: q.eq, netDebt: q.netDebt, shares: q.dil };
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
