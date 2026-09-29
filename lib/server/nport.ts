// Fund look-through: what a fund actually owns, from its latest SEC Form N-PORT filing.
// N-PORT lists every position with its weight. Unit investment trusts such as SPY and DIA don't file
// N-PORT, so those fall back to the top ten holdings Yahoo Finance reports.
import { HOUR, memo } from "./cache";
import { secFetch } from "./sec";
import { topHoldings } from "./yahoo";

export type Position = { name: string; cusip: string | null; weight: number; equity: boolean };
export type LookThrough = { symbol: string; source: "N-PORT" | "Yahoo top holdings" | null; period: string | null; count: number; coverage: number; positions: Position[] };

const decode = (x: string) => x.replace(/&amp;/g, "&").replace(/&apos;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const tag = (xml: string, name: string) => { const m = new RegExp(`<${name}>([^<]*)</${name}>`).exec(xml)?.[1]; return m == null ? null : decode(m.trim()); };

function fundIndex() {
  return memo("sec:mf", 24 * HOUR, async () => {
    const j = await (await secFetch("https://www.sec.gov/files/company_tickers_mf.json")).json();
    return new Map<string, string>(j.data.map((r: [number, string, string, string]) => [String(r[3]).toUpperCase(), r[1]]));
  });
}

async function fromNport(symbol: string): Promise<LookThrough | null> {
  const series = (await fundIndex()).get(symbol);
  if (!series) return null;
  const atom = await (await secFetch(`https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${series}&type=NPORT-P&dateb=&owner=include&count=1&output=atom`)).text();
  const index = /<filing-href>(.*?)<\/filing-href>/.exec(atom)?.[1];
  if (!index) return null;
  const page = await (await secFetch(index)).text();
  const doc = [...page.matchAll(/href="(\/Archives\/[^"]+\/primary_doc\.xml)"/g)].map((m) => m[1]).find((p) => !p.includes("xsl"));
  if (!doc) return null;
  const res = await secFetch("https://www.sec.gov" + doc);
  // Bond funds can list tens of thousands of positions; look-through here is about equity exposure.
  if (Number(res.headers.get("content-length") ?? 0) > 25_000_000) return null;
  const xml = await res.text();
  const positions: Position[] = [];
  for (const m of xml.matchAll(/<invstOrSec>([\s\S]*?)<\/invstOrSec>/g)) {
    const x = m[1];
    const w = Number(tag(x, "pctVal") ?? 0) / 100;
    if (!(w > 0)) continue; // short positions and derivatives with negative value
    // Shares of other funds are not company exposure. Some filers mark them as issuer category RF;
    // others file them as ordinary equity (VNQ reports its holding in Vanguard Real Estate II Index
    // Fund that way), so the name is checked too.
    const name = tag(x, "name") ?? tag(x, "title") ?? "";
    const equity = ["EC", "EP"].includes(tag(x, "assetCat") ?? "") && tag(x, "issuerCat") !== "RF" && !/\b(fund|etf)\b/i.test(name);
    positions.push({ name, cusip: tag(x, "cusip"), weight: w, equity });
  }
  positions.sort((a, b) => b.weight - a.weight);
  const top = positions.slice(0, 300); // the long tail adds little and makes the response large
  return { symbol, source: "N-PORT", period: tag(xml, "repPdDate"), count: positions.length, coverage: top.reduce((s, p) => s + p.weight, 0), positions: top };
}

async function fromYahoo(symbol: string): Promise<LookThrough | null> {
  const h = await topHoldings(symbol);
  if (!h?.length) return null;
  return { symbol, source: "Yahoo top holdings", period: null, count: h.length, coverage: h.reduce((s, p) => s + p.weight, 0), positions: h.map((p) => ({ name: p.name, cusip: null, weight: p.weight, equity: true })) };
}

export function lookThrough(symbol: string): Promise<LookThrough> {
  return memo(`lookthrough:v2:${symbol}`, 24 * HOUR, async () => {
    const r = (await fromNport(symbol).catch(() => null)) ?? (await fromYahoo(symbol).catch(() => null));
    return r ?? { symbol, source: null, period: null, count: 0, coverage: 0, positions: [] };
  });
}
