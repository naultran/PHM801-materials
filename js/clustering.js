/**
 * Distance matrix + agglomerative hierarchical clustering + dendrogram layout,
 * used by the Heatmap & Clustering activity. Recomputed from scratch on every
 * control change (small n, so this is effectively instant) rather than
 * incrementally updated, which keeps the logic easy to audit.
 *
 * Depends on: similarity.js, math-utils.js (load first).
 */

/** @param {number[][]} rows - one row per sample, one column per gene */
function distanceMatrix(rows, metric = "euclidean") {
  const n = rows.length;
  const D = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      let d;
      if (metric === "euclidean") d = Similarity.euclidean(rows[i], rows[j]);
      else if (metric === "correlation") d = 1 - Similarity.pearson(rows[i], rows[j]);
      else if (metric === "cosine") d = 1 - Similarity.cosine(rows[i], rows[j]);
      else throw new Error(`Unknown distance metric: ${metric}`);
      D[i][j] = d;
      D[j][i] = d;
    }
  }
  return D;
}

/**
 * Agglomerative clustering over a precomputed distance matrix.
 * @param {number[][]} distMatrix
 * @param {'single'|'complete'|'average'} linkage
 * @returns {{merges: Array<[number,number,number,number]>, n: number}}
 *   merges[k] = [clusterIdA, clusterIdB, mergeHeight, mergedSize]; ids 0..n-1
 *   are the original leaves, ids n..(2n-2) are created in merge order (id of
 *   merges[k] is n+k) — same convention as SciPy's linkage matrix.
 */
function agglomerativeCluster(distMatrix, linkage = "average") {
  const n = distMatrix.length;
  let clusters = Array.from({ length: n }, (_, i) => ({ id: i, members: [i] }));
  let nextId = n;
  const merges = [];

  function clusterDistance(c1, c2) {
    let best = linkage === "single" ? Infinity : linkage === "complete" ? -Infinity : 0;
    let count = 0;
    for (const i of c1.members) {
      for (const j of c2.members) {
        const d = distMatrix[i][j];
        if (linkage === "single") best = Math.min(best, d);
        else if (linkage === "complete") best = Math.max(best, d);
        else { best += d; count++; }
      }
    }
    return linkage === "average" ? best / count : best;
  }

  while (clusters.length > 1) {
    let bestPair = null;
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const d = clusterDistance(clusters[i], clusters[j]);
        if (!bestPair || d < bestPair.d) bestPair = { i, j, d };
      }
    }
    const c1 = clusters[bestPair.i];
    const c2 = clusters[bestPair.j];
    const merged = { id: nextId, members: c1.members.concat(c2.members) };
    merges.push([c1.id, c2.id, bestPair.d, merged.members.length]);
    nextId++;
    clusters = clusters.filter((_, idx) => idx !== bestPair.i && idx !== bestPair.j);
    clusters.push(merged);
  }

  return { merges, n };
}

/**
 * Lay out a dendrogram from a clustering result: assigns each leaf an
 * evenly-spaced integer x position (in-order traversal, so branches never
 * cross), each internal node's x is the midpoint of its children, and y is
 * the merge height. Returns SVG-ready edge segments (two vertical stems +
 * one horizontal bar per merge).
 */
function dendrogramLayout(clusterResult, labels) {
  const { merges, n } = clusterResult;
  const nodes = {};
  for (let i = 0; i < n; i++) nodes[i] = { id: i, height: 0, isLeaf: true, label: labels[i] };
  merges.forEach((m, k) => {
    const [a, b, height, size] = m;
    nodes[n + k] = { id: n + k, height, isLeaf: false, children: [nodes[a], nodes[b]], size };
  });

  const rootId = n === 1 ? 0 : n + merges.length - 1;
  const root = nodes[rootId];

  let xCounter = 0;
  const leafOrder = [];
  function assignX(node) {
    if (node.isLeaf) {
      node.x = xCounter++;
      leafOrder.push(node.id);
      return node.x;
    }
    const xs = node.children.map(assignX);
    node.x = (xs[0] + xs[1]) / 2;
    return node.x;
  }
  if (root) assignX(root);

  const edges = [];
  function collectEdges(node) {
    if (node.isLeaf) return;
    node.children.forEach((child) => {
      edges.push({ x1: child.x, y1: child.height, x2: child.x, y2: node.height, kind: "stem" });
    });
    edges.push({
      x1: node.children[0].x, y1: node.height,
      x2: node.children[1].x, y2: node.height, kind: "bar"
    });
    node.children.forEach(collectEdges);
  }
  if (root && !root.isLeaf) collectEdges(root);

  return { nodes, root, leafOrder, edges };
}

/** Find, for each item, the index of its nearest neighbor under a distance matrix. */
function nearestNeighbors(distMatrix) {
  return distMatrix.map((row, i) => {
    let bestJ = -1, bestD = Infinity;
    row.forEach((d, j) => {
      if (j !== i && d < bestD) { bestD = d; bestJ = j; }
    });
    return { index: bestJ, distance: bestD };
  });
}

/**
 * Genes contributing most to the similarity/difference between two samples,
 * ranked by absolute per-gene difference (used for the "why did these group
 * together" explanation panel).
 */
function topContributingGenes(rowA, rowB, geneLabels, topN = 5) {
  const diffs = rowA.map((v, i) => ({ gene: geneLabels[i], diff: Math.abs(v - rowB[i]), a: v, b: rowB[i] }));
  return diffs.sort((x, y) => x.diff - y.diff).slice(0, topN);
}

window.Clustering = { distanceMatrix, agglomerativeCluster, dendrogramLayout, nearestNeighbors, topContributingGenes };
