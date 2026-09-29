// Segment revenue and operating income from the XBRL in each 10-K.
// The company-facts API only carries consolidated figures; anything broken down by a dimension
// (segment, product line, region) is left out. Those facts are still in each filing's XBRL
// instance, so this reads the instance directly: contexts with exactly one segment, product or
// geography member, full fiscal years only, labeled with the company's own names from MetaLinks.
// The last three 10-Ks are read; newer filings win where years overlap, so recast history is used.
import { HOUR, memo } from "./cache";
import { lookup, secFetch, submissions } from "./sec";

const REVENUE = [
  "RevenueFromContractWithCustomerExcludingAssessedTax", "Revenues", "RevenueFromContractWithCustomerIncludingAssessedTax",
  "SalesRevenueNet", "RevenuesNetOfInterestExpense", "SalesRevenueGoodsNet", "SalesRevenueServicesNet",
];
const OPERATING = ["OperatingIncomeLoss", "SegmentReportingInformationOperatingIncomeLoss"];
const AXES: Record<string, [Axis, string]> = {
  StatementBusinessSegmentsAxis: ["segment", "Reportable segments"],
  ProductOrServiceAxis: ["product", "Products and services"],
  StatementGeographicalAxis: ["geography", "Geography"],
};
const COUNTRY: Record<string, string> = {
  US: "United States", CN: "China", JP: "Japan", GB: "United Kingdom", DE: "Germany", FR: "France", IN: "India", CA: "Canada",
  IE: "Ireland", TW: "Taiwan", KR: "South Korea", SG: "Singapore", NL: "Netherlands", CH: "Switzerland", MX: "Mexico", BR: "Brazil",
};

type Axis = "segment" | "product" | "geography";
type Values = Record<string, number>; // period end -> value
type Parsed = { total: Record<string, Values>; axes: Partial<Record<Axis, Record<string, Record<string, Values>>>>; labels: Record<string, string> };

export type SegmentRow = { member: string; label: string; parent: string | null; revenue: (number | null)[]; operatingIncome: (number | null)[] | null };
export type Breakdown = {
  key: string; axis: Axis; title: string; concept: string; operatingConcept: string | null;
  years: string[]; total: (number | null)[]; coverage: (number | null)[]; restated: boolean; rows: SegmentRow[];
};
export type Segments = { breakdowns: Breakdown[]; filings: { accession: string; filed: string }[]; reason: string | null };

const local = (q: string) => q.slice(q.lastIndexOf(":") + 1);
const days = (s: string, e: string) => (Date.parse(e) - Date.parse(s)) / 864e5;
const unescape = (s: string) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'");

function label(member: string, tags: Record<string, any>): string {
  const role = tags[member.replace(":", "_")]?.lang?.["en-us"]?.role;
  let text: string | undefined = role?.terseLabel || role?.label;
  if (!text) {
    const [prefix, name] = member.includes(":") ? member.split(":", 2) : ["", member];
    if (prefix === "country" && COUNTRY[name]) return COUNTRY[name];
    text = name.replace(/(?<=[a-z0-9])(?=[A-Z])/g, " ");
  }
  text = unescape(text).replace(/\s*\[(Member|Domain)\]\s*$/, "").trim();
  for (let i = 0; i < 2; i++) text = text.replace(/\s+(Segment|Member)$/i, ""); // "North America Segment Member"
  return text === text.toUpperCase() && text.length > 4 ? text.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : text;
}

