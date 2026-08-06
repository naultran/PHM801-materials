/**
 * Vector similarity/distance functions used by the Signature Matcher,
 * Mixture Simulator, and the clustering distance matrix.
 */

function pearson(a, b) {
  const n = a.length;
  const ma = MathUtils.mean(a);
  const mb = MathUtils.mean(b);
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    const xa = a[i] - ma;
    const xb = b[i] - mb;
    num += xa * xb;
    da += xa * xa;
    db += xb * xb;
  }
  const denom = Math.sqrt(da * db);
  return denom < 1e-12 ? 0 : num / denom;
}

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom < 1e-12 ? 0 : dot / denom;
}

function euclidean(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

/** Map an unbounded distance to a 0-1 "similarity" for display alongside r/cosine. */
function euclideanToSimilarity(d) {
  return 1 / (1 + d);
}

/**
 * Compute a similarity score using a named metric, always returned as a
 * value where higher = more similar (Euclidean distance is converted).
 */
function similarityByMetric(a, b, metric) {
  if (metric === "pearson") return pearson(a, b);
  if (metric === "cosine") return cosine(a, b);
  if (metric === "euclidean") return euclideanToSimilarity(euclidean(a, b));
  throw new Error(`Unknown similarity metric: ${metric}`);
}

window.Similarity = { pearson, cosine, euclidean, euclideanToSimilarity, similarityByMetric };
