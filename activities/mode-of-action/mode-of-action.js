/**
 * Activity — Mode of Action Discovery.
 *
 * Ten compounds were profiled across 48 genes. Each gene is annotated with the
 * receptor it is a known target of (a colored bar beside the heatmap), and both
 * the genes and the compounds are hierarchically clustered, so genes that are
 * regulated by the same receptor sit together as colored blocks.
 *
 * Each receptor has two compounds that act through it (a pair), so the compounds
 * cluster in pairs too. Some compounds also weakly engage a second receptor
 * (cross-talk), and eight genes have no receptor annotation. The seed picks which
 * pair is highlighted. The question: what is the likely mechanism of that pair?
 * Read it from which colored block its two columns switch on.
 *
 * The reveal backs the eyeballing with a real test: the genes changed in the same
 * direction in both compounds are tested for over-representation of each
 * receptor's target genes (Fisher's exact test, as in the enrichment activity).
 *
 * Depends on: prng.js, math-utils.js, similarity.js, clustering.js, stats-utils.js,
 * svg-utils.js, prediction-component.js, activity-shell.js.
 */

const RECEPTORS = [
  { id: "gr", short: "GR", label: "GR (glucocorticoid receptor)", color: "#009e73",
    genes: ["Fkbp5", "Tsc22d3", "Sgk1", "Per1", "Dusp1", "Klf15", "Pdk4", "Ddit4"] },
  { id: "er", short: "ER", label: "ER (estrogen receptor)", color: "#cc79a7",
    genes: ["Pgr", "Greb1", "Tff1", "Ctsd", "Xbp1", "Cxcl12", "Igfbp4", "Areg"] },
  { id: "ppar", short: "PPARα", label: "PPARα (lipid-sensing receptor)", color: "#e69f00",
    genes: ["Cpt1a", "Acox1", "Ehhadh", "Cyp4a14", "Fabp1", "Acadm", "Hmgcs2", "Angptl4"] },
  { id: "ahr", short: "AhR", label: "AhR (aryl hydrocarbon receptor)", color: "#7b3fb5",
    genes: ["Cyp1a1", "Cyp1a2", "Cyp1b1", "Ahrr", "Nqo1", "Aldh3a1", "Ugt1a6", "Tiparp"] },
  { id: "pxr", short: "PXR", label: "PXR (xenobiotic sensor)", color: "#8c6d46",
    genes: ["Cyp3a11", "Cyp2b10", "Abcb1a", "Slco1a4", "Cyp2c29", "Gstm3", "Abcc2", "Ces2a"] }
];
const OTHER = { id: "other", short: "No annotation", label: "No receptor annotation", color: "#c4c9ce" };
const N_OTHER = 8;
const CHANGE_CUTOFF = 1.0;      // |log2 fold change| for "changed" in the Fisher test
const MAX_ABS = 2.6;            // color scale limit

/* ---------- model ---------- */

function buildGenes() {
  const genes = [];
  RECEPTORS.forEach((r) => r.genes.forEach((name) => genes.push({ name, receptor: r.id })));
  for (let i = 0; i < N_OTHER; i++) genes.push({ name: "G" + String(i + 1).padStart(2, "0"), receptor: "other" });
  return genes;
}

function drawScenario(rng) {
  const genes = buildGenes();
  const nGenes = genes.length;

  // each receptor's signature: mostly induced genes, at most one repressed
  const archetype = {};
  RECEPTORS.forEach((r) => {
    const neg = rng.random() < 0.4 ? rng.int(0, r.genes.length) : -1;
    archetype[r.id] = r.genes.map((_, i) => (i === neg ? -1 : 1) * rng.range(1.4, 2.8));
  });

  // two compounds per receptor, shuffled so numbers don't reveal the pairs
  const primaries = rng.shuffle(RECEPTORS.flatMap((r) => [r.id, r.id]));
  const compounds = primaries.map((primary, i) => {
    const others = RECEPTORS.map((r) => r.id).filter((id) => id !== primary);
    const secondary = rng.random() < 0.45 ? rng.pick(others) : null;
    return { id: i, label: String(i + 1), primary, strength: rng.range(0.85, 1.2), secondary, secondaryStrength: rng.range(0.25, 0.4) };
  });

  // matrix[gene][compound] = log2 fold change
  const matrix = genes.map((g, gi) => compounds.map((c) => {
    let v = rng.gaussian(0, 0.35);
    RECEPTORS.forEach((r) => {
      const k = r.genes.indexOf(g.name);
      if (k < 0) return;
      if (r.id === c.primary) v += c.strength * archetype[r.id][k];
      else if (r.id === c.secondary) v += c.secondaryStrength * archetype[r.id][k];
    });
    if (g.receptor === "other" && rng.random() < 0.06) v += rng.pick([-1, 1]) * rng.range(0.9, 1.5);
    return v;
  }));

  const target = rng.pick(RECEPTORS.map((r) => r.id));
  const pair = compounds.filter((c) => c.primary === target).map((c) => c.id);
  const analysis = analysePair(genes, matrix, pair);

  // keep the case readable: the target receptor must clearly stand out
  const ranked = [...analysis.byReceptor].sort((a, b) => b.meanAbs - a.meanAbs);
  const ok = ranked[0].id === target && ranked[1].meanAbs < 0.6 * ranked[0].meanAbs && analysis.byReceptor.find((r) => r.id === target).overlap >= 6;
  return ok ? { genes, matrix, compounds, target, pair, archetype, analysis } : null;
}

