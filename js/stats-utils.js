/**
 * Small statistical routines for the Experimental Design & Statistical Power
 * activity: Welch's t-test, Benjamini-Hochberg FDR, and a normal-approximation
 * power estimate. All numeric approximations are standard textbook formulas,
 * documented inline with reference check values.
 *
 * Depends on: math-utils.js (load first).
 */

/** Abramowitz & Stegun 7.1.26 approximation of the error function, |error| < 1.5e-7 */
function erf(x) {
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741,
        a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const t = 1 / (1 + p * x);
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return sign * y;
}

/** Standard normal CDF, P(Z <= z). Check: normalCDF(1.96) ~= 0.975 */
function normalCDF(z) {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

/** Regularized incomplete beta function via a continued fraction (Lentz's method). */
function incompleteBeta(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const lbeta = logGamma(a) + logGamma(b) - logGamma(a + b);
  const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lbeta) / a;

  // continued fraction (Numerical Recipes betacf), swap for faster convergence
  let useX = x, useA = a, useB = b, flip = false;
  if (x > (a + 1) / (a + b + 2)) {
    useX = 1 - x; useA = b; useB = a; flip = true;
  }
  const cf = betacf(useX, useA, useB);
  const frontSwapped = Math.exp(
    Math.log(useX) * useA + Math.log(1 - useX) * useB +
    logGamma(useA + useB) - logGamma(useA) - logGamma(useB)
  ) / useA;
  const result = frontSwapped * cf;
  return flip ? 1 - result : result;
}

function betacf(x, a, b) {
  const MAXIT = 200, EPS = 3e-9, FPMIN = 1e-300;
  const qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

/** Lanczos approximation of ln(Gamma(x)) */
function logGamma(x) {
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7
  ];
  if (x < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  }
  x -= 1;
  let a = c[0];
  const t = x + g + 0.5;
  for (let i = 1; i < g + 2; i++) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

/**
 * Two-sided p-value for Student's t distribution with `df` degrees of
 * freedom. Check values: tCDF two-sided p at t=2.228, df=10 ~= 0.05;
 * t=0, df=any -> p=1.
 */
function tTwoSidedP(t, df) {
  if (!isFinite(t) || df <= 0) return 1;
  const x = df / (df + t * t);
  return incompleteBeta(x, df / 2, 0.5);
}

/**
 * Welch's t-test for two independent samples with possibly unequal variance,
 * appropriate here because the simulated replicate counts can be small (~3-10).
 */
function welchTTest(a, b) {
  const na = a.length, nb = b.length;
  const ma = MathUtils.mean(a), mb = MathUtils.mean(b);
  const va = MathUtils.variance(a), vb = MathUtils.variance(b);
  const se2 = va / na + vb / nb;
  const t = (ma - mb) / Math.sqrt(se2 || 1e-12);
  const df = (se2 * se2) / ((va / na) ** 2 / (na - 1) + (vb / nb) ** 2 / (nb - 1) || 1);
  const p = tTwoSidedP(t, df);
  return { t, df, p, meanA: ma, meanB: mb };
}

/**
 * Benjamini-Hochberg step-up FDR correction.
 * @param {number[]} pValues
 * @returns {number[]} q-values in the same order as the input
 */
function benjaminiHochberg(pValues) {
  const m = pValues.length;
  const indexed = pValues.map((p, i) => ({ p, i }));
  indexed.sort((x, y) => x.p - y.p);
  const q = new Array(m);
  let runningMin = 1;
  for (let rank = m; rank >= 1; rank--) {
    const { p, i } = indexed[rank - 1];
    const raw = (p * m) / rank;
    runningMin = Math.min(runningMin, raw);
    q[i] = MathUtils.clamp(runningMin, 0, 1);
  }
  return q;
}

/**
 * Normal-approximation power estimate for a two-sample comparison.
 * power = P(|Z| > z_(1-alpha/2) - effectSize / (sd * sqrt(2/n)))
 * Check: effectSize=1, sd=1, n=16, alpha=0.05 -> power ~= 0.78
 */
function estimatePower(effectSize, sd, n, alpha = 0.05) {
  const zAlpha = Math.SQRT2 * erfInv(1 - alpha); // z_(1-alpha/2)
  const ncp = effectSize / (sd * Math.sqrt(2 / n));
  return MathUtils.clamp(1 - normalCDF(zAlpha - ncp) + normalCDF(-zAlpha - ncp), 0, 1);
}

/** Inverse error function (Newton's method refinement of a rational approximation). */
function erfInv(x) {
  const a = 0.147;
  const ln1mx2 = Math.log(1 - x * x);
  const term1 = 2 / (Math.PI * a) + ln1mx2 / 2;
  const term2 = ln1mx2 / a;
  let result = Math.sign(x) * Math.sqrt(Math.sqrt(term1 * term1 - term2) - term1);
  // one Newton refinement step against erf() for better accuracy
  const fx = erf(result) - x;
  const dfx = (2 / Math.sqrt(Math.PI)) * Math.exp(-result * result);
  result -= fx / dfx;
  return result;
}

function logChoose(n, k) {
  if (k < 0 || k > n) return -Infinity;
  return logGamma(n + 1) - logGamma(k + 1) - logGamma(n - k + 1);
}

/**
 * One-tailed (over-representation) Fisher's exact test on a 2x2 contingency table:
 *                in pathway   not in pathway
 *   in gene list      a             b
 *   not in list        c             d
 * Returns the exact probability of overlap this large or larger by chance,
 * via the hypergeometric distribution — the standard test for "does my gene
 * list overlap a known pathway more than expected." Check: a=8, b=4, c=7,
 * d=81 (12-gene list, 15-gene pathway, 100 genes total) -> p ~= 1.3e-5.
 */
function fishersExactTest(a, b, c, d) {
  const n = a + b + c + d;
  const K = a + c;
  const draws = a + b;
  const maxK = Math.min(K, draws);
  let pValue = 0;
  for (let k = a; k <= maxK; k++) {
    pValue += Math.exp(logChoose(K, k) + logChoose(n - K, draws - k) - logChoose(n, draws));
  }
  return MathUtils.clamp(pValue, 0, 1);
}

window.StatsUtils = {
  erf, normalCDF, incompleteBeta, tTwoSidedP, welchTTest, benjaminiHochberg,
  estimatePower, logGamma, fishersExactTest
};
