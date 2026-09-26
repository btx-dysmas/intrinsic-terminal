// Thin client for the app's own route handlers under /api.
export type Co = any;

export async function api<T = any>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`/api${path}`, init);
  let j: any = {};
  try {
    j = await r.json();
  } catch {
    /* non-JSON error page */
  }
  if (!r.ok) throw new Error(j.detail || `Request failed (HTTP ${r.status}).`);
  return j as T;
}

/** Flatten the /api/company payload into the object the models and views work with. */
export function toCo(j: any): Co {
  const f = j.fundamentals, s = j.snapshot;
  return {
    ...s,
    tk: j.ticker,
    raw: j.meta,
    y: j.profile || {},
    A: f.A, Q: f.Q, L: f.L, LP: f.LP, LB: f.LB,
    fin: f.fin, ins: f.ins, opDerived: f.opDerived,
    px: j.prices,
    hasPx: !!(j.prices && j.prices.t),
    name: j.profile?.name || j.meta.name,
    group: j.group,
    sector: j.profile?.sector || "n/a",
    industry: j.profile?.industry || j.meta.sicDesc || "n/a",
    defaultPeers: j.defaultPeers || [],
  };
}

const companies = new Map<string, Promise<Co>>();
export function getCompany(tk: string): Promise<Co> {
  const key = tk.toUpperCase().replace(".", "-");
  if (!companies.has(key)) {
    const p = api(`/company/${encodeURIComponent(key)}`).then(toCo);
    p.catch(() => companies.delete(key));
    companies.set(key, p);
  }
  return companies.get(key)!;
}

let macroP: Promise<any> | null = null;
export function getMacro() {
  if (!macroP) {
    macroP = api("/macro");
    macroP.catch(() => (macroP = null));
  }
  return macroP;
}
