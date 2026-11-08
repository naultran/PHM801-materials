/**
 * Activity — Over-Representation or Ranked?
 *
 * Twenty genes are ranked from most induced to most repressed and tagged with
 * one of three pathways. The student looks at the ranking alone and commits to
 * the pathway they think is enriched; the reveal then runs two methods on the
 * same data:
 *   1. Over-representation: Fisher's exact test on the "changed" genes (the
 *      boxed top 4 + bottom 4) against the 20-gene background.
 *   2. Ranked (GSEA-style): a running sum down the whole list — each pathway
 *      gene steps the line up, every other gene steps it down — scored by its
 *      largest excursion and compared with random gene sets of the same size
 *      (a permutation p-value).
 *
 * Every seed has exactly one pathway that is enriched by both methods; the
 * other two are chosen so that neither method flags them. A new seed changes
 * the genes, the ranking, which pathway is real, and where its genes fall.
 *
 * Depends on: prng.js, math-utils.js, stats-utils.js, svg-utils.js,
 * activity-shell.js, prediction-component.js.
 */

const N_GENES = 20;
const SET_SIZE = 5;          // genes per pathway
const BOX_N = 4;             // boxed at each end: top 4 and bottom 4
const N_PERM = 2000;
const ALPHA = 0.05;
const PATH_COLORS = ["#0072b2", "#d55e00", "#009e73"];

/* ---------- pure logic (also exercised by a node test harness) ---------- */

/** Running-sum curve down the ranked list for a set of hit ranks (0-based). */
function runningSum(hits) {
  const hitCount = hits.size;
  const missCount = N_GENES - hitCount;
  const path = [0];
  let s = 0;
  for (let i = 0; i < N_GENES; i++) {
    s += hits.has(i) ? 1 / hitCount : -1 / missCount;
    path.push(s);
  }
  return path;
}

/** Enrichment score: the running sum's largest excursion from zero (signed). */
function enrichmentScore(path) {
  let best = 0;
  path.forEach((v) => { if (Math.abs(v) > Math.abs(best)) best = v; });
  return best;
}

/** Null distribution of |ES| for random gene sets of the given size. */
function buildNull(rng, size) {
  const ranks = Array.from({ length: N_GENES }, (_, i) => i);
  const nullES = [];
  for (let t = 0; t < N_PERM; t++) {
    const pick = new Set(rng.shuffle(ranks).slice(0, size));
    nullES.push(Math.abs(enrichmentScore(runningSum(pick))));
  }
  return nullES;
}

function permutationP(absES, nullES) {
  let atLeast = 0;
  nullES.forEach((v) => { if (v >= absES - 1e-12) atLeast++; });
  return (atLeast + 1) / (nullES.length + 1);
}

function isBoxed(rank) {
  return rank < BOX_N || rank >= N_GENES - BOX_N;
}

/** Both methods for one pathway (a Set of 0-based ranks). */
function analyzePathway(hits, nullES) {
  const a = [...hits].filter(isBoxed).length;       // boxed genes in pathway
  const boxTotal = 2 * BOX_N;
  const b = boxTotal - a;                           // boxed genes not in pathway
  const c = hits.size - a;                          // pathway genes not boxed
  const d = N_GENES - a - b - c;                    // neither
  const fisherP = StatsUtils.fishersExactTest(a, b, c, d);
  const path = runningSum(hits);
  const es = enrichmentScore(path);
  const gseaP = permutationP(Math.abs(es), nullES);
  return {
    table: { a, b, c, d }, fisherP, fisherSig: fisherP < ALPHA,
    path, es, gseaP, gseaSig: gseaP < ALPHA
  };
}

/**
 * Build one scenario: ranked fold changes, gene names, and three pathways of
 * which exactly one is enriched (by both methods). Retries until a draw meets
 * that rule; the rule is easy to satisfy so this almost always takes 1-3 tries.
 */
