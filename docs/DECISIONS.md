# Intrinsic: Design Decisions

Each decision below records the situation, what I chose, what I considered instead, and what it cost. Several of the most important ones were forced by having no budget, and several of those turned out better than the original plan.

---

### 1. Serverless TypeScript route handlers instead of a Python server

**Context.** The first version was a FastAPI backend in Python (using EdgarTools and yfinance) behind a Next.js frontend. It needed an always-on server. The free option I planned to use, Oracle Cloud's free tier, requires a credit card to sign up, and I don't have one.

**Decision.** Rewrite the backend as Next.js route handlers in TypeScript, deployed as serverless functions next to the frontend on Vercel's free tier.

**Alternatives.** Other free Python hosts (they sleep after inactivity, which means 30–60 second cold starts on a finance site); keeping Python and running it only locally (no public demo).

**Consequences.** One language, one repository, one deployment, and no server to keep alive. I had to rebuild the parts of EdgarTools and yfinance I used, and every request has to finish within the function time limit, which pushed me toward parallel fetching and aggressive caching. I verified the port by matching the Python version's outputs on the same filings.

### 2. My own XBRL normalizer instead of a library or hosted API

**Context.** EdgarTools only runs in Python. Hosted fundamentals APIs (Financial Modeling Prep, Finnhub and others) need keys and have restrictive free tiers, and I couldn't see how they computed their numbers.

**Decision.** Read the SEC's company-facts API directly and write the normalization myself: form filtering, latest-filing-wins, year-to-date differencing, tag fallbacks, trailing twelve months and predecessor merges (see ARCHITECTURE.md §4).

**Alternatives.** A paid data provider; scraping HTML statements.

**Consequences.** Every number traces to a specific SEC filing, and restatements are handled correctly. The cost is edge cases: companies that tag unusual concepts, change fiscal years or report through predecessors each needed specific handling, and some line items are still unavailable for some filers.

### 3. Deterministic research notes instead of an LLM

**Context.** The original design had GPT write the research note. I couldn't afford API usage.

**Decision.** Write the note from templates filled with computed figures (`lib/note.ts`), with sentences included only when the data supports them.

**Alternatives.** A free-tier LLM with rate limits; no written note.

**Consequences.** This became one of the project's strengths. A generated note can state a wrong number confidently; a template can't invent one. The note is reproducible, free, instant, and every claim can be checked against the page. The trade-off is less varied prose.

### 4. Valuation runs in the browser

**Context.** A valuation has more than 20 editable assumptions. If the server computed it, every keystroke would need a round trip.

**Decision.** The server returns normalized data; `lib/models.ts` runs every model in the browser.

