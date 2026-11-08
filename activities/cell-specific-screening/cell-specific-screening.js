/**
 * Activity — Screening Drugs by Cell-Specific Signature.
 *
 * Single-cell data from an inflammatory liver disease give each cell type its
 * own disease signature (disease vs. healthy). Two candidate drugs each reverse
 * one of them: one is the mirror image of the hepatocyte signature, the other
 * of the immune-cell signature. Because the disease is inflammatory, the drug
 * that inversely matches the IMMUNE signature is the one to test.
 *
 * The reveal also builds the "bulk" signature (cell-type signatures averaged by
 * how many cells there are of each type: ~85% hepatocytes, ~15% immune cells).
 * Hepatocytes dominate the average, so a screen run on bulk data would pick the
 * wrong drug. Which letter (A or B) is the right one changes with the seed.
 *
 * The question names the disease driver (immune cells) outright, so the task is
 * pattern matching: find the drug that is the mirror image of the immune-cell
 * signature. The feedback then branches on what the student chose: the
 * hepatocyte-matching drug is exactly what a bulk screen would have picked, so
 * that wrong answer is explained as "right if you only had bulk data".
 *
 * Depends on: prng.js, math-utils.js, similarity.js, svg-utils.js,
 * prediction-component.js, activity-shell.js.
 */

const N_GENES = 30;
const HEP_GENES = Array.from({ length: 10 }, (_, i) => i);          // 0-9
const IMM_GENES = Array.from({ length: 10 }, (_, i) => 10 + i);     // 10-19
const HEP_SHARE = 0.85;
const IMM_SHARE = 0.15;

function pearson(a, b) { return Similarity.pearson(a, b); }

function signedMagnitudes(rng, count, upCount, lo, hi) {
  const signs = rng.shuffle(Array.from({ length: count }, (_, i) => (i < upCount ? 1 : -1)));
  return signs.map((s) => s * rng.range(lo, hi));
}

/** One draw of the whole scenario; returns null if it fails the teaching rules. */
function drawScenario(rng) {
  const hep = Array.from({ length: N_GENES }, () => rng.gaussian(0, 0.15));
  const imm = Array.from({ length: N_GENES }, () => rng.gaussian(0, 0.15));
  signedMagnitudes(rng, HEP_GENES.length, 5, 1.0, 2.0).forEach((v, i) => { hep[HEP_GENES[i]] = v; });
  signedMagnitudes(rng, IMM_GENES.length, 7, 1.4, 2.6).forEach((v, i) => { imm[IMM_GENES[i]] = v; });

  const bulk = hep.map((v, i) => HEP_SHARE * v + IMM_SHARE * imm[i]);
  const drugHep = hep.map((v) => -v + rng.gaussian(0, 0.35));
  const drugImm = imm.map((v) => -v + rng.gaussian(0, 0.35));

  const r = {
    hepOnHep: pearson(drugHep, hep), hepOnImm: pearson(drugHep, imm), hepOnBulk: pearson(drugHep, bulk),
    immOnHep: pearson(drugImm, hep), immOnImm: pearson(drugImm, imm), immOnBulk: pearson(drugImm, bulk)
  };
  const ok = r.hepOnHep < -0.8 && r.immOnImm < -0.8 &&
    Math.abs(r.hepOnImm) < 0.4 && Math.abs(r.immOnHep) < 0.4 &&
    r.hepOnBulk < r.immOnBulk - 0.2; // bulk favors the hepatocyte drug
  return ok ? { hep, imm, bulk, drugHep, drugImm } : null;
}

function buildScenario(rng) {
  let s = null;
  for (let i = 0; i < 300 && !s; i++) s = drawScenario(rng);
  if (!s) throw new Error("Could not build a screening scenario for this seed.");
  const immIsA = rng.random() < 0.5; // which letter is the immune-matching drug
  const drugs = immIsA
    ? { A: { sig: s.drugImm, target: "imm" }, B: { sig: s.drugHep, target: "hep" } }
    : { A: { sig: s.drugHep, target: "hep" }, B: { sig: s.drugImm, target: "imm" } };
  return { hep: s.hep, imm: s.imm, bulk: s.bulk, drugs, correct: immIsA ? "A" : "B" };
}

if (typeof module !== "undefined") module.exports = { buildScenario, pearson };

/* ---------- rendering ---------- */

const CELL_W = 74, ROW_H = 11, GAP = 14, TOP = 50, LEFT = 4;

function diverging(t) {
  t = MathUtils.clamp(t, -1, 1);
  const lerp = (c1, c2, s) => c1.map((x, i) => Math.round(x + (c2[i] - x) * s));
  const rgb = t < 0 ? lerp([27, 58, 92], [255, 255, 255], t + 1) : lerp([255, 255, 255], [181, 101, 29], t);
  return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
}

