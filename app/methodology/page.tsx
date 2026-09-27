import { Content, TitleBar } from "@/components/Shell";
import { Card } from "@/components/ui";

const P = ({ children }: { children: React.ReactNode }) => <p className="mb-3">{children}</p>;

export default function Methodology() {
  return (
    <>
      <TitleBar title="Methodology and data sources" back="/" />
      <Content>
        <div className="grid gap-3.5 lg:grid-cols-2">
          <Card title="Data sources">
            <div className="max-w-[80ch] px-6 pb-5 text-ink-2">
              <P><b>Financial statements:</b> SEC EDGAR company-facts XBRL API. For each period the most recently filed value is used, so restatements supersede original figures. Quarterly cash flows are derived from year-to-date filings; LTM sums the last four reported quarters.</P>
              <P><b>Insider transactions:</b> SEC Form 4 XML filings, parsed for transaction code, shares, price and holdings after the trade. Open-market purchases (P) and sales (S) are summarized separately from compensation events.</P>
              <P><b>Market data:</b> Yahoo Finance: daily OHLC, adjusted close and volume on the S&amp;P 500 trading calendar; company profile; analyst EPS and revenue estimates, price targets, rating distribution, earnings dates and surprises; news headlines by RSS. The S&amp;P 500 is represented by SPY total return.</P>
              <P><b>Macroeconomic data:</b> FRED (rates, CPI, GDP, unemployment, credit spreads, VIX), the U.S. Treasury daily par yield curve, and Federal Reserve press releases by RSS. The 10-year Treasury yield (DGS10) sets the default risk-free rate.</P>
              <P><b>Research notes:</b> written by deterministic templates from the figures on the page. No language model is involved, so each statement can be traced to a number.</P>
            </div>
          </Card>
          <Card title="Models">
            <div className="max-w-[80ch] px-6 pb-5 text-ink-2">
              <P><b>Operating companies:</b> unlevered DCF. FCFF = EBIT x (1 - tax) + D&amp;A - capex - change in NWC. Revenue growth fades linearly to the final year; operating margin converges linearly to a normalized target. Gordon growth terminal value. Discount rate = CAPM-based WACC with a floor (default 7%).</P>
              <P><b>Banks, brokers and insurers</b> (SIC 6000-6499, excluding managed care): residual income model. Value = book value + PV of (ROE - cost of equity) x opening book value, with book value compounding at retained earnings. Cost of equity floor 8%.</P>
              <P><b>Enterprise value</b> = market capitalization + total debt - cash and short-term investments; not computed for financial institutions. For insurers, short-term investments back policy liabilities and are not deducted. Where operating income is not tagged, EBIT = pre-tax income + interest expense. Where capex is not tagged, the capex assumption defaults to D&amp;A.</P>
              <P><b>Rating:</b> six factors scored -2 to +2 and weighted: intrinsic value upside 30%, relative valuation 15%, growth 15%, returns on capital 15%, balance sheet or capital strength 10%, risk-adjusted return 15%. Buy at +0.50 or above, Sell at -0.50 or below.</P>
              <P><b>Historical valuation bands:</b> P/E, EV/EBITDA and P/S (P/E and P/B for financials) computed weekly from daily prices and the trailing fundamentals available 45 days after each period end, compared with their own average and one standard deviation.</P>
              <P><b>Economic regime:</b> Stagflation if CPI inflation is above 3.5% with weak growth; Recession if real GDP contracts or the Sahm rule (3-month unemployment average 0.5 pp above its 12-month low) triggers; Recovery if growth is positive while unemployment is elevated but falling; Expansion if GDP grows 1.5% or more; otherwise Slowdown.</P>
              <P><b>Portfolio builder:</b> daily-rebalanced returns from adjusted closes; Sharpe and Sortino against the 10-year yield; historical 95% VaR and CVaR; risk share from each holding&apos;s covariance with the portfolio.</P>
              <P><b>Retirement simulator:</b> 5,000 paths of correlated lognormal annual returns for stocks, bonds and cash (Cholesky factorization, seeded), contributions until retirement and inflation-adjusted withdrawals after.</P>
              <P>Model outputs are quantitative screens, not investment advice.</P>
            </div>
          </Card>
        </div>
      </Content>
    </>
  );
}
