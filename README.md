# Intrinsic

**An equity research terminal for any U.S. public company, built on free public data.**

Type a ticker and Intrinsic pulls the company's filings from the SEC, market data from Yahoo Finance and macro data from the Federal Reserve. Within a few seconds it has built normalized financial statements, a discounted cash flow model, a peer comparison, risk and technical analysis, and a written research note you can export as a PDF. Everything runs on GitHub and Vercel's free tier. There's no database, no paid API and no AI model behind it.

![Company overview](docs/screenshots/overview.png)

---

## About me

Hi, I'm **Noah Williams**. Online I go by **Dysmas Anastasiou**. I'm 18, and I built this by myself.

My high school transcript doesn't tell the whole story. I left the group home system in 2022. For a long time after that I was dealing with depression, anxiety and symptoms close to schizophrenia, and my grades went down with me. I didn't want that transcript to be the last word on what I can do, so I decided to build real things and use them to earn a place at a university.

Intrinsic is the biggest of those projects. I wanted it to look and work like the tools analysts use at Bloomberg, Capital IQ or Morningstar. I also wanted it to be honest about where every number comes from.

---

## What it does

| | |
|---|---|
| **Company analysis** | Search any SEC-registered U.S. ticker. Get the overview, 52-week range, analyst consensus, earnings dates and surprises, and a company profile. |
| **Financial statements** | Income statement, balance sheet and cash flow built from raw XBRL filings. Annual and quarterly, plus trailing twelve months. Restatements replace original figures. |
| **Ratio analysis** | Profitability, returns, liquidity, leverage, efficiency and per-share trends. Nonsense values (such as margins of -50,000% for pre-revenue companies) are flagged instead of plotted. |
| **Valuation model** | Unlevered DCF for operating companies and a residual income model for banks and insurers. Bull, base and bear scenarios, sensitivity grids, a margin-of-safety slider, and historical P/E, EV/EBITDA and P/S bands. Every assumption can be edited. |
| **Comparable companies** | Peer multiples and operating metrics against a peer set you can change. |
| **Risk and technicals** | Beta, volatility, drawdowns, Sharpe and Sortino, VaR, moving averages, RSI, MACD and volume. |
| **Filings and insiders** | Recent 10-K, 10-Q and 8-K filings with direct links, plus Form 4 insider trades with net buying and selling. |
| **Research report** | A rules-based note covering business, positioning, growth, financials, valuation, risks and thesis, with a six-factor Buy, Hold or Sell rating. Exports as a one-page tear sheet or a full PDF report. |
| **Portfolio builder** | Build allocations (preset or custom). See position sizing, return and risk contribution, VaR, the correlation matrix, and asset-class and sector exposure against the S&P 500. |
| **Retirement simulator** | A 5,000-path Monte Carlo that estimates the chance your savings last, shows best and worst cases, and finds the savings rate you need. |
| **Macro and regime** | Classifies the economy as Expansion, Recovery, Slowdown, Recession or Stagflation from GDP, CPI, unemployment (the Sahm rule) and the yield curve. Shows what each regime has meant for stocks, bonds, real assets and sectors. |
| **Screener** | A 42-company coverage universe across 10 industries, sortable and comparable side by side. |

Every conclusion traces back to a number on the page. The commentary is generated from templates, not from a language model, so it can't invent a figure.

---

## Screenshots

| | |
|---|---|
| ![Coverage universe](docs/screenshots/home.png) | ![Valuation model, dark mode](docs/screenshots/valuation.png) |
| **Coverage universe:** peer groups, the screener and quick tools | **Valuation model (dark mode):** editable DCF, margin of safety and historical P/E band |
| ![Research report](docs/screenshots/report.png) | ![Macro dashboard](docs/screenshots/macro.png) |
| **Research report:** rules-based note and rating scorecard | **Macro dashboard:** economic regime, implications and the Treasury curve |
| ![Portfolio builder](docs/screenshots/portfolio.png) | ![Retirement simulator](docs/screenshots/retirement.png) |
| **Portfolio builder:** risk metrics, drawdown and position sizing | **Retirement simulator:** Monte Carlo probability of success |

![Architecture](docs/screenshots/architecture.png)

---

## How it's built

```
Browser (React)                        Vercel (free tier)                   Public data
─────────────────────────              ─────────────────────────            ─────────────────────
Pages + Plotly charts        ──JSON──▶ CDN cache (s-maxage, SWR)            SEC EDGAR
Valuation engine (DCF, RI,             Route handlers  ────────────────────▶ Yahoo Finance
  comps, scenarios, rating)              /api/company/[ticker]               FRED
Monte Carlo, regime rules                /api/prices  /api/macro             U.S. Treasury
Rules-based research note                XBRL → normalized statements        Federal Reserve RSS
PDF export (jsPDF)                     SEC throttle (≤10 req/s)
                                       data/universe.json (daily GitHub Action)
```

