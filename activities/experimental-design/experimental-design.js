/**
 * Activity 7 — Experimental Design & Statistical Power.
 * Data: ../../data/experimental-design.json (defaults for gene count,
 * variability, effect size, %DE, replicate count, alpha)
 * Teaching point: replicate count, variability, effect size, and multiple
 * testing correction jointly determine what a study can actually detect —
 * and identical designs still produce somewhat different results each run.
 */

function runExperiment({ geneCount, baselineMean, variabilitySd, effectSizeMean, pctDE, n, seed }) {
  const localRng = PRNG.createRNG(seed);
  const genes = [];
  for (let i = 0; i < geneCount; i++) {
    const isDE = localRng.random() < pctDE;
    const sign = localRng.random() < 0.5 ? -1 : 1;
    const trueLog2FC = isDE ? sign * Math.abs(localRng.gaussian(effectSizeMean, effectSizeMean * 0.25 || 0.1)) : 0;
    const groupA = Array.from({ length: n }, () => baselineMean + localRng.gaussian(0, variabilitySd));
    const groupB = Array.from({ length: n }, () => baselineMean + trueLog2FC + localRng.gaussian(0, variabilitySd));
    const test = StatsUtils.welchTTest(groupA, groupB);
    genes.push({
      id: i, isDE, trueLog2FC,
      observedLog2FC: MathUtils.mean(groupB) - MathUtils.mean(groupA),
      p: test.p
    });
  }
  const qValues = StatsUtils.benjaminiHochberg(genes.map((g) => g.p));
  genes.forEach((g, i) => { g.q = qValues[i]; });
  return genes;
}

