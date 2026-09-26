import { respond } from "@/lib/server/respond";
import { normTicker } from "@/lib/server/sec";
import { headlines } from "@/lib/server/yahoo";

export async function GET(_req: Request, { params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  return respond(() => headlines(normTicker(decodeURIComponent(ticker))), 3600);
}
