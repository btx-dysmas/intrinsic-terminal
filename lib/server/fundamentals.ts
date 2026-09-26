// Turn EDGAR company facts into annual, quarterly and last-twelve-month statements.
import type { Facts } from "./sec";

const C: Record<string, string[]> = {
  rev: ["RevenueFromContractWithCustomerExcludingAssessedTax", "Revenues", "RevenuesNetOfInterestExpense", "SalesRevenueNet", "RevenueFromContractWithCustomerIncludingAssessedTax", "SalesRevenueGoodsNet"],
  cogs: ["CostOfRevenue", "CostOfGoodsAndServicesSold", "CostOfGoodsSold"],
  gp: ["GrossProfit"], op: ["OperatingIncomeLoss"],
  ni: ["NetIncomeLoss", "NetIncomeLossAvailableToCommonStockholdersBasic", "ProfitLoss"],
  dep2: ["OtherDepreciationAndAmortization", "Depreciation"], amort: ["AmortizationOfIntangibleAssets"],
  eps: ["EarningsPerShareDiluted", "EarningsPerShareBasic"],
  da: ["DepreciationDepletionAndAmortization", "DepreciationAndAmortization", "DepreciationAmortizationAndAccretionNet", "DepreciationAmortizationAndOther"],
  tax: ["IncomeTaxExpenseBenefit"],
  pretax: ["IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest", "IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments"],
  int: ["InterestExpense", "InterestExpenseNonoperating", "InterestExpenseDebt"],
  nii: ["InterestIncomeExpenseNet"], nonii: ["NoninterestIncome"],
  rnd: ["ResearchAndDevelopmentExpense"], sga: ["SellingGeneralAndAdministrativeExpense"],
  ocf: ["NetCashProvidedByUsedInOperatingActivities"],
  capex: ["PaymentsToAcquirePropertyPlantAndEquipment", "PaymentsToAcquireProductiveAssets", "PaymentsToAcquireOilAndGasPropertyAndEquipment"],
  cfi: ["NetCashProvidedByUsedInInvestingActivities"], cff: ["NetCashProvidedByUsedInFinancingActivities"],
  divp: ["PaymentsOfDividends", "PaymentsOfDividendsCommonStock"], buyback: ["PaymentsForRepurchaseOfCommonStock"],
  sbc: ["ShareBasedCompensation", "AllocatedShareBasedCompensationExpense"],
  dil: ["WeightedAverageNumberOfDilutedSharesOutstanding"],
  dps: ["CommonStockDividendsPerShareDeclared", "CommonStockDividendsPerShareCashPaid"],
  cash: ["CashAndCashEquivalentsAtCarryingValue", "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents"],
  stinv: ["MarketableSecuritiesCurrent", "ShortTermInvestments", "AvailableForSaleSecuritiesDebtSecuritiesCurrent"],
  cashsti: ["CashCashEquivalentsAndShortTermInvestments"],
  recv: ["AccountsReceivableNetCurrent"], inv: ["InventoryNet"], gw: ["Goodwill"], intang: ["IntangibleAssetsNetExcludingGoodwill"],
  dep: ["Deposits"], ca: ["AssetsCurrent"], ta: ["Assets"], cl: ["LiabilitiesCurrent"], tl: ["Liabilities"],
  lse: ["LiabilitiesAndStockholdersEquity"], eq: ["StockholdersEquity"], eqnci: ["StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"],
  ltd: ["LongTermDebt"], ltdnc: ["LongTermDebtNoncurrent"], ltdc: ["LongTermDebtCurrent"], debtc: ["DebtCurrent"],
  cp: ["CommercialPaper"], stb: ["ShortTermBorrowings", "OtherShortTermBorrowings"],
  ltdcl: ["LongTermDebtAndCapitalLeaseObligations"], ltdclc: ["LongTermDebtAndCapitalLeaseObligationsCurrent"],
  shs: ["EntityCommonStockSharesOutstanding"],
};
const UNIT: Record<string, string> = { eps: "USD/shares", dps: "USD/shares", dil: "shares", shs: "shares" };
const TAKE_MAX = new Set(["rev", "da", "capex", "divp", "sbc"]);
const NOT_ADDITIVE = new Set(["eps", "dps", "dil", "shs"]); // per-share figures and share counts cannot be summed across quarters
const FLOW = ["rev", "cogs", "gp", "op", "ni", "eps", "da", "ebitda", "pretax", "tax", "int", "rnd", "sga", "ocf", "capex", "fcf", "cfi", "cff", "divp", "buyback", "sbc", "nii", "nonii"];