function buildScenario(rng) {
  const nullES = buildNull(rng, SET_SIZE);

  let fc = [];
  for (let i = 0; i < N_GENES; i++) {
    fc.push(2.8 - (5.2 * i) / (N_GENES - 1) + rng.range(-0.12, 0.12));
  }
  fc = fc.sort((x, y) => y - x).map((v) => Math.round(v * 100) / 100);

  const names = rng.shuffle(Array.from({ length: N_GENES }, (_, i) => i + 1))
    .map((n) => "G" + String(n).padStart(2, "0"));

  const topBox = Array.from({ length: BOX_N }, (_, i) => i);
  const bottomBox = Array.from({ length: BOX_N }, (_, i) => N_GENES - BOX_N + i);
  const allRanks = Array.from({ length: N_GENES }, (_, i) => i);

  let chosen = null;
  for (let attempt = 0; attempt < 200 && !chosen; attempt++) {
    const mainIsTop = rng.random() < 0.5;
    const main = mainIsTop ? topBox : bottomBox;
    const other = mainIsTop ? bottomBox : topBox;
    const mainCount = rng.random() < 0.5 ? 4 : 3;
    const real = new Set(
      rng.shuffle(main).slice(0, mainCount).concat(rng.shuffle(other).slice(0, SET_SIZE - mainCount))
    );
    const rest = rng.shuffle(allRanks.filter((r) => !real.has(r)));
    const decoyA = new Set(rest.slice(0, SET_SIZE));
    const decoyB = new Set(rest.slice(SET_SIZE, 2 * SET_SIZE));
    const stats = [real, decoyA, decoyB].map((s) => analyzePathway(s, nullES));
    const realOk = stats[0].fisherSig && stats[0].gseaSig;
    const decoysOk = [stats[1], stats[2]].every((s) => !s.fisherSig && !s.gseaSig);
    if (realOk && decoysOk) chosen = { sets: [real, decoyA, decoyB], stats };
  }
  if (!chosen) { // extremely unlikely fallback: keep the last draw so the activity still runs
    const real = new Set([0, 1, 2, 3, N_GENES - 1]);
    const rest = rng.shuffle(allRanks.filter((r) => !real.has(r)));
    const sets = [real, new Set(rest.slice(0, SET_SIZE)), new Set(rest.slice(SET_SIZE, 2 * SET_SIZE))];
    chosen = { sets, stats: sets.map((s) => analyzePathway(s, nullES)) };
  }

  // Shuffle which label (Path 1/2/3) is the real one.
  const order = rng.shuffle([0, 1, 2]);
  const pathways = order.map((srcIdx, i) => ({
    label: `Path ${i + 1}`, color: PATH_COLORS[i], hits: chosen.sets[srcIdx], stats: chosen.stats[srcIdx]
  }));
  const membership = new Array(N_GENES).fill(-1);
  pathways.forEach((p, i) => p.hits.forEach((r) => { membership[r] = i; }));
  const realIndex = pathways.findIndex((p) => p.stats.fisherSig && p.stats.gseaSig);

  return { fc, names, pathways, membership, realIndex };
}

if (typeof module !== "undefined") {
  module.exports = { buildScenario, runningSum, enrichmentScore, analyzePathway, buildNull };
}

/* ---------- rendering ---------- */

function fmtP(p) {
  return p < 0.001 ? p.toExponential(1) : p.toFixed(3);
}

function el(tag, attrs, text) {
  const node = document.createElement(tag);
  Object.entries(attrs || {}).forEach(([k, v]) => node.setAttribute(k, v));
  if (text !== undefined) node.textContent = text;
  return node;
}

function drawRunningSum(pathway, yDomain) {
  const W = 240, H = 132, X0 = 12, X1 = 232, Y0 = 8, Y1 = 98;
  const svg = SvgUtils.svgEl("svg", {
    viewBox: `0 0 ${W} ${H}`, class: "em-gsea-svg", role: "img",
    "aria-label": `Running-sum curve for ${pathway.label}. Enrichment score ${pathway.stats.es.toFixed(2)}.`
  });
  const x = SvgUtils.linearScale([0, N_GENES], [X0, X1]);
  const y = SvgUtils.linearScale(yDomain, [Y1, Y0]);

  svg.appendChild(SvgUtils.svgEl("line", { x1: X0, x2: X1, y1: y(0), y2: y(0), stroke: "#9ca3af", "stroke-dasharray": "3 3" }));
  const pts = pathway.stats.path.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  svg.appendChild(SvgUtils.svgEl("polyline", { points: pts, fill: "none", stroke: pathway.color, "stroke-width": 2.5 }));

  // ES marker
  let bestI = 0;
  pathway.stats.path.forEach((v, i) => { if (Math.abs(v) > Math.abs(pathway.stats.path[bestI])) bestI = i; });
  svg.appendChild(SvgUtils.svgEl("circle", { cx: x(bestI), cy: y(pathway.stats.path[bestI]), r: 4, fill: pathway.color, stroke: "#fff", "stroke-width": 1.5 }));

  // rug of hits
  for (let r = 0; r < N_GENES; r++) {
    const hit = pathway.hits.has(r);
    svg.appendChild(SvgUtils.svgEl("line", {
      x1: x(r + 0.5), x2: x(r + 0.5), y1: 106, y2: hit ? 122 : 110,
      stroke: hit ? pathway.color : "#d1d5db", "stroke-width": hit ? 2.5 : 1
    }));
  }
  svg.appendChild(SvgUtils.svgEl("text", { x: X0, y: 131, class: "svg-axis-label", "font-size": 9 }, ["most induced"]));
  svg.appendChild(SvgUtils.svgEl("text", { x: X1, y: 131, class: "svg-axis-label", "font-size": 9, "text-anchor": "end" }, ["most repressed"]));
  return svg;
}

