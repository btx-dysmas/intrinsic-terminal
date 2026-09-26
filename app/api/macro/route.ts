import { macro } from "@/lib/server/macro";
import { respond } from "@/lib/server/respond";

export const maxDuration = 60;

export async function GET() {
  return respond(() => macro());
}
