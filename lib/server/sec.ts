// SEC EDGAR: company facts (XBRL), submissions (filing index) and Form 4 insider transactions.
import { HOUR, memo, NotFound } from "./cache";

// The SEC asks every automated client to identify itself with a name and contact email.
const UA = process.env.SEC_USER_AGENT?.trim() || "Intrinsic Research Terminal research@example.com";

// SEC fair-access policy: at most 10 requests per second.
let queue: Promise<void> = Promise.resolve();
function throttle() {
  const next = queue.then(() => new Promise<void>((r) => setTimeout(r, 110)));
  queue = next;
  return next;
}

export async function secFetch(url: string): Promise<Response> {
  let last = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    await throttle();
    const r = await fetch(url, { headers: { "User-Agent": UA, "Accept-Encoding": "gzip, deflate" }, cache: "no-store" });
    if (r.ok) return r;
    if (r.status === 404) throw new NotFound(url);
    last = `HTTP ${r.status}`;
    await new Promise((res) => setTimeout(res, 800 * (attempt + 1)));
  }
  throw new Error(`SEC request failed (${last}): ${url}`);
}
const secJson = async (url: string) => (await secFetch(url)).json();

export const normTicker = (tk: string) => tk.trim().toUpperCase().replace(/^\$/, "").replace(".", "-");

export function tickers(): Promise<Map<string, { cik: number; name: string }>> {
  return memo("sec:tickers", 24 * HOUR, async () => {
    const raw: Record<string, { ticker: string; cik_str: number; title: string }> = await secJson("https://www.sec.gov/files/company_tickers.json");
    return new Map(Object.values(raw).map((v) => [v.ticker.toUpperCase(), { cik: v.cik_str, name: v.title }]));
  });
}

const CONCEPTS = new Set(`
Revenues RevenueFromContractWithCustomerExcludingAssessedTax RevenueFromContractWithCustomerIncludingAssessedTax SalesRevenueNet SalesRevenueGoodsNet
RevenuesNetOfInterestExpense InterestIncomeExpenseNet NoninterestIncome
CostOfRevenue CostOfGoodsAndServicesSold CostOfGoodsSold GrossProfit OperatingIncomeLoss NetIncomeLoss ProfitLoss NetIncomeLossAvailableToCommonStockholdersBasic
EarningsPerShareDiluted EarningsPerShareBasic DepreciationDepletionAndAmortization DepreciationAndAmortization DepreciationAmortizationAndAccretionNet
Depreciation DepreciationAmortizationAndOther OtherDepreciationAndAmortization AmortizationOfIntangibleAssets
IncomeTaxExpenseBenefit IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest
IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments
InterestExpense InterestExpenseNonoperating InterestExpenseDebt ResearchAndDevelopmentExpense SellingGeneralAndAdministrativeExpense
CashAndCashEquivalentsAtCarryingValue CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents MarketableSecuritiesCurrent ShortTermInvestments
AvailableForSaleSecuritiesDebtSecuritiesCurrent CashCashEquivalentsAndShortTermInvestments
LongTermDebt LongTermDebtNoncurrent LongTermDebtCurrent DebtCurrent CommercialPaper ShortTermBorrowings OtherShortTermBorrowings
LongTermDebtAndCapitalLeaseObligations LongTermDebtAndCapitalLeaseObligationsCurrent
StockholdersEquity StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest Assets Liabilities LiabilitiesAndStockholdersEquity
AssetsCurrent LiabilitiesCurrent InventoryNet AccountsReceivableNetCurrent Goodwill IntangibleAssetsNetExcludingGoodwill Deposits
NetCashProvidedByUsedInOperatingActivities PaymentsToAcquirePropertyPlantAndEquipment PaymentsToAcquireProductiveAssets PaymentsToAcquireOilAndGasPropertyAndEquipment
NetCashProvidedByUsedInInvestingActivities NetCashProvidedByUsedInFinancingActivities
PaymentsOfDividends PaymentsOfDividendsCommonStock PaymentsForRepurchaseOfCommonStock ShareBasedCompensation AllocatedShareBasedCompensationExpense
WeightedAverageNumberOfDilutedSharesOutstanding CommonStockSharesOutstanding CommonStockDividendsPerShareDeclared CommonStockDividendsPerShareCashPaid
`.split(/\s+/).filter(Boolean));
const FORMS = new Set(["10-K", "10-Q", "10-K/A", "10-Q/A", "10-KT", "20-F", "40-F"]);
// A holding-company reorganization starts a new CIK; the history stays with the predecessor filer.
const PREDECESSORS: Record<string, number[]> = { XOM: [34088] };

