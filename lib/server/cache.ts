// In-memory cache for a warm serverless instance. Responses are also cached at the CDN
// through Cache-Control headers, so this only saves repeat work inside one instance.
const store = new Map<string, { at: number; value: Promise<unknown> }>();

export function memo<T>(key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < ttlSeconds * 1000) return hit.value as Promise<T>;
  const value = load();
  store.set(key, { at: Date.now(), value });
  value.catch(() => store.delete(key));
  return value;
}

export const forget = (key: string) => store.delete(key);

export const HOUR = 3600;

/** Cache-Control for JSON responses: fresh for `fresh` seconds at the CDN, then served stale while refreshing. */
export function cacheHeaders(fresh = 6 * HOUR) {
  return { "Cache-Control": `public, s-maxage=${fresh}, stale-while-revalidate=${fresh * 4}` };
}

export class NotFound extends Error {}
