/**
 * Activity — Seeing Space in a Tissue Measurement.
 *
 * A 20 x 20 piece of liver, one dot per cell: blue = hepatocyte, red = immune
 * cell. Raise the share of immune cells and, in "inflammation" mode, they form
 * tight foci rather than spreading evenly. Three views of the same tissue:
 *   1. the dot map: where every cell is (single-cell resolution with position),
 *   2. what 10 genes look like in every cell: a compressed heatmap (rows =
 *      genes, one column per cell, sorted by cell type, no labels),
 *   3. bulk: those 400 columns collapsed into a single column of 10 genes.
 *
 * Each cell's gene values depend only on its type and on a fixed noise "slot"
 * (the k-th immune cell, the k-th hepatocyte), never on its position. So moving
 * between "clustered" and "scattered" changes the dot map but leaves the heatmap
 * and the bulk column exactly as they were: expression alone does not say where
 * the cells are.
 *
 * Depends on: prng.js, math-utils.js, activity-shell.js.
 */

const SIZE = 20;
const TOTAL = SIZE * SIZE;
const BLUE = [43, 108, 176];
const RED = [192, 57, 43];

// 10 genes: four hepatocyte genes, four immune genes, two shared genes
const GENE_TYPE = ["H", "H", "H", "H", "I", "I", "I", "I", "S", "S"];
const LEVEL = { hep: { H: 8, I: 1, S: 5 }, imm: { H: 1, I: 8, S: 5 } };
const MAX_LEVEL = 10;
const HEAT_PX = 350;          // canvas pixels across (shown at 175 css px)

function tag(name, attrs, text) {
  const node = document.createElementNS(
    ["svg", "circle", "rect", "text", "g", "line"].includes(name) ? "http://www.w3.org/2000/svg" : "http://www.w3.org/1999/xhtml", name);
  Object.entries(attrs || {}).forEach(([k, v]) => node.setAttribute(k, v));
  if (text !== undefined) node.textContent = text;
  return node;
}

function mix(f) {
  const c = BLUE.map((b, i) => Math.round(b + (RED[i] - b) * f));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

/** White (low) to teal (high) expression color, same as the composition activity. */
function expressionColor(v) {
  const t = MathUtils.clamp(v / MAX_LEVEL, 0, 1);
  const lerp = (a, b) => Math.round(a + (b - a) * t);
  return `rgb(${lerp(255, 24)},${lerp(255, 110)},${lerp(255, 100)})`;
}

/** Rank cells so that the first N in the order become immune cells. */
function buildOrders(rng) {
  const fociCount = rng.int(2, 4);
  const foci = Array.from({ length: fociCount }, () => ({ x: rng.range(3, SIZE - 3), y: rng.range(3, SIZE - 3), s: rng.range(2.2, 3.4) }));
  const clustered = [];
  const scattered = [];
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      let score = 0;
      foci.forEach((f) => { score += Math.exp(-((x - f.x) ** 2 + (y - f.y) ** 2) / (2 * f.s * f.s)); });
      clustered.push({ i: y * SIZE + x, score: score + rng.range(0, 0.08) });
      scattered.push({ i: y * SIZE + x, score: rng.random() });
    }
  }
  const order = (arr) => arr.sort((a, b) => b.score - a.score).map((c) => c.i);
  return { clustered: order(clustered), scattered: order(scattered) };
}

function immuneSet(order, percent) {
  const n = Math.round((percent / 100) * TOTAL);
  return new Set(order.slice(0, n));
}

/** Noise for the k-th cell of each type (so values never depend on position). */
function buildNoise(rng) {
  const make = () => Array.from({ length: TOTAL }, () => GENE_TYPE.map(() => rng.gaussian(0, 1)));
  return { hep: make(), imm: make() };
}

/** Expression of the cell in sorted column `c` (immune cells first, then hepatocytes). */
function cellValues(noise, nImm, c) {
  const immune = c < nImm;
  const k = immune ? c : c - nImm;
  const level = immune ? LEVEL.imm : LEVEL.hep;
  const nz = (immune ? noise.imm : noise.hep)[k];
  return GENE_TYPE.map((t, g) => MathUtils.clamp(level[t] + nz[g], 0, MAX_LEVEL));
}

function bulkOf(noise, nImm) {
  const sums = GENE_TYPE.map(() => 0);
  for (let c = 0; c < TOTAL; c++) cellValues(noise, nImm, c).forEach((v, g) => { sums[g] += v; });
  return sums.map((s) => s / TOTAL);
}

if (typeof module !== "undefined") module.exports = { buildNoise, cellValues, bulkOf, GENE_TYPE, TOTAL };

