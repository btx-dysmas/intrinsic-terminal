// Featured companies used for demonstrations and default peer sets. Any SEC-registered ticker can be analyzed.
export const CURATED: Record<string, string[]> = {
  "Mega-Cap Technology": ["AAPL", "MSFT", "GOOGL", "META", "AMZN"],
  Semiconductors: ["NVDA", "AVGO", "AMD", "QCOM", "INTC"],
  Payments: ["V", "MA", "AXP", "PYPL"],
  "Banks & Diversified Financials": ["JPM", "BAC", "WFC", "GS", "BRK-B"],
  Pharmaceuticals: ["JNJ", "LLY", "MRK", "ABBV", "PFE"],
  "Managed Care": ["UNH", "ELV", "CI", "HUM"],
  "Integrated Energy": ["XOM", "CVX", "COP"],
  "Consumer Staples": ["KO", "PEP", "PG"],
  Retail: ["WMT", "COST", "TGT", "HD", "LOW"],
  Automobiles: ["TSLA", "GM", "F"],
};
export const CURATED_TICKERS = Object.values(CURATED).flat();
