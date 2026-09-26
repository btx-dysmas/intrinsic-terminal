import { respond } from "@/lib/server/respond";
import { insiders } from "@/lib/server/sec";

export const maxDuration = 60;

export async function GET(_req: Request, { params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  return respond(() => insiders(decodeURIComponent(ticker)));
}
