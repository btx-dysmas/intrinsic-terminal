// Refreshes data/universe.json, the featured-company table on the home page and the screener.
// Run with `npm run universe`. A scheduled GitHub Action runs it daily so the deployed site stays current.
import { writeFileSync } from "node:fs";
import { CURATED, CURATED_TICKERS } from "../lib/universe";
import { assemble, summarize } from "../lib/server/company";
import { BENCH, history } from "../lib/server/yahoo";

async function main() {
  const rows: ReturnType<typeof summarize>[] = [];
  const queue = [...CURATED_TICKERS];
  const worker = async () => {
    for (let tk = queue.shift(); tk; tk = queue.shift()) {
      try {
        rows.push(summarize(await assemble(tk)));
        console.log(`ok   ${tk}`);
      } catch (e: any) {
        console.log(`skip ${tk}: ${e.message}`);
      }
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  rows.sort((a, b) => CURATED_TICKERS.indexOf(a.ticker) - CURATED_TICKERS.indexOf(b.ticker));

  const spy = await history(BENCH);
  const a = spy?.rows.a ?? [], c = spy?.rows.c ?? [];
  const bench = spy
    ? { last: c[c.length - 1], prev: c[c.length - 2], r1y: a.length > 253 ? (a[a.length - 1] as number) / (a[a.length - 253] as number) - 1 : null }
    : null;
  const out = { built: new Date().toISOString(), asOf: spy?.dates[spy.dates.length - 1] ?? null, bench, groups: CURATED, rows };
  writeFileSync(new URL("../data/universe.json", import.meta.url), JSON.stringify(out));
  console.log(`\nwrote ${rows.length}/${CURATED_TICKERS.length} companies, prices as of ${out.asOf}`);
}

main();
