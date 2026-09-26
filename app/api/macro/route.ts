import { macro } from "@/lib/server/macro";
import { respond } from "@/lib/server/respond";

export const maxDuration = 60;

export async function GET() {
  const res = await respond(() => macro());
  // Don't let the CDN hold on to a response without FRED data.
  const body = await res.clone().json().catch(() => null);
  if (!body?.available) res.headers.set("Cache-Control", "no-store");
  return res;
}
