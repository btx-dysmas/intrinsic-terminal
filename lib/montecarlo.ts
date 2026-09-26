// Monte Carlo retirement simulation: correlated annual asset returns, contributions until retirement,
// inflation-adjusted withdrawals afterward. All results are in today's dollars.

export type Plan = {
  age: number; retireAge: number; endAge: number; savings: number; income: number; saveRate: number; incomeGrowth: number;
  spending: number; otherIncome: number; stocks: number; bonds: number; cash: number; inflation: number; fee: number; runs: number;
};

export const DEFAULT_PLAN: Plan = {
  age: 18, retireAge: 65, endAge: 95, savings: 2000, income: 35000, saveRate: 0.1, incomeGrowth: 0.02,
  spending: 50000, otherIncome: 18000, stocks: 0.8, bonds: 0.15, cash: 0.05, inflation: 0.025, fee: 0.002, runs: 5000,
};

// Long-run nominal assumptions (annual mean, volatility) and correlations: U.S. equities, U.S. aggregate bonds, T-bills.
export const CMA = { mean: [0.085, 0.045, 0.03], vol: [0.17, 0.06, 0.01] };
const CORR = [[1, 0.1, 0], [0.1, 1, 0.2], [0, 0.2, 1]];

function cholesky(m: number[][]) {
  const n = m.length, L = m.map(() => Array(n).fill(0));
  for (let i = 0; i < n; i++)
    for (let j = 0; j <= i; j++) {
      let s = m[i][j];
      for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
      L[i][j] = i === j ? Math.sqrt(s) : s / L[j][j];
    }
  return L;
}

// Seeded generator so the same inputs always give the same answer.
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function normals(rand: () => number) {
  const u = Math.max(rand(), 1e-12), v = rand(), r = Math.sqrt(-2 * Math.log(u));
  return [r * Math.cos(2 * Math.PI * v), r * Math.sin(2 * Math.PI * v)];
}

const pct = (sorted: number[], p: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))))];

export function simulate(p: Plan, seed = 7) {
  const years = Math.max(1, p.endAge - p.age), L = cholesky(CORR), rand = mulberry32(seed);
  const w = [p.stocks, p.bonds, p.cash], wsum = w.reduce((a, b) => a + b, 0) || 1;
  const paths: Float64Array[] = [];
  const endWealth: number[] = [], depletedAt: (number | null)[] = [];
  let spare: number | null = null;
  const z = () => { if (spare != null) { const s = spare; spare = null; return s; } const [a, b] = normals(rand); spare = b; return a; };

  for (let n = 0; n < p.runs; n++) {
    const path = new Float64Array(years + 1);
    let wealth = p.savings, income = p.income, broke: number | null = null;
    path[0] = wealth;
    for (let y = 1; y <= years; y++) {
      const e = [z(), z(), z()];
      const shock = L.map((row) => row.reduce((s, l, k) => s + l * e[k], 0));
      // Lognormal draws matched to the arithmetic mean and volatility of each asset.
      const r = CMA.mean.map((m, i) => {
        const s2 = Math.log(1 + (CMA.vol[i] / (1 + m)) ** 2);
        return Math.exp(Math.log(1 + m) - s2 / 2 + Math.sqrt(s2) * shock[i]) - 1;
      });
      const nominal = r.reduce((s, x, i) => s + (w[i] / wsum) * x, 0) - p.fee;
      const real = (1 + nominal) / (1 + p.inflation) - 1;
      const age = p.age + y;
      if (age <= p.retireAge) {
        wealth = wealth * (1 + real) + income * p.saveRate;
        income *= 1 + p.incomeGrowth;
      } else {
        wealth = wealth * (1 + real) - Math.max(0, p.spending - p.otherIncome);
      }
      if (wealth <= 0 && broke == null) broke = age;
      if (wealth < 0) wealth = 0;
      path[y] = wealth;
    }
    paths.push(path);
    endWealth.push(path[years]);
    depletedAt.push(broke);
  }

  const ages = Array.from({ length: years + 1 }, (_, i) => p.age + i);
  const qs = [0.05, 0.25, 0.5, 0.75, 0.95], bands: number[][] = qs.map(() => []);
  ages.forEach((_, y) => {
    const col = Float64Array.from(paths, (x) => x[y]).sort();
    qs.forEach((q, i) => bands[i].push(col[Math.round(q * (col.length - 1))]));
  });
  const retireIdx = Math.min(years, Math.max(0, p.retireAge - p.age));
  const atRetire = paths.map((x) => x[retireIdx]).sort((a, b) => a - b);
  const sortedEnd = [...endWealth].sort((a, b) => a - b);
  const failures = depletedAt.filter((a) => a != null) as number[];
  return {
    ages, bands, success: 1 - failures.length / p.runs,
    atRetire: { p5: pct(atRetire, 0.05), p50: pct(atRetire, 0.5), p95: pct(atRetire, 0.95) },
    end: { p5: pct(sortedEnd, 0.05), p50: pct(sortedEnd, 0.5), p95: pct(sortedEnd, 0.95), worst: sortedEnd[0], best: sortedEnd[sortedEnd.length - 1] },
    medianDepletionAge: failures.length ? [...failures].sort((a, b) => a - b)[Math.floor(failures.length / 2)] : null,
    endWealth: sortedEnd,
    // 4% rule of thumb as a cross-check on the goal.
    needed: Math.max(0, p.spending - p.otherIncome) * 25,
  };
}

/** Lowest savings rate (to 0.5%) that reaches the target probability of success, or null if above 60%. */
export function requiredSaveRate(p: Plan, target = 0.8) {
  let lo = 0, hi = 0.6;
  const q = { ...p, runs: 1500 };
  if (simulate({ ...q, saveRate: hi }).success < target) return null;
  while (hi - lo > 0.005) {
    const mid = (lo + hi) / 2;
    if (simulate({ ...q, saveRate: mid }).success >= target) hi = mid; else lo = mid;
  }
  return hi;
}