ActivityShell.init({
  rootId: "activity-root",
  title: "Experimental Design & Statistical Power",
  dataUrl: "../../data/experimental-design.json",
  defaultSeed: 2024,
  instructions:
    "Each gene here has a randomly assigned true effect (most genes are truly unaffected). Adjust the " +
    "design, then see how many of the truly-affected genes you actually detect after FDR correction. " +
    "Press Reseed to rerun the identical design with a fresh random draw.",

  render(data, { rng, container }) {
    let geneCount = data.defaultGeneCount;
    let variabilitySd = data.defaultVariabilitySd;
    let effectSizeMean = data.defaultEffectSizeMean;
    let pctDE = data.defaultPctDE;
    let n = data.defaultN;
    let alpha = data.defaultAlpha;
    let experimentSeed = rng.int(0, 1e9);

    const layout = document.createElement("div");
    layout.className = "ed-layout";
    container.appendChild(layout);
    const controls = document.createElement("div");
    const resultsCol = document.createElement("div");
    layout.appendChild(controls);
    layout.appendChild(resultsCol);

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
      valueEl.textContent = (formatFn || String)(value);
      input.addEventListener("input", () => {
        const v = Number(input.value);
        valueEl.textContent = (formatFn || String)(v);
        onInput(v);
      });
      row.appendChild(label); row.appendChild(input); row.appendChild(valueEl);
      return row;
    }

    controls.appendChild(sliderRow("Replicates per group (n)", data.nRange[0], data.nRange[1], 1, n, (v) => { n = Math.round(v); update(); }));
    controls.appendChild(sliderRow("Genes measured", data.geneCountRange[0], data.geneCountRange[1], 10, geneCount, (v) => { geneCount = Math.round(v); update(); }));
    controls.appendChild(sliderRow("% of genes truly affected", 1, 50, 1, pctDE * 100, (v) => { pctDE = v / 100; update(); }, (v) => `${Math.round(v)}%`));
    controls.appendChild(sliderRow("True effect size", data.effectSizeRange[0], data.effectSizeRange[1], 0.05, effectSizeMean, (v) => { effectSizeMean = v; update(); }));
    controls.appendChild(sliderRow("Variability (biological + technical)", data.variabilitySdRange[0], data.variabilitySdRange[1], 0.05, variabilitySd, (v) => { variabilitySd = v; update(); }));
    controls.appendChild(sliderRow("FDR threshold (alpha)", 0.01, 0.2, 0.01, alpha, (v) => { alpha = v; update(); }));

    const reseedBtn = document.createElement("button");
    reseedBtn.type = "button"; reseedBtn.className = "touch-target";
    reseedBtn.textContent = "Reseed (new random draw, same design)";
    reseedBtn.addEventListener("click", () => { experimentSeed = Math.floor(Math.random() * 1e9); update(); });
    controls.appendChild(reseedBtn);

    const note = document.createElement("p");
    note.style.fontSize = "var(--font-size-sm)";
    note.style.color = "var(--color-text-muted)";
    note.textContent = "\"Variability\" combines biological and technical noise into one control here, to keep the " +
      "panel simple — see TECHNICAL-LIMITS.md for why they're not modeled separately.";
    controls.appendChild(note);

    const summaryRow = document.createElement("div");
    summaryRow.className = "ed-summary-row";
    resultsCol.appendChild(summaryRow);

    const chartsWrap = document.createElement("div");
    chartsWrap.className = "ed-charts";
    resultsCol.appendChild(chartsWrap);
    const volcanoWrap = document.createElement("div");
    const powerWrap = document.createElement("div");
    const volcanoHeading = document.createElement("h4"); volcanoHeading.textContent = "Volcano plot";
    const powerHeading = document.createElement("h4"); powerHeading.textContent = "Estimated power vs. replicate count";
    volcanoWrap.appendChild(volcanoHeading);
    powerWrap.appendChild(powerHeading);
    chartsWrap.appendChild(volcanoWrap);
    chartsWrap.appendChild(powerWrap);

    const W = 420, H = 340, M = { top: 15, right: 15, bottom: 45, left: 50 };

    function drawVolcano(genes) {
      const xVals = genes.map((g) => g.observedLog2FC);
      const yVals = genes.map((g) => -Math.log10(Math.max(g.p, 1e-12)));
      const xMax = Math.max(1, ...xVals.map(Math.abs));
      const yMax = Math.max(1, ...yVals) * 1.1;
      const xScale = SvgUtils.linearScale([-xMax, xMax], [M.left, W - M.right]);
      const yScale = SvgUtils.linearScale([0, yMax], [H - M.bottom, M.top]);

      const svg = SvgUtils.svgEl("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}` });
      const xAxis = SvgUtils.axis({ scale: xScale, ticks: SvgUtils.niceLinearTicks([-xMax, xMax], 5), orientation: "bottom" });
      xAxis.setAttribute("transform", `translate(0, ${H - M.bottom})`);
      svg.appendChild(xAxis);
      const yAxis = SvgUtils.axis({ scale: yScale, ticks: SvgUtils.niceLinearTicks([0, yMax], 5), orientation: "left" });
      yAxis.setAttribute("transform", `translate(${M.left}, 0)`);
      svg.appendChild(yAxis);
      svg.appendChild(SvgUtils.svgEl("text", { x: W / 2, y: H - 8, "text-anchor": "middle", class: "svg-axis-label" }, ["log2 fold change"]));
      svg.appendChild(SvgUtils.svgEl("text", {
        x: 12, y: H / 2, "text-anchor": "middle", class: "svg-axis-label", transform: `rotate(-90, 12, ${H / 2})`
      }, ["-log10(p)"]));

      genes.forEach((g) => {
        const significant = g.q < alpha;
        svg.appendChild(SvgUtils.svgEl("circle", {
          cx: xScale(g.observedLog2FC), cy: yScale(-Math.log10(Math.max(g.p, 1e-12))), r: significant ? 3.5 : 2.5,
          fill: significant ? "var(--color-accent)" : "none",
          stroke: significant ? "none" : "var(--color-neutral)",
          "fill-opacity": "0.8", "stroke-opacity": "0.5"
        }));
      });
      volcanoWrap.querySelector("svg")?.remove();
      volcanoWrap.appendChild(svg);
    }

    function drawPowerCurve(currentN) {
      const nMin = data.nRange[0], nMax = data.nRange[1];
      const ns = MathUtils.linspace(nMin, nMax, nMax - nMin + 1);
      const powers = ns.map((nn) => StatsUtils.estimatePower(effectSizeMean, variabilitySd, nn, alpha));
      const xScale = SvgUtils.linearScale([nMin, nMax], [M.left, W - M.right]);
      const yScale = SvgUtils.linearScale([0, 1], [H - M.bottom, M.top]);

      const svg = SvgUtils.svgEl("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}` });
      const xAxis = SvgUtils.axis({ scale: xScale, ticks: SvgUtils.niceLinearTicks([nMin, nMax], 6), orientation: "bottom" });
      xAxis.setAttribute("transform", `translate(0, ${H - M.bottom})`);
      svg.appendChild(xAxis);
      const yAxis = SvgUtils.axis({ scale: yScale, ticks: [0, 0.2, 0.4, 0.6, 0.8, 1], orientation: "left" });
      yAxis.setAttribute("transform", `translate(${M.left}, 0)`);
      svg.appendChild(yAxis);
      svg.appendChild(SvgUtils.svgEl("text", { x: W / 2, y: H - 8, "text-anchor": "middle", class: "svg-axis-label" }, ["replicates per group (n)"]));
      svg.appendChild(SvgUtils.svgEl("text", {
        x: 12, y: H / 2, "text-anchor": "middle", class: "svg-axis-label", transform: `rotate(-90, 12, ${H / 2})`
      }, ["estimated power"]));

      const pathD = ns.map((nn, i) => `${i === 0 ? "M" : "L"} ${xScale(nn)} ${yScale(powers[i])}`).join(" ");
      svg.appendChild(SvgUtils.svgEl("path", { d: pathD, fill: "none", stroke: "var(--color-primary)", "stroke-width": 2.5 }));
      svg.appendChild(SvgUtils.svgEl("line", {
        x1: xScale(currentN), x2: xScale(currentN), y1: M.top, y2: H - M.bottom,
        stroke: "var(--color-accent)", "stroke-width": 1.5, "stroke-dasharray": "4,3"
      }));

      powerWrap.querySelector("svg")?.remove();
      powerWrap.appendChild(svg);
    }

    function update() {
      const genes = runExperiment({ geneCount, baselineMean: data.baselineMean, variabilitySd, effectSizeMean, pctDE, n, seed: experimentSeed });
      const truePositive = genes.filter((g) => g.isDE && g.q < alpha).length;
      const falsePositive = genes.filter((g) => !g.isDE && g.q < alpha).length;
      const falseNegative = genes.filter((g) => g.isDE && g.q >= alpha).length;
      const trueDECount = genes.filter((g) => g.isDE).length;
      const estPower = StatsUtils.estimatePower(effectSizeMean, variabilitySd, n, alpha);

      summaryRow.innerHTML = "";
      [
        ["True positives", `${truePositive} / ${trueDECount}`],
        ["False positives", String(falsePositive)],
        ["False negatives", String(falseNegative)],
        ["Estimated power", MathUtils.formatNumber(estPower, 2)]
      ].forEach(([label, value]) => {
        const tile = document.createElement("div");
        tile.className = "ed-summary-tile";
        tile.innerHTML = `<span class="ed-summary-tile__label">${label}</span><span class="ed-summary-tile__value">${value}</span>`;
        summaryRow.appendChild(tile);
      });

      drawVolcano(genes);
      drawPowerCurve(n);
    }

    update();
  }
});
