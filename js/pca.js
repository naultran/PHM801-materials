/**
 * Small-scale PCA via covariance matrix + Jacobi eigendecomposition. Suitable
 * for the gene counts used in this template (<=30 genes -> a 30x30 covariance
 * matrix); see TECHNICAL-LIMITS.md for why this approach does not scale to a
 * full transcriptome.
 *
 * Depends on: math-utils.js (load first).
 */

/** rows = samples, cols = genes; returns the genes x genes covariance matrix */
function covarianceMatrix(centeredMatrix) {
  const n = centeredMatrix.length;
  const Xt = MathUtils.transpose(centeredMatrix);
  const XtX = MathUtils.matMul(Xt, centeredMatrix);
  return XtX.map((row) => row.map((v) => v / Math.max(n - 1, 1)));
}

/**
 * Classical cyclic-sweep Jacobi eigenvalue algorithm for a small dense
 * symmetric matrix. Chosen over power-iteration + deflation because it
 * reliably recovers *all* eigenpairs of a small matrix in one pass, which is
 * what a "show me every principal component" explorer needs.
 * @returns {{eigenvalues: number[], eigenvectors: number[][]}} eigenvectors[k]
 *   is the k-th eigenvector (same order as eigenvalues), not yet sorted.
 */
function jacobiEigen(matrix, { maxSweeps = 100 } = {}) {
  const n = matrix.length;
  const a = matrix.map((row) => row.slice());
  const v = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  const b = new Array(n);
  const d = new Array(n);
  const z = new Array(n).fill(0);
  for (let i = 0; i < n; i++) b[i] = d[i] = a[i][i];

  function rotate(mat, i, j, k, l, s, tau) {
    const g = mat[i][j];
    const h = mat[k][l];
    mat[i][j] = g - s * (h + g * tau);
    mat[k][l] = h + s * (g - h * tau);
  }

  for (let sweep = 0; sweep < maxSweeps; sweep++) {
    let sm = 0;
    for (let ip = 0; ip < n - 1; ip++) {
      for (let iq = ip + 1; iq < n; iq++) sm += Math.abs(a[ip][iq]);
    }
    if (sm === 0) break;

    const thresh = sweep < 3 ? (0.2 * sm) / (n * n) : 0;

    for (let ip = 0; ip < n - 1; ip++) {
      for (let iq = ip + 1; iq < n; iq++) {
        const g = 100 * Math.abs(a[ip][iq]);
        if (sweep > 3 && Math.abs(d[ip]) + g === Math.abs(d[ip]) && Math.abs(d[iq]) + g === Math.abs(d[iq])) {
          a[ip][iq] = 0;
        } else if (Math.abs(a[ip][iq]) > thresh) {
          let h = d[iq] - d[ip];
          let t;
          if (Math.abs(h) + g === Math.abs(h)) {
            t = a[ip][iq] / h;
          } else {
            const theta = (0.5 * h) / a[ip][iq];
            t = 1 / (Math.abs(theta) + Math.sqrt(1 + theta * theta));
            if (theta < 0) t = -t;
          }
          const c = 1 / Math.sqrt(1 + t * t);
          const s = t * c;
          const tau = s / (1 + c);
          h = t * a[ip][iq];
          z[ip] -= h; z[iq] += h;
          d[ip] -= h; d[iq] += h;
          a[ip][iq] = 0;
          for (let j = 0; j < ip; j++) rotate(a, j, ip, j, iq, s, tau);
          for (let j = ip + 1; j < iq; j++) rotate(a, ip, j, j, iq, s, tau);
          for (let j = iq + 1; j < n; j++) rotate(a, ip, j, iq, j, s, tau);
          for (let j = 0; j < n; j++) rotate(v, j, ip, j, iq, s, tau);
        }
      }
    }
    for (let ip = 0; ip < n; ip++) { b[ip] += z[ip]; d[ip] = b[ip]; z[ip] = 0; }
  }

  const eigenvectors = [];
  for (let col = 0; col < n; col++) eigenvectors.push(v.map((row) => row[col]));
  return { eigenvalues: d, eigenvectors };
}

/**
 * @param {number[][]} dataMatrix - rows = samples, cols = genes
 * @param {{standardize?: boolean}} opts
 * @returns {{scores:number[][], loadings:number[][], eigenvalues:number[],
 *            explainedVarianceRatio:number[], means:number[], sds:?number[]}}
 *   scores[i] = sample i's coordinates on each PC; loadings[k] = gene weights
 *   for PC k (same order as eigenvalues, descending).
 */
function runPCA(dataMatrix, opts = {}) {
  const standardize = !!opts.standardize;
  const { centered, means } = MathUtils.centerColumns(dataMatrix);
  let X = centered;
  let sds = null;
  if (standardize) {
    sds = dataMatrix[0].map((_, c) => MathUtils.sd(dataMatrix.map((r) => r[c])) || 1);
    X = MathUtils.scaleColumns(centered, sds);
  }

  const cov = covarianceMatrix(X);
  const { eigenvalues, eigenvectors } = jacobiEigen(cov, { maxSweeps: 100 });

  const order = eigenvalues.map((_, i) => i).sort((a, b) => eigenvalues[b] - eigenvalues[a]);
  const sortedEigenvalues = order.map((i) => eigenvalues[i]);
  const sortedEigenvectors = order.map((i) => eigenvectors[i]);

  const totalVar = sortedEigenvalues.reduce((a, v) => a + Math.max(v, 0), 0) || 1;
  const explainedVarianceRatio = sortedEigenvalues.map((v) => Math.max(v, 0) / totalVar);

  const scores = X.map((row) => sortedEigenvectors.map((vec) => row.reduce((s, v, i) => s + v * vec[i], 0)));

  return { scores, loadings: sortedEigenvectors, eigenvalues: sortedEigenvalues, explainedVarianceRatio, means, sds };
}

window.PCA = { covarianceMatrix, jacobiEigen, runPCA };
