// Yahoo Finance: daily prices, company profile, Street consensus, earnings history and headlines.
import { HOUR, memo } from "./cache";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
export const BENCH = "SPY";

const num = (x: any): number | null => {
  const v = typeof x === "object" && x !== null ? x.raw : x;
  return typeof v === "number" && isFinite(v) ? v : null;
};
const isoDay = (sec: number) => new Date(sec * 1000).toISOString().slice(0, 10);

// quoteSummary needs a session cookie plus a matching "crumb" token.
let session: { cookie: string; crumb: string; at: number } | null = null;
async function getSession(force = false) {
  if (session && !force && Date.now() - session.at < 3600_000) return session;
  const r = await fetch("https://fc.yahoo.com", { headers: { "User-Agent": UA }, redirect: "manual", cache: "no-store" });
  const cookie = (r.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
  const c = await fetch("https://query2.finance.yahoo.com/v1/test/getcrumb", { headers: { "User-Agent": UA, Cookie: cookie }, cache: "no-store" });
  session = { cookie, crumb: (await c.text()).trim(), at: Date.now() };
  return session;
}

async function quoteSummary(symbol: string, modules: string[]) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const s = await getSession(attempt > 0);
    const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${modules.join(",")}&crumb=${encodeURIComponent(s.crumb)}`;
    const r = await fetch(url, { headers: { "User-Agent": UA, Cookie: s.cookie }, cache: "no-store" });
    if (r.ok) return (await r.json()).quoteSummary?.result?.[0] ?? null;
    if (r.status !== 401 && r.status !== 403) return null;
  }
  return null;
}

export type History = { dates: string[]; rows: Record<string, (number | null)[]>; divs: [string, number][]; meta: any };

/** Five years of daily OHLC, adjusted close and volume. */
export function history(symbol: string): Promise<History | null> {
  return memo(`yf:chart:${symbol}`, 3 * HOUR, async () => {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5y&interval=1d&events=div`;
    const r = await fetch(url, { headers: { "User-Agent": UA }, cache: "no-store" });
    if (!r.ok) return null;
    const res = (await r.json()).chart?.result?.[0];
    if (!res?.timestamp) return null;
    const q = res.indicators.quote[0], adj = res.indicators.adjclose?.[0]?.adjclose ?? q.close;
    const divs = Object.values<any>(res.events?.dividends ?? {}).map((d) => [isoDay(d.date), d.amount] as [string, number]).sort();
    return { dates: res.timestamp.map(isoDay), rows: { o: q.open, h: q.high, l: q.low, c: q.close, a: adj, v: q.volume }, divs, meta: res.meta };
  });
}

/** Price arrays for `symbol` aligned to the benchmark's trading calendar. */
export async function aligned(symbol: string) {
  const [bench, own] = await Promise.all([history(BENCH), history(symbol)]);
  if (!bench) return null;
  const idx = new Map(own?.dates.map((d, i) => [d, i]) ?? []);
  const round = (v: any) => (typeof v === "number" && isFinite(v) ? Math.round(v * 100) / 100 : null);
  const pick = (k: string) =>
    bench.dates.map((d) => {
      const i = idx.get(d);
      const v = i == null ? null : own!.rows[k][i];
      return k === "v" ? (v == null ? null : Math.round(v)) : round(v);
    });
  return {
    dates: bench.dates,
    t: own ? { o: pick("o"), h: pick("h"), l: pick("l"), c: pick("c"), a: pick("a"), v: pick("v") } : null,
    bench: bench.rows.a.map(round),
    divs: own?.divs ?? [],
  };
}

const est = (e: any, kind: "earningsEstimate" | "revenueEstimate") => {
  const x = e?.[kind];
  if (!x) return null;
  return { avg: num(x.avg), low: num(x.low), high: num(x.high), n: num(x.numberOfAnalysts), growth: num(x.growth), yearAgo: num(kind === "earningsEstimate" ? x.yearAgoEps : x.yearAgoRevenue) };
};

