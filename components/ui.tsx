import type { ReactNode } from "react";
import { fP, ok } from "@/lib/format";

export function Card({ title, unit, right, children, className = "" }: { title?: ReactNode; unit?: ReactNode; right?: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {(title || unit) && (
        <header className="px-5 pt-4 pb-1.5">
          {title && (
            <h2 className="card-title">
              {title}
              {right && <span className="ml-auto text-[13px] font-normal">{right}</span>}
            </h2>
          )}
          {unit && <div className="card-sub">{unit}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

/** Circled arrow: the direction of a change, readable without color. */
export function Arrow({ v }: { v: number | null | undefined }) {
  if (!ok(v)) return null;
  const up = v > 0.0005, dn = v < -0.0005;
  const color = up ? "text-pos" : dn ? "text-neg" : "text-ink-3";
  return (
    <svg viewBox="0 0 24 24" className={`h-[22px] w-[22px] flex-none fill-none stroke-current ${color}`} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      {up ? <path d="M12 16.5v-9M8 11l4-4 4 4" /> : dn ? <path d="M12 7.5v9M8 13l4 4 4-4" /> : <path d="M7.5 12h9" />}
    </svg>
  );
}

/** Change line under a figure: arrow, signed percentage, and what it is measured against. */
export function Delta({ v, vs, dp = 1, text }: { v: number | null | undefined; vs?: ReactNode; dp?: number; text?: string }) {
  if (!ok(v) && !text) return <div className="min-h-[24px]" />;
  return (
    <div className="flex min-h-[24px] items-center gap-2 text-[14px] text-ink-2">
      {ok(v) && <Arrow v={v} />}
      <span className={ok(v) ? (v > 0.0005 ? "font-semibold text-pos" : v < -0.0005 ? "font-semibold text-neg" : "") : ""}>{text ?? fP(v, dp, true)}</span>
      {vs && <span className="text-ink-3">{vs}</span>}
    </div>
  );
}

export function Kpi({ title, unit, value, delta, extra }: { title: ReactNode; unit: ReactNode; value: ReactNode; delta?: ReactNode; extra?: ReactNode }) {
  return (
    <div className="card flex min-h-[132px] flex-col px-5 pt-4 pb-4">
      <div className="text-[14px] font-semibold tracking-[0.06em] text-ink uppercase">{title}</div>
      <div className="text-[12.5px] text-ink-3">{unit}</div>
      <div className="mt-auto flex items-end justify-between gap-3 pt-2">
        <div className="text-[30px] leading-none font-semibold tracking-tight text-ink">{value}</div>
        {extra}
      </div>
      <div className="mt-2">{delta ?? <div className="min-h-[24px]" />}</div>
    </div>
  );
}

export function Badge({ v, dp = 1, text, tone }: { v?: number | null; dp?: number; text?: string; tone?: "pos" | "neg" | "flat" | "warn" }) {
  if (text == null && !ok(v)) return null;
  const t = tone ?? (v! > 0.005 ? "pos" : v! < -0.005 ? "neg" : "flat");
  const c = { pos: "bg-pos-soft text-pos", neg: "bg-neg-soft text-neg", flat: "bg-card-2 text-ink-2", warn: "bg-warn-soft text-warn" }[t];
  return <span className={`chip ${c}`}>{text ?? fP(v, dp, true)}</span>;
}

export function KV({ rows }: { rows: [ReactNode, ReactNode][] }) {
  // Label and value must be direct children of the grid so the odd/even styling lines up.
  return (
    <div className="kv">
      {rows.flatMap(([k, v], i) => [<div key={`k${i}`}>{k}</div>, <div key={`v${i}`}>{v}</div>])}
    </div>
  );
}

export function Seg<T extends string | number>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <span className="seg">
      {options.map(([v, l]) => (
        <button key={String(v)} className={v === value ? "on" : ""} onClick={() => onChange(v)}>{l}</button>
      ))}
    </span>
  );
}

export function Loading({ text }: { text: string }) {
  return (
    <div className="card px-6 py-14 text-center text-ink-2">
      {text}
      <div className="relative mx-auto mt-3.5 h-[3px] w-[220px] overflow-hidden bg-line">
        <i className="ld-bar absolute top-0 bottom-0 -left-[40%] w-[40%] bg-accent" style={{ animation: "ld 1.2s linear infinite" }} />
      </div>
    </div>
  );
}

export function ErrorCard({ title = "Something went wrong", message }: { title?: string; message: string }) {
  return (
    <div className="card border-l-4 border-l-neg px-5 py-4">
      <div className="font-semibold text-neg">{title}</div>
      <div className="mt-1 text-ink-3">{message}</div>
    </div>
  );
}

export const Note = ({ children }: { children: ReactNode }) => <div className="note">{children}</div>;

export function Chip({ kind, children }: { kind: "buy" | "sell" | "hold"; children: ReactNode }) {
  const c = kind === "buy" ? "bg-pos-soft text-pos" : kind === "sell" ? "bg-neg-soft text-neg" : "bg-warn-soft text-warn";
  return <span className={`chip ${c}`}>{children}</span>;
}

export const Tw = ({ children }: { children: ReactNode }) => <div className="overflow-x-auto px-5 pb-4">{children}</div>;

/** Signed variance cell with a direction triangle, as in management-report variance columns. */
export function Var({ v, pct = true, dp = 1 }: { v: number | null | undefined; pct?: boolean; dp?: number }) {
  if (!ok(v)) return <>—</>;
  const up = v > 0;
  return (
    <span className={up ? "text-pos" : v < 0 ? "text-neg" : "text-ink-2"}>
      <span className="mr-1 text-[10px]">{up ? "▲" : v < 0 ? "▼" : "■"}</span>
      {pct ? fP(v, dp, true) : v.toLocaleString("en-US", { maximumFractionDigits: 2, signDisplay: "exceptZero" })}
    </span>
  );
}

/** Donut gauge (0-1) with the value in the middle. */
export function Donut({ value, label, color = "var(--c1)" }: { value: number | null; label: ReactNode; color?: string }) {
  const v = ok(value) ? Math.max(0, Math.min(1, value)) : 0, r = 34, c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 88 88" className="h-[88px] w-[88px]" role="img" aria-label={typeof label === "string" ? label : undefined}>
      <circle cx="44" cy="44" r={r} fill="none" stroke="var(--line)" strokeWidth="10" />
      <circle cx="44" cy="44" r={r} fill="none" stroke={color} strokeWidth="10" strokeDasharray={`${v * c} ${c}`} strokeLinecap="round" transform="rotate(-90 44 44)" />
    </svg>
  );
}

/** Minimal line sparkline with an emphasized endpoint. */
export function Sparkline({ data, width = 140, height = 44, color = "var(--c4)" }: { data: number[]; width?: number; height?: number; color?: string }) {
  const c = data.filter(ok);
  if (c.length < 3) return null;
  const mn = Math.min(...c), mx = Math.max(...c), px = (i: number) => (i / (c.length - 1)) * (width - 6) + 3, py = (v: number) => height - 4 - ((v - mn) / (mx - mn || 1)) * (height - 8);
  const pts = c.map((v, i) => `${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <polyline fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" points={pts} />
      <circle cx={px(c.length - 1)} cy={py(c[c.length - 1])} r={3.5} fill={color} stroke="var(--card)" strokeWidth={2} />
    </svg>
  );
}
