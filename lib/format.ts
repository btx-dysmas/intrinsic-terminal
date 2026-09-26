export const ok = (v: unknown): v is number => v != null && typeof v === "number" && isFinite(v);
export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
export const mean = (a: (number | null | undefined)[]) => {
  const b = a.filter(ok);
  return b.length ? b.reduce((x, y) => x + y, 0) / b.length : null;
};
export const median = (a: (number | null | undefined)[]) => {
  const b = a.filter(ok).sort((x, y) => x - y);
  if (!b.length) return null;
  const m = b.length >> 1;
  return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2;
};
export const quant = (a: (number | null | undefined)[], q: number) => {
  const b = a.filter(ok).sort((x, y) => x - y);
  if (!b.length) return null;
  const p = (b.length - 1) * q, i = Math.floor(p);
  return b[i] + (b[Math.min(i + 1, b.length - 1)] - b[i]) * (p - i);
};
export const sd = (a: number[]) => {
  const m = mean(a) as number;
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1));
};
export const div = (a: any, b: any) => (ok(a) && ok(b) && b !== 0 ? a / b : null);
export const days = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 864e5;

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const dLabel = (d: string) => MON[+d.slice(5, 7) - 1] + "-" + d.slice(2, 4);
export const dLong = (d?: string | null) => (d ? `${MON[+d.slice(5, 7) - 1]} ${+d.slice(8, 10)}, ${d.slice(0, 4)}` : "");
export const monthName = (m: number) => MON[m - 1];
export const DASH = "—";

export function fB(v: any, dp = 1) {
  if (!ok(v)) return DASH;
  const a = Math.abs(v), s = v < 0 ? "-" : "";
  if (a >= 1e12) return `${s}$${(a / 1e12).toFixed(2)}T`;
  if (a >= 1e9) return `${s}$${(a / 1e9).toFixed(dp)}B`;
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(dp)}M`;
  if (a >= 1e3) return `${s}$${(a / 1e3).toFixed(0)}K`;
  return `${s}$${a.toFixed(0)}`;
}
export function fM(v: any) {
  if (!ok(v)) return DASH;
  const s = Math.abs(v / 1e6).toLocaleString("en-US", { maximumFractionDigits: 0 });
  return v < 0 ? `(${s})` : s;
}
export const fM1 = (v: any) => (ok(v) ? (v / 1e6).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : DASH);
export const fP = (v: any, dp = 1, sign = false) => (ok(v) ? `${sign && v > 0 ? "+" : ""}${(v * 100).toFixed(dp)}%` : DASH);
export const fX = (v: any, dp = 1) => (!ok(v) || v <= 0 || v > 999 ? "n.m." : `${v.toFixed(dp)}x`);
export const fN = (v: any, dp = 2) => (ok(v) ? (Math.abs(v) < 0.5 * 10 ** -dp ? 0 : v).toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp }) : DASH);
export const fD = (v: any, dp = 2) =>
  ok(v) ? `${v < 0 ? "-$" : "$"}${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp })}` : DASH;
/** Per-share model value; a value that is not meaningful (negative equity) shows as n.m. */
export const fPS = (v: any) => (ok(v) ? fD(v) : "n.m.");
export function fVol(v: any) {
  if (!ok(v)) return DASH;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return String(Math.round(v));
}
export const fR = (v: any, k: string) => (k === "p" ? fP(v) : ok(v) ? `${v.toFixed(2)}x` : "n.m.");
export const cls = (v: any) => (ok(v) ? (v > 0 ? "text-pos" : v < 0 ? "text-neg" : "") : "");
