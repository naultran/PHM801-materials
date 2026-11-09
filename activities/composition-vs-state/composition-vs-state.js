/**
 * Activity — Bulk or Mixed? Composition vs. State.
 *
 * A toy liver of 10 cells x 10 genes. Bulk RNA-seq is the average of the cells,
 * so two different cellular events can produce the same bulk result:
 *   Step 1  Composition: change how many cells are immune cells (slider).
 *   Step 2  State: keep the cell mix fixed, turn up the immune genes inside
 *           each immune cell (slider).
 *   Step 3  Put them side by side: a composition change and the matching state
 *           change give (nearly) the same bulk profile for the immune genes.
 *
 * Genes: H1-H4 are made by hepatocytes, I1-I4 by immune cells, S1-S2 by both.
 * Depends on: prng.js, math-utils.js, activity-shell.js.
 */

const N_CELLS = 10;
const GENES = ["H1", "H2", "H3", "H4", "I1", "I2", "I3", "I4", "S1", "S2"];
const GENE_TYPE = ["H", "H", "H", "H", "I", "I", "I", "I", "S", "S"];
const BASE_IMMUNE = 2;   // starting number of immune cells
const MAX_ACTIVATION = 4;

// Typical expression of each gene class in each cell type.
const LEVEL = {
  hep: { H: 8, I: 0.6, S: 5 },
  imm: { H: 0.4, I: 7, S: 5 }
};

function expressionOf(type, gene, noise, activation) {
  const cls = GENE_TYPE[gene];
  let v = LEVEL[type][cls];
  if (type === "imm" && cls === "I") v *= activation;
  return Math.max(0, v + noise);
}

/** Build the 10x10 matrix for a given immune-cell count and activation. */
function buildMatrix(noise, immuneCount, activation) {
  const rows = [];
  for (let c = 0; c < N_CELLS; c++) {
    const type = c >= N_CELLS - immuneCount ? "imm" : "hep";
    rows.push({ type, values: GENES.map((g, gi) => expressionOf(type, gi, noise[c][gi], activation)) });
  }
  return rows;
}

function bulkOf(rows) {
  return GENES.map((g, gi) => rows.reduce((s, r) => s + r.values[gi], 0) / rows.length);
}

function log2fc(v, base) {
  return Math.log2((v + 0.05) / (base + 0.05));
}

/** Activation that makes the immune genes' bulk sum match a composition change. */
function matchingActivation(noise, baseImmune, newImmune) {
  const target = bulkOf(buildMatrix(noise, newImmune, 1));
  const iIdx = GENE_TYPE.map((t, i) => (t === "I" ? i : -1)).filter((i) => i >= 0);
  const sumTarget = iIdx.reduce((s, i) => s + target[i], 0);
  const at1 = bulkOf(buildMatrix(noise, baseImmune, 1));
  const at2 = bulkOf(buildMatrix(noise, baseImmune, 2));
  const s1 = iIdx.reduce((s, i) => s + at1[i], 0);
  const s2 = iIdx.reduce((s, i) => s + at2[i], 0);
  const slope = s2 - s1; // bulk sum is linear in activation
  return slope > 0 ? Math.max(1, (sumTarget - s1) / slope + 1) : 1;
}

if (typeof module !== "undefined") module.exports = { buildMatrix, bulkOf, matchingActivation, log2fc, GENES, GENE_TYPE, BASE_IMMUNE };

function sequential(v) {
  const t = MathUtils.clamp(v / 12, 0, 1);
  const lerp = (a, b) => Math.round(a + (b - a) * t);
  return { bg: `rgb(${lerp(255, 24)},${lerp(255, 110)},${lerp(255, 100)})`, dark: t > 0.5 };
}
function diverging(v) {
  const t = MathUtils.clamp(v / 2, -1, 1);
  const lerp = (c1, c2, s) => c1.map((x, i) => Math.round(x + (c2[i] - x) * s));
  const rgb = t < 0 ? lerp([33, 102, 172], [255, 255, 255], t + 1) : lerp([255, 255, 255], [178, 24, 43], t);
  return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
}

function tag(name, attrs, text) {
  const node = document.createElement(name);
  Object.entries(attrs || {}).forEach(([k, v]) => node.setAttribute(k, v));
  if (text !== undefined) node.textContent = text;
  return node;
}

function headerRow(extra) {
  const tr = tag("tr");
  tr.appendChild(tag("th", {}, extra || ""));
  GENES.forEach((g, i) => tr.appendChild(tag("th", { class: `cs-gene cs-gene--${GENE_TYPE[i]}` }, g)));
  return tr;
}

