// Assemble everything the company pages need for one ticker.
import universe from "@/data/universe.json";
import { CURATED } from "@/lib/universe";
import { memo, NotFound, HOUR } from "./cache";
import { buildFundamentals } from "./fundamentals";
import { companyFacts, normTicker } from "./sec";
import { snapshot } from "./snapshot";
import { aligned, profile } from "./yahoo";

const known = new Map<string, { sector?: string | null; industry?: string | null }>((universe as any).rows?.map((r: any) => [r.ticker, r]) ?? []);

/** Featured peer group for a ticker: its own group, else the group sharing its industry or sector. */
function groupOf(tk: string, y: { industry?: string | null; sector?: string | null }) {
  for (const [g, tks] of Object.entries(CURATED)) if (tks.includes(tk)) return g;
  const entries = Object.entries(CURATED).flatMap(([g, tks]) => tks.map((t) => [g, known.get(t)] as const));
  const hit = entries.find(([, p]) => y.industry && p?.industry === y.industry) ?? entries.find(([, p]) => y.sector && p?.sector === y.sector);
  return hit ? hit[0] : "Other";
}

export function assemble(tk: string) {
  const ticker = normTicker(tk);
  return memo(`company:${ticker}`, 6 * HOUR, async () => {
    const [e, y, px] = await Promise.all([companyFacts(ticker), profile(ticker), aligned(ticker)]);
    const fundamentals = buildFundamentals(e);
    if (!fundamentals) throw new NotFound(`${ticker}: EDGAR filings contain no annual revenue and net income periods to analyze`);
    const meta = { ...e, facts: undefined };
    const group = groupOf(ticker, y);
    return {
      ticker, meta, profile: y, fundamentals, prices: px, snapshot: snapshot(meta, fundamentals, y, px),
      group, defaultPeers: (CURATED[group] ?? []).filter((t) => t !== ticker).slice(0, 6),
    };
  });
}

/** Compact row for the universe table and screener. */
export function summarize(c: Awaited<ReturnType<typeof assemble>>) {
  const s = c.snapshot, closes = (c.prices?.t?.c ?? []).slice(-252).filter((v: number | null) => v != null);
  const keys = ["price", "prev", "mcap", "pe", "fpe", "evEbitda", "evRev", "pb", "ltmGrowth", "cagr3", "gm", "om", "nm", "roe", "roic", "de", "ndEbitda", "divYld", "fcfYld", "street", "r1y", "r3y", "beta"];
  return {
    ticker: c.ticker, name: c.profile.name || c.meta.name, group: c.group, fin: c.fundamentals.fin, sector: c.profile.sector, industry: c.profile.industry,
    rev: c.fundamentals.L.rev, spark: closes.filter((_: unknown, i: number) => i % 5 === 0), ...Object.fromEntries(keys.map((k) => [k, s[k] ?? null])),
  };
}