const days = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 864e5;
const has = (v: unknown): v is number => typeof v === "number" && isFinite(v);

export const isFinancial = (sic: unknown) => {
  const s = Number(sic);
  return s >= 6000 && s <= 6499 && s !== 6324; // banks, brokers, insurers; managed care is analyzed as an operating company
};
export const isInsurer = (sic: unknown) => Number(sic) >= 6300 && Number(sic) <= 6411;

type Series = { A: Record<string, number>; Q: Record<string, number>; I: Record<string, number> };

/**
 * Split facts into annual, quarterly and point-in-time values. 10-Q cash flow statements are
 * year-to-date, so quarters are derived by differencing cumulative periods that share a start date.
 */
function periodize(rows: [string, string, number][], derive: boolean): Series {
  const A: Record<string, number> = {}, Q: Record<string, number> = {}, I: Record<string, number> = {};
  const groups: Record<string, [string, number][]> = {};
  for (const [s, e, v] of rows) {
    if (!s) { I[e] = v; continue; }
    const d = days(s, e);
    if (d >= 350 && d <= 380) A[e] = v;
    if (d >= 75 && d <= 120) Q[e] = v;
    (groups[s] ??= []).push([e, v]);
  }
  if (derive)
    for (const g of Object.values(groups)) {
      g.sort((a, b) => (a[0] < b[0] ? -1 : 1));
      for (let i = 1; i < g.length; i++) {
        const gap = days(g[i - 1][0], g[i][0]);
        if (gap >= 75 && gap <= 120 && Q[g[i][0]] == null) Q[g[i][0]] = g[i][1] - g[i - 1][1];
      }
    }
  return { A, Q, I };
}

function metric(facts: Facts, key: string): Series {
  const out: Series = { A: {}, Q: {}, I: {} };
  for (const c of C[key]) {
    const rows = facts[c]?.[UNIT[key] ?? "USD"];
    if (!rows) continue;
    const p = periodize(rows, !NOT_ADDITIVE.has(key));
    if (key === "dil") for (const [e, v] of Object.entries(p.A)) p.Q[e] ??= v;
    for (const k of ["A", "Q", "I"] as const)
      for (const [e, v] of Object.entries(p[k])) {
        const cur = out[k][e];
        if (cur == null || (TAKE_MAX.has(key) && v > cur)) out[k][e] = v;
      }
  }
  return out;
}

