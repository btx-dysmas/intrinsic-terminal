import { cacheHeaders, NotFound } from "./cache";

/** Run a data loader and turn the result (or failure) into a cached JSON response. */
export async function respond(load: () => Promise<unknown>, fresh?: number) {
  try {
    return Response.json(await load(), { headers: cacheHeaders(fresh) });
  } catch (e: any) {
    const status = e instanceof NotFound ? 404 : 502;
    const detail = e instanceof NotFound ? e.message.replace(/^https?:\/\/\S+$/, "Not found on SEC EDGAR") : `Data retrieval failed: ${e.message}`;
    return Response.json({ detail }, { status });
  }
}
