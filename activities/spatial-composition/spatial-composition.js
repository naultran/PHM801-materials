/**
 * Activity — Seeing Space in a Tissue Measurement.
 *
 * A 20 x 20 piece of liver, one dot per cell: blue = hepatocyte, red = immune
 * cell. Raise the share of immune cells and, in "inflammation" mode, they form
 * tight foci rather than spreading evenly. The same tissue is then "measured"
 * three ways:
 *   - single-cell resolution (every dot),
 *   - spot-based spatial (each square spot averages the cells under it),
 *   - bulk (one number for the whole tissue).
 * Switching to "scattered" keeps the bulk number identical but erases the foci,
 * which is the point: bulk cannot see where the cells are.
 *
 * Depends on: prng.js, math-utils.js, activity-shell.js.
 */

const SIZE = 20;
const TOTAL = SIZE * SIZE;
const BLUE = [43, 108, 176];
const RED = [192, 57, 43];
const SPOT_OPTIONS = [2, 4, 5, 10];

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

ActivityShell.init({
  rootId: "activity-root",
  title: "Seeing Space in a Tissue Measurement",
  defaultSeed: 2028,
  instructions:
    "Each dot is one cell: blue is a hepatocyte, red is an immune cell. Raise the share of immune cells and see how " +
    "the same tissue looks at single-cell resolution, with spot-based spatial transcriptomics, and as a bulk sample.",

  render(data, { rng, container }) {
    const orders = buildOrders(rng);
    const state = { percent: 8, pattern: "clustered", spot: 5 };

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

    const spotRow = tag("div", { class: "control-row" });
    const spotLabel = tag("label", { class: "field-label", for: "sc-spot" }, "Spot size for the spatial measurement");
    const spotSel = tag("select", { id: "sc-spot", class: "touch-target" });
    SPOT_OPTIONS.forEach((s) => {
      const o = tag("option", { value: s }, `${s} × ${s} cells per spot`);
      if (s === state.spot) o.selected = true;
      spotSel.appendChild(o);
    });
    spotSel.addEventListener("change", () => { state.spot = Number(spotSel.value); draw(); });
    spotRow.append(spotLabel, spotSel);

    slider.addEventListener("input", () => { state.percent = Number(slider.value); sliderValue.textContent = `${state.percent}%`; draw(); });
    controls.append(sliderRow, pattern, spotRow);

    const panels = tag("div", { class: "sc-panels" });
    const readout = tag("p", { class: "sc-readout", "aria-live": "polite" });
    container.append(controls, readout, panels);

    function panel(title, subtitle) {
      const p = tag("section", { class: "aw-panel sc-panel" });
      p.appendChild(tag("h4", {}, title));
      p.appendChild(tag("p", { class: "aw-note" }, subtitle));
      return p;
    }

    function draw() {
      const set = immuneSet(orders[state.pattern], state.percent);
      const immuneFraction = set.size / TOTAL;
      panels.innerHTML = "";

      // 1 — single cell
      const p1 = panel("Single-cell resolution", "Every cell is measured individually.");
      const svg1 = tag("svg", { viewBox: `0 0 ${SIZE} ${SIZE}`, class: "sc-svg", role: "img", "aria-label": `${set.size} immune cells among ${TOTAL} cells, ${state.pattern}` });
      for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
          const imm = set.has(y * SIZE + x);
          svg1.appendChild(tag("circle", { cx: x + 0.5, cy: y + 0.5, r: 0.4, fill: imm ? mix(1) : mix(0) }));
        }
      }
      p1.appendChild(svg1);
      p1.appendChild(tag("p", { class: "sc-legend" }, ""));
      p1.lastChild.innerHTML = '<span class="aw-swatch" style="background:' + mix(0) + '"></span>Hepatocyte &nbsp; <span class="aw-swatch" style="background:' + mix(1) + '"></span>Immune cell';

      // 2 — spot based
      const spot = state.spot;
      const spots = SIZE / spot;
      const p2 = panel("Spot-based spatial", `Each ${spot} × ${spot} spot averages the cells under it.`);
      const svg2 = tag("svg", { viewBox: `0 0 ${SIZE} ${SIZE}`, class: "sc-svg", role: "img", "aria-label": "Spot-based spatial measurement" });
      let maxSpot = 0;
      for (let sy = 0; sy < spots; sy++) {
        for (let sx = 0; sx < spots; sx++) {
          let count = 0;
          for (let y = sy * spot; y < (sy + 1) * spot; y++) for (let x = sx * spot; x < (sx + 1) * spot; x++) if (set.has(y * SIZE + x)) count++;
          const f = count / (spot * spot);
          maxSpot = Math.max(maxSpot, f);
          svg2.appendChild(tag("rect", { x: sx * spot + 0.08, y: sy * spot + 0.08, width: spot - 0.16, height: spot - 0.16, rx: 0.5, fill: mix(Math.min(1, f * 2)) }));
          if (spots <= 5) {
            svg2.appendChild(tag("text", { x: sx * spot + spot / 2, y: sy * spot + spot / 2 + 0.4, "text-anchor": "middle", "font-size": spot > 4 ? 1.7 : 1.1, fill: "#fff", "font-weight": 700 }, `${Math.round(f * 100)}%`));
          }
        }
      }
      p2.appendChild(svg2);
      p2.appendChild(tag("p", { class: "sc-legend" }, "Color: share of immune cells in the spot (red = 50% or more)."));

      // 3 — bulk
      const p3 = panel("Bulk (whole tissue)", "Everything is averaged into one number.");
      const svg3 = tag("svg", { viewBox: `0 0 ${SIZE} ${SIZE}`, class: "sc-svg", role: "img", "aria-label": `Bulk measurement: ${Math.round(immuneFraction * 100)} percent immune cells` });
      svg3.appendChild(tag("rect", { x: 0.1, y: 0.1, width: SIZE - 0.2, height: SIZE - 0.2, rx: 1, fill: mix(Math.min(1, immuneFraction * 2)) }));
      svg3.appendChild(tag("text", { x: SIZE / 2, y: SIZE / 2 + 1.6, "text-anchor": "middle", "font-size": 5, fill: "#fff", "font-weight": 700 }, `${Math.round(immuneFraction * 100)}%`));
      p3.appendChild(svg3);
      p3.appendChild(tag("p", { class: "sc-legend" }, "One value: the fraction of immune cells across the whole sample."));

      panels.append(p1, p2, p3);
      readout.innerHTML =
        `Bulk says <b>${Math.round(immuneFraction * 100)}%</b> immune cells. The busiest spot is <b>${Math.round(maxSpot * 100)}%</b>. ` +
        (state.pattern === "clustered"
          ? "The immune cells are packed into foci, so some spots are mostly immune while the bulk number looks modest."
          : "The immune cells are spread evenly, so the spots stay much closer to the bulk average. Switch back to “clustered” to compare: the bulk number does not change.");
    }

    draw();
    return {
      reset() {
        state.percent = 8; state.pattern = "clustered"; state.spot = 5;
        slider.value = state.percent; sliderValue.textContent = `${state.percent}%`;
        pattern.querySelectorAll("input").forEach((r) => { r.checked = r.value === "clustered"; });
        spotSel.value = String(state.spot);
        draw();
      }
    };
  }
});
