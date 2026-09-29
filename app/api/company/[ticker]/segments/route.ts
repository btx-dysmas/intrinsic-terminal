import { respond } from "@/lib/server/respond";
import { segments } from "@/lib/server/segments";

export const maxDuration = 60;

export async function GET(_req: Request, { params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  return respond(() => segments(decodeURIComponent(ticker).toUpperCase()), 24 * 3600);
}
