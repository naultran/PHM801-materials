/**
 * Activity 4 — Bulk-Tissue Mixture Simulator.
 * Data: ../../data/mixture-simulator.json (genes with inflammatory/fibrotic
 * flags + activationGain, cellTypes with baseline signatures, a hidden target)
 * Teaching point: a bulk profile can shift either because cell *composition*
 * changed or because a cell type's *state* (activation) changed — the two are
 * easy to conflate without single-cell resolution.
 */

function effectiveSignature(cellType, activation, genes) {
  return cellType.signature.map((v, i) => {
    const g = genes[i];
    if (!(g.inflammatory || g.fibrotic)) return v;
    const gain = g.activationGain || 1;
    return v * (1 + activation * (gain - 1));
  });
}

function computeBulk(cellTypes, proportions, activations, genes) {
  const total = cellTypes.reduce((s, c) => s + Math.max(proportions[c.id], 0), 0) || 1;
  const bulk = new Array(genes.length).fill(0);
  cellTypes.forEach((c) => {
    const frac = Math.max(proportions[c.id], 0) / total;
    const eff = effectiveSignature(c, activations[c.id], genes);
    eff.forEach((v, i) => { bulk[i] += frac * v; });
  });
  return bulk;
}

function scoreFor(bulk, genes, flagKey) {
  const idx = genes.map((g, i) => (g[flagKey] ? i : -1)).filter((i) => i >= 0);
  if (idx.length === 0) return 0;
  return MathUtils.mean(idx.map((i) => bulk[i]));
}

function bar(label, value, maxValue, seriesClass) {
  const row = document.createElement("div");
  row.className = "mx-bar-row";
  const l = document.createElement("span"); l.className = "mx-bar-row__label"; l.textContent = label;
  const track = document.createElement("div"); track.className = "mx-bar-row__track";
  const fill = document.createElement("div"); fill.className = `mx-bar-row__fill ${seriesClass}`;
  fill.style.width = `${MathUtils.clamp((value / maxValue) * 100, 1, 100)}%`;
  track.appendChild(fill);
  const v = document.createElement("span"); v.className = "mx-bar-row__value"; v.textContent = MathUtils.formatNumber(value, 1);
  row.appendChild(l); row.appendChild(track); row.appendChild(v);
  return row;
}

