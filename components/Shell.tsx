"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import { ThemeToggle } from "./Theme";

const ICON: Record<string, ReactNode> = {
  home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  macro: <><path d="M3 20h18" /><path d="M5 16l4-5 4 3 6-8" /><circle cx="19" cy="6" r="1.2" /></>,
  screener: <path d="M3.5 5h17l-6.5 7.5V19l-4 1.5v-8z" />,
  portfolio: <><path d="M12 3a9 9 0 1 0 9 9h-9z" /><path d="M15 2.6A9 9 0 0 1 21.4 9H15z" /></>,
  retirement: <><path d="M4 20c1.5-6 4.5-9 8-9s6.5 3 8 9" /><circle cx="12" cy="6" r="2.5" /><path d="M3 20h18" /></>,
  architecture: <><rect x="3" y="3.5" width="7" height="5" rx="1" /><rect x="14" y="3.5" width="7" height="5" rx="1" /><rect x="8.5" y="15.5" width="7" height="5" rx="1" /><path d="M6.5 8.5v3.5h11V8.5M12 12v3.5" /></>,
  overview: <><rect x="3" y="3" width="7.5" height="7.5" rx="1" /><rect x="13.5" y="3" width="7.5" height="7.5" rx="1" /><rect x="3" y="13.5" width="7.5" height="7.5" rx="1" /><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1" /></>,
  financials: <><rect x="3.5" y="3.5" width="17" height="17" rx="1.5" /><path d="M3.5 9h17M3.5 14.5h17M9.5 9v11.5" /></>,
  filings: <><path d="M4 4h10l6 6v10H4z" /><path d="M14 4v6h6M8 14h8M8 17.5h5" /></>,
  ratios: <><path d="M5 19 19 5" /><circle cx="7" cy="7" r="2.5" /><circle cx="17" cy="17" r="2.5" /></>,
  valuation: <><rect x="5" y="2.5" width="14" height="19" rx="1.5" /><path d="M8 6.5h8M8 11h.01M12 11h.01M16 11h.01M8 14.5h.01M12 14.5h.01M16 14.5h.01M8 18h.01M12 18h4" /></>,
  comps: <path d="M4 20V10M9.3 20V4M14.6 20v-7M20 20V8M2.5 20.5h19" />,
  risk: <path d="M12 3 4.5 6v5.5c0 4.6 3.1 8.2 7.5 9.5 4.4-1.3 7.5-4.9 7.5-9.5V6z" />,
  technicals: <><path d="M3 17l5-5 4 4 8-9" /><path d="M15 7h5v5" /></>,
  report: <><path d="M6 2.5h8.5L19 7v14.5H6z" /><path d="M14 2.5V7h5M9 12h7M9 15.5h7M9 19h4" /></>,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9.6 9.2a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.5M12 17h.01" /></>,
};
export const COMPANY_VIEWS: [string, string][] = [
  ["overview", "Overview"], ["financials", "Financial statements"], ["filings", "Filings & insiders"], ["ratios", "Ratio analysis"], ["valuation", "Valuation model"],
  ["comps", "Comparable companies"], ["risk", "Risk & return"], ["technicals", "Technical analysis"], ["report", "Research report"],
];

const GLOBAL: [string, string, string][] = [
  ["/", "home", "Coverage universe"], ["/screener", "screener", "Peer screener"], ["/macro", "macro", "Macro & regime"],
  ["/portfolio", "portfolio", "Portfolio builder"], ["/retirement", "retirement", "Retirement simulator"],
];

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" style={{ width: size, height: size }} className="fill-none stroke-current" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      {ICON[name]}
    </svg>
  );
}

function NavLink({ href, icon, label, active, disabled }: { href: string; icon: string; label: string; active: boolean; disabled?: boolean }) {
  return (
    <Link
      href={href} aria-current={active ? "page" : undefined} aria-disabled={disabled} title={label}
      className={`flex items-center gap-2.5 rounded px-2 py-[5px] text-[13px] transition-colors ${active ? "bg-accent-soft font-medium text-ink" : "text-ink-2 hover:bg-card-2 hover:text-ink"} ${disabled ? "pointer-events-none opacity-40" : ""}`}
    >
      <span className={active ? "text-accent" : "text-ink-3"}><Icon name={icon} size={16} /></span>
      <span className="truncate">{label}</span>
    </Link>
  );
}

