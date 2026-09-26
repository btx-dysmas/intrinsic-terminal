import { Content, Section, TitleBar } from "@/components/Shell";
import { Card, Note, Tw } from "@/components/ui";

export const metadata = { title: "Architecture · Intrinsic" };

type Box = { x: number; y: number; w: number; h: number; title: string; lines: string[]; tone?: "accent" | "muted" | "source" };

function Node({ x, y, w, h, title, lines, tone }: Box) {
  const fill = tone === "accent" ? "var(--c1)" : tone === "source" ? "var(--card-2)" : "var(--card)";
  const ink = tone === "accent" ? "#fff" : "var(--ink)";
  const sub = tone === "accent" ? "rgba(255,255,255,.82)" : "var(--ink-3)";
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={6} fill={fill} stroke={tone === "accent" ? "var(--c1)" : "var(--line-2)"} />
      <text x={x + 14} y={y + 24} fontSize={14} fontWeight={600} fill={ink}>{title}</text>
      {lines.map((l, i) => <text key={l} x={x + 14} y={y + 44 + i * 17} fontSize={12} fill={sub}>{l}</text>)}
    </g>
  );
}

function Arrow({ d, label, lx, ly }: { d: string; label?: string; lx?: number; ly?: number }) {
  return (
    <g>
      <path d={d} fill="none" stroke="var(--ink-3)" strokeWidth={1.4} markerEnd="url(#head)" />
      {label && <text x={lx} y={ly} fontSize={11} fill="var(--ink-3)" textAnchor="middle">{label}</text>}
    </g>
  );
}

function Diagram() {
  const sources: Box[] = [
    { x: 800, y: 20, w: 240, h: 74, title: "SEC EDGAR", lines: ["XBRL company facts, submissions,", "Form 4 insider filings"], tone: "source" },
    { x: 800, y: 106, w: 240, h: 74, title: "Yahoo Finance", lines: ["Daily prices, profile, estimates,", "earnings history, RSS headlines"], tone: "source" },
    { x: 800, y: 192, w: 240, h: 74, title: "FRED", lines: ["Rates, inflation, GDP, labor,", "credit spreads, VIX"], tone: "source" },
    { x: 800, y: 278, w: 240, h: 74, title: "U.S. Treasury + Federal Reserve", lines: ["Par yield curve (CSV),", "press releases (RSS)"], tone: "source" },
  ];
  return (
    <svg viewBox="0 0 1060 520" className="h-auto w-full min-w-[760px]" role="img" aria-label="System architecture diagram">
      <defs>
        <marker id="head" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="var(--ink-3)" />
        </marker>
      </defs>
      <rect x={10} y={10} width={330} height={500} rx={8} fill="none" stroke="var(--line)" strokeDasharray="4 4" />
      <text x={24} y={34} fontSize={11} letterSpacing=".09em" fill="var(--accent)" fontWeight={700}>BROWSER</text>
      <Node x={30} y={50} w={290} h={92} title="Next.js pages (React)" lines={["Company, screener, portfolio,", "retirement, macro views", "Plotly charts, dark mode"]} />
      <Node x={30} y={160} w={290} h={110} title="Valuation engine" tone="accent" lines={["DCF (FCFF), residual income, comps,", "scenarios and sensitivities,", "rating model, risk and technicals,", "Monte Carlo, regime rules"]} />
      <Node x={30} y={288} w={290} h={74} title="Rules-based research note" lines={["Templates filled from the numbers;", "every sentence traces to a figure"]} />
      <Node x={30} y={380} w={290} h={74} title="PDF export (jsPDF)" lines={["Tear sheet and full report,", "generated on the client"]} />
      <text x={24} y={490} fontSize={11.5} fill="var(--ink-3)">Assumptions change instantly: no round trip to a server.</text>

      <rect x={390} y={10} width={360} height={500} rx={8} fill="none" stroke="var(--line)" strokeDasharray="4 4" />
      <text x={404} y={34} fontSize={11} letterSpacing=".09em" fill="var(--accent)" fontWeight={700}>VERCEL (FREE TIER)</text>
      <Node x={410} y={50} w={320} h={74} title="Edge CDN cache" lines={["s-maxage + stale-while-revalidate;", "one upstream call serves many users"]} />
      <Node x={410} y={146} w={320} h={128} title="Route handlers (serverless)" lines={["/api/company/[ticker]  /filings  /insiders", "/api/prices  /api/macro  /api/search", "Normalize XBRL into annual, quarterly", "and trailing-twelve-month statements", "In-memory promise cache per instance"]} />
      <Node x={410} y={296} w={320} h={74} title="SEC request throttle" lines={["≤10 requests/second with a declared", "User-Agent, as EDGAR requires"]} />
      <Node x={410} y={392} w={320} h={92} title="Static universe snapshot" lines={["data/universe.json: 42 companies,", "rebuilt each weekday by a", "GitHub Action (npm run universe)"]} />

      {sources.map((b) => <Node key={b.title} {...b} />)}
      <Node x={800} y={392} w={240} h={92} title="GitHub" lines={["Source of truth; every push", "to main redeploys on Vercel"]} tone="muted" />

      <Arrow d="M320 96 L406 87" label="fetch JSON" lx={362} ly={82} />
      <Arrow d="M570 124 L570 142" />
      <Arrow d="M730 190 L796 57" />
      <Arrow d="M730 200 L796 143" />
      <Arrow d="M730 210 L796 229" />
      <Arrow d="M730 222 L796 315" />
      <Arrow d="M570 274 L570 292" />
      <Arrow d="M800 438 L734 438" label="deploy" lx={767} ly={430} />
      <Arrow d="M406 438 L324 205" label="bundled" lx={350} ly={318} />
    </svg>
  );
}

