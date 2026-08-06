/**
 * Small general-purpose numeric helpers shared across activities. Kept
 * dependency-free and framework-free on purpose (see TECHNICAL-LIMITS.md).
 */

function mean(arr) {
  if (!arr.length) return NaN;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/** @param {boolean} sample - if true, divide by (n-1) (sample variance) */
function variance(arr, sample = true) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const ss = arr.reduce((a, b) => a + (b - m) * (b - m), 0);
  return ss / (arr.length - (sample ? 1 : 0));
}

function sd(arr, sample = true) {
  return Math.sqrt(variance(arr, sample));
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

/** count evenly spaced values from start to end inclusive */
function linspace(start, end, count) {
  if (count <= 1) return [start];
  const step = (end - start) / (count - 1);
  return Array.from({ length: count }, (_, i) => start + step * i);
}

/** logarithmically spaced values between 10^startExp and 10^endExp */
function logspace(startExp, endExp, count) {
  return linspace(startExp, endExp, count).map((e) => Math.pow(10, e));
}

function transpose(matrix) {
  if (!matrix.length) return [];
  return matrix[0].map((_, c) => matrix.map((row) => row[c]));
}

/** A (n x m) times B (m x p) -> (n x p) */
function matMul(A, B) {
  const n = A.length;
  const m = B.length;
  const p = B[0].length;
  const out = Array.from({ length: n }, () => new Array(p).fill(0));
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < m; k++) {
      const aik = A[i][k];
      if (aik === 0) continue;
      for (let j = 0; j < p; j++) {
        out[i][j] += aik * B[k][j];
      }
    }
  }
  return out;
}

/** Subtract each column's mean from every value. Returns {centered, means}. */
function centerColumns(matrix) {
  const cols = matrix[0].length;
  const means = new Array(cols).fill(0);
  for (let c = 0; c < cols; c++) {
    means[c] = mean(matrix.map((row) => row[c]));
  }
  const centered = matrix.map((row) => row.map((v, c) => v - means[c]));
  return { centered, means };
}

/** Divide each column by its (sample) standard deviation, in place on a copy. */
function scaleColumns(matrix, sds) {
  return matrix.map((row) => row.map((v, c) => (sds[c] > 1e-12 ? v / sds[c] : v)));
}

/** Row-wise z-score: each row independently centered/scaled by its own mean/sd. */
function zscoreRows(matrix) {
  return matrix.map((row) => {
    const m = mean(row);
    const s = sd(row) || 1;
    return row.map((v) => (v - m) / s);
  });
}

function formatNumber(v, decimals = 2) {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return Number(v).toFixed(decimals);
}

/** Trigger a client-side-only JSON file download (no server involved). */
function downloadJSON(filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Trigger a client-side-only PNG download of a canvas element. */
function downloadCanvasPNG(canvas, filename) {
  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, "image/png");
}

window.MathUtils = {
  mean, variance, sd, clamp, linspace, logspace, transpose, matMul,
  centerColumns, scaleColumns, zscoreRows, formatNumber, downloadJSON, downloadCanvasPNG
};
