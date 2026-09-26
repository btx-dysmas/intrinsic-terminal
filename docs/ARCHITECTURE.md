# Intrinsic: Architecture

This document explains how Intrinsic is put together: where data comes from, how raw SEC filings become financial statements, where each calculation runs, and how the system stays fast and free to operate. For *why* each choice was made, see [DECISIONS.md](DECISIONS.md). For the story of how it got here, see [DEVLOG.md](DEVLOG.md).

---

## 1. Goals and constraints

The architecture follows from five requirements:

1. **Any U.S. ticker, on demand.** Nothing is precomputed per company except a 42-company showcase universe.
2. **Zero cost.** No paid APIs, no paid hosting, no database, no AI model. It runs on GitHub and Vercel's free (Hobby) tier.
3. **Traceable numbers.** Every figure must come from a filing, a market data point or a stated assumption.
4. **Fast interaction.** Changing a valuation assumption must update the model instantly.
5. **Graceful degradation.** Unofficial or optional sources (Yahoo Finance, news, insider filings) can fail without taking the page down.

## 2. System overview

```
┌──────────────────────────── Browser ─────────────────────────────┐
│  Next.js App Router pages (React 19, client components)           │
│   ├── Company views: overview, statements, ratios, filings,       │
│   │   valuation, comps, risk, technicals, report                  │
│   ├── Valuation engine (lib/models.ts): DCF, residual income,     │
│   │   scenarios, sensitivities, peer multiples, 6-factor rating   │
│   ├── Risk and technicals (lib/risk.ts), valuation bands          │
│   ├── Portfolio builder, Monte Carlo retirement, regime rules     │
│   ├── Rules-based research note (lib/note.ts)                     │
│   └── PDF export (jsPDF): tear sheet and full report              │
└───────────────▲──────────────────────────────────────────────────┘
                │ JSON over HTTPS
┌───────────────┴──────────── Vercel ───────────────────────────────┐
│  Edge CDN cache: s-maxage + stale-while-revalidate                 │
│  Route handlers (serverless functions, TypeScript)                 │
│   /api/company/[ticker]   /filings   /insiders   /news             │
│   /api/prices   /api/macro   /api/search   /api/health             │
│  lib/server: SEC client (rate-limited), XBRL normalizer,           │
│              Yahoo client (cookie + crumb), FRED, Treasury, RSS    │
│  In-memory promise cache per warm instance                         │
└───────────────▲──────────────────────────────────────────────────┘
                │
   SEC EDGAR · Yahoo Finance · FRED · U.S. Treasury · Federal Reserve

GitHub Actions (weekdays) ──► scripts/build-universe.ts ──► data/universe.json ──► redeploy
```

The split is deliberate: **the server fetches and normalizes; the browser models.** Route handlers do the work that needs secrets, rate limiting or heavy parsing. Everything that depends on the user's assumptions runs in the browser, so no round trip is needed when an input changes.

## 3. What happens when you search a ticker

Take `MSFT` on a cold cache:

1. **Search.** `/api/search` matches the query against the SEC's ticker map (`company_tickers.json`, about 10,000 companies, cached for 24 hours).
2. **Company request.** The page calls `/api/company/MSFT`. The route handler's `assemble()` starts three fetches in parallel:
   - SEC company facts (every XBRL fact Microsoft has filed), plus the submissions index for metadata;
   - Yahoo Finance profile, estimates, targets and earnings history (`quoteSummary`);
   - five years of daily prices for MSFT and SPY, aligned to one trading calendar.
3. **Normalization.** `buildFundamentals()` turns the raw facts into annual, quarterly and trailing-twelve-month statements (section 4).
4. **Snapshot.** `snapshot()` computes market multiples, returns, margins, leverage and growth from those statements and the latest price.
5. **Response.** The combined JSON is returned with `Cache-Control: s-maxage=21600, stale-while-revalidate`, so Vercel's CDN serves the next visitor without touching any upstream source. On a cold start the whole request takes about 1.3 seconds; cached, it takes milliseconds.
6. **Modeling in the browser.** The company layout derives default assumptions (growth from consensus or history, margins, tax rate, capex intensity, CAPM discount rate using the live 10-year Treasury yield from `/api/macro`), then runs the DCF, scenarios, sensitivity grids, peer comparison and rating. Filings, insider trades and headlines load separately and lazily, so a slow optional source never blocks the page.

## 4. The XBRL processing pipeline