- **No backend server.** The API is a set of Next.js route handlers that deploy as serverless functions next to the site.
- **Valuation runs in the browser.** Changing an assumption updates the model instantly with no round trip.
- **Three layers of caching** keep it free to run: Vercel's CDN, an in-memory cache per function instance, and a static snapshot of the 42-company universe rebuilt each weekday by a GitHub Action.
- **XBRL processing.** Companies file thousands of tagged facts. The pipeline keeps 10-K and 10-Q values, takes the latest filing for each period, turns year-to-date figures into quarters, falls back across the different tags companies use for the same line, and merges predecessor filers (for example, Exxon's pre-merger CIK).

The app has its own [Architecture page](app/architecture/page.tsx) with the full diagram and a walk-through.

### Tech stack

| Layer | Tools |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS 4, IBM Plex Sans, Source Serif 4, light and dark themes |
| Charts | Plotly.js with colorblind-safe palettes |
| PDF | jsPDF and jspdf-autotable |
| Hosting | Vercel (Hobby), GitHub, GitHub Actions |

### Data sources

| Source | Used for | Status |
|---|---|---|
| SEC EDGAR (XBRL company facts, submissions) | Financial statements, filing history, company metadata | ✅ Live |
| SEC Form 4 | Insider buys, sells and holdings | ✅ Live |
| Yahoo Finance | Prices, profile, analyst estimates, earnings calendar and surprises, news RSS | ✅ Live |
| FRED | Risk-free rate, CPI, GDP, unemployment, credit spreads, VIX | ✅ Live (free key) |
| U.S. Treasury | Daily par yield curve | ✅ Live |
| Federal Reserve | Press releases (RSS) | ✅ Live |
| Financial Modeling Prep, Finnhub | Segment data, transcripts, more estimates | 🔜 Planned (free keys) |
| SEC N-PORT, ETF holdings | Fund look-through for the portfolio builder | 🔜 Planned |

---

## What I couldn't do (yet)

Building with no budget meant working around a few walls:

- **No Oracle Cloud.** My first plan was a Python API (FastAPI and EdgarTools) on Oracle's free-tier VM. Oracle requires a credit card to sign up, and I don't have one. So I rewrote the backend in TypeScript as Vercel route handlers. That turned out simpler: one repo, one deploy, and no server to keep alive.
- **No OpenAI.** The original design had GPT write the research notes. I couldn't afford an API key. So I wrote a rules-based note generator instead. Looking back, that's the better design for this kind of tool: every sentence is backed by a number, it never makes a figure up, and it costs nothing.
- **No Stooq.** I wanted Stooq as a second price source, but it now serves a bot check to scripts, and I didn't want to get around that.
- **No EdgarTools.** It's a great Python library, but it only works with a Python server. I rebuilt the parts I needed (XBRL normalization and Form 4 parsing) in TypeScript.
- **Yahoo Finance is unofficial.** It's free, but it can change without warning, so every Yahoo field is optional and the app still works from SEC data alone.

The valuation model isn't tuned to agree with the market. When a company's free cash flow is squeezed (as with Microsoft's AI data-center spending in 2026), the DCF says so, and the page shows exactly which inputs drive it.

---

## Run it locally

You need Node.js 20 or newer.

```bash
git clone https://github.com/<your-username>/intrinsic-terminal.git
cd intrinsic-terminal
npm install
cp .env.example .env.local   # then fill in the two values
npm run dev
```

Open http://localhost:3000.

| Variable | Required | What it is |
|---|---|---|
| `SEC_USER_AGENT` | Yes | Your name and email, e.g. `Jane Doe jane@example.com`. The SEC requires this on every request. |
| `FRED_API_KEY` | Recommended | Free key from [fred.stlouisfed.org](https://fred.stlouisfed.org/docs/api/api_key.html). Without it, macro pages are disabled and valuations use a 4.25% risk-free rate. |

To refresh the home-page universe snapshot:

```bash
npm run universe
```

## Deploy (free)

1. Push the repo to GitHub.
2. Import it at [vercel.com/new](https://vercel.com/new). The defaults for Next.js are correct.
3. Add `SEC_USER_AGENT` and `FRED_API_KEY` under **Settings → Environment Variables**.
4. Optional: add the same two values as GitHub repository secrets. The workflow in `.github/workflows/universe.yml` then refreshes the universe snapshot every weekday.

## Project structure

```
app/                 pages and API route handlers
  api/               company, prices, macro, search, health
  company/[ticker]/  company views (overview, financials, valuation, ...)
components/          shell, UI primitives, charts, company views
lib/                 valuation models, portfolio and Monte Carlo math, regime rules, PDF, formatting
lib/server/          SEC, Yahoo, FRED and Treasury clients, XBRL normalization, caching
scripts/             universe snapshot builder
data/                universe.json (generated)
```

## Roadmap

- Segment revenue and earnings-call transcripts (Financial Modeling Prep or Finnhub free tiers)
- ETF look-through in the portfolio builder (SEC N-PORT)
- Saved watchlists shared by URL
- More peer groups in the coverage universe

---

## Disclaimer

Intrinsic is an educational project. Its models are quantitative screens, not investment advice.

## Author

**Noah Williams** (Dysmas Anastasiou)
Email: nwfootball07@gmail.com