ActivityShell.init({
  rootId: "activity-root",
  title: "Bulk-Tissue Mixture Simulator",
  dataUrl: "../../data/mixture-simulator.json",
  defaultSeed: 9090,
  instructions:
    "A bulk measurement mixes together every cell in the sample. Adjust each cell type's abundance AND " +
    "its activation state, and try to reproduce the mystery target profile — then reveal how it was " +
    "really built.",

  render(data, { rng, container }) {
    const genes = data.genes;
    const cellTypes = data.cellTypes;

    const proportions = {};
    const activations = {};
    cellTypes.forEach((c) => { proportions[c.id] = 25; activations[c.id] = 0; });

    const targetBulk = computeBulk(cellTypes, data.target.trueProportions, data.target.trueActivation, genes)
      .map((v) => v + rng.gaussian(0, data.target.noiseSd));

    const layout = document.createElement("div");
    layout.className = "mx-layout";
    container.appendChild(layout);
    const leftCol = document.createElement("div");
    const rightCol = document.createElement("div");
    layout.appendChild(leftCol);
    layout.appendChild(rightCol);

    // ---- presets ----
    const presetRow = document.createElement("div");
    presetRow.className = "mx-preset-row";
    const presetComposition = document.createElement("button");
    presetComposition.type = "button"; presetComposition.className = "touch-target";
    presetComposition.textContent = "Preset: more macrophages (composition only)";
    const presetActivation = document.createElement("button");
    presetActivation.type = "button"; presetActivation.className = "touch-target";
    presetActivation.textContent = "Preset: angrier macrophages (activation only)";
    presetRow.appendChild(presetComposition);
    presetRow.appendChild(presetActivation);
    leftCol.appendChild(presetRow);

    // ---- cell type controls ----
    const slidersByType = {};
    cellTypes.forEach((c) => {
      const box = document.createElement("div");
      box.className = "mx-celltype";
      const h = document.createElement("h4");
      h.textContent = c.label;
      box.appendChild(h);

      const propRow = document.createElement("div");
      propRow.className = "control-row";
      const propLabel = document.createElement("label");
      propLabel.className = "field-label";
      propLabel.textContent = "Relative abundance";
      const propSlider = document.createElement("input");
      propSlider.type = "range"; propSlider.min = "0"; propSlider.max = "100"; propSlider.step = "1";
      propSlider.value = String(proportions[c.id]);
      propRow.appendChild(propLabel); propRow.appendChild(propSlider);

      const actRow = document.createElement("div");
      actRow.className = "control-row";
      const actLabel = document.createElement("label");
      actLabel.className = "field-label";
      actLabel.textContent = "Activation state";
      const actSlider = document.createElement("input");
      actSlider.type = "range"; actSlider.min = "0"; actSlider.max = "1"; actSlider.step = "0.05";
      actSlider.value = String(activations[c.id]);
      actRow.appendChild(actLabel); actRow.appendChild(actSlider);

      propSlider.addEventListener("input", () => { proportions[c.id] = Number(propSlider.value); update(); });
      actSlider.addEventListener("input", () => { activations[c.id] = Number(actSlider.value); update(); });

      box.appendChild(propRow);
      box.appendChild(actRow);
      leftCol.appendChild(box);
      slidersByType[c.id] = { propSlider, actSlider };
    });

    // ---- results ----
    const scoreRow = document.createElement("div");
    scoreRow.className = "mx-score-row";
    rightCol.appendChild(scoreRow);

    const compositionHeading = document.createElement("h4");
    compositionHeading.textContent = "Cell composition (renormalized)";
    rightCol.appendChild(compositionHeading);
    const compositionChart = document.createElement("div");
    rightCol.appendChild(compositionChart);

    const bulkHeading = document.createElement("h4");
    bulkHeading.textContent = "Resulting bulk profile vs. mystery target";
    rightCol.appendChild(bulkHeading);
    const bulkChart = document.createElement("div");
    rightCol.appendChild(bulkChart);

    const revealMount = document.createElement("div");
    rightCol.appendChild(revealMount);

    function currentBulk() {
      return computeBulk(cellTypes, proportions, activations, genes);
    }

    function update() {
      const bulk = currentBulk();
      const total = cellTypes.reduce((s, c) => s + Math.max(proportions[c.id], 0), 0) || 1;
      const matchScore = Similarity.cosine(bulk, targetBulk);
      const inflammation = scoreFor(bulk, genes, "inflammatory");
      const fibrosis = scoreFor(bulk, genes, "fibrotic");

      scoreRow.innerHTML = "";
      [["Match to target", MathUtils.formatNumber(matchScore, 3)],
       ["Inflammation score", MathUtils.formatNumber(inflammation, 2)],
       ["Fibrosis score", MathUtils.formatNumber(fibrosis, 2)]].forEach(([label, value]) => {
        const tile = document.createElement("div");
        tile.className = "mx-score-tile";
        tile.innerHTML = `<span class="mx-score-tile__label">${label}</span><span class="mx-score-tile__value">${value}</span>`;
        scoreRow.appendChild(tile);
      });

      compositionChart.innerHTML = "";
      cellTypes.forEach((c) => {
        const frac = (Math.max(proportions[c.id], 0) / total) * 100;
        compositionChart.appendChild(bar(c.label, frac, 100, "series-a"));
      });

      bulkChart.innerHTML = "";
      const maxVal = Math.max(...bulk, ...targetBulk, 1);
      genes.forEach((g, i) => {
        bulkChart.appendChild(bar(`${g.label} (yours)`, bulk[i], maxVal, "series-a"));
        bulkChart.appendChild(bar(`${g.label} (target)`, targetBulk[i], maxVal, "series-b"));
      });
    }

    presetComposition.addEventListener("click", () => {
      cellTypes.forEach((c) => { proportions[c.id] = c.id === "macrophages" ? 55 : 15; });
      slidersByType.macrophages.propSlider.value = "55";
      cellTypes.filter((c) => c.id !== "macrophages").forEach((c) => { slidersByType[c.id].propSlider.value = "15"; });
      update();
    });
    presetActivation.addEventListener("click", () => {
      cellTypes.forEach((c) => { proportions[c.id] = 25; slidersByType[c.id].propSlider.value = "25"; });
      activations.macrophages = 1;
      slidersByType.macrophages.actSlider.value = "1";
      update();
    });

    BeforeAfterComponent.createBeforeAfter(revealMount, {
      revealLabel: "Reveal the hidden cellular explanation",
      beforeRenderFn(el) {
        const p = document.createElement("p");
        p.textContent = "Once you're happy with your match, reveal how the mystery sample was actually built.";
        el.appendChild(p);
      },
      afterRenderFn(el) {
        const p = document.createElement("p");
        p.innerHTML = "The mystery target was built from: " +
          cellTypes.map((c) => `<strong>${c.label}</strong>: ${MathUtils.formatNumber(data.target.trueProportions[c.id] * 100, 0)}%, ` +
            `activation ${MathUtils.formatNumber(data.target.trueActivation[c.id], 2)}`).join("; ") + ".";
        el.appendChild(p);
        const note = document.createElement("p");
        note.style.color = "var(--color-text-muted)";
        note.textContent = "A bulk measurement alone often can't tell you whether a match like this came from the " +
          "right composition, the right activation state, or a confusing mix of both — that ambiguity is exactly " +
          "what single-cell sequencing resolves.";
        el.appendChild(note);
      }
    });

    update();
  }
});
