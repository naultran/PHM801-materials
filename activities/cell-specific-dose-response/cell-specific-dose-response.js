/**
 * Activity — Cell-Specific vs. Tissue-Level Dose-Response.
 *
 * Gene X is induced by a drug. The tissue (bulk) dose-response curve is the
 * average of four cell types, weighted by how many cells of each type there
 * are. Tick "Split into cell types" to see the curves it is made of: every one
 * is a sigmoid, but their potencies differ by orders of magnitude. A dashed line
 * marks the 10% response: bulk gives ONE dose where it is crossed, the split
 * view gives one per cell type — some very sensitive, one that barely responds.
 *
 * Depends on: prng.js, math-utils.js, svg-utils.js, activity-shell.js.
 */

const CELL_TYPES = [
  { id: "hep", label: "Hepatocytes", weight: 0.60, color: "#0072b2" },
  { id: "end", label: "Endothelial cells", weight: 0.15, color: "#009e73" },
  { id: "imm", label: "Immune cells", weight: 0.10, color: "#d55e00" },
  { id: "ste", label: "Stellate cells", weight: 0.15, color: "#cc79a7" }
];
const EC50_POOL = [0.2, 2, 20, 20000];   // µM; the last is "barely responds" in range
const DOSE_MIN = 0.01, DOSE_MAX = 1000;  // µM
const THRESHOLD = 0.10;                  // the 10% response line

/** Hill curve scaled 0..1 */
function hill(dose, ec50, slope) {
  return 1 / (1 + Math.pow(ec50 / dose, slope));
}

/** Dose that gives `level` of the maximum (analytic for a single Hill curve). */
function doseAtLevel(ec50, slope, level) {
  return ec50 * Math.pow(level / (1 - level), 1 / slope);
}

function buildScenario(rng) {
  // Hepatocytes (60% of the tissue) are never the most or least sensitive type:
  // the point is that a sensitive MINORITY is hidden by the majority's average.
  let ec50s;
  do { ec50s = rng.shuffle(EC50_POOL); } while (ec50s[0] === EC50_POOL[0] || ec50s[0] === EC50_POOL[3]);
  const cells = CELL_TYPES.map((c, i) => ({ ...c, ec50: ec50s[i], slope: rng.range(1.2, 2.2) }));
  const bulk = (dose) => cells.reduce((s, c) => s + c.weight * hill(dose, c.ec50, c.slope), 0);
  // 10% crossing of the bulk curve by bisection on log10(dose)
  let lo = Math.log10(DOSE_MIN), hi = Math.log10(DOSE_MAX * 100);
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (bulk(Math.pow(10, mid)) < THRESHOLD) lo = mid; else hi = mid;
  }
  const bulkDose = Math.pow(10, (lo + hi) / 2);
  cells.forEach((c) => { c.dose10 = doseAtLevel(c.ec50, c.slope, THRESHOLD); });
  return { cells, bulk, bulkDose };
}

if (typeof module !== "undefined") module.exports = { buildScenario, hill };

/* ---------- rendering ---------- */

function el(tagName, attrs, text) {
  const node = document.createElement(tagName);
  Object.entries(attrs || {}).forEach(([k, v]) => node.setAttribute(k, v));
  if (text !== undefined) node.textContent = text;
  return node;
}

function fmtDose(d) {
  if (d >= 100) return d.toFixed(0);
  if (d >= 10) return d.toFixed(1);
  if (d >= 1) return d.toFixed(2);
  return d.toPrecision(2);
}

function pct(v) { return `${(v * 100).toFixed(v < 0.1 ? 1 : 0)}%`; }