export type Facts = Record<string, Record<string, [string, string, number][]>>;

/** Keep only the concepts the model uses, one value per (start, end), taken from the latest filing. */
function trimFacts(cf: any): Facts {
  const out: Facts = {};
  for (const tax of ["us-gaap", "dei"]) {
    for (const [concept, d] of Object.entries<any>(cf?.facts?.[tax] ?? {})) {
      if (tax === "us-gaap" && !CONCEPTS.has(concept)) continue;
      if (tax === "dei" && concept !== "EntityCommonStockSharesOutstanding") continue;
      for (const [unit, arr] of Object.entries<any[]>(d.units ?? {})) {
        const best = new Map<string, { v: number; filed: string; s: string; e: string }>();
        for (const f of arr) {
          if (!FORMS.has(f.form) || f.end < "2018-01-01") continue;
          const k = `${f.start ?? ""}|${f.end}`;
          const cur = best.get(k);
          if (!cur || f.filed > cur.filed) best.set(k, { v: f.val, filed: f.filed, s: f.start ?? "", e: f.end });
        }
        const rows = [...best.values()].map((b) => [b.s, b.e, b.v] as [string, string, number]).sort((a, b) => (a[1] + a[0] < b[1] + b[0] ? -1 : 1));
        if (rows.length) (out[concept] ??= {})[unit] = rows;
      }
    }
  }
  return out;
}

const cik10 = (cik: number) => String(cik).padStart(10, "0");

export function submissions(cik: number): Promise<any> {
  return memo(`sec:sub:${cik}`, 6 * HOUR, () => secJson(`https://data.sec.gov/submissions/CIK${cik10(cik)}.json`));
}

export async function lookup(tk: string) {
  const m = await tickers();
  const hit = m.get(normTicker(tk));
  if (!hit) throw new NotFound(`${normTicker(tk)} is not in the SEC ticker index`);
  return hit;
}

export function companyFacts(tk: string) {
  const ticker = normTicker(tk);
  return memo(`sec:facts:${ticker}`, 6 * HOUR, async () => {
    const { cik, name } = await lookup(ticker);
    const [cf, sub] = await Promise.all([secJson(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik10(cik)}.json`), submissions(cik)]);
    const facts = trimFacts(cf);
    for (const pcik of PREDECESSORS[ticker] ?? []) {
      const old = trimFacts(await secJson(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik10(pcik)}.json`));
      for (const [concept, units] of Object.entries(old))
        for (const [unit, rows] of Object.entries(units)) {
          const cur = ((facts[concept] ??= {})[unit] ??= []);
          const have = new Set(cur.map((r) => `${r[0]}|${r[1]}`));
          cur.push(...rows.filter((r) => !have.has(`${r[0]}|${r[1]}`)));
          cur.sort((a, b) => (a[1] + a[0] < b[1] + b[0] ? -1 : 1));
        }
    }
    if (!Object.keys(facts).length) throw new NotFound(`${ticker} has no US-GAAP XBRL financial statements on EDGAR (IFRS filers are not supported)`);
    const rec = sub.filings?.recent ?? {};
    const i = (rec.form ?? []).findIndex((f: string) => f === "10-K" || f === "10-Q");
    return {
      ticker, cik, name: cf.entityName || name, sic: sub.sic, sicDesc: sub.sicDescription, exchange: sub.exchanges?.[0] ?? "",
      fye: sub.fiscalYearEnd, state: sub.stateOfIncorporation, lastForm: i >= 0 ? rec.form[i] : null, lastFiled: i >= 0 ? rec.filingDate[i] : null, facts,
    };
  });
}