/** columns: [{label, sub, values, gapBefore?}] */
function drawHeatmap(columns, maxAbs) {
  let x = LEFT;
  const placed = columns.map((c) => { if (c.gapBefore) x += GAP; const out = { ...c, x }; x += CELL_W + 4; return out; });
  const width = x + 4;
  const height = TOP + N_GENES * ROW_H + 6;
  const svg = SvgUtils.svgEl("svg", { viewBox: `0 0 ${width} ${height}`, class: "css-heatmap", role: "img", "aria-label": "Heatmap of gene changes by cell type and by candidate drug" });
  placed.forEach((c) => {
    svg.appendChild(SvgUtils.svgEl("text", { x: c.x + CELL_W / 2, y: 14, "text-anchor": "middle", class: "css-col-label" }, [c.label]));
    if (c.sub) svg.appendChild(SvgUtils.svgEl("text", { x: c.x + CELL_W / 2, y: 27, "text-anchor": "middle", class: "css-col-sub" }, [c.sub]));
    if (c.sub2) svg.appendChild(SvgUtils.svgEl("text", { x: c.x + CELL_W / 2, y: 38, "text-anchor": "middle", class: c.driver ? "css-col-sub css-col-driver" : "css-col-sub" }, [c.sub2]));
    c.values.forEach((v, gi) => {
      svg.appendChild(SvgUtils.svgEl("rect", { x: c.x, y: TOP + gi * ROW_H, width: CELL_W, height: ROW_H - 1, fill: diverging(v / maxAbs) }));
    });
  });
  return svg;
}

function el(tagName, attrs, text) {
  const node = document.createElement(tagName);
  Object.entries(attrs || {}).forEach(([k, v]) => node.setAttribute(k, v));
  if (text !== undefined) node.textContent = text;
  return node;
}