export function buildFundamentals(e: { facts: Facts; sic?: unknown }) {
  const fin = isFinancial(e.sic), ins = isInsurer(e.sic);
  const M: Record<string, Series> = {};
  for (const k of Object.keys(C)) M[k] = metric(e.facts, k);
  const at = (k: string, d: string) => M[k].I[d] ?? null;

  const debtAt = (d: string) => {
    const st = at("cp", d) ?? at("stb", d) ?? 0;
    if (at("ltd", d) != null) return at("ltd", d)! + st;
    if (at("ltdnc", d) != null) return at("ltdnc", d)! + (at("debtc", d) ?? (at("ltdc", d) ?? 0) + st);
    if (at("ltdcl", d) != null) return at("ltdcl", d)! + (at("debtc", d) ?? (at("ltdclc", d) ?? 0) + st);
    return (at("debtc", d) ?? 0) + st || null;
  };

  const balance = (o: any, d: string) => {
    o.cash = at("cash", d);
    o.stinv = at("stinv", d) ?? (at("cashsti", d) != null && o.cash != null ? at("cashsti", d)! - o.cash : 0);
    for (const k of ["recv", "inv", "ca", "ta", "cl", "gw", "intang"]) o[k] = at(k, d);
    o.deposits = at("dep", d);
    o.eq = at("eq", d) ?? at("eqnci", d);
    const eqn = at("eqnci", d) ?? o.eq;
    o.tl = at("tl", d) ?? (at("lse", d) != null && eqn != null ? at("lse", d)! - eqn : null);
    o.debt = debtAt(d) ?? 0;
    // Insurers' investment portfolios back policy liabilities, so they are not netted against debt.
    o.netDebt = o.debt - (o.cash ?? 0) - (ins ? 0 : o.stinv ?? 0);
    o.tbv = o.eq != null ? o.eq - (o.gw ?? 0) - (o.intang ?? 0) : null;
    return o;
  };

  const record = (type: "A" | "Q", d: string) => {
    const g = (k: string) => M[k][type][d] ?? null;
    const o: any = { type, end: d, rev: g("rev"), cogs: g("cogs") };
    o.gp = g("gp") ?? (has(o.rev) && has(o.cogs) ? o.rev - o.cogs : null);
    if (o.cogs == null && has(o.gp) && has(o.rev)) o.cogs = o.rev - o.gp;
    Object.assign(o, { op: g("op"), ni: g("ni"), eps: g("eps"), da: g("da") });
    const d2 = g("dep2"), am = g("amort");
    if (has(d2) && has(am) && (o.da == null || d2 + am > o.da)) o.da = d2 + am;
    else if (o.da == null && has(d2)) o.da = d2;
    for (const k of ["pretax", "tax", "int", "rnd", "sga", "dil", "nii", "nonii", "ocf", "capex", "cfi", "cff", "divp", "buyback", "sbc", "dps"]) o[k] = g(k);
    o.opDerived = false;
    if (!fin && o.op == null && has(o.pretax)) {
      o.op = o.pretax + (o.int ?? 0); // EBIT proxy where operating income is not tagged
      o.opDerived = true;
    }
    o.ebitda = has(o.op) && has(o.da) ? o.op + o.da : null;
    o.fcf = has(o.ocf) && has(o.capex) ? o.ocf - o.capex : null;
    return balance(o, d);
  };

  const aEnds = Object.keys(M.rev.A).filter((d) => d in M.ni.A).sort().slice(-6);
  const qEnds = Object.keys(M.rev.Q).filter((d) => d in M.ni.Q).sort().slice(-12);
  const A = aEnds.map((d) => record("A", d)), Q = qEnds.map((d) => record("Q", d));
  if (!A.length) return null;

  const ltmFrom = (qs: any[]) => {
    if (qs.length !== 4 || !qs.every((q, i) => i === 0 || (days(qs[i - 1].end, q.end) >= 75 && days(qs[i - 1].end, q.end) <= 120))) return null;
    const o: any = { type: "LTM", end: qs[3].end };
    for (const k of FLOW) o[k] = qs.every((q) => has(q[k])) ? qs.reduce((s, q) => s + q[k], 0) : null;
    if (o.ebitda == null && has(o.op) && has(o.da)) o.ebitda = o.op + o.da;
    o.dil = qs[3].dil;
    o.opDerived = qs.some((q) => q.opDerived);
    return balance(o, qs[3].end);
  };

  const last = A[A.length - 1];
  let L = Q.length && Q[Q.length - 1].end > last.end ? ltmFrom(Q.slice(-4)) : null;
  if (!L) L = { ...last, type: "LTM" };
  const LP = L.end !== last.end && Q.length >= 8 ? ltmFrom(Q.slice(-8, -4)) : A.length >= 2 ? A[A.length - 2] : null;
  const yearAgo = L.end !== last.end && Q.length >= 5 ? Q[Q.length - 5].end : A.length >= 2 ? A[A.length - 2].end : null;
  const LB = yearAgo ? balance({ end: yearAgo }, yearAgo) : null;
  const shs = M.shs.I, shsLast = Object.keys(shs).sort().pop();
  return { A, Q, L, LP, LB, fin, ins, coverShares: shsLast ? shs[shsLast] : null, coverSharesDate: shsLast ?? null, opDerived: A.some((r) => r.opDerived) };
}
export type Fundamentals = NonNullable<ReturnType<typeof buildFundamentals>>;