**Consequences.** Instant updates, fewer function invocations, and a very cacheable API (the company payload doesn't depend on user input). The trade-off is that model code ships to the client, which is fine for an open-source project.

### 5. No database

**Context.** A database is the default answer for caching and state, but free database tiers pause, expire or add operational work.

**Decision.** Three caching layers instead: the CDN, an in-memory promise cache per function instance, and a static JSON snapshot of the coverage universe rebuilt by GitHub Actions.

**Consequences.** Nothing to provision or migrate. The home page and screener are served as static data. Cold instances refetch from sources, which the CDN mostly hides.

### 6. Yahoo Finance as optional enrichment; Stooq rejected

**Context.** Free market data is limited. Yahoo Finance's endpoints are free but unofficial and can change without notice. I planned to use Stooq as a second price source, but it now serves a JavaScript proof-of-work bot check to automated requests.

**Decision.** Use Yahoo for prices, profiles, estimates and news, and treat every Yahoo field as optional; the core analysis works from SEC data alone. Leave Stooq out rather than work around its bot check.

**Consequences.** If Yahoo breaks, statements, valuation and filings still work, and missing fields show "—" instead of being guessed.

### 7. FRED through its API instead of the public CSV

**Context.** FRED's public CSV download timed out repeatedly from the server.

**Decision.** Use the FRED API with a free key; keep the key in environment variables only; trim whitespace from it; show FRED's own error message if it's rejected.

**Consequences.** Reliable macro data. It introduced the one production incident so far (see DEVLOG.md), which led to decision 14.

### 8. Residual income for financial companies, and a discount-rate floor

**Context.** Free cash flow and enterprise value are not meaningful for banks and insurers, whose debt is raw material rather than financing. CAPM can also produce implausibly low discount rates for low-beta stocks.

**Decision.** Detect financial institutions by SIC code and value them with a residual income model on book value. Floor the discount rate at 7% (8% for financials), with the floor shown whenever it applies.

**Consequences.** JPMorgan and Microsoft each get an appropriate model. Floors are a judgment call, so they are visible and can be overridden.

### 9. Show "n.m." instead of absurd numbers

**Context.** Early versions showed Lucid Group worth −$2,272 per share and operating margins of −55,936%. These are mathematically correct and useless.

**Decision.** When projected equity value is negative, report per-share value as "n.m." (not meaningful) and explain why. Show ratios beyond ±1,000% as "n.m." and exclude them from averages. Give unprofitable companies an explicit break-even path (8% target margin over ten years) instead of extrapolating losses.

**Consequences.** Pre-revenue and loss-making companies get an honest page instead of nonsense.

### 10. The model is allowed to disagree with the market

**Context.** In 2026 Microsoft's capital spending is about three times its depreciation, which cuts free cash flow; with a 5.2% risk-free rate, the DCF comes out far below the share price.

**Decision.** Don't tune defaults to agree with the market. Show which inputs drive the result and let the user change them.

**Consequences.** Some results look surprising. That's the point: a model that always agrees with the price isn't telling you anything.

### 11. Chart design: single axis, validated colors, one set of figures

**Decision.** Every chart has one y-axis (different units get separate charts). Palettes were checked for color-vision deficiencies. Dark mode remaps each light color to a validated dark equivalent when rendering, and the same figure objects are rasterized for the PDF.

**Consequences.** One chart definition serves light mode, dark mode and print.

### 12. PDFs generated in the browser

**Decision.** jsPDF and jspdf-autotable build the tear sheet and full report on the client.

**Consequences.** No server-side rendering, no headless browser in a function, no upload of anything the user is looking at.

### 13. A curated 42-company universe

**Context.** The home page and screener need many companies at once; building them live would mean hundreds of upstream calls per visit.

**Decision.** Curate 42 companies in 10 peer groups, build them with the same pipeline in a script, and refresh them with a weekday GitHub Action.

**Consequences.** The busiest pages cost nothing to serve, and any other ticker is still analyzed live.

### 14. Never cache a failure

**Context.** After deploying, a malformed FRED key caused every FRED request to fail, and the CDN cached that failed response for hours, so fixing the key didn't fix the site.

**Decision.** Evict failed promises from the in-memory cache; mark any macro response without data `no-store`; trim environment variables; surface upstream error messages.

**Consequences.** Configuration mistakes are visible and fix themselves as soon as the configuration is corrected.

### 15. Segments and fund holdings from SEC filings, not a paid API

**Context.** The roadmap listed Financial Modeling Prep or Finnhub for segment revenue and earnings-call transcripts. Their free tiers no longer include either, and like other hosted APIs they don't show how a figure was derived. The SEC's company-facts API has no segment data because it omits every dimensional fact.

**Decision.** Read segments from the XBRL instance of each 10-K: contexts with exactly one segment, product or geography member, full fiscal years only, labeled with the company's own names from MetaLinks.json. Read fund holdings from each fund's latest Form N-PORT. Leave transcripts out, since there is no free and reliable source.

**Alternatives.** A paid data plan, which conflicts with running for free. Parsing the segment note's HTML table, which every company lays out differently.

**Consequences.** More parsing work: companies tag the same revenue in overlapping ways, so the members of each breakdown are checked against total revenue, subtotals are nested only when they hold in two consecutive years, and history stops where an older 10-K disagrees with a recast one. In return, every segment figure links to a filing and an XBRL concept, and the whole project still uses only public data.