ActivityShell.init({
  rootId: "activity-root",
  title: "Screening Drugs by Cell-Specific Signature",
  defaultSeed: 2029,
  instructions:
    "This liver disease is driven by inflammation, so the immune cells are the cells you need to fix. Single-cell data show the disease " +
    "signature in each cell type, and two candidate drugs are shown beside them. Find the drug that is the mirror image of the immune-cell " +
    "signature (orange where the disease is blue, blue where it is orange), then check your answer.",

  render(data, { rng, container }) {
    const sc = buildScenario(rng);
    const maxAbs = Math.max(...sc.hep.map(Math.abs), ...sc.imm.map(Math.abs), ...sc.drugs.A.sig.map(Math.abs), ...sc.drugs.B.sig.map(Math.abs));
    let revealed = false;

    const layout = el("div", { class: "css-layout" });
    const left = el("section", { class: "aw-panel" });
    left.appendChild(el("h3", {}, "Disease signatures from single-cell data"));
    left.appendChild(el("p", { class: "aw-note" },
      "Each row is the same gene (30 total). Orange = turned up, blue = turned down. Columns 1–2 are the disease signature (diseased vs. healthy) in each cell type. Columns 3–4 are what each candidate drug does to those same genes."));
    const heatMount = el("div", {});
    left.appendChild(heatMount);

    const right = el("section", { class: "aw-panel css-right" });
    right.appendChild(el("h3", {}, "Which drug reverses the disease?"));
    right.appendChild(el("p", { class: "aw-note" },
      "This disease is driven by the immune cells. A drug that reverses a signature looks like its mirror image: blue where the disease is orange, and orange where the disease is blue. Compare each drug with the immune-cell column."));
    const predictMount = el("div", {});
    right.appendChild(predictMount);
    const widget = PredictionComponent.createPredictionWidget(predictMount, {
      prompt: "Which drug is the mirror image of the immune-cell disease signature?",
      inputType: "select",
      options: [{ id: "A", label: "Drug A" }, { id: "B", label: "Drug B" }],
      commitLabel: "Lock in answer"
    });
    const actions = el("div", { class: "aw-actions" });
    const revealBtn = el("button", { type: "button" }, "Check my answer");
    actions.appendChild(revealBtn);
    right.appendChild(actions);
    const results = el("div", { class: "css-results", "aria-live": "polite" });
    right.appendChild(results);
    layout.append(left, right);
    container.appendChild(layout);

    function drawBase() {
      heatMount.innerHTML = "";
      heatMount.appendChild(drawHeatmap([
        { label: "Hepatocytes", sub: "disease signature", sub2: "85% of cells", values: sc.hep },
        { label: "Immune cells", sub: "disease signature", sub2: "15% · driver", driver: true, values: sc.imm },
        { label: "Drug A", sub: "drug effect", values: sc.drugs.A.sig, gapBefore: true },
        { label: "Drug B", sub: "drug effect", values: sc.drugs.B.sig }
      ], maxAbs));
    }
    function drawRevealed() {
      heatMount.innerHTML = "";
      heatMount.appendChild(drawHeatmap([
        { label: "Hepatocytes", sub: "disease signature", sub2: "85% of cells", values: sc.hep },
        { label: "Immune cells", sub: "disease signature", sub2: "15% · driver", driver: true, values: sc.imm },
        { label: "Bulk", sub: "disease signature", sub2: "averaged", values: sc.bulk },
        { label: "Drug A", sub: "drug effect", values: sc.drugs.A.sig, gapBefore: true },
        { label: "Drug B", sub: "drug effect", values: sc.drugs.B.sig }
      ], maxAbs));
    }
    drawBase();

    function reveal() {
      if (revealed) return;
      revealed = true;
      drawRevealed();
      const rows = ["A", "B"].map((k) => ({
        k, hep: pearson(sc.drugs[k].sig, sc.hep), imm: pearson(sc.drugs[k].sig, sc.imm), bulk: pearson(sc.drugs[k].sig, sc.bulk)
      }));
      const fmt = (v) => (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(2);
      const cell = (v, strong) => `<td class="${strong ? "css-best" : ""}">${fmt(v)}</td>`;
      const minOf = (key) => Math.min(...rows.map((r) => r[key]));
      const table = el("table", { class: "aw-table css-corr" });
      table.innerHTML =
        "<thead><tr><th>Correlation with disease signature</th><th>Hepatocytes</th><th>Immune cells</th><th>Bulk</th></tr></thead><tbody>" +
        rows.map((r) => `<tr><th>Drug ${r.k}</th>${cell(r.hep, r.hep === minOf("hep"))}${cell(r.imm, r.imm === minOf("imm"))}${cell(r.bulk, r.bulk === minOf("bulk"))}</tr>`).join("") +
        "</tbody>";
      results.innerHTML = "";
      results.appendChild(table);
      const hepLetter = sc.correct === "A" ? "B" : "A";           // the hepatocyte-matching drug
      const rowOf = (k) => rows.find((r) => r.k === k);
      const picked = widget.getPrediction();
      const msg = el("p", { class: "css-takeaway" });
      const bulkNote =
        `<b>The bulk twist:</b> the bulk column is mostly hepatocytes (85% of the cells), so it looks like the hepatocyte signature. ` +
        `Drug ${hepLetter} matches it best (r = ${fmt(rowOf(hepLetter).bulk)}), so a screen run on bulk data would have ranked Drug ${hepLetter} first and ` +
        `missed the drug that targets the cells driving this disease.`;
      if (picked === sc.correct) {
        msg.innerHTML =
          `<b>Drug ${sc.correct} is the mirror image of the immune-cell signature.</b> You matched the disease driver. ` + bulkNote +
          ` Only the single-cell data let you see that.`;
      } else if (picked === hepLetter) {
        msg.innerHTML =
          `<b>Drug ${hepLetter} is a mirror image, but of the wrong cells.</b> It reverses the <i>hepatocyte</i> signature (r = ${fmt(rowOf(hepLetter).hep)}) and barely touches the immune cells (r = ${fmt(rowOf(hepLetter).imm)}). ` +
          `It would still be a sensible pick if you only had <b>bulk</b> data: the bulk signature is mostly hepatocytes (85% of the cells), so a bulk screen ranks Drug ${hepLetter} first (r = ${fmt(rowOf(hepLetter).bulk)}). ` +
          `But this disease is driven by the immune cells, so the drug to test is <b>Drug ${sc.correct}</b> (r = ${fmt(rowOf(sc.correct).imm)}), which single-cell data reveal.`;
      } else {
        msg.innerHTML =
          `No answer was locked in. <b>Drug ${sc.correct}</b> is the mirror image of the immune-cell signature (r = ${fmt(rowOf(sc.correct).imm)}). ` + bulkNote;
      }
      results.appendChild(msg);
      widget.reveal(sc.correct, (predicted) => {
        const ok = predicted === sc.correct;
        return {
          status: ok ? "correct" : "incorrect",
          label: ok ? "Correct!" : "Not quite",
          detail: ok
            ? `Drug ${sc.correct} reverses the immune-cell signature (r = ${fmt(rowOf(sc.correct).imm)}).`
            : `Drug ${predicted} reverses the hepatocyte signature, but the immune cells drive this disease.`
        };
      });
      revealBtn.disabled = true;
    }
    revealBtn.addEventListener("click", reveal);

    return {
      reset() {
        revealed = false;
        revealBtn.disabled = false;
        widget.reset();
        results.innerHTML = "";
        drawBase();
      }
    };
  }
});