/** Per receptor: mean |change| of its genes in the pair, and Fisher over-representation among shared changes. */
function analysePair(genes, matrix, pair) {
  const [ca, cb] = pair;
  const changed = genes.map((_, gi) => {
    const a = matrix[gi][ca], b = matrix[gi][cb];
    return Math.sign(a) === Math.sign(b) && Math.min(Math.abs(a), Math.abs(b)) >= CHANGE_CUTOFF;
  });
  const k = changed.filter(Boolean).length;
  const N = genes.length;
  const byReceptor = RECEPTORS.map((r) => {
    const idx = genes.map((g, gi) => (g.receptor === r.id ? gi : -1)).filter((i) => i >= 0);
    const overlap = idx.filter((gi) => changed[gi]).length;
    const meanAbs = idx.reduce((s, gi) => s + Math.abs((matrix[gi][ca] + matrix[gi][cb]) / 2), 0) / idx.length;
    const p = StatsUtils.fishersExactTest(overlap, k - overlap, idx.length - overlap, N - k - idx.length + overlap);
    return { id: r.id, overlap, size: idx.length, meanAbs, p };
  });
  return { changedCount: k, byReceptor };
}

function buildScenario(rng) {
  for (let i = 0; i < 500; i++) {
    const s = drawScenario(rng);
    if (s) return s;
  }
  throw new Error("Could not build a mode-of-action scenario for this seed.");
}

if (typeof module !== "undefined") module.exports = { buildScenario, analysePair, RECEPTORS };

/* ---------- rendering ---------- */

const CELL_W = 36, CELL_H = 7, ROW_TREE_W = 54, BAR_W = 12, COL_TREE_H = 46;

function divergingColor(t) {
  t = MathUtils.clamp(t, -1, 1);
  const lerp = (c1, c2, s) => c1.map((v, i) => Math.round(v + (c2[i] - v) * s));
  const rgb = t < 0 ? lerp([33, 102, 172], [255, 255, 255], t + 1) : lerp([255, 255, 255], [178, 24, 43], t);
  return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
}

function el(tagName, attrs, text) {
  const node = document.createElement(tagName);
  Object.entries(attrs || {}).forEach(([k, v]) => node.setAttribute(k, v));
  if (text !== undefined) node.textContent = text;
  return node;
}
const sv = (tag, attrs, children) => SvgUtils.svgEl(tag, attrs, children || []);
const recById = (id) => RECEPTORS.find((r) => r.id === id) || OTHER;

/** Cluster rows (genes) and columns (compounds) of the matrix; returns orders and dendrogram edges. */
function clusterBoth(sc) {
  const colVecs = sc.compounds.map((c) => sc.genes.map((_, gi) => sc.matrix[gi][c.id]));
  const rowVecs = sc.matrix;
  const colRes = Clustering.agglomerativeCluster(Clustering.distanceMatrix(colVecs, "correlation"), "average");
  const rowRes = Clustering.agglomerativeCluster(Clustering.distanceMatrix(rowVecs, "correlation"), "average");
  return {
    cols: Clustering.dendrogramLayout(colRes, sc.compounds.map((c) => c.label)),
    rows: Clustering.dendrogramLayout(rowRes, sc.genes.map((g) => g.name))
  };
}

