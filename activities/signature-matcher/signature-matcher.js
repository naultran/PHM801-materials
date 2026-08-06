/**
 * Activity 1 — Biological Signature Matcher.
 * Data: ../../data/signature-matcher.json (genes, 3 candidates, defaultNoiseSd)
 * Teaching point: a coordinated multigene signature is a more robust way to
 * identify a sample than any single marker gene.
 */

const METRIC_EXPLAINERS = {
  pearson: "Pearson correlation asks whether the ups and downs across genes track together, ignoring overall scale — two samples can correlate strongly even if one is uniformly higher.",
  cosine: "Cosine similarity compares the direction of the two gene-expression vectors, also fairly scale-insensitive, but treats each gene as an independent axis rather than looking for a shared trend.",
  euclidean: "Euclidean distance (converted to a 0-1 similarity) measures raw closeness in value — it's sensitive to overall scale, so a uniformly higher sample can look 'far' even if its pattern matches."
};

ActivityShell.init({
  rootId: "activity-root",
  title: "Biological Signature Matcher",
  dataUrl: "../../data/signature-matcher.json",
  defaultSeed: 12345,
  instructions:
    "An unknown fictional sample's gene expression is shown below as sliders. Adjust the sliders, " +
    "compare it against three reference tissues, and see how the ranking changes with the similarity " +
    "metric and with how many genes you use.",

  render(data, { rng, container }) {
    const genes = data.genes;
    const candidates = data.candidates;

    // Pick a "true source" candidate + generate the unknown sample from it plus noise.
    // Re-derived fresh from the seeded rng every render, so Reset (no seed change)
    // reproduces the exact same starting scenario.
    let noiseSd = data.defaultNoiseSd;
    let trueSource = rng.pick(candidates);
    let unknownValues = trueSource.values.map((v) => MathUtils.clamp(v + rng.gaussian(0, noiseSd), 0, 10));

    let metric = "pearson";
    let mode = "multigene"; // 'multigene' | 'one-marker'
    let activeGeneIndex = 0;

    // ---- layout ----
    const layout = document.createElement("div");
    layout.className = "sm-layout";

    const leftCol = document.createElement("div");
    const rightCol = document.createElement("div");
    layout.appendChild(leftCol);
    layout.appendChild(rightCol);
    container.appendChild(layout);

    // Prediction widget (spec experience #17), sits above the exploration controls.
    const predictionMount = document.createElement("div");
    container.insertBefore(predictionMount, layout);
    const prediction = PredictionComponent.createPredictionWidget(predictionMount, {
      prompt: "Before experimenting: which reference tissue do you predict the unknown sample came from?",
      inputType: "select",
      options: candidates.map((c) => ({ id: c.id, label: c.label }))
    });

    // ---- toolbar (mode, metric, noise, randomize, reveal) ----
    const toolbar = document.createElement("div");
    toolbar.className = "sm-toolbar";
    leftCol.appendChild(toolbar);

    const modeLabel = document.createElement("label");
    modeLabel.className = "field-label";
    modeLabel.textContent = "Comparison mode";
    const modeSelect = document.createElement("select");
    modeSelect.className = "touch-target";
    [["multigene", "Multigene signature"], ["one-marker", "One marker only"]].forEach(([val, label]) => {
      const opt = document.createElement("option");
      opt.value = val; opt.textContent = label;
      modeSelect.appendChild(opt);
    });

    const geneSelectWrap = document.createElement("div");
    const geneSelectLabel = document.createElement("label");
    geneSelectLabel.className = "field-label";
    geneSelectLabel.textContent = "Marker gene";
    const geneSelect = document.createElement("select");
    geneSelect.className = "touch-target";
    genes.forEach((g, i) => {
      const opt = document.createElement("option");
      opt.value = i; opt.textContent = g.label;
      geneSelect.appendChild(opt);
    });
    geneSelectWrap.appendChild(geneSelectLabel);
    geneSelectWrap.appendChild(geneSelect);

    const metricLabel = document.createElement("label");
    metricLabel.className = "field-label";
    metricLabel.textContent = "Similarity metric";
    const metricSelect = document.createElement("select");
    metricSelect.className = "touch-target";
    [["pearson", "Pearson correlation"], ["cosine", "Cosine similarity"], ["euclidean", "Euclidean distance"]].forEach(([val, label]) => {
      const opt = document.createElement("option");
      opt.value = val; opt.textContent = label;
      metricSelect.appendChild(opt);
    });

    const noiseWrap = document.createElement("div");
    const noiseLabelEl = document.createElement("label");
    noiseLabelEl.className = "field-label";
    noiseLabelEl.textContent = "Noise level for next randomized sample";
    const noiseSlider = document.createElement("input");
    noiseSlider.type = "range"; noiseSlider.min = "0"; noiseSlider.max = "3"; noiseSlider.step = "0.1";
    noiseSlider.value = String(noiseSd);
    noiseWrap.appendChild(noiseLabelEl);
    noiseWrap.appendChild(noiseSlider);

    const randomizeBtn = document.createElement("button");
    randomizeBtn.type = "button"; randomizeBtn.className = "touch-target";
    randomizeBtn.textContent = "Randomize sample";

    const revealBtn = document.createElement("button");
    revealBtn.type = "button"; revealBtn.className = "touch-target";
    revealBtn.textContent = "Reveal answer";

    [modeLabel, modeSelect, geneSelectWrap, metricLabel, metricSelect, noiseWrap, randomizeBtn, revealBtn]
      .forEach((el) => toolbar.appendChild(el));

    const metricExplainer = document.createElement("p");
    metricExplainer.className = "sm-metric-explainer";
    leftCol.appendChild(metricExplainer);

    // ---- gene sliders ----
    const slidersHeading = document.createElement("h3");
    slidersHeading.textContent = "Unknown sample's gene expression";
    leftCol.appendChild(slidersHeading);
    const slidersWrap = document.createElement("div");
    leftCol.appendChild(slidersWrap);

    const sliderRows = genes.map((g, i) => {
      const row = document.createElement("div");
      row.className = "sm-gene-row";
      const label = document.createElement("span");
      label.className = "sm-gene-row__label";
      label.textContent = g.label;
      const input = document.createElement("input");
      input.type = "range"; input.min = "0"; input.max = "10"; input.step = "0.1";
      input.value = String(unknownValues[i]);
      input.setAttribute("aria-label", `${g.label} expression level`);
      const valueEl = document.createElement("span");
      valueEl.className = "sm-gene-row__value";
      valueEl.textContent = MathUtils.formatNumber(unknownValues[i], 1);
      row.appendChild(label); row.appendChild(input); row.appendChild(valueEl);
      slidersWrap.appendChild(row);
      input.addEventListener("input", () => {
        unknownValues[i] = Number(input.value);
        valueEl.textContent = MathUtils.formatNumber(unknownValues[i], 1);
        updateResults();
      });
      return { row, input, valueEl };
    });

    // ---- results panel ----
    const resultsHeading = document.createElement("h3");
    resultsHeading.textContent = "Similarity to each reference tissue";
    rightCol.appendChild(resultsHeading);
    const resultsWrap = document.createElement("div");
    resultsWrap.setAttribute("aria-live", "polite");
    resultsWrap.setAttribute("aria-atomic", "true");
    rightCol.appendChild(resultsWrap);
    const marginNote = document.createElement("p");
    marginNote.className = "sm-margin-note";
    marginNote.setAttribute("aria-live", "polite");
    rightCol.appendChild(marginNote);
    const revealNote = document.createElement("div");
    revealNote.className = "sm-reveal-note";
    revealNote.hidden = true;
    rightCol.appendChild(revealNote);

    function activeIndices() {
      return mode === "one-marker" ? [activeGeneIndex] : genes.map((_, i) => i);
    }

    function updateSliderEmphasis() {
      sliderRows.forEach((r, i) => {
        r.row.classList.toggle("sm-gene-row--muted", mode === "one-marker" && i !== activeGeneIndex);
      });
    }

    function computeScores() {
      const idx = activeIndices();
      const unknownVec = idx.map((i) => unknownValues[i]);
      return candidates.map((c) => {
        const candVec = idx.map((i) => c.values[i]);
        const score = Similarity.similarityByMetric(unknownVec, candVec, metric);
        return { candidate: c, score };
      }).sort((a, b) => b.score - a.score);
    }

    function updateResults() {
      const ranked = computeScores();
      const best = ranked[0];
      const worst = ranked[ranked.length - 1];
      const span = Math.max(best.score - worst.score, 1e-6);

      resultsWrap.innerHTML = "";
      ranked.forEach((r, i) => {
        const row = document.createElement("div");
        row.className = "sm-bar-row";
        const label = document.createElement("span");
        label.className = "sm-bar-row__label";
        label.textContent = r.candidate.label;
        const track = document.createElement("div");
        track.className = "sm-bar-row__track";
        const fill = document.createElement("div");
        fill.className = "sm-bar-row__fill" + (i === 0 ? " is-best" : "");
        const widthFrac = MathUtils.clamp((r.score - worst.score + span * 0.05) / (span * 1.1), 0.03, 1);
        fill.style.width = `${widthFrac * 100}%`;
        track.appendChild(fill);
        const scoreEl = document.createElement("span");
        scoreEl.className = "sm-bar-row__score";
        scoreEl.textContent = MathUtils.formatNumber(r.score, 3);
        row.appendChild(label); row.appendChild(track); row.appendChild(scoreEl);
        if (i === 0) {
          const badge = document.createElement("span");
          badge.className = "badge badge-correct";
          badge.textContent = "Best match";
          row.appendChild(badge);
        }
        resultsWrap.appendChild(row);
      });

      const margin = ranked.length > 1 ? ranked[0].score - ranked[1].score : 0;
      const clearMargin = margin > span * 0.25;
      marginNote.textContent = ranked.length > 1
        ? `Separation between best and second-best match: ${MathUtils.formatNumber(margin, 3)} ` +
          `(${clearMargin ? "a fairly clear best match" : "a close call — not clearly separated"}).`
        : "";

      metricExplainer.textContent = METRIC_EXPLAINERS[metric] +
        (mode === "one-marker" ? " In one-marker mode, only the selected gene is used." : "");
    }

    // ---- wiring ----
    modeSelect.addEventListener("change", () => {
      mode = modeSelect.value;
      geneSelectWrap.style.display = mode === "one-marker" ? "" : "none";
      if (mode === "one-marker" && metric === "pearson") {
        metric = "euclidean";
        metricSelect.value = "euclidean";
      }
      metricSelect.querySelector('option[value="pearson"]').disabled = mode === "one-marker";
      updateSliderEmphasis();
      updateResults();
    });
    geneSelect.addEventListener("change", () => {
      activeGeneIndex = Number(geneSelect.value);
      updateSliderEmphasis();
      updateResults();
    });
    metricSelect.addEventListener("change", () => {
      metric = metricSelect.value;
      updateResults();
    });
    noiseSlider.addEventListener("input", () => { noiseSd = Number(noiseSlider.value); });

    randomizeBtn.addEventListener("click", () => {
      trueSource = rng.pick(candidates);
      unknownValues = trueSource.values.map((v) => MathUtils.clamp(v + rng.gaussian(0, noiseSd), 0, 10));
      sliderRows.forEach((r, i) => {
        r.input.value = String(unknownValues[i]);
        r.valueEl.textContent = MathUtils.formatNumber(unknownValues[i], 1);
      });
      revealNote.hidden = true;
      prediction.reset();
      updateResults();
    });

    revealBtn.addEventListener("click", () => {
      prediction.reveal(trueSource.id);
      const ranked = computeScores();
      const topMatch = ranked[0].candidate;
      revealNote.hidden = false;
      revealNote.innerHTML = "";
      const p1 = document.createElement("p");
      p1.innerHTML = `This unknown sample was generated from <strong>${trueSource.label}</strong> plus random noise.`;
      const p2 = document.createElement("p");
      p2.innerHTML = topMatch.id === trueSource.id
        ? `The current metric's top-ranked match (<strong>${topMatch.label}</strong>) is correct.`
        : `Under the current metric, the top-ranked match is <strong>${topMatch.label}</strong> — ` +
          `not the true source. Try switching metrics or modes to see why.`;
      revealNote.appendChild(p1);
      revealNote.appendChild(p2);
    });

    // initial state
    geneSelectWrap.style.display = "none";
    metricSelect.querySelector('option[value="pearson"]').disabled = false;
    updateSliderEmphasis();
    updateResults();
  }
});