function sigBadge(sig) {
  return el("span", { class: `badge ${sig ? "badge-correct" : "badge-neutral"}` }, sig ? "Significant" : "Not significant");
}

ActivityShell.init({
  rootId: "activity-root",
  title: "Over-Representation or Ranked?",
  defaultSeed: 3030,
  instructions:
    "Twenty genes are ranked from most induced (top) to most repressed (bottom), and each is tagged with a " +
    "pathway. Look at the ranking and predict which pathway is enriched. Then reveal how two methods judge it: " +
    "over-representation (boxed genes only) and a ranked method that uses the whole list.",

  render(data, { rng, container }) {
    const scenario = buildScenario(rng);
    const { fc, names, pathways, membership, realIndex } = scenario;
    const maxAbs = Math.max(...fc.map(Math.abs));
    let revealed = false;

    const layout = el("div", { class: "em-layout" });
    container.appendChild(layout);

    /* ---- left: the ranked list ---- */
    const left = el("section", { class: "aw-panel em-list-panel" });
    left.appendChild(el("h3", {}, "Genes ranked by fold change"));
    const legend = el("p", { class: "aw-note" });
    legend.innerHTML = "Boxed: the <b>4 most induced</b> and <b>4 most repressed</b> genes.";
    left.appendChild(legend);

    const list = el("div", { class: "em-list", role: "list", "aria-label": "Genes ranked by fold change" });
    function addRow(rank, parent) {
      const row = el("div", { class: "em-row", role: "listitem" });
      row.appendChild(el("span", { class: "em-rank" }, String(rank + 1)));
      row.appendChild(el("span", { class: "em-gene" }, names[rank]));
      const bar = el("span", { class: "em-bar", "aria-hidden": "true" });
      const fill = el("i", {});
      const half = (Math.abs(fc[rank]) / maxAbs) * 50;
      fill.style.width = half + "%";
      fill.style.left = fc[rank] >= 0 ? "50%" : (50 - half) + "%";
      fill.style.background = fc[rank] >= 0 ? "#b5651d" : "#1b3a5c";
      bar.appendChild(fill);
      row.appendChild(bar);
      row.appendChild(el("span", { class: "em-fc" }, (fc[rank] > 0 ? "+" : "") + fc[rank].toFixed(2)));
      const m = membership[rank];
      const chip = m >= 0
        ? el("span", { class: "em-chip", style: `background:${pathways[m].color}` }, pathways[m].label)
        : el("span", { class: "em-chip em-chip--none" }, "none");
      row.appendChild(chip);
      parent.appendChild(row);
    }
    const topBox = el("div", { class: "em-box", "data-label": "Top 4" });
    for (let r = 0; r < BOX_N; r++) addRow(r, topBox);
    list.appendChild(topBox);
    const mid = el("div", { class: "em-mid" });
    for (let r = BOX_N; r < N_GENES - BOX_N; r++) addRow(r, mid);
    list.appendChild(mid);
    const botBox = el("div", { class: "em-box", "data-label": "Bottom 4" });
    for (let r = N_GENES - BOX_N; r < N_GENES; r++) addRow(r, botBox);
    list.appendChild(botBox);
    left.appendChild(list);
    layout.appendChild(left);

    /* ---- right: prediction, then both methods ---- */
    const right = el("section", { class: "aw-panel em-right" });
    right.appendChild(el("h3", {}, "Which pathway is enriched?"));
    const predictMount = el("div", {});
    right.appendChild(predictMount);
    const widget = PredictionComponent.createPredictionWidget(predictMount, {
      prompt: "Judging only by where each pathway's genes sit in the ranking, which pathway do you think is enriched?",
      inputType: "select",
      options: pathways.map((p) => ({ id: p.label, label: p.label })),
      commitLabel: "Lock in answer"
    });

    const actions = el("div", { class: "aw-actions" });
    const revealBtn = el("button", { type: "button" }, "Reveal — run both methods");
    actions.appendChild(revealBtn);
    right.appendChild(actions);

    const results = el("div", { class: "em-results", "aria-live": "polite" });
    results.appendChild(el("p", { class: "aw-note" },
      "Lock in a guess first. The reveal tests every pathway two ways, using the same 20 genes."));
    right.appendChild(results);
    layout.appendChild(right);

    function showResults() {
      results.innerHTML = "";
      const yAll = pathways.flatMap((p) => p.stats.path);
      const yDomain = [Math.min(-0.1, ...yAll) - 0.05, Math.max(0.2, ...yAll) + 0.05];

      const grid = el("div", { class: "em-cards" });
      pathways.forEach((p, i) => {
        const s = p.stats;
        const card = el("div", { class: "em-card", style: `border-top-color:${p.color}` });
        card.appendChild(el("h4", {}, p.label));

        card.appendChild(el("div", { class: "em-method" }, "1 · Over-representation"));
        const t = el("table", { class: "aw-table em-2x2" });
        t.innerHTML =
          "<thead><tr><th></th><th>In pathway</th><th>Not</th></tr></thead>" +
          `<tbody><tr><th>Boxed</th><td>${s.table.a}</td><td>${s.table.b}</td></tr>` +
          `<tr><th>Not boxed</th><td>${s.table.c}</td><td>${s.table.d}</td></tr></tbody>`;
        card.appendChild(t);
        const p1 = el("p", { class: "em-pline" });
        p1.append(`Fisher p = ${fmtP(s.fisherP)} `, sigBadge(s.fisherSig));
        card.appendChild(p1);

        card.appendChild(el("div", { class: "em-method" }, "2 · Ranked (whole list)"));
        card.appendChild(drawRunningSum(p, yDomain));
        const p2 = el("p", { class: "em-pline" });
        p2.append(`Score ${s.es >= 0 ? "+" : ""}${s.es.toFixed(2)} · permutation p = ${fmtP(s.gseaP)} `, sigBadge(s.gseaSig));
        card.appendChild(p2);
        grid.appendChild(card);
      });
      results.appendChild(grid);

      const real = pathways[realIndex];
      const takeaway = el("p", { class: "em-takeaway" });
      const shape = real.stats.es >= 0
        ? `its genes pile up toward the <b>most induced</b> end, so the line shoots up at the start and then drifts back to zero`
        : `its genes pile up toward the <b>most repressed</b> end, so the line drifts down through most of the list and then snaps back up at the end`;
      takeaway.innerHTML =
        `<b>${real.label}</b> is the enriched pathway: ${shape} (a “hockey stick”). The other two wander near zero. ` +
        `Over-representation only sees the boxed genes; the ranked method uses every gene's position, so it can also catch ` +
        `a pathway that is only gently shifted.`;
      results.appendChild(takeaway);
    }

    revealBtn.addEventListener("click", () => {
      if (revealed) return;
      revealed = true;
      const guess = widget.getPrediction() || pathways[0].label;
      showResults();
      const real = pathways[realIndex];
      widget.reveal(real.label, (predicted) => {
        const correct = predicted === real.label;
        return {
          status: correct ? "correct" : "incorrect",
          label: correct ? "Correct!" : "Not quite",
          detail: `${real.label} is significant by both methods (Fisher p = ${fmtP(real.stats.fisherP)}, ` +
            `permutation p = ${fmtP(real.stats.gseaP)}).`
        };
      });
      revealBtn.disabled = true;
    });

    return {
      reset() {
        revealed = false;
        revealBtn.disabled = false;
        widget.reset();
        results.innerHTML = "";
        results.appendChild(el("p", { class: "aw-note" },
          "Lock in a guess first. The reveal tests every pathway two ways, using the same 20 genes."));
      }
    };
  }
});
