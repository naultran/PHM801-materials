/**
 * Activity 6 — Dose-Response Laboratory.
 * Data: ../../data/dose-response.json (one fictional compound's default Hill
 * parameters + dose range)
 * Teaching point: a response seen only at very high concentrations may be a
 * nonspecific cytotoxicity artifact rather than a real target-specific effect.
 */

const SHAPE_LABELS = {
  monotonic: "Monotonic",
  nonmonotonic: "Nonmonotonic (bell-shaped)",
  adaptive: "Adaptive (partial desensitization)",
  cytotoxicity: "Cytotoxicity-driven (nonspecific)"
};

ActivityShell.init({
  rootId: "activity-root",
  title: "Dose-Response Laboratory",
  dataUrl: "../../data/dose-response.json",
  defaultSeed: 5150,
  instructions:
    "Adjust the curve parameters and response shape, then compare the smooth \"true\" curve against noisy " +
    "simulated replicate measurements. Watch what happens to the apparent signal once dose crosses the " +
    "cytotoxicity threshold.",

  render(data, { rng, container }) {
    const compound = data.compounds[0];
    const params = { top: compound.top, bottom: compound.bottom, ec50: compound.ec50, hillSlope: compound.hillSlope };
    let shape = data.defaultShape || "monotonic";
    let noiseSd = data.defaultNoiseSd;
    let replicates = data.defaultReplicates;
    let cytotoxicityThreshold = compound.cytotoxicityThreshold;
    let replicateSeed = rng.int(0, 1e9);

    const layout = document.createElement("div");
    layout.className = "dr-layout";
    container.appendChild(layout);
    const controls = document.createElement("div");
    const chartCol = document.createElement("div");
    layout.appendChild(controls);
    layout.appendChild(chartCol);

    function sliderRow(labelText, min, max, step, value, onInput, formatFn) {
      const row = document.createElement("div");
      row.className = "control-row";
      const label = document.createElement("label");
      label.className = "field-label";
      label.textContent = labelText;
      const input = document.createElement("input");
      input.type = "range"; input.min = String(min); input.max = String(max); input.step = String(step); input.value = String(value);
      const valueEl = document.createElement("span");
      valueEl.className = "control-row__value";
      valueEl.textContent = (formatFn || ((v) => v))(value);
      input.addEventListener("input", () => {
        const v = Number(input.value);
        valueEl.textContent = (formatFn || ((v2) => v2))(v);
        onInput(v);
      });
      row.appendChild(label); row.appendChild(input); row.appendChild(valueEl);
      return row;
    }

    controls.appendChild(sliderRow("Top (maximum response)", 0, 150, 1, params.top, (v) => { params.top = v; update(); }));
    controls.appendChild(sliderRow("Bottom (baseline response)", 0, 50, 1, params.bottom, (v) => { params.bottom = v; update(); }));
    controls.appendChild(sliderRow("EC50 (log scale)", -2, 3, 0.05, Math.log10(params.ec50), (v) => { params.ec50 = Math.pow(10, v); update(); }, (v) => MathUtils.formatNumber(Math.pow(10, v), 2)));
    controls.appendChild(sliderRow("Hill slope", 0.3, 4, 0.1, params.hillSlope, (v) => { params.hillSlope = v; update(); }));
    controls.appendChild(sliderRow("Replicate noise (SD)", 0, 20, 0.5, noiseSd, (v) => { noiseSd = v; update(); }));
    controls.appendChild(sliderRow("Replicates per dose", 1, 8, 1, replicates, (v) => { replicates = Math.round(v); update(); }));
    controls.appendChild(sliderRow("Cytotoxicity threshold (dose)", 1, 1000, 1, cytotoxicityThreshold, (v) => { cytotoxicityThreshold = v; update(); }));

    const shapeRow = document.createElement("div");
    shapeRow.className = "control-row";
    const shapeLabel = document.createElement("label");
    shapeLabel.className = "field-label";
    shapeLabel.textContent = "Response shape";
    const shapeSelect = document.createElement("select");
    shapeSelect.className = "touch-target";
    Object.entries(SHAPE_LABELS).forEach(([val, text]) => {
      const opt = document.createElement("option"); opt.value = val; opt.textContent = text;
      shapeSelect.appendChild(opt);
    });
    shapeSelect.value = shape;
    shapeSelect.addEventListener("change", () => { shape = shapeSelect.value; update(); });
    shapeRow.appendChild(shapeLabel); shapeRow.appendChild(shapeSelect);
    controls.appendChild(shapeRow);

    const reseedBtn = document.createElement("button");
    reseedBtn.type = "button"; reseedBtn.className = "touch-target";
    reseedBtn.textContent = "New random replicates";
    reseedBtn.addEventListener("click", () => { replicateSeed = Math.floor(Math.random() * 1e9); update(); });
    controls.appendChild(reseedBtn);

    const chartWrap = document.createElement("div");
    chartWrap.className = "dr-chart-wrap";
    chartCol.appendChild(chartWrap);
    const readouts = document.createElement("div");
    readouts.className = "dr-readouts";
    chartCol.appendChild(readouts);
    const shapeNote = document.createElement("p");
    chartCol.appendChild(shapeNote);

    const WIDTH = 640, HEIGHT = 380, MARGIN = { top: 20, right: 20, bottom: 50, left: 55 };

    function update() {
      const doseRange = [Math.pow(10, compound.doseRangeLog10[0]), Math.pow(10, compound.doseRangeLog10[1])];
      const smoothDoses = DoseResponseModel.generateDoseSeries(compound.doseRangeLog10, 120);
      const scatterDoses = DoseResponseModel.generateDoseSeries(compound.doseRangeLog10, 10);

      const smoothTrue = smoothDoses.map((d) => DoseResponseModel.computeApparentResponse(d, params, shape, cytotoxicityThreshold));
      const simResult = DoseResponseModel.simulateReplicates(scatterDoses, params, {
        noiseSd, replicates, seed: replicateSeed, shape, cytotoxicityThreshold
      });

      const yMax = Math.max(params.top, ...smoothTrue, ...simResult.flatMap((r) => r.replicateValues)) * 1.15 || 1;
      const yMin = Math.min(0, params.bottom, ...simResult.flatMap((r) => r.replicateValues));

      const xScale = SvgUtils.logScale(doseRange, [MARGIN.left, WIDTH - MARGIN.right]);
      const yScale = SvgUtils.linearScale([yMin, yMax], [HEIGHT - MARGIN.bottom, MARGIN.top]);

      const svg = SvgUtils.svgEl("svg", { width: WIDTH, height: HEIGHT, viewBox: `0 0 ${WIDTH} ${HEIGHT}` });

      // cytotoxicity shaded region
      if (cytotoxicityThreshold >= doseRange[0] && cytotoxicityThreshold <= doseRange[1]) {
        svg.appendChild(SvgUtils.svgEl("rect", {
          x: xScale(cytotoxicityThreshold), y: MARGIN.top,
          width: Math.max(0, (WIDTH - MARGIN.right) - xScale(cytotoxicityThreshold)),
          height: HEIGHT - MARGIN.top - MARGIN.bottom,
          fill: "var(--color-danger-bg)"
        }));
        svg.appendChild(SvgUtils.svgEl("line", {
          x1: xScale(cytotoxicityThreshold), x2: xScale(cytotoxicityThreshold),
          y1: MARGIN.top, y2: HEIGHT - MARGIN.bottom,
          stroke: "var(--color-danger)", "stroke-width": 1.5, "stroke-dasharray": "5,4"
        }));
      }

      // axes
      const xAxis = SvgUtils.axis({
        scale: xScale, ticks: SvgUtils.logTicks(doseRange), orientation: "bottom",
        tickFormat: (v) => v >= 1 ? String(Math.round(v)) : v.toFixed(2)
      });
      xAxis.setAttribute("transform", `translate(0, ${HEIGHT - MARGIN.bottom})`);
      svg.appendChild(xAxis);
      const yAxis = SvgUtils.axis({ scale: yScale, ticks: SvgUtils.niceLinearTicks([yMin, yMax], 6), orientation: "left" });
      yAxis.setAttribute("transform", `translate(${MARGIN.left}, 0)`);
      svg.appendChild(yAxis);

      svg.appendChild(SvgUtils.svgEl("text", { x: WIDTH / 2, y: HEIGHT - 8, "text-anchor": "middle", class: "svg-axis-label" }, ["Dose (log scale)"]));
      svg.appendChild(SvgUtils.svgEl("text", {
        x: 14, y: HEIGHT / 2, "text-anchor": "middle", class: "svg-axis-label",
        transform: `rotate(-90, 14, ${HEIGHT / 2})`
      }, ["Response"]));

      // true curve
      const pathD = smoothDoses.map((d, i) => `${i === 0 ? "M" : "L"} ${xScale(d)} ${yScale(smoothTrue[i])}`).join(" ");
      svg.appendChild(SvgUtils.svgEl("path", { d: pathD, fill: "none", stroke: "var(--color-primary)", "stroke-width": 2.5 }));

      // replicate scatter
      simResult.forEach((r) => {
        r.replicateValues.forEach((val) => {
          svg.appendChild(SvgUtils.svgEl("circle", {
            cx: xScale(r.dose), cy: yScale(val), r: 4,
            fill: "var(--color-accent)", "fill-opacity": "0.75"
          }));
        });
      });

      chartWrap.innerHTML = "";
      chartWrap.appendChild(svg);

      readouts.innerHTML = "";
      const cytotoxAtMaxDose = DoseResponseModel.cytotoxicityFraction(doseRange[1], cytotoxicityThreshold) > 0.5;
      [
        ["Configured EC50", MathUtils.formatNumber(params.ec50, 2)],
        ["Cytotoxicity past threshold?", cytotoxAtMaxDose ? "Yes, within tested range" : "Not within tested range"],
        ["Response shape", SHAPE_LABELS[shape]]
      ].forEach(([label, value]) => {
        const tile = document.createElement("div");
        tile.className = "dr-readout-tile";
        tile.innerHTML = `<span class="dr-readout-tile__label">${label}</span><span class="dr-readout-tile__value">${value}</span>`;
        readouts.appendChild(tile);
      });

      shapeNote.textContent = shape === "cytotoxicity"
        ? "In this mode the true target-specific response is flat — any rise you see is a nonspecific cytotoxic-stress artifact past the threshold, not a real target effect."
        : "The shaded red region marks doses past the cytotoxicity threshold, where any observed response becomes harder to interpret as target-specific.";
    }

    update();
  }
});
