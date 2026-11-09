/**
 * Activity — From Gene Curves to a Dose.
 *
 * Follows the enrichment activity. A drug ("Drug X", a glucocorticoid-receptor
 * agonist) is applied at doses from 0.01 to 1000 µM and 80 genes are profiled.
 * Every gene has its own dose-response curve and therefore its own benchmark
 * dose (BMD): the dose where the curve crosses a fixed response threshold.
 *
 *   Step 1  Many curves: 80 genes, 80 BMDs.
 *   Step 2  Group the BMDs by pathway and, as the dose rises, test which
 *           pathways are significantly over-represented among the responders
 *           (the same Fisher's exact test as the enrichment activity).
 *   Step 3  Ten established ways to turn gene BMDs into a point of departure
 *           (PoD), computed on this dataset and shown side by side (no
 *           lock-in). They spread over orders of magnitude. The mechanism-
 *           anchored estimate (median BMD of the enriched pathway linked to
 *           the adverse outcome: lipid biosynthesis -> steatosis) is shown
 *           against the efficacy dose to give the window.
 *
 * Every seed guarantees: the most sensitive gene is NOT in the efficacy or
 * adverse pathway; the adaptive pathway is enriched first; the efficacy and
 * adverse pathways are each enriched at some dose; the cell-cycle pathway
 * (a pathway label without coordinated response) is never enriched.
 *
 * Depends on: prng.js, math-utils.js, stats-utils.js, svg-utils.js, activity-shell.js.
 */

const DOSE_MIN = 0.01, DOSE_MAX = 1000;   // µM
const THETA = 0.5;                        // response threshold, |log2 fold change|
const Y_MAX = 3.2;
const MIN_GENES = 3;                      // minimum responders for "enriched"
const ALPHA = 0.01;                       // Fisher's exact p-value cutoff
const N_BACKGROUND = 40;

const PATHWAYS = [
  {
    id: "gr", label: "GR target genes", role: "Intended effect (efficacy)", color: "#009e73",
    genes: ["Fkbp5", "Tsc22d3", "Dusp1", "Sgk1", "Nfkbia", "Per1", "Zbtb16", "Ddit4", "Klf15", "Gadd45b", "Cebpd", "Pdk4"]
  },
  {
    id: "ox", label: "Oxidative stress response", role: "Adaptive stress response", color: "#e69f00",
    genes: ["Hmox1", "Nqo1", "Gclc", "Gclm", "Srxn1"]
  },
  {
    id: "lip", label: "Lipid biosynthesis", role: "Linked to the adverse effect (steatosis)", color: "#d55e00",
    genes: ["Fasn", "Scd1", "Acaca", "Srebf1", "Elovl6", "Acly", "Dgat2", "Gpam", "Cd36", "Pparg", "Lpl", "Fabp4", "Mogat1", "Cidea"]
  },
  {
    id: "cc", label: "Cell cycle", role: "No known link to this drug", color: "#cc79a7",
    genes: ["Ccnd1", "Cdk1", "Mki67", "Top2a", "E2f1", "Ccnb1", "Pcna", "Mcm2", "Plk1"]
  },
  { id: "bg", label: "Other genes", role: "No pathway annotation", color: "#8a949e", genes: [] }
];
const PATH = Object.fromEntries(PATHWAYS.map((p) => [p.id, p]));

/* ---------- model ---------- */

function hill(dose, ec, slope) { return 1 / (1 + Math.pow(ec / dose, slope)); }
function geneResponse(g, dose) { return g.emax * hill(dose, g.ec, g.slope); }

