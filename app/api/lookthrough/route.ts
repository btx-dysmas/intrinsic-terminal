import { lookThrough } from "@/lib/server/nport";
import { respond } from "@/lib/server/respond";

export const maxDuration = 60;

// Holdings of up to 10 funds, for the portfolio builder's look-through view.
export async function GET(req: Request) {
  const symbols = [...new Set((new URL(req.url).searchParams.get("symbols") ?? "").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean))].slice(0, 10);
  return respond(async () => Object.fromEntries(await Promise.all(symbols.map(async (s) => [s, await lookThrough(s)] as const))), 24 * 3600);
}
