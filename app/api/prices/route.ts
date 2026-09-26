import { respond } from "@/lib/server/respond";
import { aligned, classify } from "@/lib/server/yahoo";

export const maxDuration = 60;

// Daily adjusted closes for up to 15 symbols on one calendar, with name, type and sector for each.
export async function GET(req: Request) {
  const symbols = [...new Set((new URL(req.url).searchParams.get("symbols") ?? "").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean))].slice(0, 15);
  return respond(async () => {
    const out: Record<string, any> = {};
    let dates: string[] = [], bench: (number | null)[] = [];
    await Promise.all(
      symbols.map(async (s) => {
        const [px, info] = await Promise.all([aligned(s), classify(s).catch(() => null)]);
        if (!px) return;
        dates = px.dates;
        bench = px.bench;
        out[s] = { a: px.t?.a ?? null, ...info };
      }),
    );
    return { dates, bench, series: out };
  }, 3 * 3600);
}