ActivityShell.init({
  rootId: "activity-root",
  title: "Cell-Specific vs. Tissue-Level Dose-Response",
  defaultSeed: 2030,
  instructions:
    "This is the dose-response of one gene (Gene X) measured in bulk tissue. Tick “Split into cell types” to see the " +
    "cell-level curves it is built from. The dashed line marks the 10% response: how many doses does it cross, and what does that mean for safety?",

  render(data, { rng, container }) {
    const sc = buildScenario(rng);
    const state = { split: false, logDose: 0 };

    const W = 640, H = 330, X0 = 56, X1 = 620, Y0 = 16, Y1 = 270;
    const xs = SvgUtils.logScale([DOSE_MIN, DOSE_MAX], [X0, X1]);
    const ys = SvgUtils.linearScale([0, 1], [Y1, Y0]);

    const layout = el("div", { class: "cd-layout" });
    const plotPanel = el("section", { class: "aw-panel" });
    const side = el("section", { class: "aw-panel cd-side" });
    layout.append(plotPanel, side);
    container.appendChild(layout);

    const toggleRow = el("div", { class: "aw-actions" });
    const toggleLabel = el("label", { class: "cd-toggle" });
    const toggle = el("input", { type: "checkbox", id: "cd-split" });
    toggleLabel.append(toggle, " Split into cell types");
    toggleRow.appendChild(toggleLabel);
    plotPanel.append(el("h3", {}, "Gene X response to the drug"), toggleRow);

    const svg = SvgUtils.svgEl("svg", { viewBox: `0 0 ${W} ${H}`, class: "cd-svg", role: "img", "aria-label": "Dose-response curves for Gene X" });
    plotPanel.appendChild(svg);

    const doseRow = el("div", { class: "control-row" });
    const doseLabel = el("label", { class: "field-label", for: "cd-dose" });
    const doseVal = el("span", { class: "control-row__value" });
    doseLabel.append("Look at one dose (µM): ", doseVal);
    const doseInput = el("input", { type: "range", id: "cd-dose", min: Math.log10(DOSE_MIN), max: Math.log10(DOSE_MAX), step: 0.05, value: state.logDose });
    doseRow.append(doseLabel, doseInput);
    plotPanel.appendChild(doseRow);

    side.appendChild(el("h3", {}, "Dose at 10% response"));
    const table = el("table", { class: "aw-table cd-table" });
    side.appendChild(table);
    const readout = el("p", { class: "cd-readout", "aria-live": "polite" });
    side.appendChild(readout);
    const atDose = el("div", { class: "cd-at-dose" });
    side.appendChild(atDose);

    function draw() {
      SvgUtils.clearSVG(svg);
      // gridlines + axes
      [0, 0.25, 0.5, 0.75, 1].forEach((t) => {
        svg.appendChild(SvgUtils.svgEl("line", { x1: X0, x2: X1, y1: ys(t), y2: ys(t), stroke: "#e5e7eb" }));
        svg.appendChild(SvgUtils.svgEl("text", { x: X0 - 8, y: ys(t) + 4, "text-anchor": "end", class: "svg-axis-label" }, [`${t * 100}%`]));
      });
      SvgUtils.logTicks([DOSE_MIN, DOSE_MAX]).forEach((d) => {
        svg.appendChild(SvgUtils.svgEl("line", { x1: xs(d), x2: xs(d), y1: Y0, y2: Y1, stroke: "#f1f3f5" }));
        svg.appendChild(SvgUtils.svgEl("text", { x: xs(d), y: Y1 + 16, "text-anchor": "middle", class: "svg-axis-label" }, [String(d)]));
      });
      svg.appendChild(SvgUtils.svgEl("text", { x: (X0 + X1) / 2, y: H - 10, "text-anchor": "middle", class: "svg-axis-label" }, ["Dose (µM, log scale)"]));
      svg.appendChild(SvgUtils.svgEl("text", { x: 14, y: (Y0 + Y1) / 2, "text-anchor": "middle", class: "svg-axis-label", transform: `rotate(-90 14 ${(Y0 + Y1) / 2})` }, ["% of maximal response"]));

      const curve = (fn, color, width, dash) => {
        const pts = [];
        for (let i = 0; i <= 120; i++) {
          const d = Math.pow(10, Math.log10(DOSE_MIN) + (i / 120) * (Math.log10(DOSE_MAX) - Math.log10(DOSE_MIN)));
          pts.push(`${xs(d).toFixed(1)},${ys(fn(d)).toFixed(1)}`);
        }
        svg.appendChild(SvgUtils.svgEl("polyline", { points: pts.join(" "), fill: "none", stroke: color, "stroke-width": width, "stroke-dasharray": dash || null }));
      };

      // 10% line
      svg.appendChild(SvgUtils.svgEl("line", { x1: X0, x2: X1, y1: ys(THRESHOLD), y2: ys(THRESHOLD), stroke: "#a3291e", "stroke-width": 1.5, "stroke-dasharray": "6 4" }));
      svg.appendChild(SvgUtils.svgEl("text", { x: X1 - 4, y: ys(THRESHOLD) - 5, "text-anchor": "end", fill: "#a3291e", "font-size": 11, "font-weight": 700 }, ["10% response"]));

      const mark = (dose, color, label) => {
        if (dose < DOSE_MIN || dose > DOSE_MAX) return;
        svg.appendChild(SvgUtils.svgEl("line", { x1: xs(dose), x2: xs(dose), y1: ys(THRESHOLD), y2: Y1, stroke: color, "stroke-width": 1.2, "stroke-dasharray": "2 3" }));
        svg.appendChild(SvgUtils.svgEl("circle", { cx: xs(dose), cy: ys(THRESHOLD), r: 5, fill: color, stroke: "#fff", "stroke-width": 1.5 }));
      };

      if (state.split) {
        sc.cells.forEach((c) => {
          curve((d) => hill(d, c.ec50, c.slope), c.color, 2);
          mark(c.dose10, c.color);
        });
      }
      curve(sc.bulk, "#17202a", 3.5, state.split ? "7 4" : null);
      mark(sc.bulkDose, "#17202a");

      // selected-dose marker
      const dsel = Math.pow(10, state.logDose);
      svg.appendChild(SvgUtils.svgEl("line", { x1: xs(dsel), x2: xs(dsel), y1: Y0, y2: Y1, stroke: "#6b7280", "stroke-width": 1.5 }));

      // legend
      const legend = [{ label: "Bulk tissue", color: "#17202a" }].concat(state.split ? sc.cells.map((c) => ({ label: c.label, color: c.color })) : []);
      legend.forEach((it, i) => {
        svg.appendChild(SvgUtils.svgEl("rect", { x: X0 + 8, y: Y0 + 4 + i * 16, width: 12, height: 12, rx: 2, fill: it.color }));
        svg.appendChild(SvgUtils.svgEl("text", { x: X0 + 26, y: Y0 + 14 + i * 16, "font-size": 11, fill: "#17202a" }, [it.label]));
      });

      // table
      const rows = state.split ? [...sc.cells].sort((a, b) => a.dose10 - b.dose10) : [];
      table.innerHTML =
        "<thead><tr><th>Measurement</th><th>Dose (µM)</th></tr></thead><tbody>" +
        `<tr class="cd-bulkrow"><th><span class="aw-swatch" style="background:#17202a"></span>Bulk tissue</th><td>${fmtDose(sc.bulkDose)}</td></tr>` +
        rows.map((c) => `<tr><th><span class="aw-swatch" style="background:${c.color}"></span>${c.label}</th><td>${c.dose10 > DOSE_MAX ? `not reached (&gt; ${DOSE_MAX})` : fmtDose(c.dose10)}</td></tr>`).join("") +
        "</tbody>";

      // narrative
      if (state.split) {
        const reached = sc.cells.filter((c) => c.dose10 <= DOSE_MAX);
        const most = reached.reduce((a, b) => (a.dose10 < b.dose10 ? a : b));
        const fold = sc.bulkDose / most.dose10;
        const yAtBulk = hill(sc.bulkDose, most.ec50, most.slope);
        readout.innerHTML =
          `Bulk gives <b>one</b> number (${fmtDose(sc.bulkDose)} µM). Split by cell type, the same line is crossed at <b>${reached.length}</b> different doses, ` +
          `and ${sc.cells.length - reached.length} cell type never reaches it. <b>${most.label}</b> respond about <b>${fold >= 10 ? Math.round(fold) : fold.toFixed(1)}-fold</b> more ` +
          `sensitively than the bulk value suggests: at the bulk dose they are already at <b>${pct(yAtBulk)}</b> of their maximum.`;
      } else {
        readout.innerHTML = "Bulk tissue gives a single curve and a single number. Tick the box to see what it is hiding.";
      }

      // readout at chosen dose
      doseVal.textContent = `${fmtDose(dsel)} µM`;
      const lines = [`<li><span class="aw-swatch" style="background:#17202a"></span>Bulk tissue: <b>${pct(sc.bulk(dsel))}</b></li>`];
      if (state.split) sc.cells.forEach((c) => lines.push(`<li><span class="aw-swatch" style="background:${c.color}"></span>${c.label}: <b>${pct(hill(dsel, c.ec50, c.slope))}</b></li>`));
      atDose.innerHTML = `<h4>At ${fmtDose(dsel)} µM</h4><ul>${lines.join("")}</ul>`;
    }

    toggle.addEventListener("change", () => { state.split = toggle.checked; draw(); });
    doseInput.addEventListener("input", () => { state.logDose = Number(doseInput.value); draw(); });
    draw();

    return {
      reset() {
        state.split = false; state.logDose = 0;
        toggle.checked = false; doseInput.value = 0;
        draw();
      }
    };
  }
});