function drawHeatmap(svg, sc, cl, state) {
  SvgUtils.clearSVG(svg);
  const nC = sc.compounds.length, nR = sc.genes.length;
  const x0 = ROW_TREE_W + BAR_W + 8;
  const y0 = COL_TREE_H + 26;
  const W = x0 + nC * CELL_W + 4;
  const H = y0 + nR * CELL_H + 20;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);

  const rowOrder = cl.rows.leafOrder, colOrder = cl.cols.leafOrder;
  const pairSet = new Set(sc.pair);

  // dendrograms
  const maxH = (d) => Math.max(...d.edges.map((e) => Math.max(e.y1, e.y2)), 1e-6);
  const hc = maxH(cl.cols), hr = maxH(cl.rows);
  const colBase = y0 - 20;
  cl.cols.edges.forEach((e) => {
    const px = (x) => x0 + (x + 0.5) * CELL_W;
    const py = (y) => colBase - (y / hc) * (COL_TREE_H - 6);
    svg.appendChild(sv("line", { x1: px(e.x1), y1: py(e.y1), x2: px(e.x2), y2: py(e.y2), class: "moa-tree" }));
  });
  cl.rows.edges.forEach((e) => {
    const py = (x) => y0 + (x + 0.5) * CELL_H;
    const px = (y) => ROW_TREE_W - 4 - (y / hr) * (ROW_TREE_W - 8);
    svg.appendChild(sv("line", { x1: px(e.y1), y1: py(e.x1), x2: px(e.y2), y2: py(e.x2), class: "moa-tree" }));
  });

  // receptor annotation bar + heatmap cells
  rowOrder.forEach((gi, r) => {
    const g = sc.genes[gi];
    const rec = recById(g.receptor);
    const dim = state.focus && state.focus !== g.receptor;
    const bar = sv("rect", { x: ROW_TREE_W, y: y0 + r * CELL_H, width: BAR_W, height: CELL_H, fill: rec.color, opacity: dim ? 0.25 : 1 });
    bar.appendChild(sv("title", {}, [`${g.name}: ${g.receptor === "other" ? "no receptor annotation" : rec.short + " target"}`]));
    svg.appendChild(bar);
    colOrder.forEach((ci, c) => {
      svg.appendChild(sv("rect", {
        x: x0 + c * CELL_W, y: y0 + r * CELL_H, width: CELL_W - 1, height: CELL_H - (CELL_H > 5 ? 0.5 : 0),
        fill: divergingColor(sc.matrix[gi][ci] / MAX_ABS), opacity: dim ? 0.2 : 1
      }));
    });
  });

  // column labels and the highlighted pair
  colOrder.forEach((ci, c) => {
    svg.appendChild(sv("text", { x: x0 + c * CELL_W + CELL_W / 2, y: y0 + nR * CELL_H + 14, "text-anchor": "middle", class: "svg-axis-label", "font-weight": pairSet.has(ci) ? 700 : 400 }, [sc.compounds[ci].label]));
  });
  const pairCols = colOrder.map((ci, c) => (pairSet.has(ci) ? c : -1)).filter((c) => c >= 0);
  pairCols.forEach((c) => {
    svg.appendChild(sv("rect", { x: x0 + c * CELL_W - 1, y: y0 - 1, width: CELL_W + 1, height: nR * CELL_H + 2, fill: "none", stroke: "#17202a", "stroke-width": 2.2 }));
    svg.appendChild(sv("text", { x: x0 + c * CELL_W + CELL_W / 2, y: y0 - 5, "text-anchor": "middle", "font-size": 12, "font-weight": 700, fill: "#17202a" }, ["★"]));
  });
}