ActivityShell.init({
  rootId: "activity-root",
  title: "Seeing Space in a Tissue Measurement",
  defaultSeed: 2028,
  instructions:
    "Each dot is one cell: blue is a hepatocyte, red is an immune cell. Raise the share of immune cells and watch three views of the same tissue: " +
    "where the cells are, what 10 genes look like in every cell, and the single column you get if you measure the whole tissue in bulk.",

  render(data, { rng, container }) {
    const orders = buildOrders(rng);
    const noise = buildNoise(rng);
    const state = { percent: 8, pattern: "clustered" };

    const controls = tag("div", { class: "sc-controls aw-panel" });
    const slider = tag("input", { type: "range", id: "sc-percent", min: 0, max: 50, step: 1, value: state.percent });
    const sliderLabel = tag("label", { class: "field-label", for: "sc-percent" });
    const sliderValue = tag("span", { class: "control-row__value" }, `${state.percent}%`);
    sliderLabel.append("Immune cells in the tissue: ", sliderValue);
    const sliderRow = tag("div", { class: "control-row" });
    sliderRow.append(sliderLabel, slider);

    const pattern = tag("fieldset", { class: "control-group" });
    pattern.appendChild(tag("legend", {}, "Where do the immune cells sit?"));
    [["clustered", "Clustered in foci (inflammation)"], ["scattered", "Scattered evenly"]].forEach(([val, text]) => {
      const lab = tag("label", { class: "sc-radio" });
      const r = tag("input", { type: "radio", name: "sc-pattern", value: val });
      if (val === state.pattern) r.checked = true;
      r.addEventListener("change", () => { state.pattern = val; draw(); });
      lab.append(r, " " + text);
      pattern.appendChild(lab);
    });

    slider.addEventListener("input", () => { state.percent = Number(slider.value); sliderValue.textContent = `${state.percent}%`; draw(); });
    controls.append(sliderRow, pattern);

    const panels = tag("div", { class: "sc-panels" });
    const readout = tag("p", { class: "sc-readout", "aria-live": "polite" });
    container.append(controls, readout, panels);

    function panel(title, subtitle) {
      const p = tag("section", { class: "aw-panel sc-panel" });
      p.appendChild(tag("h4", {}, title));
      p.appendChild(tag("p", { class: "aw-note" }, subtitle));
      return p;
    }

    function drawHeat(canvas, nImm) {
      const ctx = canvas.getContext("2d");
      const rowH = HEAT_PX / GENE_TYPE.length;
      for (let x = 0; x < HEAT_PX; x++) {
        const c0 = Math.floor((x * TOTAL) / HEAT_PX);
        const c1 = Math.max(c0 + 1, Math.floor(((x + 1) * TOTAL) / HEAT_PX));
        const sums = GENE_TYPE.map(() => 0);
        for (let c = c0; c < c1; c++) cellValues(noise, nImm, c).forEach((v, g) => { sums[g] += v; });
        sums.forEach((s, g) => {
          ctx.fillStyle = expressionColor(s / (c1 - c0));
          ctx.fillRect(x, g * rowH, 1, rowH + 0.5);
        });
      }
    }

    function draw() {
      const set = immuneSet(orders[state.pattern], state.percent);
      const nImm = set.size;
      const immuneFraction = nImm / TOTAL;
      panels.innerHTML = "";

      // 1 — where the cells are
      const p1 = panel("Where the cells are", "Each dot is one cell.");
      const svg1 = tag("svg", { viewBox: `0 0 ${SIZE} ${SIZE}`, class: "sc-svg", role: "img", "aria-label": `${nImm} immune cells among ${TOTAL} cells, ${state.pattern}` });
      for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
          svg1.appendChild(tag("circle", { cx: x + 0.5, cy: y + 0.5, r: 0.4, fill: set.has(y * SIZE + x) ? mix(1) : mix(0) }));
        }
      }
      p1.appendChild(svg1);
      const leg1 = tag("p", { class: "sc-legend" });
      leg1.innerHTML = '<span class="aw-swatch" style="background:' + mix(0) + '"></span>Hepatocyte &nbsp; <span class="aw-swatch" style="background:' + mix(1) + '"></span>Immune cell';
      p1.appendChild(leg1);

      // 2 — 10 genes in every cell, single-cell resolution
      const p2 = panel("10 genes in every cell", "Rows are genes and each column is a cell, sorted by type (immune first).");
      const canvas = tag("canvas", { width: HEAT_PX, height: HEAT_PX, class: "sc-heat", role: "img", "aria-label": `Single-cell heatmap: 10 genes across ${TOTAL} cells, ${nImm} of them immune cells` });
      p2.appendChild(canvas);
      drawHeat(canvas, nImm);
      p2.appendChild(tag("p", { class: "sc-legend" }, "White = low expression, teal = high."));

      // 3 — bulk: all columns collapsed into one
      const bulk = bulkOf(noise, nImm);
      const p3 = panel("Bulk (whole tissue)", "All the cells averaged into a single column.");
      const svg3 = tag("svg", { viewBox: `0 0 1 ${GENE_TYPE.length}`, preserveAspectRatio: "none", class: "sc-bulk", role: "img", "aria-label": "Bulk measurement: one column of 10 genes" });
      bulk.forEach((v, g) => svg3.appendChild(tag("rect", { x: 0, y: g, width: 1, height: 1.02, fill: expressionColor(v) })));
      p3.appendChild(svg3);
      p3.appendChild(tag("p", { class: "sc-legend" }, "One column, 10 genes."));

      panels.append(p1, p2, p3);

      const immuneGenes = GENE_TYPE.map((t, g) => (t === "I" ? g : -1)).filter((g) => g >= 0);
      const bulkImm = immuneGenes.reduce((s, g) => s + bulk[g], 0) / immuneGenes.length;
      if (nImm === 0) {
        readout.innerHTML = "There are no immune cells yet, so the immune genes are off everywhere. Raise the percentage to add some.";
        return;
      }
      readout.innerHTML =
        `<b>${Math.round(immuneFraction * 100)}%</b> of the cells are immune cells. In the heatmap the immune genes are bright only in the immune block (about ${LEVEL.imm.I} on this scale); ` +
        `in bulk they are diluted to about <b>${bulkImm.toFixed(1)}</b>. ` +
        (state.pattern === "clustered"
          ? "The immune cells sit in foci on the map, but nothing in the heatmap or the bulk column records that."
          : "Switch between clustered and scattered: the dots move, but the heatmap and the bulk column do not change. Expression alone does not say where the cells are.");
    }

    draw();
    return {
      reset() {
        state.percent = 8; state.pattern = "clustered";
        slider.value = state.percent; sliderValue.textContent = `${state.percent}%`;
        pattern.querySelectorAll("input").forEach((r) => { r.checked = r.value === "clustered"; });
        draw();
      }
    };
  }
});
