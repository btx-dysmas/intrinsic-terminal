import { respond } from "@/lib/server/respond";
import { tickers } from "@/lib/server/sec";

export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().toUpperCase();
  return respond(async () => {
    if (!q) return [];
    const m = await tickers();
    const byTicker = [...m.keys()].filter((t) => t.startsWith(q)).sort((a, b) => Number(a !== q) - Number(b !== q) || a.length - b.length || a.localeCompare(b));
    const byName = [...m.entries()].filter(([t, v]) => v.name.toUpperCase().includes(q) && !byTicker.includes(t)).map(([t]) => t);
    return [...byTicker, ...byName].slice(0, 10).map((t) => ({ ticker: t, name: m.get(t)!.name }));
  }, 86400);
}
