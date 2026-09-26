import { respond } from "@/lib/server/respond";
import { filings } from "@/lib/server/sec";

export async function GET(_req: Request, { params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  return respond(() => filings(decodeURIComponent(ticker)));
}