const Group = ({ label, children }: { label: ReactNode; children: ReactNode }) => (
  <div className="pb-4">
    <div className="truncate px-2 pb-1 text-[10.5px] font-semibold tracking-[0.1em] text-ink-3 uppercase">{label}</div>
    {children}
  </div>
);

function Search() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<{ ticker: string; name: string }[]>([]);
  const [open, setOpen] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    clearTimeout(t.current);
    if (!q.trim()) return;
    t.current = setTimeout(() => api(`/search?q=${encodeURIComponent(q)}`).then(setHits).catch(() => setHits([])), 150);
  }, [q]);
  const go = (tk: string) => {
    setOpen(false);
    setQ("");
    router.push(`/company/${encodeURIComponent(tk.trim().toUpperCase().replace(".", "-"))}`);
  };
  return (
    <form role="search" className="relative flex h-[32px] w-[min(420px,100%)] items-center gap-2 rounded border border-line-2 bg-card-2 pr-1 pl-2.5 focus-within:border-accent"
      onSubmit={(e) => { e.preventDefault(); if (q.trim()) go(hits[0]?.ticker === q.trim().toUpperCase() || !hits.length ? q : hits[0].ticker); }}>
      <svg viewBox="0 0 24 24" className="h-4 w-4 flex-none fill-none stroke-[var(--ink-3)]" strokeWidth={2}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
      <input
        aria-label="Search ticker or company" placeholder="Ticker or company name, e.g. ORCL" value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="min-w-0 flex-1 bg-transparent text-[13.5px] text-ink outline-none placeholder:text-ink-3"
      />
      <kbd className="hidden rounded border border-line px-1.5 text-[11px] text-ink-3 sm:block">↵</kbd>
      {open && q.trim() && hits.length > 0 && (
        <ul className="absolute top-[38px] left-0 z-50 w-full overflow-hidden rounded-md border border-line bg-card text-ink shadow-xl">
          {hits.map((h) => (
            <li key={h.ticker}>
              <button type="button" onMouseDown={() => go(h.ticker)} className="flex w-full gap-3 px-3 py-2 text-left hover:bg-card-2">
                <b className="w-16 text-c1">{h.ticker}</b>
                <span className="truncate text-ink-2">{h.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}

export default function Shell({ children }: { children: ReactNode }) {
  const path = usePathname() || "/";
  const m = path.match(/^\/company\/([^/]+)(?:\/([^/]+))?/);
  const [lastTk, setLastTk] = useState<string | null>(null);
  const tk = m ? decodeURIComponent(m[1]) : lastTk;
  const view = m ? m[2] || "overview" : null;
  const [health, setHealth] = useState<any>(null);
  useEffect(() => {
    if (m) setLastTk(decodeURIComponent(m[1]));
  }, [path]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    api("/health").then(setHealth).catch(() => setHealth({ status: "down" }));
  }, []);
  const online = health?.status === "ok";
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 z-30 hidden h-screen w-[228px] shrink-0 flex-col border-r border-line bg-card md:flex">
        <Link href="/" className="flex items-baseline gap-2 border-b border-line px-4 pt-4 pb-3.5">
          <span className="font-serif text-[21px] leading-none font-semibold tracking-tight text-ink">Intrinsic</span>
          <span className="text-[11.5px] text-ink-3">equity research</span>
        </Link>
        <nav className="flex-1 overflow-y-auto px-2 pt-3" aria-label="Sections">
          <Group label="Research">
            <NavLink href="/" icon="home" label="Coverage universe" active={path === "/"} />
            <NavLink href="/screener" icon="screener" label="Peer screener" active={path === "/screener"} />
          </Group>
          <Group label={tk ? <>Company · <span className="text-ink">{tk}</span></> : "Company · none selected"}>
            {COMPANY_VIEWS.map(([v, l]) => (
              <NavLink key={v} href={tk ? `/company/${tk}${v === "overview" ? "" : "/" + v}` : "#"} icon={v} label={l} active={view === v} disabled={!tk} />
            ))}
          </Group>
          <Group label="Tools">
            {GLOBAL.slice(2).map(([href, icon, label]) => <NavLink key={href} href={href} icon={icon} label={label} active={path === href} />)}
          </Group>
          <Group label="About">
            <NavLink href="/architecture" icon="architecture" label="Architecture" active={path === "/architecture"} />
            <NavLink href="/methodology" icon="help" label="Methodology" active={path === "/methodology"} />
          </Group>
        </nav>
        <div className="border-t border-line px-4 py-3 text-[11.5px] leading-snug text-ink-3">
          <div className="flex items-center gap-1.5 text-ink-2">
            <i className={`inline-block h-[6px] w-[6px] rounded-full ${!health ? "bg-ink-4" : online ? "bg-pos" : "bg-warn"}`} />
            {!health ? "Checking data sources…" : online ? "Data sources connected" : "API unavailable"}
          </div>
          <div className="mt-0.5">SEC EDGAR · Yahoo Finance{health?.fredKey ? " · FRED" : ""}</div>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-[50px] items-center gap-4 border-b border-line bg-card px-4 md:px-6">
          <Link href="/" className="font-serif text-[17px] font-semibold text-ink md:hidden">Intrinsic</Link>
          <Search />
          <div className="ml-auto flex items-center gap-3 text-[12px] text-ink-3">
            <span className="hidden lg:inline">Market data delayed · filings as reported</span>
            <ThemeToggle />
          </div>
        </header>
        {!m && (
          <nav className="flex overflow-x-auto border-b border-line bg-card px-2 md:hidden">
            {[...GLOBAL, ["/architecture", "", "Architecture"]].map(([href, , l]) => (
              <Link key={href} href={href} className={`border-b-2 px-3 py-2.5 whitespace-nowrap ${path === href ? "border-accent text-accent" : "border-transparent text-ink-2"}`}>{l}</Link>
            ))}
          </nav>
        )}
        {m && (
          <nav className="flex overflow-x-auto border-b border-line bg-card px-2 md:hidden">
            {COMPANY_VIEWS.map(([v, l]) => (
              <Link key={v} href={`/company/${tk}${v === "overview" ? "" : "/" + v}`} className={`border-b-2 px-3 py-2.5 whitespace-nowrap ${view === v ? "border-accent text-accent" : "border-transparent text-ink-2"}`}>{l}</Link>
            ))}
          </nav>
        )}
        {children}
      </div>
    </div>
  );
}

/** Page header: title row plus an optional strip of labeled filters, closed by an accent rule. */
export function TitleBar({ title, sub, right, back, filters }: { title: ReactNode; sub?: ReactNode; right?: ReactNode; back?: string; filters?: ReactNode }) {
  return (
    <div className="border-b border-line bg-card">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 pt-3 pb-2 md:px-6">
        {back && (
          <Link href={back} aria-label="Back" className="grid place-items-center rounded p-0.5 text-ink-3 hover:text-accent">
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5m6-6-6 6 6 6" /></svg>
          </Link>
        )}
        <div className="min-w-0">
          <h1 className="font-serif text-[25px] leading-tight font-semibold tracking-tight text-balance text-ink">{title}</h1>
          {sub && <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[12.5px] text-ink-3">{sub}</div>}
        </div>
        {right && <div className="ml-auto flex items-baseline gap-2.5 text-right">{right}</div>}
      </div>
      {filters && <div className="flex flex-wrap items-end gap-x-5 gap-y-2 px-4 pt-1 pb-3 md:px-6">{filters}</div>}
    </div>
  );
}

export function Filter({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="flabel">{label}</span>
      {children}
    </label>
  );
}

export const Content = ({ children }: { children: ReactNode }) => <main className="grid w-full max-w-[1560px] gap-4 px-4 pt-5 pb-10 md:px-6">{children}</main>;
export const Section = ({ children }: { children: ReactNode }) => <h2 className="section-head">{children}</h2>;
