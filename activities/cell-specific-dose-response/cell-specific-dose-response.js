/**
 * Activity — Cell-Specific vs. Tissue-Level Dose-Response.
 *
 * Gene X is induced by a drug. The tissue (bulk) dose-response curve is the
 * average of four cell types, weighted by how many cells of each type there
 * are, and the tissue itself has two liver regions, portal and central. Every
 * cell type responds a little differently in the two regions, and hepatocytes
 * differ most (central hepatocytes are far more sensitive).
 *
 * Two independent tick boxes:
 *   "Split into cell types"  - one curve per cell type (averaged over regions)
 *   "Split into regions"     - one curve for the portal region, one for central
 *   both ticked              - a portal and a central curve for each cell type
 * A dashed line marks the 10% response. Bulk gives ONE dose where it is crossed;
 * every split gives more, some far lower, and some never reached.
 *
 * Depends on: prng.js, math-utils.js, svg-utils.js, activity-shell.js.
 */

const CELL_TYPES = [
  { id: "hep", label: "Hepatocytes", weight: 0.60, color: "#0072b2", zoneFactor: [6, 12] },
  { id: "end", label: "Endothelial cells", weight: 0.15, color: "#009e73", zoneFactor: [1.2, 2.0] },
  { id: "imm", label: "Immune cells", weight: 0.10, color: "#d55e00", zoneFactor: [1.2, 2.0] },
  { id: "ste", label: "Stellate cells", weight: 0.15, color: "#cc79a7", zoneFactor: [1.2, 2.0] }
];
const REGION_COLOR = { portal: "#6a3d9a", central: "#b15928" };
const EC50_POOL = [0.2, 2, 20, 20000];   // µM, portal; the last is "barely responds" in range
const DOSE_MIN = 0.01, DOSE_MAX = 1000;  // µM
const THRESHOLD = 0.10;                  // the 10% response line
const DASH = "7 4";                      // central-region curves are dashed

/** Hill curve scaled 0..1 */
function hill(dose, ec50, slope) {
  return 1 / (1 + Math.pow(ec50 / dose, slope));
}

/** Dose where an increasing curve `fn` first reaches `level`, by bisection on log10(dose). */
function doseAtLevel(fn, level) {
  let lo = Math.log10(DOSE_MIN) - 3, hi = Math.log10(DOSE_MAX) + 3;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (fn(Math.pow(10, mid)) < level) lo = mid; else hi = mid;
  }
  return Math.pow(10, (lo + hi) / 2);
}

function buildScenario(rng) {
  // Hepatocytes (60% of the tissue) are never the most or least sensitive type:
  // the point is that a sensitive MINORITY is hidden by the majority's average.
  let ec50s;
  do { ec50s = rng.shuffle(EC50_POOL); } while (ec50s[0] === EC50_POOL[0] || ec50s[0] === EC50_POOL[3]);
  const cells = CELL_TYPES.map((c, i) => {
    const factor = rng.range(c.zoneFactor[0], c.zoneFactor[1]);
    return { ...c, ecPortal: ec50s[i], ecCentral: ec50s[i] / factor, slope: rng.range(1.2, 2.2) };
  });
  const zoneFn = (c, zone) => (d) => hill(d, zone === "portal" ? c.ecPortal : c.ecCentral, c.slope);
  const avgFn = (c) => (d) => 0.5 * (zoneFn(c, "portal")(d) + zoneFn(c, "central")(d));
  const regionFn = (zone) => (d) => cells.reduce((s, c) => s + c.weight * zoneFn(c, zone)(d), 0);
  const bulk = (d) => 0.5 * (regionFn("portal")(d) + regionFn("central")(d));
  return { cells, zoneFn, avgFn, regionFn, bulk, bulkDose: doseAtLevel(bulk, THRESHOLD) };
}