const STAGES: [string, string][] = [
  ["Ingestion", "Route handlers pull EDGAR company facts (every XBRL fact a company has filed), the submissions index for filing history, and raw Form 4 XML for insider trades. Yahoo supplies adjusted daily prices on the S&P 500 calendar, the company profile, analyst estimates and earnings surprises. FRED and the Treasury provide rates and macro series. Every upstream call has retries and a timeout, and a failure in one optional source (news, insiders) never blocks the page."],
  ["Processing pipeline", "XBRL facts arrive as a flat list of values with start and end dates. The pipeline keeps 10-K and 10-Q facts, takes the latest filing for each period, turns year-to-date figures into discrete quarters by differencing, and builds trailing-twelve-month totals from the last four quarters. Concept fallbacks cover the different tags companies use for the same line item, and predecessor filers (for example XOM's pre-merger CIK) are merged. The output is a normalized income statement, balance sheet and cash flow statement."],
  ["Caching", "Three layers keep the app free to run. Vercel's CDN caches each API response (company data for six hours, macro data for twelve) and serves stale copies while it revalidates. Inside a warm serverless instance, a promise cache deduplicates concurrent requests for the same ticker. The 42-company universe behind the home page and screener is a static JSON file built ahead of time, so the busiest pages never touch an upstream API."],
  ["Valuation engine", "All modeling runs in the browser. Defaults (growth, margins, reinvestment, cost of capital) are derived from the company's own history and CAPM with the live 10-year Treasury yield, then every assumption can be edited. Industrial companies use a free-cash-flow-to-firm DCF with a Gordon terminal value; banks and insurers use a residual-income model on book value. Results are cross-checked against peer multiples and analyst targets, and a six-factor rating combines value, quality, growth, momentum, balance sheet and estimate revisions."],
];

export default function Architecture() {
  return (
    <>
      <TitleBar title="Architecture" back="/" sub={<><span>Next.js 16 on Vercel</span><span>No database, no paid APIs, no backend server</span></>} />
      <Content>
        <Card title="System overview" unit="Data flows right to left; computation happens on the left">
          <Tw><Diagram /></Tw>
        </Card>
        <Section>How it works</Section>
        <div className="grid gap-3.5 lg:grid-cols-2">
          {STAGES.map(([t, body]) => (
            <Card key={t} title={t}><p className="px-5 pb-5 text-[14px] leading-relaxed text-ink-2">{body}</p></Card>
          ))}
        </div>
        <Card title="Design constraints">
          <Tw>
            <table className="t">
              <thead><tr><th className="l">Constraint</th><th className="l">Decision</th></tr></thead>
              <tbody>
                {[
                  ["Free to host", "Vercel hobby tier and GitHub only. Serverless functions stay under the 60-second limit by fetching in parallel and caching aggressively."],
                  ["No paid data", "SEC, FRED, Treasury and Federal Reserve data are public. Yahoo Finance endpoints are free but unofficial, so every Yahoo field is optional."],
                  ["No AI dependency", "Commentary comes from deterministic templates, so every conclusion can be traced to a number on the page and the app works with no API keys beyond FRED."],
                  ["Any U.S. ticker", "Nothing is precomputed per company except the 42-name universe; any EDGAR filer with XBRL statements can be analyzed on demand."],
                ].map(([a, b]) => <tr key={a}><td className="l w-[180px] font-semibold">{a}</td><td className="l whitespace-normal text-ink-2">{b}</td></tr>)}
              </tbody>
            </table>
          </Tw>
          <Note>See the Methodology page for formulas and model assumptions.</Note>
        </Card>
      </Content>
    </>
  );
}