function cellTable(rows, baseBulk) {
  const table = tag("table", { class: "cs-table", "aria-label": "Expression of 10 genes in 10 cells, with the bulk average" });
  const thead = tag("thead");
  thead.appendChild(headerRow("Cell"));
  table.appendChild(thead);
  const tbody = tag("tbody");
  rows.forEach((r, i) => {
    const tr = tag("tr");
    const label = tag("th", { class: `cs-cellname cs-cellname--${r.type}` }, `${i + 1} · ${r.type === "hep" ? "Hepatocyte" : "Immune"}`);
    tr.appendChild(label);
    r.values.forEach((v) => {
      const c = sequential(v);
      tr.appendChild(tag("td", { style: `background:${c.bg};color:${c.dark ? "#fff" : "#17202a"}` }, v.toFixed(1)));
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  const bulk = bulkOf(rows);
  const tfoot = tag("tfoot");
  const tr = tag("tr", { class: "cs-bulk" });
  tr.appendChild(tag("th", {}, "Bulk (average)"));
  bulk.forEach((v) => {
    const c = sequential(v);
    tr.appendChild(tag("td", { style: `background:${c.bg};color:${c.dark ? "#fff" : "#17202a"}` }, v.toFixed(1)));
  });
  tfoot.appendChild(tr);
  const fr = tag("tr", { class: "cs-fold" });
  fr.appendChild(tag("th", {}, "Change vs. start (log₂)"));
  bulk.forEach((v, i) => {
    const f = log2fc(v, baseBulk[i]);
    fr.appendChild(tag("td", { style: `background:${diverging(f)};color:${Math.abs(f) > 1 ? "#fff" : "#17202a"}` },
      (f >= 0 ? "+" : "") + f.toFixed(2)));
  });
  tfoot.appendChild(fr);
  table.appendChild(tfoot);
  return table;
}

function slider(id, label, min, max, step, value, fmt, onInput) {
  const wrap = tag("div", { class: "control-row" });
  const lab = tag("label", { class: "field-label", for: id });
  const val = tag("span", { class: "control-row__value" }, fmt(value));
  lab.append(label + ": ", val);
  const input = tag("input", { type: "range", id, min, max, step, value });
  input.addEventListener("input", () => { val.textContent = fmt(Number(input.value)); onInput(Number(input.value)); });
  wrap.append(lab, input);
  return { wrap, input };
}

ActivityShell.init({
  rootId: "activity-root",
  title: "Bulk or Mixed? Composition vs. State",
  defaultSeed: 2027,
  instructions:
    "A bulk measurement is the average of every cell in the sample. Change the mix of cell types, then change " +
    "what the cells are doing, and watch how the bulk result responds. Finally, see whether the two can be told apart.",

  render(data, { rng, container }) {
    const noise = Array.from({ length: N_CELLS }, () => GENES.map(() => rng.gaussian(0, 0.45)));
    const baseBulk = bulkOf(buildMatrix(noise, BASE_IMMUNE, 1));
    let step = 0;
    let immune = BASE_IMMUNE;
    let activation = 1;
    let altImmune = 3;

    const dots = tag("div", { class: "aw-steps", role: "list" });
    const body = tag("div", {});
    container.append(dots, body);

    function drawDots() {
      dots.innerHTML = "";
      dots.setAttribute("aria-label", `Step ${step + 1} of 3`);
      for (let i = 0; i < 3; i++) {
        dots.appendChild(tag("span", { class: "aw-step-dot" + (i === step ? " aw-step-dot--current" : i < step ? " aw-step-dot--done" : ""), role: "listitem" }));
      }
    }

    function navButtons() {
      const bar = tag("div", { class: "aw-actions" });
      if (step > 0) {
        const back = tag("button", { type: "button" }, "← Back");
        back.addEventListener("click", () => { step -= 1; show(); });
        bar.appendChild(back);
      }
      if (step < 2) {
        const next = tag("button", { type: "button" }, step === 0 ? "Next: change what the cells are doing →" : "Next: can you tell them apart? →");
        next.addEventListener("click", () => { step += 1; show(); });
        bar.appendChild(next);
      } else {
        const again = tag("button", { type: "button" }, "↻ Start over");
        again.addEventListener("click", () => { immune = BASE_IMMUNE; activation = 1; altImmune = 3; step = 0; show(); });
        bar.appendChild(again);
      }
      return bar;
    }

    function stepOneOrTwo() {
      const isComposition = step === 0;
      body.appendChild(tag("h3", {}, isComposition
        ? "Step 1 — What if there are more immune cells?"
        : "Step 2 — What if each immune cell does more?"));
      body.appendChild(tag("p", { class: "aw-note" }, isComposition
        ? "Hepatocytes and immune cells are the same as before, but the mix changes. Drag the slider and watch the bulk row."
        : "The mix stays at 2 immune cells in 10. Turn up the immune genes (I1–I4) inside each immune cell and watch the bulk row."));

      const tableMount = tag("div", { class: "cs-table-wrap" });
      const redraw = () => {
        tableMount.innerHTML = "";
        // Each step changes one thing only: step 1 varies the mix (activation
        // fixed at 1x); step 2 varies activation (mix fixed at the starting 2).
        const rows = buildMatrix(noise, isComposition ? immune : BASE_IMMUNE, isComposition ? 1 : activation);
        tableMount.appendChild(cellTable(rows, baseBulk));
      };
      const ctl = isComposition
        ? slider("cs-immune", "Immune cells in the sample", 0, 10, 1, immune, (v) => `${v} of 10`, (v) => { immune = v; redraw(); })
        : slider("cs-activation", "Immune gene expression per immune cell", 1, MAX_ACTIVATION, 0.1, activation, (v) => `${v.toFixed(1)}×`, (v) => { activation = v; redraw(); });
      body.append(ctl.wrap, tableMount);
      redraw();
      body.appendChild(tag("p", { class: "aw-note" }, isComposition
        ? "Notice what happens to the hepatocyte genes (H1–H4) as immune cells are added: they dilute."
        : "Here only I1–I4 move. The hepatocyte genes (H1–H4) and the shared genes do not."));
    }

    function stepThree() {
      body.appendChild(tag("h3", {}, "Step 3 — Same bulk result, two different stories"));
      body.appendChild(tag("p", { class: "aw-note" },
        "Start from 2 immune cells in 10. Story A: more immune cells moved in. Story B: the same cells, but each immune cell turned its genes up. " +
        "Choose how many immune cells Story A adds; Story B is set to the activation that gives the same bulk immune signal."));

      const out = tag("div", {});
      const redraw = () => {
        const k = matchingActivation(noise, BASE_IMMUNE, altImmune);
        const bulkA = bulkOf(buildMatrix(noise, altImmune, 1));
        const bulkB = bulkOf(buildMatrix(noise, BASE_IMMUNE, k));
        out.innerHTML = "";
        const table = tag("table", { class: "cs-table cs-compare", "aria-label": "Bulk profiles for the start, Story A, and Story B" });
        const thead = tag("thead"); thead.appendChild(headerRow("Bulk profile")); table.appendChild(thead);
        const tbody = tag("tbody");
        const addRow = (name, bulk, cls) => {
          const tr = tag("tr", { class: cls || "" });
          tr.appendChild(tag("th", {}, name));
          bulk.forEach((v) => {
            const c = sequential(v);
            tr.appendChild(tag("td", { style: `background:${c.bg};color:${c.dark ? "#fff" : "#17202a"}` }, v.toFixed(1)));
          });
          tbody.appendChild(tr);
        };
        const addFold = (name, bulk) => {
          const tr = tag("tr", { class: "cs-fold" });
          tr.appendChild(tag("th", {}, name));
          bulk.forEach((v, i) => {
            const f = log2fc(v, baseBulk[i]);
            tr.appendChild(tag("td", { style: `background:${diverging(f)};color:${Math.abs(f) > 1 ? "#fff" : "#17202a"}` }, (f >= 0 ? "+" : "") + f.toFixed(2)));
          });
          tbody.appendChild(tr);
        };
        addRow("Start (2 immune cells)", baseBulk);
        addRow(`A: ${altImmune} immune cells`, bulkA, "cs-story-a");
        addRow(`B: 2 cells, immune genes ×${k.toFixed(2)}`, bulkB, "cs-story-b");
        addFold("A vs. start (log₂)", bulkA);
        addFold("B vs. start (log₂)", bulkB);
        table.appendChild(tbody);
        out.appendChild(table);

        const iIdx = [4, 5, 6, 7], hIdx = [0, 1, 2, 3];
        const meanFold = (bulk, idx) => idx.reduce((s, i) => s + log2fc(bulk[i], baseBulk[i]), 0) / idx.length;
        const iA = meanFold(bulkA, iIdx), iB = meanFold(bulkB, iIdx), hA = meanFold(bulkA, hIdx), hB = meanFold(bulkB, hIdx);
        const pct = (f) => `${((Math.pow(2, f) - 1) * 100).toFixed(0)}%`;
        const msg = tag("p", { class: "cs-takeaway" });
        msg.innerHTML =
          `Immune genes (I1–I4) change by an average of <b>${iA >= 0 ? "+" : ""}${iA.toFixed(2)}</b> log₂ in Story A and ` +
          `<b>${iB >= 0 ? "+" : ""}${iB.toFixed(2)}</b> in Story B: <b>the bulk data cannot tell them apart on these genes.</b> ` +
          `The only hint is that Story A also dilutes the hepatocyte genes (${hA.toFixed(2)} log₂, about ${pct(hA)}) while Story B leaves them at ${hB.toFixed(2)}. ` +
          `In a real experiment that small shift sits inside sample-to-sample variation, so bulk RNA-seq alone usually cannot settle ` +
          `whether the cells <i>changed in number</i> or <i>changed in behavior</i>.`;
        out.appendChild(msg);
      };
      const ctl = slider("cs-alt", "Story A: immune cells in the sample", 3, 6, 1, altImmune, (v) => `${v} of 10`, (v) => { altImmune = v; redraw(); });
      body.append(ctl.wrap, out);
      redraw();
    }

    function show() {
      body.innerHTML = "";
      body.className = step < 2 ? "cs-step cs-step--split" : "cs-step";
      drawDots();
      if (step < 2) stepOneOrTwo(); else stepThree();
      body.appendChild(navButtons());
    }
    show();

    return { reset() { immune = BASE_IMMUNE; activation = 1; altImmune = 3; step = 0; show(); } };
  }
});
