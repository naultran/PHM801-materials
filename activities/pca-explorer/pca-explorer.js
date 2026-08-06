/**
 * Activity 9 — PCA / Dimensionality Reduction Explorer.
 * Data: ../../data/pca-explorer.json (genes tagged 'biology'/'batch'/'noise',
 * samples tagged by treatment AND batch, matrix[sample][gene])
 * Teaching point: what a principal component "means" depends on which genes
 * are included — by default here, a technical batch effect is deliberately
 * stronger than the real biological effect and dominates PC1 until the
 * batch-sensitive genes are excluded.
 */

const KIND_NOTE = {
  biology: "biology-responsive",
  batch: "batch-sensitive",
  noise: "no structure"
};

const GROUP_COLORS = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)"];

function easeInOutQuad(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

ActivityShell.init({
  rootId: "activity-root",
  title: "PCA / Dimensionality Reduction Explorer",
  dataUrl: "../../data/pca-explorer.json",
  defaultSeed: 8002,
  instructions:
    "This PCA recomputes live as you change genes, standardization, or noise. By default a technical " +
    "batch effect is stronger than the real treatment effect — see if you can tell from PC1 alone, then " +
    "use \"Color by\" and the loadings panel to check your answer.",

  render(data, { rng, container }) {
    const allGenes = data.genes;
    const samples = data.samples;
    const baseMatrix = data.matrix; // [sampleIndex][geneIndex]

    const includedGenes = new Set(allGenes.map((g) => g.id));
    const noisePattern = samples.map(() => allGenes.map(() => rng.gaussian(0, 1)));
    const adjustments = {}; // "geneId|sampleId" -> delta

    let standardize = false;
    let colorBy = "treatment";
    let noiseAmplitude = 0;
    let onlyHVG = false;
    let pcX = 0, pcY = 1;

    const layout = document.createElement("div");
    layout.className = "pca-layout";
    container.appendChild(layout);
    const controls = document.createElement("div");
    const plotCol = document.createElement("div");
    const loadingsCol = document.createElement("div");
    layout.appendChild(controls);
    layout.appendChild(plotCol);
    layout.appendChild(loadingsCol);

    // ---- controls ----
    function checkboxRow(label, checked, onChange) {
      const row = document.createElement("label");
      row.className = "control-row";
      row.style.display = "flex"; row.style.alignItems = "center"; row.style.gap = "6px";
      const cb = document.createElement("input");
      cb.type = "checkbox"; cb.checked = checked;
      cb.addEventListener("change", () => onChange(cb.checked));
      row.appendChild(cb);
      row.append(" " + label);
      return row;
    }
    function selectRow(labelText, options, initial, onChange) {
      const row = document.createElement("div");
      row.className = "control-row";
      const label = document.createElement("label");
      label.className = "field-label"; label.textContent = labelText;
      const select = document.createElement("select");
      select.className = "touch-target";
      options.forEach(([val, text]) => { const o = document.createElement("option"); o.value = val; o.textContent = text; select.appendChild(o); });
      select.value = initial;
      select.addEventListener("change", () => onChange(select.value));
      row.appendChild(label); row.appendChild(select);
      row.selectEl = select;
      return row;
    }

    controls.appendChild(selectRow("Color by", [["treatment", "Treatment"], ["batch", "Batch"]], colorBy, (v) => { colorBy = v; update(false); }));
    const pcCount = Math.min(allGenes.length, samples.length);
    const pcOptions = Array.from({ length: pcCount }, (_, i) => [String(i), `PC${i + 1}`]);
    controls.appendChild(selectRow("Horizontal axis", pcOptions, "0", (v) => { pcX = Number(v); update(true); }));
    controls.appendChild(selectRow("Vertical axis", pcOptions, "1", (v) => { pcY = Number(v); update(true); }));
    controls.appendChild(checkboxRow("Standardize (divide by SD)", standardize, (v) => { standardize = v; update(true); }));
    controls.appendChild(checkboxRow("Only highly-variable genes (top 6)", onlyHVG, (v) => { onlyHVG = v; update(true); }));

    const noiseRow = document.createElement("div");
    noiseRow.className = "control-row";
    const noiseLabel = document.createElement("label"); noiseLabel.className = "field-label"; noiseLabel.textContent = "Measurement noise";
    const noiseSlider = document.createElement("input");
    noiseSlider.type = "range"; noiseSlider.min = "0"; noiseSlider.max = "3"; noiseSlider.step = "0.1"; noiseSlider.value = "0";
    noiseSlider.addEventListener("input", () => { noiseAmplitude = Number(noiseSlider.value); update(true); });
    noiseRow.appendChild(noiseLabel); noiseRow.appendChild(noiseSlider);
    controls.appendChild(noiseRow);

    const geneHeading = document.createElement("p");
    geneHeading.className = "field-label";
    geneHeading.textContent = "Genes included";
    controls.appendChild(geneHeading);
    const geneChecklist = document.createElement("div");
    geneChecklist.className = "pca-checklist";
    allGenes.forEach((g) => {
      const label = document.createElement("label");
      const cb = document.createElement("input");
      cb.type = "checkbox"; cb.checked = true;
      cb.addEventListener("change", () => {
        if (cb.checked) includedGenes.add(g.id); else includedGenes.delete(g.id);
        update(true);
      });
      label.appendChild(cb);
      label.append(` ${g.label} (${KIND_NOTE[g.kind]})`);
      geneChecklist.appendChild(label);
    });
    controls.appendChild(geneChecklist);

    // nudge one value
    const nudgeHeading = document.createElement("p");
    nudgeHeading.className = "field-label";
    nudgeHeading.textContent = "Change one gene's expression (one sample)";
    controls.appendChild(nudgeHeading);
    const geneSelect = document.createElement("select"); geneSelect.className = "touch-target";
    allGenes.forEach((g) => { const o = document.createElement("option"); o.value = g.id; o.textContent = g.label; geneSelect.appendChild(o); });
    const sampleSelect = document.createElement("select"); sampleSelect.className = "touch-target";
    samples.forEach((s) => { const o = document.createElement("option"); o.value = s.id; o.textContent = s.label; sampleSelect.appendChild(o); });
    const deltaSlider = document.createElement("input");
    deltaSlider.type = "range"; deltaSlider.min = "-6"; deltaSlider.max = "6"; deltaSlider.step = "0.5"; deltaSlider.value = "0";
    deltaSlider.addEventListener("input", () => {
      adjustments[`${geneSelect.value}|${sampleSelect.value}`] = Number(deltaSlider.value);
      update(true);
    });
    controls.appendChild(geneSelect);
    controls.appendChild(sampleSelect);
    controls.appendChild(deltaSlider);

    // ---- plot area ----
    const plotHeading = document.createElement("h4");
    plotHeading.textContent = "Sample scores";
    plotCol.appendChild(plotHeading);
    // The scatter plot itself is unlabeled SVG dots — this stays in sync as
    // a plain-text stand-in, set once per completed layout (not once per
    // animation frame, which would spam a screen reader mid-transition).
    const scatterDescription = document.createElement("p");
    scatterDescription.setAttribute("aria-live", "polite");
    plotCol.appendChild(scatterDescription);
    const plotWrap = document.createElement("div");
    plotCol.appendChild(plotWrap);
    const legend = document.createElement("div");
    legend.className = "pca-legend";
    plotCol.appendChild(legend);
    const varianceNote = document.createElement("p");
    varianceNote.style.fontSize = "var(--font-size-sm)";
    varianceNote.style.color = "var(--color-text-muted)";
    varianceNote.setAttribute("aria-live", "polite");
    plotCol.appendChild(varianceNote);

    const loadingsHeading = document.createElement("h4");
    loadingsHeading.textContent = "What drives this axis?";
    loadingsCol.appendChild(loadingsHeading);
    const loadingsWrap = document.createElement("div");
    loadingsWrap.setAttribute("aria-live", "polite");
    loadingsCol.appendChild(loadingsWrap);

    const W = 460, H = 420, M = 40;

    function currentGeneSet() {
      let genes = allGenes.filter((g) => includedGenes.has(g.id));
      if (onlyHVG && genes.length > 6) {
        const withVar = genes.map((g) => {
          const gi = allGenes.indexOf(g);
          const values = samples.map((_, si) => baseMatrix[si][gi]);
          return { g, variance: MathUtils.variance(values) };
        });
        withVar.sort((a, b) => b.variance - a.variance);
        genes = withVar.slice(0, 6).map((x) => x.g);
      }
      return genes;
    }

    function buildMatrix(genes) {
      return samples.map((s, si) => genes.map((g) => {
        const gi = allGenes.indexOf(g);
        const key = `${g.id}|${s.id}`;
        return baseMatrix[si][gi] + noiseAmplitude * noisePattern[si][gi] + (adjustments[key] || 0);
      }));
    }

    let prevScores = null; // sampleId -> [pcX, pcY] from the last completed layout
    let animFrame = null;
    let fallbackTimer = null;

    function groupsForColorBy() {
      const values = [...new Set(samples.map((s) => s[colorBy]))];
      return values;
    }

    function drawFrame(genes, result, interpScores) {
      const groups = groupsForColorBy();
      const colorForSample = (s) => GROUP_COLORS[groups.indexOf(s[colorBy]) % GROUP_COLORS.length];

      const xs = interpScores.map((p) => p[0]);
      const ys = interpScores.map((p) => p[1]);
      const xMax = Math.max(1e-6, ...xs.map(Math.abs));
      const yMax = Math.max(1e-6, ...ys.map(Math.abs));
      const xScale = SvgUtils.linearScale([-xMax * 1.2, xMax * 1.2], [M, W - M]);
      const yScale = SvgUtils.linearScale([-yMax * 1.2, yMax * 1.2], [H - M, M]);

      const svg = SvgUtils.svgEl("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}` });
      svg.appendChild(SvgUtils.svgEl("line", { x1: M, x2: W - M, y1: yScale(0), y2: yScale(0), stroke: "var(--color-border)" }));
      svg.appendChild(SvgUtils.svgEl("line", { x1: xScale(0), x2: xScale(0), y1: M, y2: H - M, stroke: "var(--color-border)" }));
      svg.appendChild(SvgUtils.svgEl("text", { x: W / 2, y: H - 8, "text-anchor": "middle", class: "svg-axis-label" }, [`PC${pcX + 1}`]));
      svg.appendChild(SvgUtils.svgEl("text", {
        x: 12, y: H / 2, "text-anchor": "middle", class: "svg-axis-label", transform: `rotate(-90, 12, ${H / 2})`
      }, [`PC${pcY + 1}`]));

      samples.forEach((s, i) => {
        svg.appendChild(SvgUtils.svgEl("circle", {
          cx: xScale(interpScores[i][0]), cy: yScale(interpScores[i][1]), r: 6,
          fill: colorForSample(s), stroke: "var(--color-surface)", "stroke-width": 1.5
        }));
      });

      plotWrap.innerHTML = "";
      plotWrap.appendChild(svg);

      legend.innerHTML = "";
      groups.forEach((g, i) => {
        const item = document.createElement("span");
        item.className = "pca-legend-item";
        item.innerHTML = `<span class="pca-legend-swatch" style="background:${GROUP_COLORS[i % GROUP_COLORS.length]}"></span>${g}`;
        legend.appendChild(item);
      });

      varianceNote.textContent = `PC${pcX + 1} explains ${MathUtils.formatNumber(result.explainedVarianceRatio[pcX] * 100, 1)}% of variance; ` +
        `PC${pcY + 1} explains ${MathUtils.formatNumber(result.explainedVarianceRatio[pcY] * 100, 1)}%.`;

      // loadings panel for pcX
      loadingsWrap.innerHTML = "";
      const loadings = genes.map((g, i) => ({ gene: g, value: result.loadings[pcX][i] }));
      loadings.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
      const maxAbs = Math.max(...loadings.map((l) => Math.abs(l.value)), 1e-6);
      loadings.forEach((l) => {
        const row = document.createElement("div");
        row.className = "pca-loadings-row";
        const label = document.createElement("span");
        label.className = "pca-loadings-row__label";
        label.textContent = l.gene.label;
        const barWrap = document.createElement("div");
        barWrap.className = "pca-loadings-row__bar-wrap";
        const bar = document.createElement("div");
        bar.className = "pca-loadings-row__bar";
        bar.style.width = `${(Math.abs(l.value) / maxAbs) * 100}%`;
        bar.style.background = l.value >= 0 ? "var(--color-primary)" : "var(--color-accent)";
        barWrap.appendChild(bar);
        row.appendChild(label);
        row.appendChild(barWrap);
        loadingsWrap.appendChild(row);
      });
    }

    function update(recompute) {
      const genes = currentGeneSet();
      if (genes.length < 2) {
        plotWrap.innerHTML = "<p>Include at least 2 genes to compute PCA.</p>";
        loadingsWrap.innerHTML = "";
        return;
      }
      const matrix = buildMatrix(genes);
      const result = PCA.runPCA(matrix, { standardize });
      const newScores = result.scores.map((row) => [row[pcX] || 0, row[pcY] || 0]);

      // Set once per completed layout (not per animation frame) so this
      // doesn't spam a screen reader mid-transition.
      const groups = groupsForColorBy();
      scatterDescription.textContent =
        `Scatter plot of ${samples.length} samples on PC${pcX + 1} vs PC${pcY + 1}, colored by ${colorBy} ` +
        `(${groups.length} groups: ${groups.join(", ")}). See the loadings panel below for which genes drive ` +
        `each axis.`;

      if (animFrame) cancelAnimationFrame(animFrame);
      if (fallbackTimer) clearTimeout(fallbackTimer);
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (!prevScores || !recompute || reducedMotion || prevScores.length !== newScores.length) {
        drawFrame(genes, result, newScores);
        prevScores = newScores;
        return;
      }

      const startScores = prevScores;
      const duration = 500;
      const startTime = performance.now();
      let settled = false;

      function finish() {
        if (settled) return;
        settled = true;
        cancelAnimationFrame(animFrame);
        clearTimeout(fallbackTimer);
        drawFrame(genes, result, newScores);
        prevScores = newScores;
      }

      function step(now) {
        const t = MathUtils.clamp((now - startTime) / duration, 0, 1);
        const eased = easeInOutQuad(t);
        const interp = newScores.map((p, i) => [
          startScores[i][0] + (p[0] - startScores[i][0]) * eased,
          startScores[i][1] + (p[1] - startScores[i][1]) * eased
        ]);
        drawFrame(genes, result, interp);
        if (t < 1) {
          animFrame = requestAnimationFrame(step);
        } else {
          finish();
        }
      }
      animFrame = requestAnimationFrame(step);
      // requestAnimationFrame is throttled or never fires on a backgrounded/
      // non-visible tab (or a paused/off-screen lecture slide) — this
      // fallback guarantees the final state still renders instead of
      // silently going stale until the tab regains focus.
      fallbackTimer = setTimeout(finish, duration + 150);
    }

    update(false);
  }
});
