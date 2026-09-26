import { assemble } from "@/lib/server/company";
import { respond } from "@/lib/server/respond";

export const maxDuration = 60;

export async function GET(_req: Request, { params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  return respond(() => assemble(decodeURIComponent(ticker)));
}
