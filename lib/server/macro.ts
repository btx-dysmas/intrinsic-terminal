// FRED macroeconomic series, the Treasury par yield curve and Federal Reserve press releases.
import { forget, HOUR, memo } from "./cache";
import { rss } from "./yahoo";

// Trimmed: a stray space or newline pasted into a dashboard makes FRED reject the key.
const KEY = (process.env.FRED_API_KEY ?? "").trim();
const START = "2007-01-01"; // long enough to include the 2008 and 2020 recessions in the regime history

export const SERIES: [id: string, title: string, units: string, transform?: "yoy"][] = [
  ["DGS10", "10-year Treasury yield", "%"],
  ["DGS2", "2-year Treasury yield", "%"],
  ["T10Y2Y", "10-year less 2-year spread", "pp"],
  ["DFF", "Effective federal funds rate", "%"],
  ["CPIAUCSL", "CPI inflation, year over year", "%", "yoy"],
  ["UNRATE", "Unemployment rate", "%"],
  ["A191RL1Q225SBEA", "Real GDP growth, annualized", "%"],
  ["BAA10Y", "Baa corporate spread over 10-year Treasury", "pp"],
  ["VIXCLS", "CBOE Volatility Index", "index"],
];

async function observations(id: string): Promise<[string, number][]> {
  const q = new URLSearchParams({ series_id: id, api_key: KEY, file_type: "json", observation_start: START });
  const r = await fetch(`https://api.stlouisfed.org/fred/series/observations?${q}`, { cache: "no-store" });
  if (!r.ok) {
    const why = await r.json().then((j) => j.error_message).catch(() => null);
    throw new Error(why ? `FRED: ${why}` : `FRED ${id}: HTTP ${r.status}`);
  }
  const data = await r.json();
  return (data.observations ?? []).filter((o: any) => o.value !== ".").map((o: any) => [o.date, Number(o.value)]);
}

const yoy = (obs: [string, number][]) => {
  const by = new Map(obs);
  return obs.flatMap(([d, v]) => {
    const prev = by.get(`${Number(d.slice(0, 4)) - 1}${d.slice(4)}`);
    return prev ? [[d, Math.round((v / prev - 1) * 10000) / 100] as [string, number]] : [];
  });
};

// Daily series are thinned to one point per week to keep the payload small.
const weekly = (obs: [string, number][]) => {
  const out = new Map<string, [string, number]>();
  for (const [d, v] of obs) {
    const t = new Date(d);
    const week = `${t.getUTCFullYear()}-${Math.floor((t.getTime() - Date.UTC(t.getUTCFullYear(), 0, 1)) / (7 * 864e5))}`;
    out.set(week, [d, v]);
  }
  return [...out.values()];
};

async function treasuryCurve() {
  const year = new Date().getUTCFullYear();
  const get = async (y: number) => {
    const url = `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/${y}/all?type=daily_treasury_yield_curve&field_tdr_date_value=${y}&page&_format=csv`;
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" });
    if (!r.ok) return null;
    const [head, ...lines] = (await r.text()).trim().split("\n");
    const cols = head.split(",").map((c) => c.replace(/"/g, ""));
    return lines.map((l) => {
      const cells = l.split(",");
      const [m, d, yy] = cells[0].split("/");
      return { date: `${yy}-${m}-${d}`, values: Object.fromEntries(cols.slice(1).map((c, i) => [c, cells[i + 1] ? Number(cells[i + 1]) : null])) };
    });
  };
  const [cur, prev] = await Promise.all([get(year), get(year - 1)]);
  const rows = [...(cur ?? []), ...(prev ?? [])].sort((a, b) => (a.date < b.date ? 1 : -1));
  if (!rows.length) return null;
  const tenors = ["1 Mo", "3 Mo", "6 Mo", "1 Yr", "2 Yr", "3 Yr", "5 Yr", "7 Yr", "10 Yr", "20 Yr", "30 Yr"];
  const latest = rows[0];
  const nearest = (daysBack: number) => {
    const target = new Date(Date.parse(latest.date) - daysBack * 864e5).toISOString().slice(0, 10);
    return rows.find((r) => r.date <= target) ?? null;
  };
  const pick = (r: any) => (r ? { date: r.date, yields: tenors.map((t) => r.values[t] ?? null) } : null);
  return { tenors, latest: pick(latest), monthAgo: pick(nearest(30)), yearAgo: pick(nearest(365)) };
}

export async function macro() {
  const m = await memo("macro", 6 * HOUR, async () => {
    const series: Record<string, any> = {};
    if (KEY) {
      await Promise.all(
        SERIES.map(async ([id, title, units, tf]) => {
          try {
            let obs = await observations(id);
            if (tf === "yoy") obs = yoy(obs);
            if (obs.length > 1500) obs = weekly(obs);
            const latest = obs[obs.length - 1] ?? null;
            const yearAgo = latest ? [...obs].reverse().find(([d]) => d <= `${Number(latest[0].slice(0, 4)) - 1}${latest[0].slice(4)}`) : null;
            series[id] = { id, title, units, obs, latest, chg1y: latest && yearAgo ? Math.round((latest[1] - yearAgo[1]) * 100) / 100 : null };
          } catch (e: any) {
            series[id] = { id, title, units, error: e.message };
          }
        }),
      );
    }
    const [curve, fed] = await Promise.all([treasuryCurve().catch(() => null), rss("https://www.federalreserve.gov/feeds/press_all.xml", 6).catch(() => [])]);
    const tenYear = curve?.latest?.yields[8] ?? series.DGS10?.latest?.[1] ?? null;
    return { keyConfigured: !!KEY, available: Object.values(series).some((s) => s.obs), series, curve, fed, riskFree: tenYear != null ? tenYear / 100 : null };
  });
  if (!m.available) forget("macro"); // retry on the next request instead of holding a failure for hours
  return m;
}