ActivityShell.init({
  rootId: "activity-root",
  title: "Mode of Action Discovery",
  defaultSeed: 2026,
  instructions:
    "Ten compounds were profiled across 48 genes. The colored bar marks which receptor each gene is a known target of, and " +
    "both genes and compounds are hierarchically clustered. The two starred compounds are a pair. Read the heatmap to decide " +
    "which receptor they most likely act through, then check your answer with an enrichment test. A new seed changes the pair.",

  render(data, { rng, container }) {
    const sc = buildScenario(rng);
    const cl = clusterBoth(sc);
    const state = { focus: null };
    let checked = false;

    const layout = el("div", { class: "moa-layout" });
    const left = el("section", { class: "aw-panel" });
    const right = el("section", { class: "aw-panel moa-right" });
    layout.append(left, right);
    container.appendChild(layout);

    left.appendChild(el("h3", {}, "Clustered gene expression changes"));
    left.appendChild(el("p", { class: "aw-note" },
      "Rows are genes and columns are compounds (log₂ fold change: red = induced, white = no change, blue = repressed). " +
      "The colored bar marks each gene’s known receptor. Click a receptor to highlight its genes."));
    const legend = el("div", { class: "moa-legend" });
    [...RECEPTORS, OTHER].forEach((r) => {
      const chip = el("button", { type: "button", class: "moa-chip", "aria-pressed": "false", "data-id": r.id });
      chip.innerHTML = `<span class="aw-swatch" style="background:${r.color}"></span>${r.short}`;
      chip.addEventListener("click", () => {
        state.focus = state.focus === r.id ? null : r.id;
        legend.querySelectorAll(".moa-chip").forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.id === state.focus)));
        draw();
      });
      legend.appendChild(chip);
    });
    left.appendChild(legend);
    const svg = sv("svg", { class: "moa-heatmap", role: "img", "aria-label": "Clustered heatmap of 48 genes across 10 compounds, with a receptor annotation bar; two compounds are starred as the pair to explain" });
    left.appendChild(svg);
    function draw() { drawHeatmap(svg, sc, cl, state); }
    draw();

    right.appendChild(el("h3", {}, "What is the likely mechanism of the starred pair?"));
    right.appendChild(el("p", { class: "aw-note" },
      "Look at which colored block of genes the two starred compounds switch on, and compare with the other compounds. Then choose the receptor they most likely act through."));
    const predictMount = el("div", {});
    right.appendChild(predictMount);
    const options = rng.shuffle(RECEPTORS.map((r) => ({ id: r.id, label: r.label })));
    const widget = PredictionComponent.createPredictionWidget(predictMount, {
      prompt: "Which receptor is the likely mechanism of action of the starred pair?",
      inputType: "select", options, commitLabel: "Lock in answer"
    });
    const actions = el("div", { class: "aw-actions" });
    const checkBtn = el("button", { type: "button" }, "Check my answer");
    actions.appendChild(checkBtn);
    right.appendChild(actions);
    const results = el("div", { class: "moa-results", "aria-live": "polite" });
    right.appendChild(results);

    function check() {
      if (checked) return;
      checked = true;
      const an = sc.analysis;
      const fmtP = (p) => (p < 0.001 ? p.toExponential(1) : p.toFixed(3));
      const table = el("table", { class: "aw-table moa-table" });
      table.innerHTML =
        "<thead><tr><th>Receptor</th><th>Shared genes changed</th><th>Mean |log₂FC|</th><th>Fisher p</th></tr></thead><tbody>" +
        an.byReceptor.map((r) => {
          const rec = recById(r.id);
          return `<tr class="${r.id === sc.target ? "moa-best" : ""}"><th><span class="aw-swatch" style="background:${rec.color}"></span>${rec.short}</th>` +
            `<td>${r.overlap} of ${r.size}</td><td>${r.meanAbs.toFixed(2)}</td><td>${fmtP(r.p)}</td></tr>`;
        }).join("") + "</tbody>";
      results.innerHTML = "";
      results.appendChild(table);

      const rec = recById(sc.target);
      const row = an.byReceptor.find((r) => r.id === sc.target);
      const [ca, cb] = sc.pair;
      const cross = [ca, cb].map((id) => sc.compounds[id]).filter((c) => c.secondary)
        .map((c) => `Compound ${c.label} also weakly nudges ${recById(c.secondary).short} targets (cross-talk)`);
      const picked = widget.getPrediction();
      const msg = el("p", { class: "moa-takeaway" });
      msg.innerHTML =
        `<b>Compounds ${sc.compounds[ca].label} and ${sc.compounds[cb].label} act through ${rec.short}.</b> Of the ${row.size} ${rec.short} target genes, ${row.overlap} changed in the same direction in both compounds ` +
        `(Fisher p = ${fmtP(row.p)}), and no other receptor’s genes move. The pair clusters together because they switch on the same colored block. ` +
        (cross.length ? `${cross.join("; ")}, which is why real signatures are never perfectly clean. ` : "") +
        `A signature like this is a hypothesis about mechanism, to be confirmed with a receptor-specific test.`;
      if (picked && picked !== sc.target) {
        const pr = recById(picked), prow = an.byReceptor.find((r) => r.id === picked);
        msg.innerHTML = `<b>Not ${pr.short}:</b> only ${prow.overlap} of its ${prow.size} target genes changed in both compounds. ` + msg.innerHTML;
      }
      results.appendChild(msg);
      widget.reveal(sc.target, (predicted) => {
        const ok = predicted === sc.target;
        return {
          status: ok ? "correct" : "incorrect",
          label: ok ? "Correct!" : "Not quite",
          detail: ok ? `The pair switches on the ${rec.short} target genes.` : `The starred pair switches on the ${rec.short} target genes.`
        };
      });
      state.focus = sc.target;
      legend.querySelectorAll(".moa-chip").forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.id === state.focus)));
      draw();
      checkBtn.disabled = true;
    }
    checkBtn.addEventListener("click", check);

    return {
      reset() {
        checked = false; state.focus = null;
        legend.querySelectorAll(".moa-chip").forEach((c) => c.setAttribute("aria-pressed", "false"));
        widget.reset(); results.innerHTML = ""; checkBtn.disabled = false;
        draw();
      }
    };
  }
});