/** The curves to draw for a given combination of the two tick boxes (bulk is always added separately). */
function makeSeries(sc, byCell, byRegion) {
  let list = [];
  if (byCell && byRegion) {
    sc.cells.forEach((c) => ["portal", "central"].forEach((zone) => {
      list.push({ key: `${c.id}-${zone}`, label: `${c.label} · ${zone}`, color: c.color, dash: zone === "central" ? DASH : null, fn: sc.zoneFn(c, zone) });
    }));
  } else if (byCell) {
    list = sc.cells.map((c) => ({ key: c.id, label: c.label, color: c.color, dash: null, fn: sc.avgFn(c) }));
  } else if (byRegion) {
    list = ["portal", "central"].map((zone) => ({ key: zone, label: `${zone[0].toUpperCase()}${zone.slice(1)} region`, color: REGION_COLOR[zone], dash: zone === "central" ? DASH : null, fn: sc.regionFn(zone) }));
  }
  list.forEach((s) => { s.dose10 = doseAtLevel(s.fn, THRESHOLD); });
  return list;
}

if (typeof module !== "undefined") module.exports = { buildScenario, makeSeries, hill, THRESHOLD, DOSE_MAX };

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
function fmtFold(x) { return x >= 10 ? `${Math.round(x)}-fold` : `${x.toFixed(1)}-fold`; }

