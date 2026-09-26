# Intrinsic: Development Log

How the project evolved, what broke along the way, and what I learned. Organized by phase rather than by date.

---

## Phase 1: The first version

**Goal:** a professional equity research platform. Search any U.S. ticker and get statements, ratios, a DCF, peer comparison, risk analysis, technicals, a recommendation and a PDF report, looking like Bloomberg, Capital IQ or Morningstar rather than a chatbot.

**First architecture:** a Python FastAPI backend using EdgarTools for SEC filings and yfinance for market data, with FRED for macro data, OpenAI for research notes, and a Next.js + Tailwind frontend with Plotly charts.

**What I built:** the XBRL pipeline (in Python), valuation models, peer groups and the first company pages.

## Phase 2: Designing the interface

I studied professional dashboards (a program-cost dashboard and a Jedox-style reporting UI) and combined elements of both: a navy navigation rail, a header with search and data status, a filter strip for model settings, KPI cards, and dense tables. Then I added a dark mode that recolors every chart rather than just inverting the page, so no data gets hidden.

## Phase 3: Hitting the constraints

Three walls came up in quick succession:

1. **No OpenAI budget.** I replaced LLM-generated notes with a rules-based generator. Every sentence is now tied to a computed number, which is a better property for financial research anyway.
2. **No credit card for Oracle Cloud.** The Python server had nowhere free to live. I decided to rewrite the backend in TypeScript as Vercel route handlers.
3. **Stooq's bot check, and FRED's CSV timeouts.** I dropped Stooq instead of working around its bot protection, and moved FRED to its API with a free key.

## Phase 4: The TypeScript port

I ported the XBRL normalizer, Form 4 parser, Yahoo client (including the cookie-and-crumb session that `quoteSummary` requires), macro client, snapshot metrics and universe builder to TypeScript.

**Verification:** the port reproduced the Python outputs on the same filings (Microsoft P/E 28.7×, EV/EBITDA 19.5×; JPMorgan P/B 2.43×). The universe build runs 42 companies in about 11 seconds with three workers.

## Phase 5: Bugs found by using it

Using the app on real companies exposed problems no unit test would have caught:

| Problem | Cause | Fix |
|---|---|---|
| Key-value cards rendered in a zig-zag | A wrapper element broke the CSS grid's row pairing | Render key and value as direct grid children |
| Lucid Group valued at **−$2,272 per share** (−55,936% upside) | Extrapolating losses produces negative equity | "n.m." with an explanation; a break-even path for unprofitable companies |
| Operating margins of −55,936% on ratio charts | Tiny revenue denominators | Values beyond ±1,000% shown as "n.m." and excluded from averages |
| "Lucid Group, Inc." cut out of the business summary | The sentence splitter treated "Inc." as the end of a sentence | Split only before a capital letter following terminal punctuation |
| Risk-free input showed 4.25% while the model used 5.17% | An uncontrolled input kept its first value after the live FRED rate arrived | Inputs follow external changes unless being edited |
| Margin of safety shown as −187.9% | Correct arithmetic, unreadable output | Shows "None", with how far the price is above fair value |
| Microsoft's DCF far below its price | Not a bug: 2026 capex is about 3× depreciation, and the risk-free rate is 5.2% | Documented; the model is allowed to disagree with the market |

## Phase 6: Features

- **Portfolio builder:** preset allocations (including 40/30/20/10), position sizing, Sharpe, Sortino, VaR, CVaR, drawdown, correlation matrix, and asset-class and sector exposure.
- **Monte Carlo retirement simulator:** 5,000 correlated paths (Cholesky factorization, seeded), probability of success, best and worst cases, and a search for the savings rate needed for 80% success.
- **Economic regime analysis:** rules on GDP, CPI, the Sahm rule and the yield curve, with its history since 2008 and portfolio implications.
- **Analyst tools:** a one-page tear sheet PDF, a margin-of-safety slider, historical P/E, EV/EBITDA and P/S bands, and an earnings calendar with surprise history.
- **Architecture page** inside the app explaining ingestion, processing, caching and the valuation engine.

## Phase 7: Deployment and the first production incident

I deployed to Vercel with the SEC identity and FRED key as environment variables, and set up a weekday GitHub Action to refresh the universe.

**Incident:** the macro page said "FRED did not respond." Querying the production API showed FRED returning HTTP 400 for every series, its response to a malformed API key. The key had been pasted into Vercel incorrectly. Worse, the failed response had been cached by the CDN, so correcting the key alone wouldn't have fixed the page for hours.

**Fixes:** trim whitespace from all keys; never cache a response without FRED data; evict failed requests from the in-memory cache; show FRED's actual error message. After the key was corrected and the fix deployed, the macro page recovered immediately.

**Lesson:** cache successes, never failures, and make configuration errors say what they are.

## Phase 8: Documentation

Wrote this log, [ARCHITECTURE.md](ARCHITECTURE.md) and [DECISIONS.md](DECISIONS.md), and rewrote the README to lead with what the project is and why it matters.

---

## What I learned

- **Constraints improve designs.** Losing the server, the LLM and the paid data led to a simpler architecture, more trustworthy notes and fully traceable numbers.
- **Real data is messier than any spec.** XBRL tags vary by company, periods overlap, restatements supersede originals and predecessors hold history. Most of the pipeline's code exists to handle exceptions.
- **"Correct" isn't the same as "useful."** A negative share price is correct arithmetic and a bad answer. Knowing when to say "not meaningful" matters.
- **Verify ports against the original.** Matching the Python numbers on real filings gave me confidence in the rewrite.
- **Operate what you build.** The first production incident taught me more about caching than any tutorial.