async function readFiling(cik: number, accession: string): Promise<Parsed | null> {
  const base = `https://www.sec.gov/Archives/edgar/data/${cik}/${accession.replace(/-/g, "")}/`;
  const idx = await (await secFetch(base + "index.json")).json();
  const names: string[] = idx.directory.item.map((i: any) => i.name);
  const inst = names.find((n) => n.endsWith("_htm.xml")) ?? names.find((n) => n.endsWith(".xml") && !/(_cal|_def|_lab|_pre|FilingSummary)\.xml$/.test(n) && !n.startsWith("R"));
  if (!inst) return null;
  const xml = await (await secFetch(base + inst)).text();
  let tags: Record<string, any> = {};
  if (names.includes("MetaLinks.json")) {
    try {
      const ml = await (await secFetch(base + "MetaLinks.json")).json();
      for (const doc of Object.values<any>(ml.instance ?? {})) tags = { ...tags, ...(doc.tag ?? {}) };
    } catch { /* labels fall back to the element name */ }
  }

  // Contexts: full fiscal years with no dimension (totals) or exactly one segment-type member.
  const ctx = new Map<string, { end: string; axis: Axis | null; member: string | null }>();
  for (const m of xml.matchAll(/<(?:xbrli:)?context\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/(?:xbrli:)?context>/g)) {
    const body = m[2];
    const start = /<(?:xbrli:)?startDate>([^<]+)</.exec(body)?.[1], end = /<(?:xbrli:)?endDate>([^<]+)</.exec(body)?.[1];
    if (!start || !end || days(start, end) < 330 || days(start, end) > 400 || /typedMember/.test(body)) continue;
    const dims = [...body.matchAll(/<xbrldi:explicitMember[^>]*dimension="([^"]+)"[^>]*>([^<]+)</g)]
      .map((d) => [d[1], d[2].trim()] as const)
      .filter(([d, v]) => !(local(d) === "ConsolidationItemsAxis" && local(v) === "OperatingSegmentsMember")); // added next to the segment in newer filings
    if (!dims.length) ctx.set(m[1], { end, axis: null, member: null });
    else if (dims.length === 1 && AXES[local(dims[0][0])]) ctx.set(m[1], { end, axis: AXES[local(dims[0][0])][0], member: dims[0][1] });
  }

  const wanted = new Set([...REVENUE, ...OPERATING]);
  const out: Parsed = { total: {}, axes: {}, labels: {} };
  for (const m of xml.matchAll(/<us-gaap:(\w+)\b([^>]*?)>([^<]*)<\/us-gaap:\1>/g)) {
    if (!wanted.has(m[1])) continue;
    const ref = /contextRef="([^"]+)"/.exec(m[2])?.[1];
    const c = ref ? ctx.get(ref) : undefined;
    const v = Number(m[3]);
    if (!c || !m[3].trim() || !Number.isFinite(v)) continue;
    if (!c.axis) ((out.total[m[1]] ??= {})[c.end] = v);
    else (((out.axes[c.axis] ??= {})[m[1]] ??= {})[c.member!] ??= {})[c.end] = v;
  }
  for (const concepts of Object.values(out.axes)) for (const byMember of Object.values(concepts!)) for (const mem of Object.keys(byMember)) out.labels[mem] ??= label(mem, tags);
  return out;
}

const pick = (concepts: Record<string, unknown>, names: string[]) =>
  names.filter((n) => n in concepts).sort((a, b) => Object.keys(concepts[b] as object).length - Object.keys(concepts[a] as object).length || names.indexOf(a) - names.indexOf(b))[0] ?? null;

const close = (a: number, b: number, tol = 0.006) => b !== 0 && Math.abs(a / b - 1) < tol;

function* subsets<T>(xs: T[]): Generator<T[]> {
  const n = xs.length;
  for (let mask = 1; mask < 1 << n; mask++) {
    if ((mask & (mask - 1)) === 0) continue; // two or more members
    yield xs.filter((_, i) => mask & (1 << i));
  }
}

/** How a breakdown's members relate, from the latest year's figures.
 *  Companies tag the same revenue twice: Microsoft reports Product and Service next to its own
 *  product lines (two complete breakdowns), and Apple reports Products next to iPhone, Mac and iPad
 *  (a subtotal). Returns groups that each stand alone and a map from child member to parent. */
function structure(members: string[], latest: Values, total: number | undefined, prior: Values) {
  members = members.slice(0, 16);
  const val = (m: string) => latest[m] ?? 0;
  const sum = (ms: string[], v = val) => ms.reduce((s, m) => s + v(m), 0);
  if (total && close(sum(members), total, 0.02)) return { groups: [members], parent: {} as Record<string, string> };
  if (total) {
    for (const a of subsets(members)) {
      const b = members.filter((m) => !a.includes(m));
      if (b.length >= 2 && close(sum(a), total, 0.02) && close(sum(b), total, 0.02)) {
        const [first, second] = a.length >= b.length ? [a, b] : [b, a];
        const byValue = (g: string[]) => [...g].sort((x, y) => val(y) - val(x));
        return { groups: [byValue(first), byValue(second)], parent: {} as Record<string, string> };
      }
    }
  }
  // Subtotals: a member equal to the sum of smaller members, in both of the last two years.
  const parent: Record<string, string> = {};
  for (const p of [...members].sort((x, y) => val(y) - val(x))) {
    if (parent[p] || val(p) <= 0) continue;
    const pool = members.filter((m) => m !== p && !parent[m] && val(m) > 0 && val(m) < val(p));
    if (pool.length > 14) continue;
    let best: string[] | null = null, bestErr = 0.002;
    for (const s of subsets(pool)) {
      const err = Math.abs(sum(s) / val(p) - 1);
      const holds = !prior[p] || close(s.reduce((t, m) => t + (prior[m] ?? 0), 0), prior[p], 0.004);
      if (err < bestErr && holds) { best = s; bestErr = err; }
    }
    best?.forEach((c) => (parent[c] = p));
  }
  return { groups: [members], parent };
}

