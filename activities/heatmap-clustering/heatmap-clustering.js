/**
 * Activity 2 — Dynamic Heatmap & Hierarchical Clustering.
 * Data: ../../data/heatmap-clustering.json (genes, samples, matrix[gene][sample])
 * Teaching point: clustering depends on the measured values, which genes/
 * samples are included, preprocessing (z-score), and the distance/linkage
 * choice — not some fixed property of the samples.
 */

function lerpColor(c1, c2, t) {
  return c1.map((v, i) => Math.round(v + (c2[i] - v) * t));
}
function divergingColor(t) {
  t = MathUtils.clamp(t, -1, 1);
  const rgb = t < 0
    ? lerpColor([27, 58, 92], [255, 255, 255], t + 1)
    : lerpColor([255, 255, 255], [181, 101, 29], t);
  return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
}

ActivityShell.init({
  rootId: "activity-root",
  title: "Dynamic Heatmap & Hierarchical Clustering",
  dataUrl: "../../data/heatmap-clustering.json",
  defaultSeed: 7001,
  instructions:
    "This heatmap re-clusters live as you change settings. Toggle genes/samples in or out, add noise, " +
    "switch to row z-scores, or change the distance metric and linkage — then compare with \"Freeze " +
    "sample order\" on and off to see the difference between values changing and relationships changing.",

  render(data, { rng, container }) {
    const allGenes = data.genes;
    const allSamples = data.samples;
    const baseMatrix = data.matrix; // [geneIndex][sampleIndex]

    const includedGenes = new Set(allGenes.map((g) => g.id));
    const includedSamples = new Set(allSamples.map((s) => s.id));
    const noisePattern = allGenes.map((g, gi) => allSamples.map((s, si) => rng.gaussian(0, 1)));

    let noiseAmplitude = 0;
    let useZScore = false;
    let distanceMetric = "euclidean";
    let linkage = "average";
    let freezeOrder = false;
    let frozenState = null; // { leafOrder: [sampleId,...] }
    let selectedSampleId = null;
    const adjustments = {}; // "geneId|sampleId" -> delta

    const layout = document.createElement("div");
    layout.className = "hm-layout";
    container.appendChild(layout);

    const controls = document.createElement("div");
    controls.className = "hm-controls";
    layout.appendChild(controls);

    const chartArea = document.createElement("div");
    layout.appendChild(chartArea);

    // ---- controls: analysis settings ----
    const settingsFieldset = document.createElement("fieldset");
    settingsFieldset.className = "control-group";
    settingsFieldset.innerHTML = "<legend>Analysis settings</legend>";

    function labeledSelect(labelText, options, initial, onChange) {
      const wrap = document.createElement("div");
      wrap.className = "control-row";
      const label = document.createElement("label");
      label.className = "field-label";
      label.textContent = labelText;
      const select = document.createElement("select");
      select.className = "touch-target";
      options.forEach(([val, text]) => {
        const opt = document.createElement("option");
        opt.value = val; opt.textContent = text;
        select.appendChild(opt);
      });
      select.value = initial;
      select.addEventListener("change", () => onChange(select.value));
      wrap.appendChild(label);
      wrap.appendChild(select);
      wrap.selectEl = select;
      return wrap;
    }

    const distanceRow = labeledSelect("Distance metric", [
      ["euclidean", "Euclidean"], ["correlation", "1 - Pearson correlation"], ["cosine", "1 - Cosine similarity"]
    ], distanceMetric, (v) => { distanceMetric = v; update(); });
    settingsFieldset.appendChild(distanceRow);

    const linkageRow = labeledSelect("Linkage", [
      ["average", "Average (UPGMA)"], ["single", "Single"], ["complete", "Complete"]
    ], linkage, (v) => { linkage = v; update(); });
    settingsFieldset.appendChild(linkageRow);

    const zscoreRow = document.createElement("div");
    zscoreRow.className = "control-row";
    const zscoreLabel = document.createElement("label");
    const zscoreCheckbox = document.createElement("input");
    zscoreCheckbox.type = "checkbox";
    zscoreCheckbox.addEventListener("change", () => { useZScore = zscoreCheckbox.checked; update(); });
    zscoreLabel.appendChild(zscoreCheckbox);
    zscoreLabel.append(" Use row z-scores (instead of raw values)");
    zscoreRow.appendChild(zscoreLabel);
    settingsFieldset.appendChild(zscoreRow);

    const freezeRow = document.createElement("div");
    freezeRow.className = "control-row";
    const freezeLabel = document.createElement("label");
    const freezeCheckbox = document.createElement("input");
    freezeCheckbox.type = "checkbox";
    freezeCheckbox.addEventListener("change", () => {
      freezeOrder = freezeCheckbox.checked;
      if (!freezeOrder) frozenState = null;
      update();
    });
    freezeLabel.appendChild(freezeCheckbox);
    freezeLabel.append(" Freeze sample order (colors update, columns stay put)");
    freezeRow.appendChild(freezeLabel);
    settingsFieldset.appendChild(freezeRow);

    const noiseRow = document.createElement("div");
    noiseRow.className = "control-row";
    const noiseLabel = document.createElement("label");
    noiseLabel.className = "field-label";
    noiseLabel.textContent = "Measurement noise";
    const noiseSlider = document.createElement("input");
    noiseSlider.type = "range"; noiseSlider.min = "0"; noiseSlider.max = "2"; noiseSlider.step = "0.1"; noiseSlider.value = "0";
    noiseSlider.addEventListener("input", () => { noiseAmplitude = Number(noiseSlider.value); update(); });
    noiseRow.appendChild(noiseLabel);
    noiseRow.appendChild(noiseSlider);
    settingsFieldset.appendChild(noiseRow);
    controls.appendChild(settingsFieldset);

    // ---- controls: nudge a single value ----
    const nudgeFieldset = document.createElement("fieldset");
    nudgeFieldset.className = "control-group";
    nudgeFieldset.innerHTML = "<legend>Nudge one value</legend>";
    const geneSelect = document.createElement("select");
    geneSelect.className = "touch-target";
    allGenes.forEach((g) => { const o = document.createElement("option"); o.value = g.id; o.textContent = g.label; geneSelect.appendChild(o); });
    const sampleSelectForNudge = document.createElement("select");
    sampleSelectForNudge.className = "touch-target";
    allSamples.forEach((s) => { const o = document.createElement("option"); o.value = s.id; o.textContent = s.label; sampleSelectForNudge.appendChild(o); });
    const deltaSlider = document.createElement("input");
    deltaSlider.type = "range"; deltaSlider.min = "-4"; deltaSlider.max = "4"; deltaSlider.step = "0.2"; deltaSlider.value = "0";
    const deltaValueEl = document.createElement("span");
    deltaValueEl.className = "control-row__value";
    deltaValueEl.textContent = "+0.0";
    function applyNudge() {
      const key = `${geneSelect.value}|${sampleSelectForNudge.value}`;
      adjustments[key] = Number(deltaSlider.value);
      deltaValueEl.textContent = (Number(deltaSlider.value) >= 0 ? "+" : "") + MathUtils.formatNumber(Number(deltaSlider.value), 1);
      update();
    }
    [geneSelect, sampleSelectForNudge].forEach((el) => el.addEventListener("change", () => {
      deltaSlider.value = String(adjustments[`${geneSelect.value}|${sampleSelectForNudge.value}`] || 0);
      deltaValueEl.textContent = (Number(deltaSlider.value) >= 0 ? "+" : "") + MathUtils.formatNumber(Number(deltaSlider.value), 1);
    }));
    deltaSlider.addEventListener("input", applyNudge);
    nudgeFieldset.appendChild(geneSelect);
    nudgeFieldset.appendChild(sampleSelectForNudge);
    const deltaRow = document.createElement("div");
    deltaRow.className = "control-row";
    deltaRow.appendChild(deltaSlider);
    deltaRow.appendChild(deltaValueEl);
    nudgeFieldset.appendChild(deltaRow);
    controls.appendChild(nudgeFieldset);

    // ---- controls: gene / sample inclusion ----
    const geneFieldset = document.createElement("fieldset");
    geneFieldset.className = "control-group";
    geneFieldset.innerHTML = "<legend>Genes included</legend>";
    const geneChecklist = document.createElement("div");
    geneChecklist.className = "hm-checklist";
    allGenes.forEach((g) => {
      const label = document.createElement("label");
      const cb = document.createElement("input");
      cb.type = "checkbox"; cb.checked = true;
      cb.addEventListener("change", () => {
        if (cb.checked) includedGenes.add(g.id); else includedGenes.delete(g.id);
        update();
      });
      label.appendChild(cb);
      label.append(" " + g.label);
      geneChecklist.appendChild(label);
    });
    geneFieldset.appendChild(geneChecklist);
    controls.appendChild(geneFieldset);

    const sampleFieldset = document.createElement("fieldset");
    sampleFieldset.className = "control-group";
    sampleFieldset.innerHTML = "<legend>Samples included</legend>";
    const sampleChecklist = document.createElement("div");
    sampleChecklist.className = "hm-checklist";
    allSamples.forEach((s) => {
      const label = document.createElement("label");
      const cb = document.createElement("input");
      cb.type = "checkbox"; cb.checked = true;
      cb.addEventListener("change", () => {
        if (cb.checked) includedSamples.add(s.id); else includedSamples.delete(s.id);
        update();
      });
      label.appendChild(cb);
      label.append(" " + s.label);
      sampleChecklist.appendChild(label);
    });
    sampleFieldset.appendChild(sampleChecklist);
    controls.appendChild(sampleFieldset);

    // ---- chart area ----
    const dendroSvg = SvgUtils.svgEl("svg", { class: "hm-dendro" });
    const heatmapSvg = SvgUtils.svgEl("svg", { class: "hm-heatmap" });
    const scrollWrap = document.createElement("div");
    scrollWrap.className = "hm-scroll";
    scrollWrap.appendChild(dendroSvg);
    scrollWrap.appendChild(heatmapSvg);
    chartArea.appendChild(scrollWrap);

    // The heatmap/dendrogram are plain SVG shapes with no text content, so a
    // screen reader has nothing to read from them directly. This paragraph
    // is a live, always-current text description of the same clustering
    // result — sample order left-to-right doubles as the description, since
    // adjacent samples are exactly the ones the algorithm judged most alike.
    const clusterDescription = document.createElement("p");
    clusterDescription.className = "hm-cluster-description";
    clusterDescription.setAttribute("aria-live", "polite");
    chartArea.appendChild(clusterDescription);

    const legend = document.createElement("div");
    legend.className = "hm-legend";
    legend.innerHTML = '<span>Low</span><span class="hm-legend-swatch"></span><span>High</span>';
    chartArea.appendChild(legend);

    const infoPanel = document.createElement("div");
    infoPanel.className = "hm-info-panel";
    infoPanel.setAttribute("aria-live", "polite");
    infoPanel.textContent = "Click a sample label below the heatmap to see its nearest neighbor and the genes driving that similarity.";
    chartArea.appendChild(infoPanel);

    const CELL_W = 46, CELL_H = 24, LEFT_MARGIN = 170, TOP_MARGIN_DENDRO = 90, LABEL_MARGIN = 90;

    function currentGenes() { return allGenes.filter((g) => includedGenes.has(g.id)); }
    function currentSamples() { return allSamples.filter((s) => includedSamples.has(s.id)); }

    function buildDisplayMatrix() {
      const genes = currentGenes();
      const samples = currentSamples();
      let matrix = genes.map((g) => {
        const gi = allGenes.indexOf(g);
        return samples.map((s) => {
          const si = allSamples.indexOf(s);
          const key = `${g.id}|${s.id}`;
          return baseMatrix[gi][si] + noiseAmplitude * noisePattern[gi][si] + (adjustments[key] || 0);
        });
      });
      if (useZScore) matrix = MathUtils.zscoreRows(matrix);
      return { genes, samples, matrix };
    }

    function update() {
      const { genes, samples, matrix } = buildDisplayMatrix();
      if (genes.length === 0 || samples.length === 0) {
        heatmapSvg.innerHTML = ""; dendroSvg.innerHTML = "";
        infoPanel.textContent = "Include at least one gene and one sample to see the heatmap.";
        return;
      }

      const sampleVectors = MathUtils.transpose(matrix); // one vector per sample, across genes
      const D = Clustering.distanceMatrix(sampleVectors, distanceMetric);

      let leafOrderIds;
      let dendro = null;
      if (freezeOrder && frozenState && frozenState.leafOrder.every((id) => samples.some((s) => s.id === id))) {
        leafOrderIds = frozenState.leafOrder;
      } else {
        const clusterResult = Clustering.agglomerativeCluster(D, linkage);
        dendro = Clustering.dendrogramLayout(clusterResult, samples.map((s) => s.label));
        leafOrderIds = dendro.leafOrder.map((leafIdx) => samples[leafIdx].id);
        if (freezeOrder) frozenState = { leafOrder: leafOrderIds };
      }

      const orderedSamples = leafOrderIds.map((id) => samples.find((s) => s.id === id));
      const orderedSampleIdx = orderedSamples.map((s) => samples.indexOf(s));

      clusterDescription.textContent = freezeOrder
        ? `Sample order is frozen at: ${orderedSamples.map((s) => s.label).join(", ")}. ` +
          `Cell colors below reflect the current values, but columns will not reorder until you unfreeze.`
        : `Clustered sample order, most similar neighbors adjacent (${distanceMetric} distance, ${linkage} linkage): ` +
          `${orderedSamples.map((s) => s.label).join(", ")}.`;

      // ---- draw dendrogram (only meaningful when we actually have one this update) ----
      const width = LEFT_MARGIN + CELL_W * samples.length + 20;
      dendroSvg.setAttribute("width", width);
      dendroSvg.setAttribute("height", TOP_MARGIN_DENDRO);
      dendroSvg.innerHTML = "";
      if (dendro) {
        const g = SvgUtils.svgEl("g", { transform: `translate(${LEFT_MARGIN + CELL_W / 2}, 10)` });
        const maxHeight = dendro.root ? dendro.root.height : 1;
        const yScale = SvgUtils.linearScale([0, maxHeight || 1], [TOP_MARGIN_DENDRO - 20, 0]);
        dendro.edges.forEach((e) => {
          g.appendChild(SvgUtils.svgEl("line", {
            x1: e.x1 * CELL_W, x2: e.x2 * CELL_W,
            y1: yScale(e.y1), y2: yScale(e.y2),
            stroke: "var(--color-primary)", "stroke-width": 1.5
          }));
        });
        dendroSvg.appendChild(g);
      } else {
        const note = SvgUtils.svgEl("text", { x: LEFT_MARGIN, y: TOP_MARGIN_DENDRO / 2, class: "svg-axis-label" }, ["(order frozen — dendrogram not recomputed)"]);
        dendroSvg.appendChild(note);
      }

      // ---- draw heatmap ----
      const height = LABEL_MARGIN + CELL_H * genes.length + 10;
      heatmapSvg.setAttribute("width", width);
      heatmapSvg.setAttribute("height", height);
      heatmapSvg.innerHTML = "";

      const allValues = matrix.flat();
      const dataMin = Math.min(...allValues), dataMax = Math.max(...allValues);
      const mid = (dataMin + dataMax) / 2;
      const halfRange = Math.max((dataMax - dataMin) / 2, 1e-6);

      genes.forEach((gene, gi) => {
        heatmapSvg.appendChild(SvgUtils.svgEl("text", {
          x: LEFT_MARGIN - 8, y: gi * CELL_H + CELL_H / 2 + 4, "text-anchor": "end", class: "svg-axis-label"
        }, [gene.label]));
        orderedSampleIdx.forEach((si, ci) => {
          const value = matrix[gi][si];
          const t = (value - mid) / halfRange;
          const rect = SvgUtils.svgEl("rect", {
            x: LEFT_MARGIN + ci * CELL_W, y: gi * CELL_H, width: CELL_W - 2, height: CELL_H - 2,
            fill: divergingColor(t)
          });
          const titleEl = SvgUtils.svgEl("title", {}, [`${gene.label} × ${samples[si].label}: ${MathUtils.formatNumber(value, 2)}`]);
          rect.appendChild(titleEl);
          heatmapSvg.appendChild(rect);
        });
      });

      orderedSampleIdx.forEach((si, ci) => {
        const sample = samples[si];
        const label = SvgUtils.svgEl("text", {
          x: LEFT_MARGIN + ci * CELL_W + (CELL_W - 2) / 2, y: CELL_H * genes.length + 16,
          "text-anchor": "end", transform: `rotate(-45, ${LEFT_MARGIN + ci * CELL_W + (CELL_W - 2) / 2}, ${CELL_H * genes.length + 16})`,
          class: "svg-axis-label hm-sample-label" + (sample.id === selectedSampleId ? " is-selected" : ""),
          tabindex: "0", role: "button"
        }, [sample.label]);
        label.addEventListener("click", () => { selectedSampleId = sample.id; update(); });
        heatmapSvg.appendChild(label);
      });

      // ---- info panel ----
      if (selectedSampleId && samples.some((s) => s.id === selectedSampleId)) {
        const idx = samples.findIndex((s) => s.id === selectedSampleId);
        const nn = Clustering.nearestNeighbors(D)[idx];
        infoPanel.innerHTML = "";
        if (nn.index >= 0) {
          const nnSample = samples[nn.index];
          const p1 = document.createElement("p");
          p1.innerHTML = `<strong>${samples[idx].label}</strong>'s nearest neighbor is ` +
            `<strong>${nnSample.label}</strong> (distance ${MathUtils.formatNumber(nn.distance, 3)}).`;
          infoPanel.appendChild(p1);
          const contributing = Clustering.topContributingGenes(
            sampleVectors[idx], sampleVectors[nn.index], genes.map((g) => g.label), 3
          );
          const p2 = document.createElement("p");
          p2.textContent = "Genes most similar between them (smallest difference): " +
            contributing.map((c) => `${c.gene} (Δ${MathUtils.formatNumber(c.diff, 2)})`).join(", ");
          infoPanel.appendChild(p2);
        } else {
          infoPanel.textContent = "Only one sample is included — no neighbor to compare.";
        }
      }
    }

    update();

    return {
      reset() {
        includedGenes.clear(); allGenes.forEach((g) => includedGenes.add(g.id));
        includedSamples.clear(); allSamples.forEach((s) => includedSamples.add(s.id));
        Object.keys(adjustments).forEach((k) => delete adjustments[k]);
        noiseAmplitude = 0; useZScore = false; distanceMetric = "euclidean"; linkage = "average";
        freezeOrder = false; frozenState = null; selectedSampleId = null;
        geneChecklist.querySelectorAll("input").forEach((cb) => (cb.checked = true));
        sampleChecklist.querySelectorAll("input").forEach((cb) => (cb.checked = true));
        noiseSlider.value = "0"; zscoreCheckbox.checked = false; freezeCheckbox.checked = false;
        deltaSlider.value = "0"; deltaValueEl.textContent = "+0.0";
        distanceRow.selectEl.value = "euclidean";
        linkageRow.selectEl.value = "average";
        update();
      }
    };
  }
});