const FILING_FORMS = new Set(["10-K", "10-Q", "8-K", "DEF 14A", "10-K/A", "10-Q/A", "S-1", "S-3"]);

export async function filings(tk: string, limit = 20) {
  const { cik } = await lookup(tk);
  const rec = (await submissions(cik)).filings?.recent ?? {};
  const out: { form: string; date: string; accession: string; description: string; url: string; doc: string | null }[] = [];
  for (let i = 0; i < (rec.form?.length ?? 0) && out.length < limit; i++) {
    if (!FILING_FORMS.has(rec.form[i])) continue;
    const acc = rec.accessionNumber[i];
    out.push({
      form: rec.form[i], date: rec.filingDate[i], accession: acc, description: rec.primaryDocDescription?.[i] || "",
      url: `https://www.sec.gov/Archives/edgar/data/${cik}/${acc.replace(/-/g, "")}/${acc}-index.htm`,
      doc: rec.primaryDocument?.[i] ? `https://www.sec.gov/Archives/edgar/data/${cik}/${acc.replace(/-/g, "")}/${rec.primaryDocument[i]}` : null,
    });
  }
  return out;
}

// ---- Form 4 insider transactions ------------------------------------------------------
const tag = (x: string, name: string) => new RegExp(`<${name}>\\s*([^<]*?)\\s*</${name}>`).exec(x)?.[1] ?? null;
const val = (x: string, name: string) => new RegExp(`<${name}>\\s*<value>\\s*([^<]*?)\\s*</value>`).exec(x)?.[1] ?? null;
const CODE: Record<string, string> = { P: "Open-market purchase", S: "Open-market sale", A: "Grant or award", M: "Option exercise", F: "Tax withholding", G: "Gift", C: "Conversion", D: "Disposition to issuer", X: "Option exercise" };

export async function insiders(tk: string, limit = 25) {
  const { cik } = await lookup(tk);
  return memo(`sec:form4:${cik}`, 6 * HOUR, async () => {
    const rec = (await submissions(cik)).filings?.recent ?? {};
    const idx: number[] = [];
    for (let i = 0; i < (rec.form?.length ?? 0) && idx.length < limit; i++) if (rec.form[i] === "4") idx.push(i);
    const trades: any[] = [];
    for (const i of idx) {
      const acc = rec.accessionNumber[i].replace(/-/g, "");
      const file = String(rec.primaryDocument[i]).split("/").pop();
      let x: string;
      try {
        x = await (await secFetch(`https://www.sec.gov/Archives/edgar/data/${cik}/${acc}/${file}`)).text();
      } catch {
        continue;
      }
      const owner = tag(x, "rptOwnerName") ?? "Unknown";
      const role = tag(x, "officerTitle") || (tag(x, "isDirector") === "1" || tag(x, "isDirector") === "true" ? "Director" : tag(x, "isTenPercentOwner") === "1" ? "10% owner" : "");
      for (const block of x.match(/<nonDerivativeTransaction>[\s\S]*?<\/nonDerivativeTransaction>/g) ?? []) {
        const code = tag(block, "transactionCode") ?? "";
        const shares = Number(val(block, "transactionShares")), price = Number(val(block, "transactionPricePerShare"));
        trades.push({
          filed: rec.filingDate[i], date: val(block, "transactionDate"), owner, role, code, type: CODE[code] ?? code,
          acquired: val(block, "transactionAcquiredDisposedCode") === "A", shares: isFinite(shares) ? shares : null,
          price: isFinite(price) && price > 0 ? price : null, after: Number(val(block, "sharesOwnedFollowingTransaction")) || null,
          url: `https://www.sec.gov/Archives/edgar/data/${cik}/${acc}/${rec.accessionNumber[i]}-index.htm`,
        });
      }
    }
    return trades;
  });
}