ActivityShell.init({
  rootId: "activity-root",
  title: "Cell-Specific vs. Tissue-Level Dose-Response",
  defaultSeed: 2030,
  instructions:
    "This is the dose-response of one gene (Gene X) measured in bulk tissue. Tick “Split into cell types” to see the cell-level curves it is built from, " +
    "“Split into regions” to see the portal and central regions of the liver, or both. The dashed horizontal line marks the 10% response: how many doses does it cross, and what does that mean for safety?",

  render(data, { rng, container }) {
    const sc = buildScenario(rng);
    const state = { cells: false, regions: false, logDose: 0 };

    const W = 640, H = 330, X0 = 56, X1 = 620, Y0 = 16, Y1 = 270;
    const xs = SvgUtils.logScale([DOSE_MIN, DOSE_MAX], [X0, X1]);
    const ys = SvgUtils.linearScale([0, 1], [Y1, Y0]);

    const layout = el("div", { class: "cd-layout" });
    const plotPanel = el("section", { class: "aw-panel" });
    const side = el("section", { class: "aw-panel cd-side" });
    layout.append(plotPanel, side);
    container.appendChild(layout);

    const toggleRow = el("div", { class: "aw-actions" });
    function toggle(id, text, onChange) {
      const label = el("label", { class: "cd-toggle" });
      const box = el("input", { type: "checkbox", id });
      box.addEventListener("change", () => { onChange(box.checked); draw(); });
      label.append(box, " " + text);
      toggleRow.appendChild(label);
      return box;
    }
    const cellBox = toggle("cd-split", "Split into cell types", (v) => { state.cells = v; });
    const regionBox = toggle("cd-regions", "Split into regions (portal / central)", (v) => { state.regions = v; });
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

      svg.appendChild(SvgUtils.svgEl("line", { x1: X0, x2: X1, y1: ys(THRESHOLD), y2: ys(THRESHOLD), stroke: "#a3291e", "stroke-width": 1.5, "stroke-dasharray": "6 4" }));
      svg.appendChild(SvgUtils.svgEl("text", { x: X1 - 4, y: ys(THRESHOLD) - 5, "text-anchor": "end", fill: "#a3291e", "font-size": 11, "font-weight": 700 }, ["10% response"]));

      const mark = (dose, color) => {
        if (dose < DOSE_MIN || dose > DOSE_MAX) return;
        svg.appendChild(SvgUtils.svgEl("line", { x1: xs(dose), x2: xs(dose), y1: ys(THRESHOLD), y2: Y1, stroke: color, "stroke-width": 1.2, "stroke-dasharray": "2 3" }));
        svg.appendChild(SvgUtils.svgEl("circle", { cx: xs(dose), cy: ys(THRESHOLD), r: 5, fill: color, stroke: "#fff", "stroke-width": 1.5 }));
      };

      const series = makeSeries(sc, state.cells, state.regions);
      series.forEach((s) => { curve(s.fn, s.color, 2, s.dash); mark(s.dose10, s.color); });
      curve(sc.bulk, "#17202a", 3.5, null);
      mark(sc.bulkDose, "#17202a");

      const dsel = Math.pow(10, state.logDose);
      svg.appendChild(SvgUtils.svgEl("line", { x1: xs(dsel), x2: xs(dsel), y1: Y0, y2: Y1, stroke: "#6b7280", "stroke-width": 1.5 }));

      // legend (two columns when there are many curves)
      const legend = [{ label: "Bulk tissue", color: "#17202a", dash: null }].concat(series.map((s) => ({ label: s.label, color: s.color, dash: s.dash })));
      const perCol = legend.length > 5 ? Math.ceil(legend.length / 2) : legend.length;
      legend.forEach((it, i) => {
        const col = Math.floor(i / perCol), row = i % perCol;
        const lx = X0 + 8 + col * 170, ly = Y0 + 4 + row * 16;
        svg.appendChild(SvgUtils.svgEl("line", { x1: lx, x2: lx + 18, y1: ly + 6, y2: ly + 6, stroke: it.color, "stroke-width": 3, "stroke-dasharray": it.dash || null }));
        svg.appendChild(SvgUtils.svgEl("text", { x: lx + 24, y: ly + 10, "font-size": 11, fill: "#17202a" }, [it.label]));
      });

      // table
      const rows = [...series].sort((a, b) => a.dose10 - b.dose10);
      table.innerHTML =
        "<thead><tr><th>Measurement</th><th>Dose (µM)</th></tr></thead><tbody>" +
        `<tr class="cd-bulkrow"><th><span class="aw-swatch" style="background:#17202a"></span>Bulk tissue</th><td>${fmtDose(sc.bulkDose)}</td></tr>` +
        rows.map((s) => `<tr><th><span class="aw-swatch" style="background:${s.color}"></span>${s.label}</th><td>${s.dose10 > DOSE_MAX ? `not reached (&gt; ${DOSE_MAX})` : fmtDose(s.dose10)}</td></tr>`).join("") +
        "</tbody>";

      // narrative
      if (series.length) {
        const reached = series.filter((s) => s.dose10 <= DOSE_MAX);
        const most = reached.reduce((a, b) => (a.dose10 < b.dose10 ? a : b));
        const fold = sc.bulkDose / most.dose10;
        const yAtBulk = most.fn(sc.bulkDose);
        const kind = state.cells && state.regions ? "cell-type and region curves" : state.cells ? "cell types" : "regions";
        const missing = series.length - reached.length;
        const plural = /cells|Hepatocytes/.test(most.label.split(" · ")[0]);
        readout.innerHTML =
          `Bulk gives <b>one</b> number (${fmtDose(sc.bulkDose)} µM). Split into ${kind}, the same line is crossed at <b>${reached.length}</b> different doses` +
          `${missing ? `, and ${missing} ${missing === 1 ? "curve never reaches" : "curves never reach"} it` : ""}. <b>${most.label}</b> respond${plural ? "" : "s"} about <b>${fmtFold(fold)}</b> more ` +
          `sensitively than the bulk value suggests: at the bulk dose ${plural ? "they are" : "it is"} already at <b>${pct(yAtBulk)}</b> of ${plural ? "their" : "its"} maximum.`;
      } else {
        readout.innerHTML = "Bulk tissue gives a single curve and a single number. Tick a box to see what it is hiding.";
      }

      doseVal.textContent = `${fmtDose(dsel)} µM`;
      const lines = [`<li><span class="aw-swatch" style="background:#17202a"></span>Bulk tissue: <b>${pct(sc.bulk(dsel))}</b></li>`]
        .concat(series.map((s) => `<li><span class="aw-swatch" style="background:${s.color}"></span>${s.label}: <b>${pct(s.fn(dsel))}</b></li>`));
      atDose.innerHTML = `<h4>At ${fmtDose(dsel)} µM</h4><ul>${lines.join("")}</ul>`;
    }

    doseInput.addEventListener("input", () => { state.logDose = Number(doseInput.value); draw(); });
    draw();

    return {
      reset() {
        state.cells = false; state.regions = false; state.logDose = 0;
        cellBox.checked = false; regionBox.checked = false; doseInput.value = 0;
        draw();
      }
    };
  }
});