function median(arr) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function quantile(arr, q) {
  const s = [...arr].sort((a, b) => a - b);
  const pos = (s.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

function responder(name, path, bmd, rng) {
  const emax = rng.range(1.1, 3.0), slope = rng.range(1.0, 2.5);
  const ec = bmd / Math.pow(THETA / (emax - THETA), 1 / slope);
  return { name, path, emax, slope, ec, bmd };
}
function nonResponder(name, path, rng) {
  return { name, path, emax: rng.range(0.08, 0.38), slope: rng.range(1.0, 2.5), ec: Math.pow(10, rng.range(-1, 2.5)), bmd: null };
}
function clampBmd(v) { return Math.min(DOSE_MAX * 0.9, Math.max(DOSE_MIN * 1.5, v)); }

/** Which pathways are over-represented among the genes that have responded by `dose`. */
function enrichmentAt(genes, dose) {
  const N = genes.length;
  const responders = genes.filter((g) => g.bmd !== null && g.bmd <= dose);
  const R = responders.length;
  const rows = {};
  PATHWAYS.forEach((p) => {
    const members = genes.filter((g) => g.path === p.id);
    const a = members.filter((g) => g.bmd !== null && g.bmd <= dose).length;
    const n = members.length;
    const pval = StatsUtils.fishersExactTest(a, n - a, R - a, N - n - (R - a));
    rows[p.id] = { a, n, p: pval, enriched: a >= MIN_GENES && pval < ALPHA && p.id !== "bg" };
  });
  return { responders: R, rows };
}

/** Lowest dose (on a fine log grid) at which a pathway is significantly enriched, or null. */
function firstEnrichedDose(genes, pathId) {
  for (let e = Math.log10(DOSE_MIN); e <= Math.log10(DOSE_MAX) + 1e-9; e += 0.02) {
    const dose = Math.pow(10, e);
    if (enrichmentAt(genes, dose).rows[pathId].enriched) return dose;
  }
  return null;
}

function pathwayBmds(genes, id) { return genes.filter((g) => g.path === id && g.bmd !== null).map((g) => g.bmd); }

function drawScenario(rng) {
  const logE = rng.range(-0.5, 0.3);
  const ratio = rng.pick([2.5, 5, 10, 20, 40]) * rng.range(0.9, 1.1);
  const logT = logE + Math.log10(ratio);
  const logS = logE - rng.range(0.5, 1.0);
  const spec = { gr: [logE, 0.18], lip: [logT, 0.2], ox: [logS, 0.12] };

  const genes = [];
  PATHWAYS.forEach((p) => {
    if (p.id === "cc") {
      const resp = new Set(rng.shuffle(p.genes.map((_, i) => i)).slice(0, 3));
      p.genes.forEach((name, i) => genes.push(resp.has(i)
        ? responder(name, p.id, Math.pow(10, rng.range(-0.5, 2.5)), rng)
        : nonResponder(name, p.id, rng)));
    } else if (p.id === "bg") {
      for (let i = 0; i < N_BACKGROUND; i++) {
        const name = "G" + String(i + 1).padStart(2, "0");
        genes.push(i < 7 ? responder(name, "bg", Math.pow(10, rng.range(-1.6, 2.8)), rng) : nonResponder(name, "bg", rng));
      }
    } else {
      const [m, sd] = spec[p.id];
      p.genes.forEach((name) => genes.push(responder(name, p.id, clampBmd(Math.pow(10, m + rng.gaussian(0, sd))), rng)));
    }
  });

  const responding = genes.filter((g) => g.bmd !== null);
  const minGene = responding.reduce((a, b) => (a.bmd < b.bmd ? a : b));
  const med = (id) => median(pathwayBmds(genes, id));
  const first = { gr: firstEnrichedDose(genes, "gr"), ox: firstEnrichedDose(genes, "ox"), lip: firstEnrichedDose(genes, "lip"), cc: firstEnrichedDose(genes, "cc") };

  const ok = minGene.path !== "gr" && minGene.path !== "lip" &&
    minGene.bmd < 0.4 * med("lip") &&
    first.ox !== null && first.gr !== null && first.lip !== null && first.cc === null &&
    first.ox < first.gr && first.ox < first.lip &&
    pathwayBmds(genes, "lip").length >= 12;
  if (!ok) return null;

  // Per-gene lower confidence limits (BMDL) and the ten PoD methods. Drawn
  // after the scenario is accepted so they do not change which genes respond.
  responding.forEach((g) => { g.bmdl = g.bmd * Math.pow(10, -rng.range(0.1, 0.4)); });
  const allBmds = responding.map((g) => g.bmd);
  const qualifying = ["gr", "ox", "lip"].filter((id) => first[id] !== null);   // enriched at some dose in Step 2
  const pathMed = Object.fromEntries(qualifying.map((id) => [id, med(id)]));
  const lowestPath = qualifying.reduce((x, y) => (pathMed[x] < pathMed[y] ? x : y));
  const methods = buildMethods({ allBmds, responding, qualifying, pathMed, lowestPath, first, genes, rng });
  return { genes, minGene, first, methods, qualifying, pathMed, efficacyPod: med("gr"), adversePod: med("lip"), ratio: med("lip") / med("gr") };
}

/** Ten established ways to define a point of departure from gene- and pathway-level BMDs. */
function buildMethods({ allBmds, responding, qualifying, pathMed, lowestPath, first, genes, rng }) {
  const pathVals = qualifying.map((id) => pathMed[id]);
  // lower 95% bound of the lowest enriched pathway's median BMD, by bootstrapping its genes
  const lowBmds = pathwayBmds(genes, lowestPath);
  const boots = Array.from({ length: 500 }, () => median(lowBmds.map(() => lowBmds[rng.int(0, lowBmds.length)])));
  return [
    { n: 1, name: "25th percentile gene BMD", how: "25th percentile of the modeled gene BMDs", dose: quantile(allBmds, 0.25) },
    { n: 2, name: "Median gene BMD", how: "50th percentile of the modeled gene BMDs", dose: median(allBmds) },
    { n: 3, name: "10th percentile gene BMD", how: "Lower-tail estimate of transcriptional sensitivity", dose: quantile(allBmds, 0.10) },
    { n: 4, name: "Lowest gene BMD", how: "Minimum gene BMD; highly sensitive to outliers", dose: Math.min(...allBmds) },
    { n: 5, name: "Lowest enriched pathway BMD", how: "BMD of the most sensitive significantly enriched pathway", dose: Math.min(...pathVals) },
    { n: 6, name: "Median pathway BMD", how: "Median of the BMDs of the qualifying enriched pathways", dose: median(pathVals) },
    { n: 7, name: "25th percentile pathway BMD", how: "Lower quartile of the qualifying pathway BMDs", dose: quantile(pathVals, 0.25) },
    { n: 8, name: "Most sensitive biological process", how: "Lowest-dose qualifying process or functional category (here: the dose where the first category becomes significantly enriched)", dose: Math.min(...qualifying.map((id) => first[id])) },
    { n: 9, name: "Pathway BMDL", how: "Lower confidence bound of a pathway BMD (here: the lowest enriched pathway, bootstrapped)", dose: quantile(boots, 0.05) },
    { n: 10, name: "Gene-level BMDL percentile", how: "A chosen percentile (here the 10th) of the gene BMD lower confidence limits", dose: quantile(responding.map((g) => g.bmdl), 0.10) }
  ];
}

function buildScenario(rng) {
  for (let i = 0; i < 500; i++) {
    const s = drawScenario(rng);
    if (s) return s;
  }
  throw new Error("Could not build a dose-response scenario for this seed.");
}

if (typeof module !== "undefined") module.exports = { buildScenario, enrichmentAt, firstEnrichedDose, pathwayBmds, median, PATHWAYS };

/* ---------- rendering helpers ---------- */

function el(tagName, attrs, text) {
  const node = document.createElement(tagName);
  Object.entries(attrs || {}).forEach(([k, v]) => node.setAttribute(k, v));
  if (text !== undefined) node.textContent = text;
  return node;
}
const sv = (tag, attrs, children) => SvgUtils.svgEl(tag, attrs, children || []);

function fmtDose(d) {
  if (d >= 100) return d.toFixed(0);
  if (d >= 10) return d.toFixed(1);
  if (d >= 1) return d.toFixed(2);
  return d.toPrecision(2);
}
function fmtP(p) { return p < 0.001 ? "<0.001" : p.toFixed(3); }
function fmtFold(x) { return x >= 10 ? Math.round(x) + "×" : x.toFixed(1) + "×"; }

function doseAxis(svg, xs, yTop, yBottom, labelY) {
  SvgUtils.logTicks([DOSE_MIN, DOSE_MAX]).forEach((d) => {
    svg.appendChild(sv("line", { x1: xs(d), x2: xs(d), y1: yTop, y2: yBottom, stroke: "#eceff2" }));
    svg.appendChild(sv("text", { x: xs(d), y: yBottom + 14, "text-anchor": "middle", class: "svg-axis-label" }, [String(d)]));
  });
  svg.appendChild(sv("text", { x: (xs(DOSE_MIN) + xs(DOSE_MAX)) / 2, y: labelY, "text-anchor": "middle", class: "svg-axis-label" }, ["Dose (µM, log scale)"]));
}

/* ---------- the activity ---------- */

ActivityShell.init({
  rootId: "activity-root",
  title: "From Gene Curves to a Dose",
  defaultSeed: 5150,
  instructions:
    "Drug X was tested at doses from 0.01 to 1000 µM and 80 genes were profiled. Each gene has its own dose-response curve. " +
    "Work through three steps: look at the curves, group the genes by pathway and test for enrichment as the dose rises, " +
    "then choose the point of departure you would carry forward for the drug’s adverse effect.",

  render(data, { rng, container }) {
    const sc = buildScenario(rng);
    const genes = sc.genes;
    const TOTAL_STEPS = 3;
    let step = 0;
    const state = { focus: null, showBmd: false, logDose: -1.5 };
    let step3El = null;

    const dots = el("div", { class: "aw-steps", role: "list" });
    const body = el("div", { class: "pp-body" });
    container.append(dots, body);

    function drawDots() {
      dots.innerHTML = "";
      dots.setAttribute("aria-label", `Step ${step + 1} of ${TOTAL_STEPS}`);
      for (let i = 0; i < TOTAL_STEPS; i++) {
        dots.appendChild(el("span", { class: "aw-step-dot" + (i === step ? " aw-step-dot--current" : i < step ? " aw-step-dot--done" : ""), role: "listitem" }));
      }
    }

    function navButtons() {
      const bar = el("div", { class: "aw-actions" });
      if (step > 0) {
        const back = el("button", { type: "button" }, "← Back");
        back.addEventListener("click", () => { step -= 1; show(); });
        bar.appendChild(back);
      }
      if (step < TOTAL_STEPS - 1) {
        const next = el("button", { type: "button" }, step === 0 ? "Next: group the genes by pathway →" : "Next: compare ways to define the PoD →");
        next.addEventListener("click", () => { step += 1; show(); });
        bar.appendChild(next);
      }
      return bar;
    }

    /** Text and controls on the left, the plot or results on the right (stacks on narrow screens). */
    function twoCol() {
      const split = el("div", { class: "pp-split" });
      const left = el("div", { class: "pp-left" });
      const right = el("div", { class: "pp-right" });
      split.append(left, right);
      body.appendChild(split);
      return { left, right };
    }

    /* ---- Step 1: the spaghetti plot ---- */
    function stepOne() {
      const { left, right } = twoCol();
      left.appendChild(el("h3", {}, "Step 1 — One curve per gene"));
      left.appendChild(el("p", { class: "aw-note" },
        "Each line is one gene’s response to Drug X. The dose where a curve crosses the dashed threshold is that gene’s benchmark dose (BMD). Click a pathway to isolate it."));

      const chips = el("div", { class: "pp-chips" });
      PATHWAYS.forEach((p) => {
        const n = genes.filter((g) => g.path === p.id).length;
        const chip = el("button", { type: "button", class: "pp-chip", "aria-pressed": state.focus === p.id ? "true" : "false" });
        chip.innerHTML = `<span class="aw-swatch" style="background:${p.color}"></span>${p.label} <span class="pp-chip__n">(${n})</span>`;
        chip.addEventListener("click", () => { state.focus = state.focus === p.id ? null : p.id; redraw(); });
        chips.appendChild(chip);
      });
      right.appendChild(chips);

      const W = 700, H = 300, X0 = 52, X1 = 690, Y0 = 12, Y1 = 258;
      const xs = SvgUtils.logScale([DOSE_MIN, DOSE_MAX], [X0, X1]);
      const ys = SvgUtils.linearScale([0, Y_MAX], [Y1, Y0]);
      const svg = sv("svg", { viewBox: `0 0 ${W} ${H}`, class: "pp-svg", role: "img", "aria-label": "Dose-response curves for 80 genes, colored by pathway" });
      right.appendChild(svg);

      const toggleRow = el("div", { class: "aw-actions" });
      const label = el("label", { class: "pp-toggle" });
      const cb = el("input", { type: "checkbox" });
      cb.checked = state.showBmd;
      label.append(cb, " Mark each gene’s BMD on the threshold line");
      toggleRow.appendChild(label);
      left.appendChild(toggleRow);
      const readout = el("p", { class: "pp-readout", "aria-live": "polite" });
      left.appendChild(readout);

      function redraw() {
        chips.querySelectorAll(".pp-chip").forEach((c, i) => c.setAttribute("aria-pressed", state.focus === PATHWAYS[i].id ? "true" : "false"));
        SvgUtils.clearSVG(svg);
        [0, 1, 2, 3].forEach((t) => {
          svg.appendChild(sv("line", { x1: X0, x2: X1, y1: ys(t), y2: ys(t), stroke: "#eceff2" }));
          svg.appendChild(sv("text", { x: X0 - 8, y: ys(t) + 4, "text-anchor": "end", class: "svg-axis-label" }, [String(t)]));
        });
        doseAxis(svg, xs, Y0, Y1, H - 6);
        svg.appendChild(sv("text", { x: 12, y: (Y0 + Y1) / 2, "text-anchor": "middle", class: "svg-axis-label", transform: `rotate(-90 12 ${(Y0 + Y1) / 2})` }, ["Response (|log₂ fold change|)"]));

        const order = [...genes].sort((a, b) => (a.path === state.focus) - (b.path === state.focus));
        order.forEach((g) => {
          const dim = state.focus && g.path !== state.focus;
          const pts = [];
          for (let i = 0; i <= 100; i++) {
            const d = Math.pow(10, Math.log10(DOSE_MIN) + (i / 100) * (Math.log10(DOSE_MAX) - Math.log10(DOSE_MIN)));
            pts.push(`${xs(d).toFixed(1)},${ys(geneResponse(g, d)).toFixed(1)}`);
          }
          svg.appendChild(sv("polyline", {
            points: pts.join(" "), fill: "none", stroke: PATH[g.path].color,
            "stroke-width": state.focus === g.path ? 1.8 : 1.2, opacity: dim ? 0.08 : g.path === "bg" && !state.focus ? 0.55 : 0.85
          }));
        });
        svg.appendChild(sv("line", { x1: X0, x2: X1, y1: ys(THETA), y2: ys(THETA), stroke: "#17202a", "stroke-width": 1.4, "stroke-dasharray": "6 4" }));
        svg.appendChild(sv("text", { x: X0 + 6, y: ys(THETA) - 5, "font-size": 11, "font-weight": 700, fill: "#17202a" }, ["Response threshold"]));
        if (state.showBmd) {
          genes.filter((g) => g.bmd !== null && (!state.focus || g.path === state.focus)).forEach((g) => {
            svg.appendChild(sv("circle", { cx: xs(g.bmd), cy: ys(THETA), r: 3.4, fill: PATH[g.path].color, stroke: "#fff", "stroke-width": 1 }));
          });
        }

        const shown = genes.filter((g) => !state.focus || g.path === state.focus);
        const crossing = shown.filter((g) => g.bmd !== null);
        readout.innerHTML = crossing.length
          ? `<b>${crossing.length}</b> of ${shown.length} ${state.focus ? `genes in “${PATH[state.focus].label}”` : "genes"} cross the threshold within the tested range. ` +
            `Their BMDs span <b>${fmtDose(Math.min(...crossing.map((g) => g.bmd)))}</b> to <b>${fmtDose(Math.max(...crossing.map((g) => g.bmd)))} µM</b>.`
          : "None of these genes cross the threshold within the tested range.";
      }
      cb.addEventListener("change", () => { state.showBmd = cb.checked; redraw(); });
      redraw();
    }

    /* ---- Step 2: BMDs by pathway + enrichment as the dose rises ---- */
    function stepTwo() {
      const { left, right } = twoCol();
      left.appendChild(el("h3", {}, "Step 2 — Group the BMDs by pathway"));
      left.appendChild(el("p", { class: "aw-note" },
        "Each dot is a gene’s BMD; the box is the middle half of a pathway’s genes and the bar is the median. Drag the dose up: the genes that have responded by then are " +
        "tested for enrichment (Fisher’s exact test as before; enriched = at least 3 genes and p < 0.01)."));

      const W = 740, ROW = 44, TOP = 14, X0 = 214, X1 = 560;
      const H = TOP + PATHWAYS.length * ROW + 34;
      const xs = SvgUtils.logScale([DOSE_MIN, DOSE_MAX], [X0, X1]);
      const svg = sv("svg", { viewBox: `0 0 ${W} ${H}`, class: "pp-svg pp-svg--rows", role: "img", "aria-label": "Benchmark doses of genes grouped by pathway, with enrichment at the selected dose" });
      right.appendChild(svg);

      const doseRow = el("div", { class: "control-row" });
      const doseLabel = el("label", { class: "field-label", for: "pp-dose" });
      const doseVal = el("span", { class: "control-row__value" });
      doseLabel.append("Dose (µM): ", doseVal);
      const doseInput = el("input", { type: "range", id: "pp-dose", min: Math.log10(DOSE_MIN), max: Math.log10(DOSE_MAX), step: 0.02, value: state.logDose });
      doseRow.append(doseLabel, doseInput);
      left.appendChild(doseRow);
      const readout = el("p", { class: "pp-readout", "aria-live": "polite" });
      left.appendChild(readout);

      function redraw() {
        SvgUtils.clearSVG(svg);
        const dose = Math.pow(10, state.logDose);
        const enr = enrichmentAt(genes, dose);
        const bottom = TOP + PATHWAYS.length * ROW;
        doseAxis(svg, xs, TOP, bottom, H - 4);

        PATHWAYS.forEach((p, i) => {
          const cy = TOP + i * ROW + ROW / 2;
          const row = enr.rows[p.id];
          if (i % 2 === 0) svg.appendChild(sv("rect", { x: 0, y: TOP + i * ROW, width: W, height: ROW, fill: "#f6f8fa", opacity: 0.7 }));
          svg.appendChild(sv("rect", { x: 6, y: cy - 6, width: 12, height: 12, rx: 3, fill: p.color }));
          svg.appendChild(sv("text", { x: 24, y: cy - 2, "font-size": 12, "font-weight": 700, fill: "#17202a" }, [p.label]));
          svg.appendChild(sv("text", { x: 24, y: cy + 12, "font-size": 10, fill: "#4b5563" }, [p.role]));

          const bmds = pathwayBmds(genes, p.id);
          if (bmds.length >= 2) {
            const q1 = quantile(bmds, 0.25), q3 = quantile(bmds, 0.75), md = median(bmds);
            svg.appendChild(sv("line", { x1: xs(Math.min(...bmds)), x2: xs(Math.max(...bmds)), y1: cy, y2: cy, stroke: p.color, "stroke-width": 1.2, opacity: 0.6 }));
            svg.appendChild(sv("rect", { x: xs(q1), y: cy - 11, width: Math.max(2, xs(q3) - xs(q1)), height: 22, fill: p.color, opacity: 0.16, stroke: p.color }));
            svg.appendChild(sv("line", { x1: xs(md), x2: xs(md), y1: cy - 13, y2: cy + 13, stroke: p.color, "stroke-width": 3 }));
          }
          genes.filter((g) => g.path === p.id && g.bmd !== null).forEach((g, k) => {
            const jitter = ((k * 7) % 5 - 2) * 3.2;
            const done = g.bmd <= dose;
            svg.appendChild(sv("circle", { cx: xs(g.bmd), cy: cy + jitter, r: 3.2, fill: done ? p.color : "#fff", stroke: p.color, "stroke-width": 1.3 }));
          });

          const tx = X1 + 14;
          svg.appendChild(sv("text", { x: tx, y: cy - 2, "font-size": 11, fill: "#17202a" }, [`${row.a} of ${row.n} respond`]));
          if (p.id === "bg") {
            svg.appendChild(sv("text", { x: tx, y: cy + 12, "font-size": 11, fill: "#6b7280" }, ["(not tested)"]));
          } else {
            svg.appendChild(sv("text", {
              x: tx, y: cy + 12, "font-size": 11, "font-weight": row.enriched ? 700 : 400,
              fill: row.enriched ? "#1b7a4b" : "#6b7280"
            }, [row.enriched ? `✓ enriched, p ${row.p < 0.001 ? "" : "= "}${fmtP(row.p)}` : (row.a ? `not enriched (p = ${fmtP(row.p)})` : "—")]));
          }
        });

        svg.appendChild(sv("line", { x1: xs(dose), x2: xs(dose), y1: TOP - 4, y2: bottom, stroke: "#17202a", "stroke-width": 1.6 }));

        doseVal.textContent = `${fmtDose(dose)} µM`;
        const enrichedNow = PATHWAYS.filter((p) => enr.rows[p.id].enriched).map((p) => p.label);
        readout.innerHTML =
          `At <b>${fmtDose(dose)} µM</b>, <b>${enr.responders}</b> of ${genes.length} genes have responded. ` +
          (enrichedNow.length ? `Significantly enriched: <b>${enrichedNow.join(", ")}</b>.` : "No pathway is significantly enriched yet.");
      }
      doseInput.addEventListener("input", () => { state.logDose = Number(doseInput.value); redraw(); });
      redraw();

      right.appendChild(el("p", { class: "aw-note" },
        "Things to try: which pathway is enriched first? Which comes next? A pathway can stop being enriched once many other genes respond, because enrichment is relative to everything else that has responded. Does Cell cycle ever become enriched?"));
    }

    /* ---- Step 3: ten established ways to define the point of departure ---- */
    function buildStepThree() {
      const wrap = el("div", { class: "pp-split" });
      const left = el("div", { class: "pp-left" });
      const right = el("div", { class: "pp-right" });
      wrap.append(left, right);

      const eff = sc.efficacyPod, adv = sc.adversePod;
      const doses = sc.methods.map((m) => m.dose);
      const spread = Math.max(...doses) / Math.min(...doses);

      left.appendChild(el("h3", {}, "Step 3 — Many ways to define the point of departure"));
      left.appendChild(el("p", { class: "aw-note" },
        "Researchers and regulators use many conventions to collapse thousands of gene BMDs into one number. Here are ten established approaches, all computed on Drug X’s data. " +
        "None is universally right."));
      const callout = el("div", { class: "pp-callout" });
      callout.innerHTML =
        `<p>The ten estimates span <b>${fmtFold(spread)}</b>, from <b>${fmtDose(Math.min(...doses))}</b> to <b>${fmtDose(Math.max(...doses))} µM</b>.</p>` +
        `<p><b>Anchoring in mechanism.</b> Drug X’s adverse effect is hepatic steatosis, which is driven by lipid biosynthesis. The median BMD of that enriched pathway is <b>${fmtDose(adv)} µM</b>; ` +
        `the median of the GR target genes (the intended effect) is <b>${fmtDose(eff)} µM</b>. The adverse effect starts about <b>${fmtFold(sc.ratio)}</b> above the dose that gives efficacy.</p>` +
        `<p>Values in red sit below the efficacy dose. Gene-level and lowest-pathway estimates are protective screening values: they pick up sensitive or adaptive responses, so on their own they cannot say whether the <i>adverse</i> effect starts before or after the therapeutic dose. The mechanism-anchored estimate can.</p>`;
      left.appendChild(callout);

      right.appendChild(ladder());
      const table = el("table", { class: "aw-table pp-table pp-methods" });
      table.innerHTML =
        "<thead><tr><th>#</th><th>Method</th><th>How the PoD is defined</th><th>Dose (µM)</th><th>× efficacy dose</th></tr></thead><tbody>" +
        sc.methods.map((m) => {
          const x = m.dose / eff;
          return `<tr><td>${m.n}</td><th>${m.name}</th><td class="pp-how">${m.how}</td><td>${fmtDose(m.dose)}</td><td class="${x < 1 ? "pp-below" : ""}">${x < 10 ? x.toFixed(2) : x.toFixed(1)}×</td></tr>`;
        }).join("") +
        `<tr class="pp-best"><td>★</td><th>Mechanism-anchored</th><td class="pp-how">Median BMD of the enriched pathway linked to the adverse outcome (lipid biosynthesis)</td><td>${fmtDose(adv)}</td><td>${(adv / eff).toFixed(1)}×</td></tr>` +
        "</tbody>";
      right.appendChild(table);

      /** All methods on one log axis, with the efficacy and adverse medians and the window between them. */
      function ladder() {
        const W = 740, H = 142, X0 = 24, X1 = 716, AX = 104;
        const xs = SvgUtils.logScale([DOSE_MIN, DOSE_MAX], [X0, X1]);
        const svg = sv("svg", { viewBox: `0 0 ${W} ${H}`, class: "pp-svg pp-ladder", role: "img", "aria-label": "The ten point-of-departure estimates on one dose axis, with the efficacy and adverse pathway medians" });
        SvgUtils.logTicks([DOSE_MIN, DOSE_MAX]).forEach((d) => {
          svg.appendChild(sv("line", { x1: xs(d), x2: xs(d), y1: 8, y2: AX, stroke: "#eceff2" }));
          svg.appendChild(sv("text", { x: xs(d), y: AX + 14, "text-anchor": "middle", class: "svg-axis-label" }, [String(d)]));
        });
        svg.appendChild(sv("text", { x: (X0 + X1) / 2, y: H - 4, "text-anchor": "middle", class: "svg-axis-label" }, ["Dose (µM, log scale)"]));
        svg.appendChild(sv("rect", { x: xs(eff), y: 8, width: Math.max(2, xs(adv) - xs(eff)), height: AX - 8, fill: "#1b7a4b", opacity: 0.1 }));
        [[eff, "Efficacy (GR median)", PATH.gr.color, "end"], [adv, "Adverse (lipid median)", PATH.lip.color, "start"]].forEach(([d, label, color, anchor]) => {
          svg.appendChild(sv("line", { x1: xs(d), x2: xs(d), y1: 8, y2: AX, stroke: color, "stroke-width": 2 }));
          svg.appendChild(sv("text", { x: xs(d) + (anchor === "start" ? 5 : -5), y: 18, "text-anchor": anchor, "font-size": 11, "font-weight": 700, fill: color }, [label]));
        });
        // numbered dots, staggered so close estimates stay readable
        [...sc.methods].sort((p, q) => p.dose - q.dose).forEach((m, i) => {
          const cy = 40 + (i % 3) * 22;
          svg.appendChild(sv("circle", { cx: xs(m.dose), cy, r: 9, fill: "#17202a", stroke: "#fff", "stroke-width": 1.5 }));
          svg.appendChild(sv("text", { x: xs(m.dose), y: cy + 3.5, "text-anchor": "middle", "font-size": 10, "font-weight": 700, fill: "#fff" }, [String(m.n)]));
        });
        return svg;
      }
      return { wrap };
    }

    function stepThree() {
      if (!step3El) step3El = buildStepThree();
      body.appendChild(step3El.wrap);
    }

    function show() {
      body.innerHTML = "";
      drawDots();
      if (step === 0) stepOne(); else if (step === 1) stepTwo(); else stepThree();
      body.appendChild(navButtons());
    }
    show();

    return {
      reset() {
        step = 0; state.focus = null; state.showBmd = false; state.logDose = -1.5;
        step3El = null;
        show();
      }
    };
  }
});