SEC company facts are a flat list of tagged values (`Revenues`, `NetIncomeLoss`, ...), each with a start date, end date, form type and filing date. Turning that into statements a human can read takes several steps (`lib/server/sec.ts`, `lib/server/fundamentals.ts`):

| Step | What it does | Why |
|---|---|---|
| **Concept filter** | Keeps about 80 concepts that feed statements and ratios. | A large filer has thousands of concepts; this cuts the payload by an order of magnitude. |
| **Form filter** | Keeps 10-K, 10-Q, their amendments, 10-KT, 20-F and 40-F, with period end in 2018 or later. | Excludes registration statements and other forms that restate old periods. |
| **Latest filing wins** | For each concept and period, keeps the most recently filed value. | Restatements supersede original figures, as an analyst would expect. |
| **Periodization** | Classifies periods as annual, quarterly or year-to-date by length; turns year-to-date cash-flow figures into discrete quarters by differencing (Q3 = 9-month − 6-month). | Most companies report cash flows only year-to-date in 10-Qs. |
| **Non-additive handling** | Never sums per-share figures or share counts across quarters. | EPS and share counts are not additive. |
| **Concept fallbacks** | Tries alternative tags for the same line (for example, `RevenueFromContractWithCustomerExcludingAssessedTax` → `Revenues` → `SalesRevenueNet`). | Companies tag the same idea differently, and change tags over time. |
| **Trailing twelve months** | Sums the last four discrete quarters for flow items; uses the latest balance for stocks. | Gives current figures between annual reports. |
| **Derived lines** | EBITDA, free cash flow, net debt; EBIT from pre-tax income plus interest when operating income isn't tagged. | Not every filer tags every line. |
| **Predecessor merge** | Merges facts from a predecessor registrant (Exxon's pre-merger CIK 34088). | Some companies' history sits under an old CIK. |
| **Sector handling** | Detects banks, brokers and insurers by SIC code (6000–6499, excluding managed care 6324); insurers keep short-term investments out of net cash. | Enterprise value and FCF-based models don't apply to financial institutions. |

The TypeScript port was checked against the original Python implementation on the same filings: Microsoft's P/E (28.7×) and EV/EBITDA (19.5×) and JPMorgan's P/B (2.43×) matched.

## 5. Data sources and clients

| Source | Client | Notes |
|---|---|---|
| **SEC EDGAR** | `lib/server/sec.ts` | A declared `User-Agent` on every request (SEC requirement); a queue spacing requests 110 ms apart (under the 10 requests/second fair-access limit); three attempts with growing backoff; 404 mapped to a clean "not found". |
| **SEC Form 4** | `insiders()` | Reads each filing's XML: owner, role, transaction code, shares, price, shares owned after. Open-market purchases (P) and sales (S) are separated from grants and exercises. |
| **Yahoo Finance** | `lib/server/yahoo.ts` | Chart API (no authentication) for prices; `quoteSummary` needs a session cookie from `fc.yahoo.com` and a matching crumb, refreshed hourly or on a 401/403. Every field is optional. |
| **FRED** | `lib/server/macro.ts` | Nine series since 2007; CPI converted to year-over-year; daily series thinned to weekly points. The key is trimmed of stray whitespace. |
| **U.S. Treasury** | `treasuryCurve()` | Daily par yield curve CSV for the current and previous year; latest, one month ago and one year ago. |
| **Federal Reserve** | `rss()` | Press-release RSS feed. |

## 6. Caching

Three layers keep the system fast and inside free-tier limits:

| Layer | Where | Lifetime | What it protects |
|---|---|---|---|
| **CDN** | Vercel edge, via `s-maxage` and `stale-while-revalidate` | Company data 6 h; prices 3 h; macro 6 h | Upstream sources and function invocations. One visitor's request serves everyone. |
| **Promise cache** | `memo()` in each warm function instance | SEC facts and submissions 6 h; Yahoo prices 3 h, profiles 6 h, classifications 24 h, news 1 h | Duplicate concurrent requests (for example, a company page and its peers all needing SPY). The promise itself is cached, so simultaneous callers share one fetch. |
| **Static snapshot** | `data/universe.json`, built by `npm run universe` | Rebuilt each weekday by GitHub Actions | The home page and screener, the most visited pages, never call an upstream API. |

**Failures are never cached.** A rejected promise is evicted from `memo()`, and the macro route marks any response without FRED data `no-store`. This rule came from a production incident, described in the development log.

## 7. The valuation engine (browser)

`lib/models.ts` holds every model; the views only render.

- **Defaults.** Revenue growth starts at Street consensus for the next two fiscal years (falling back to history) and fades linearly to a terminal rate; operating margin converges from last-twelve-months to a five-year normalized level; for unprofitable companies the target margin defaults to 8% over ten years. Tax rate is the median effective rate; capex is its three-year average share of revenue (set equal to D&A when a company doesn't tag capex).
- **Discount rate.** CAPM: cost of equity = risk-free (live 10-year Treasury) + β × 5% equity risk premium; WACC blends in after-tax cost of debt at market weights, with a floor of 7% (8% for financials).
- **Operating companies.** Unlevered DCF: FCFF = EBIT × (1 − t) + D&A − capex − ΔNWC, Gordon terminal value, optional mid-year discounting. Equity = EV − debt + cash and short-term investments.
- **Financial institutions.** Residual income: value = book value + PV of (ROE − cost of equity) × opening book value, with book growing at retained earnings.
- **Scenarios and sensitivities.** Bull and bear cases shift growth, margin and discount rate together; grids vary one pair at a time.
- **Not meaningful.** If projected equity value is zero or negative, per-share value is reported as "n.m." with an explanation, rather than a misleading negative price.
- **Rating.** Six factors scored −2 to +2 and weighted: intrinsic value 30%, relative valuation 15%, growth 15%, returns on capital 15%, balance sheet 10%, risk-adjusted return 15%. Buy at +0.50 or above, Sell at −0.50 or below.

## 8. Commentary without a language model

`lib/note.ts` writes the research note from templates. Each section (business overview, positioning, growth drivers, financial performance, valuation, risks, thesis) is assembled from computed facts: rankings within the peer set, growth against the peer median, the model's upside, the rating factors. Sentences are included only when the data supports them. The same inputs always produce the same note.

## 9. Frontend

- **Routing.** `app/company/[ticker]/layout.tsx` loads the company once and shares it (plus assumptions, peers and the risk-free rate) through React context with nine views.
- **Charts.** Every chart is built in `lib/charts.ts` as a Plotly `{ data, layout }` object, so the same figure renders on screen and in the PDF. Palettes were checked for color-vision deficiencies; dark mode swaps each light color for a validated dark equivalent at render time instead of maintaining two sets of charts.
- **PDF.** jsPDF and jspdf-autotable build the tear sheet and full report in the browser; charts are rasterized with `Plotly.toImage`. Nothing is uploaded.

## 10. The coverage universe

`scripts/build-universe.ts` runs the same `assemble()` pipeline for 42 curated companies in 10 peer groups with three parallel workers (about 11 seconds), and writes a compact row per company (price, multiples, growth, margins, returns, sparkline) to `data/universe.json`. A weekday GitHub Action runs it after the U.S. market close and commits the file if it changed, which triggers a Vercel redeploy.

## 11. Failure handling

| Failure | Behavior |
|---|---|
| Ticker not on EDGAR, or no annual revenue and net income | 404 with a clear message |
| Yahoo quoteSummary blocked or changed | Profile fields show "—"; statements, valuation and filings still work from SEC data |
| Filings, insiders or news fail | That panel shows an error; the rest of the page is unaffected |
| FRED key missing or invalid | Macro pages show FRED's own error message; valuations fall back to a 4.25% risk-free rate |
| Absurd ratios (e.g. −55,936% margin) | Shown as "n.m." and excluded from averages |

## 12. Module map

```
app/
  api/company/[ticker]/route.ts   company payload (maxDuration 60 s)
  api/company/[ticker]/filings    recent filings
  api/company/[ticker]/insiders   Form 4 transactions
  api/company/[ticker]/news       headlines
  api/prices, macro, search, health
  company/[ticker]/layout.tsx     loads the company, derives assumptions, shares context
components/views/                 Overview, Financials, Ratios, Valuation, Comps, Risk, Technicals, Filings, Report
lib/
  models.ts        DCF, residual income, scenarios, sensitivities, comps, rating
  note.ts          rules-based research note
  risk.ts          risk and technical indicators
  history.ts       historical P/E, EV/EBITDA and P/S bands
  regime.ts        economic regime rules
  montecarlo.ts    retirement simulation
  portfolio.ts     portfolio analytics
  charts.ts, pdf.ts, format.ts
  server/
    sec.ts           EDGAR client, facts, submissions, filings, Form 4
    fundamentals.ts  XBRL normalization
    snapshot.ts      multiples and metrics
    yahoo.ts         prices, profile, RSS
    macro.ts         FRED, Treasury, Fed RSS
    company.ts       assembles the company payload
    cache.ts, respond.ts
scripts/build-universe.ts
```
