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
 *   Step 3  Choose a point of departure (PoD) for the adverse effect. The most
 *           sensitive gene is the least reliable summary; the first enriched
 *           pathway is an ADAPTIVE stress response; the right anchor is the
 *           median BMD of the enriched pathway that is mechanistically linked
 *           to the adverse outcome (lipid biosynthesis -> steatosis).
 *
 * Every seed guarantees: the most sensitive gene is NOT in the efficacy or
 * adverse pathway; the adaptive pathway is enriched first; the efficacy and
 * adverse pathways are each enriched at some dose; the cell-cycle pathway
 * (a pathway label without coordinated response) is never enriched.
 *
 * Depends on: prng.js, math-utils.js, stats-utils.js, svg-utils.js,
 * prediction-component.js, activity-shell.js.
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

  const lipBmds = pathwayBmds(genes, "lip");
  const candidates = {
    gene: { dose: minGene.bmd },
    ox: { dose: med("ox") },
    all: { dose: median(responding.map((g) => g.bmd)) },
    lipMin: { dose: Math.min(...lipBmds) },
    lip: { dose: med("lip") }
  };
  return { genes, minGene, first, candidates, efficacyPod: med("gr"), adversePod: med("lip"), ratio: med("lip") / med("gr") };
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
        const next = el("button", { type: "button" }, step === 0 ? "Next: group the genes by pathway →" : "Next: choose a point of departure →");
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

    /* ---- Step 3: choose a point of departure ---- */
    function buildStepThree() {
      const wrap = el("div", { class: "pp-split" });
      const left = el("div", { class: "pp-left" });
      const right = el("div", { class: "pp-right" });
      wrap.append(left, right);
      left.appendChild(el("h3", {}, "Step 3 — Choose the point of departure"));
      const roles = el("ul", { class: "pp-roles" });
      roles.innerHTML =
        PATHWAYS.filter((p) => p.id !== "bg").map((p) => `<li><span class="aw-swatch" style="background:${p.color}"></span><b>${p.label}</b> — ${p.role.toLowerCase()}</li>`).join("");
      const rolesCard = el("div", { class: "pp-rolescard" });
      rolesCard.appendChild(el("h4", {}, "What each pathway means for Drug X"));
      rolesCard.appendChild(roles);
      right.appendChild(rolesCard);

      const mount = el("div", {});
      left.appendChild(mount);
      const options = rng.shuffle([
        { id: "gene", label: "The most sensitive gene in the whole experiment" },
        { id: "ox", label: "The median BMD of the oxidative stress genes" },
        { id: "all", label: "The median BMD of all responding genes" },
        { id: "lipMin", label: "The most sensitive gene in lipid biosynthesis" },
        { id: "lip", label: "The median BMD of the lipid biosynthesis genes" }
      ]);
      const widget = PredictionComponent.createPredictionWidget(mount, {
        prompt: "The adverse effect of Drug X is hepatic steatosis. Which value is the best point of departure for it?",
        inputType: "select", options, commitLabel: "Lock in answer"
      });
      const actions = el("div", { class: "aw-actions" });
      const checkBtn = el("button", { type: "button" }, "Check my answer");
      actions.appendChild(checkBtn);
      left.appendChild(actions);
      const results = el("div", { class: "pp-results", "aria-live": "polite" });
      right.appendChild(results);

      function check() {
        const c = sc.candidates;
        const lipRow = enrichmentAt(genes, sc.first.lip).rows.lip;   // where the pathway first becomes enriched
        const names = {
          gene: `Most sensitive gene (${sc.minGene.name})`,
          ox: "Oxidative stress median",
          all: "Median of all responding genes",
          lipMin: "Most sensitive lipid gene",
          lip: "Lipid biosynthesis median"
        };
        const verdict = {
          gene: "single gene, not tied to the adverse effect",
          ox: "enriched, but an adaptive response",
          all: "mixes unrelated pathways",
          lipMin: "right pathway, but one gene",
          lip: "enriched and linked to the adverse effect"
        };
        const order = ["gene", "ox", "all", "lipMin", "lip"];
        const table = el("table", { class: "aw-table pp-table" });
        table.innerHTML =
          "<thead><tr><th>Candidate point of departure</th><th>Dose (µM)</th><th>vs. lipid median</th><th>Why</th></tr></thead><tbody>" +
          order.map((k) => `<tr class="${k === "lip" ? "pp-best" : ""}"><th>${names[k]}</th><td>${fmtDose(c[k].dose)}</td><td>${k === "lip" ? "—" : (c[k].dose < c.lip.dose ? fmtFold(c.lip.dose / c[k].dose) + " lower" : fmtFold(c[k].dose / c.lip.dose) + " higher")}</td><td>${verdict[k]}</td></tr>`).join("") +
          "</tbody>";
        rolesCard.hidden = true;
        results.innerHTML = "";
        results.appendChild(table);

        const picked = widget.getPrediction();
        const minIsBg = sc.minGene.path === "bg";
        const geneWhat = minIsBg
          ? `${sc.minGene.name}, a gene with no pathway partners that is most likely noise`
          : `${sc.minGene.name}, part of the adaptive ${PATH[sc.minGene.path].label.toLowerCase()}`;
        const explain = {
          gene:
            `The most sensitive gene is ${geneWhat}. It responds at ${fmtDose(c.gene.dose)} µM, ${fmtFold(c.lip.dose / c.gene.dose)} below the lipid pathway’s median. ` +
            `With 80 curves, one gene will always be the extreme, and it need not be related to the adverse effect.`,
          ox:
            `The oxidative stress genes are a coordinated, significantly enriched response, so this one is real signal. But it is the cell’s <i>adaptive</i> response: ` +
            `it switches on to protect the cell, well before any harm. Enrichment shows a pathway is coordinated; mechanism tells you whether it is linked to the adverse effect.`,
          all:
            `Pooling every responder mixes the efficacy, adaptive and adverse pathways with a few random genes, so the number cannot be tied to any mechanism.`,
          lipMin:
            `This is the right pathway, so it is mechanistically anchored. But it is one gene’s value, ${fmtFold(c.lip.dose / c.lipMin.dose)} below the pathway median, and the extreme of ` +
            `${pathwayBmds(genes, "lip").length} noisy estimates is the least reproducible. It is defensible as a conservative bound, but the median is the more stable summary.`,
          lip:
            `Lipid biosynthesis becomes significantly enriched by ${fmtDose(sc.first.lip)} µM (${lipRow.a} of ${lipRow.n} genes responding, p ${fmtP(lipRow.p) === "<0.001" ? "" : "= "}${fmtP(lipRow.p)}), it is tied by mechanism to steatosis, ` +
            `and the median BMD summarises ${pathwayBmds(genes, "lip").length} genes, so no single gene decides it.`
        };
        const msg = el("p", { class: "pp-takeaway" });
        msg.innerHTML = picked
          ? (picked === "lip" ? "<b>Right choice.</b> " : "<b>Not the best anchor.</b> ") + explain[picked] + (picked === "lip" ? "" : ` The better choice is the lipid biosynthesis median: ${explain.lip}`)
          : `No answer was locked in. The best choice is the lipid biosynthesis median: ${explain.lip}`;
        results.appendChild(msg);

        // the window
        const eff = sc.efficacyPod, adv = sc.adversePod, ratio = sc.ratio;
        const naive = c.gene.dose / eff;
        const verdictText = ratio >= 10 ? "a comfortable window" : ratio >= 3 ? "a modest window that deserves caution" : "a narrow window";
        const win = el("p", { class: "pp-takeaway" });
        win.innerHTML =
          `<b>The window.</b> Efficacy point of departure (GR target median): <b>${fmtDose(eff)} µM</b>. Adverse point of departure (lipid median): <b>${fmtDose(adv)} µM</b>. ` +
          `The adverse effect starts about <b>${fmtFold(ratio)}</b> above the dose that gives efficacy: ${verdictText}. ` +
          (naive < 1
            ? `If you had used the most sensitive gene instead, the “adverse” dose would sit ${fmtFold(1 / naive)} <i>below</i> the efficacy dose, and you would wrongly conclude there is no window at all.`
            : `If you had used the most sensitive gene instead, you would estimate a margin of only ${fmtFold(naive)}, ${naive < ratio ? "understating" : "overstating"} the true ${fmtFold(ratio)}.`);
        results.appendChild(win);
        results.appendChild(ladder(names));

        widget.reveal("lip", (predicted) => {
          const ok = predicted === "lip";
          return {
            status: ok ? "correct" : "incorrect",
            label: ok ? "Correct!" : "Not quite",
            detail: ok ? "The enriched, mechanism-linked pathway median is the most defensible anchor." : "The best anchor is the median of the enriched pathway linked to the adverse effect."
          };
        });
        checkBtn.disabled = true;
      }
      checkBtn.addEventListener("click", check);

      /** A dose ladder: where each candidate sits on one log axis, with the window shaded. */
      function ladder(names) {
        const W = 740, H = 134, X0 = 30, X1 = 710, AX = 96;
        const xs = SvgUtils.logScale([DOSE_MIN, DOSE_MAX], [X0, X1]);
        const svg = sv("svg", { viewBox: `0 0 ${W} ${H}`, class: "pp-svg pp-ladder", role: "img", "aria-label": "Candidate points of departure on one dose axis" });
        SvgUtils.logTicks([DOSE_MIN, DOSE_MAX]).forEach((d) => {
          svg.appendChild(sv("line", { x1: xs(d), x2: xs(d), y1: 10, y2: AX, stroke: "#eceff2" }));
          svg.appendChild(sv("text", { x: xs(d), y: AX + 14, "text-anchor": "middle", class: "svg-axis-label" }, [String(d)]));
        });
        svg.appendChild(sv("text", { x: (X0 + X1) / 2, y: H - 4, "text-anchor": "middle", class: "svg-axis-label" }, ["Dose (µM, log scale)"]));
        svg.appendChild(sv("rect", { x: xs(sc.efficacyPod), y: 10, width: Math.max(2, xs(sc.adversePod) - xs(sc.efficacyPod)), height: AX - 10, fill: "#1b7a4b", opacity: 0.1 }));
        const marks = [
          { dose: sc.candidates.gene.dose, label: "Most sensitive gene", color: "#8a949e" },
          { dose: sc.candidates.ox.dose, label: "Oxidative stress median", color: PATH.ox.color },
          { dose: sc.efficacyPod, label: "Efficacy (GR) median", color: PATH.gr.color },
          { dose: sc.adversePod, label: "Adverse (lipid) median", color: PATH.lip.color }
        ].sort((a, b) => a.dose - b.dose);
        marks.forEach((m, i) => {
          const y = 24 + (i % 3) * 22;
          svg.appendChild(sv("line", { x1: xs(m.dose), x2: xs(m.dose), y1: y, y2: AX, stroke: m.color, "stroke-width": 2 }));
          svg.appendChild(sv("circle", { cx: xs(m.dose), cy: AX, r: 5, fill: m.color, stroke: "#fff", "stroke-width": 1.5 }));
          const right = xs(m.dose) < W - 170;
          svg.appendChild(sv("text", { x: xs(m.dose) + (right ? 6 : -6), y: y + 4, "text-anchor": right ? "start" : "end", "font-size": 11, "font-weight": 700, fill: "#17202a" }, [`${m.label} (${fmtDose(m.dose)})`]));
        });
        return svg;
      }

      return { wrap, reset() { widget.reset(); results.innerHTML = ""; rolesCard.hidden = false; checkBtn.disabled = false; } };
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