export function segments(tk: string): Promise<Segments> {
  return memo(`segments:${tk}`, 24 * HOUR, async () => {
    const { cik } = await lookup(tk);
    const rec = (await submissions(cik)).filings?.recent ?? {};
    const tenks: { accession: string; filed: string }[] = [];
    for (let i = 0; i < (rec.form?.length ?? 0) && tenks.length < 3; i++)
      if (rec.form[i] === "10-K" && (rec.isXBRL?.[i] || rec.isInlineXBRL?.[i])) tenks.push({ accession: rec.accessionNumber[i], filed: rec.filingDate[i] });
    if (!tenks.length) return { breakdowns: [], filings: [], reason: "No 10-K with XBRL data on file." };

    const parsed: { f: (typeof tenks)[number]; p: Parsed }[] = [];
    for (const f of tenks) {
      const p = await readFiling(cik, f.accession).catch(() => null);
      if (p) parsed.push({ f, p });
    }
    if (!parsed.length) return { breakdowns: [], filings: [], reason: "The 10-K XBRL could not be read." };
    const newest = parsed[0].p;

    // Consolidated revenue by year, newest filing first; older filings may use another concept.
    const totalConcept = pick(newest.total, REVENUE);
    const total: Values = {};
    for (const c of [totalConcept, ...REVENUE.filter((x) => x !== totalConcept)])
      for (const { p } of parsed) for (const [end, v] of Object.entries(p.total[c ?? ""] ?? {})) total[end] ??= v;

    const breakdowns: Breakdown[] = [];
    for (const [axis, title] of Object.values(AXES)) {
      const concepts = newest.axes[axis];
      if (!concepts) continue;
      const rc = pick(concepts, REVENUE);
      if (!rc) continue;
      const oc = pick(concepts, OPERATING);
      const ends = Object.values(concepts[rc]).flatMap((v) => Object.keys(v));
      const latestEnd = ends.reduce((a, b) => (a > b ? a : b));
      const prevEnd = ends.filter((e) => e < latestEnd).reduce((a, b) => (a > b ? a : b), "");
      const latest: Values = {}, prior: Values = {};
      for (const [m, v] of Object.entries(concepts[rc])) {
        if (v[latestEnd] != null) latest[m] = v[latestEnd];
        if (prevEnd && v[prevEnd] != null) prior[m] = v[prevEnd];
      }
      const { groups, parent } = structure(Object.keys(latest).sort((a, b) => latest[b] - latest[a]), latest, total[latestEnd], prior);

      groups.forEach((group, n) => {
        // Older 10-Ks are used only while they agree with newer ones on shared years; a disagreement
        // means the company reorganized, and older figures describe different segments.
        const usable = [parsed[0]];
        for (const entry of parsed.slice(1)) {
          const older = entry.p.axes[axis]?.[rc] ?? {};
          const clash = group.some((m) => Object.entries(older[m] ?? {}).some(([end, v]) =>
            usable.some((u) => { const w = u.p.axes[axis]?.[rc]?.[m]?.[end]; return w && v && Math.abs(v / w - 1) > 0.015; })));
          if (clash) break;
          usable.push(entry);
        }
        const rows = group.map((m) => {
          const rev: Values = {}, op: Values = {};
          for (const { p } of usable) {
            for (const [e, v] of Object.entries(p.axes[axis]?.[rc]?.[m] ?? {})) rev[e] ??= v;
            if (oc) for (const [e, v] of Object.entries(p.axes[axis]?.[oc]?.[m] ?? {})) op[e] ??= v;
          }
          return { member: m, label: newest.labels[m] ?? m, parent: parent[m] ?? null, rev, op };
        });
        const top = rows.filter((r) => !r.parent);
        const ordered = top.flatMap((r) => [r, ...rows.filter((c) => c.parent === r.member)]);
        const sums = (y: string) => top.reduce((s, r) => s + (r.rev[y] ?? 0), 0);
        const years = [...new Set(rows.flatMap((r) => Object.keys(r.rev)))].filter((y) => y <= latestEnd).sort().slice(-6)
          // Drop early years that today's members only partly cover (before a reorganization).
          .filter((y) => (total[y] ? sums(y) / total[y] >= 0.85 : top.every((r) => y in r.rev)));
        const hasOi = rows.some((r) => Object.keys(r.op).length);
        breakdowns.push({
          key: n ? `${axis}-alt` : axis, axis, title: n ? `${title} (summary)` : title, concept: rc, operatingConcept: hasOi ? oc : null,
          years, total: years.map((y) => total[y] ?? null),
          coverage: years.map((y) => (total[y] ? sums(y) / total[y] : null)),
          restated: usable.length < parsed.length,
          rows: ordered.map((r) => ({
            member: r.member, label: r.label, parent: r.parent,
            revenue: years.map((y) => r.rev[y] ?? null),
            operatingIncome: Object.keys(r.op).length ? years.map((y) => r.op[y] ?? null) : null,
          })),
        });
      });
    }
    return {
      breakdowns,
      filings: parsed.map(({ f }) => f),
      reason: breakdowns.length ? null : "The 10-K does not tag revenue by segment, product or region.",
    };
  });
}