/** Profile, market statistics, analyst estimates, price targets and earnings history. */
export function profile(symbol: string) {
  return memo(`yf:profile:${symbol}`, 6 * HOUR, async () => {
    const q = await quoteSummary(symbol, ["assetProfile", "price", "summaryDetail", "defaultKeyStatistics", "financialData", "recommendationTrend", "earningsTrend", "calendarEvents", "earningsHistory"]);
    const ap = q?.assetProfile ?? {}, pr = q?.price ?? {}, sd = q?.summaryDetail ?? {}, ks = q?.defaultKeyStatistics ?? {}, fd = q?.financialData ?? {};
    const trend = Object.fromEntries((q?.earningsTrend?.trend ?? []).map((t: any) => [t.period, t]));
    const rec = q?.recommendationTrend?.trend?.find((t: any) => t.period === "0m");
    const next = q?.calendarEvents?.earnings?.earningsDate?.[0];
    return {
      name: pr.longName || pr.shortName || null, quoteType: pr.quoteType ?? null, sector: ap.sector ?? null, industry: ap.industry ?? null,
      summary: ap.longBusinessSummary ?? null, employees: ap.fullTimeEmployees ?? null, website: ap.website ?? null,
      hq: [ap.city, ap.state, ap.country].filter(Boolean).join(", "), exchange: pr.exchangeName ?? null, currency: pr.currency ?? null,
      price: num(fd.currentPrice) ?? num(pr.regularMarketPrice), mcap: num(pr.marketCap) ?? num(sd.marketCap), ev: num(ks.enterpriseValue),
      beta: num(sd.beta) ?? num(ks.beta), trailingEps: num(ks.trailingEps), fwdEps: num(ks.forwardEps), fwdPE: num(sd.forwardPE),
      targetMean: num(fd.targetMeanPrice), targetMedian: num(fd.targetMedianPrice), targetHigh: num(fd.targetHighPrice), targetLow: num(fd.targetLowPrice),
      nAnalysts: num(fd.numberOfAnalystOpinions), recKey: fd.recommendationKey ?? null, recMean: num(fd.recommendationMean),
      instPct: num(ks.heldPercentInstitutions), insiderPct: num(ks.heldPercentInsiders), shortPct: num(ks.shortPercentOfFloat),
      nextEarnings: next ? isoDay(num(next)!) : null,
      est: {
        eps: { "0q": est(trend["0q"], "earningsEstimate"), "+1q": est(trend["+1q"], "earningsEstimate"), "0y": est(trend["0y"], "earningsEstimate"), "+1y": est(trend["+1y"], "earningsEstimate") },
        rev: { "0q": est(trend["0q"], "revenueEstimate"), "+1q": est(trend["+1q"], "revenueEstimate"), "0y": est(trend["0y"], "revenueEstimate"), "+1y": est(trend["+1y"], "revenueEstimate") },
      },
      recs: rec ? { strongBuy: rec.strongBuy, buy: rec.buy, hold: rec.hold, sell: rec.sell, strongSell: rec.strongSell } : null,
      surprises: (q?.earningsHistory?.history ?? []).map((h: any) => ({
        quarter: num(h.quarter) ? isoDay(num(h.quarter)!) : null, actual: num(h.epsActual), estimate: num(h.epsEstimate), surprise: num(h.surprisePercent),
      })),
    };
  });
}
export type Profile = Awaited<ReturnType<typeof profile>>;

/** Sector (for stocks) and instrument type, used by the portfolio builder. */
export function classify(symbol: string) {
  return memo(`yf:class:${symbol}`, 24 * HOUR, async () => {
    const q = await quoteSummary(symbol, ["assetProfile", "price"]);
    return { name: q?.price?.longName || q?.price?.shortName || symbol, type: q?.price?.quoteType ?? null, sector: q?.assetProfile?.sector ?? null };
  });
}

const decode = (s: string) => s.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();

export async function rss(url: string, limit = 8) {
  const r = await fetch(url, { headers: { "User-Agent": UA }, cache: "no-store" });
  if (!r.ok) return [];
  const xml = await r.text();
  return (xml.match(/<item>[\s\S]*?<\/item>/g) ?? []).slice(0, limit).map((it) => ({
    title: decode(/<title>([\s\S]*?)<\/title>/.exec(it)?.[1] ?? ""),
    link: decode(/<link>([\s\S]*?)<\/link>/.exec(it)?.[1] ?? ""),
    date: /<pubDate>([\s\S]*?)<\/pubDate>/.exec(it)?.[1] ?? null,
  }));
}

export const headlines = (symbol: string) =>
  memo(`yf:news:${symbol}`, HOUR, () => rss(`https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(symbol)}&region=US&lang=en-US`));
