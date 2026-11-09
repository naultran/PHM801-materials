/**
 * Activity — Understanding 'Omic Signatures.
 * Data: ../../data/omic-signatures.json (16 chemicals in 8 pairs, 100 genes;
 * this base matrix is shared with the Mode of Action Discovery activity, so
 * it's kept fixed rather than regenerated per load).
 *
 * Teaching point: a coordinated multigene signature is recognizable before
 * you compute anything — but similarity is a measured quantity, never a
 * perfect match, and an *inverse* signature is itself informative (a disease
 * state that looks like the opposite of a drug's effect is a candidate the
 * drug could reverse).
 *
 * Three-step wizard (predict -> reveal -> optionally randomize -> continue).
 * Steps 2 and 3 add one extra column to the fixed 16-chemical reference
 * heatmap, generated at runtime from a pair's own gene signature (optionally
 * inverted) plus fresh noise, so it's recognizably related but never
 * identical — exactly the point being taught.
 */

const CELL_W = 30, CELL_H = 6, CELL_GAP_X = 2;

function divergingColor(t) {
  t = MathUtils.clamp(t, -1, 1);
  const lerp = (c1, c2, s) => c1.map((v, i) => Math.round(v + (c2[i] - v) * s));
  const rgb = t < 0
    ? lerp([33, 102, 172], [255, 255, 255], t + 1)
    : lerp([255, 255, 255], [178, 24, 43], t);
  return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
}

function columnVector(data, chemIndex) {
  return data.genes.map((g, gi) => data.matrix[gi][chemIndex]);
}

/** The eight reference groups are read as diseases (two samples each). */
function diseaseLabel(pair) { return pair.label.replace(/^Pair/, "Disease"); }
function sampleLabel(chem) { return chem.label.replace(/^Cpd/, "Sample"); }

function pairAverageVector(data, pair) {
  const idxs = data.chemicals
    .map((c, i) => (c.pairId === pair.id ? i : -1))
    .filter((i) => i >= 0);
  return data.genes.map((g, gi) => (data.matrix[gi][idxs[0]] + data.matrix[gi][idxs[1]]) / 2);
}

/** A new signature recognizably related to `pair` (or its inverse) but never identical. */
function generateSignature(rng, data, pair, invert) {
  const vec = data.genes.map(() => rng.gaussian(0, 0.4));
  pair.geneIndices.forEach((g, k) => {
    const target = pair.archetype[k] * (invert ? -1 : 1);
    vec[g] = target + rng.gaussian(0, 0.3);
  });
  return vec;
}

/** Rank every pair by correlation to `vector`, most positive first. */
function rankPairsByCorrelation(data, vector) {
  return data.pairs
    .map((pair) => ({ pair, corr: Similarity.pearson(vector, pairAverageVector(data, pair)) }))
    .sort((a, b) => b.corr - a.corr);
}

/**
 * Draw a dense, unlabeled heatmap. `columns` is an ordered array of
 * { vector, extra? } — gene rows are never reordered (their order carries no
 * information once unlabeled), only column order/content changes.
 */
function drawHeatmap(svg, data, columns) {
  SvgUtils.clearSVG(svg);
  const width = columns.length * (CELL_W + CELL_GAP_X);
  const height = data.genes.length * CELL_H;
  svg.setAttribute("viewBox", `0 0 ${width} ${height + 14}`);

  const allValues = data.matrix.flat();
  const maxAbs = Math.max(...allValues.map(Math.abs), 1e-6);

  columns.forEach((col, ci) => {
    const x = ci * (CELL_W + CELL_GAP_X);
    col.vector.forEach((v, gi) => {
      svg.appendChild(SvgUtils.svgEl("rect", {
        x, y: gi * CELL_H + 14, width: CELL_W, height: CELL_H,
        fill: divergingColor(v / maxAbs)
      }));
    });
    if (col.extra) {
      svg.appendChild(SvgUtils.svgEl("rect", {
        x: x - 1, y: 13, width: CELL_W + 2, height: height + 2,
        fill: "none", stroke: "#a3291e", "stroke-width": 2
      }));
      svg.appendChild(SvgUtils.svgEl("text", {
        x: x + CELL_W / 2, y: 10, "text-anchor": "middle", class: "svg-axis-label", fill: "#a3291e"
      }, [col.label || "?"]));
    }
  });
}

function stepIndicator(container, total, current) {
  const wrap = document.createElement("div");
  wrap.className = "os-steps";
  wrap.setAttribute("role", "list");
  wrap.setAttribute("aria-label", `Step ${current + 1} of ${total}`);
  for (let i = 0; i < total; i++) {
    const dot = document.createElement("span");
    dot.className = "os-step-dot" + (i === current ? " os-step-dot--current" : i < current ? " os-step-dot--done" : "");
    dot.setAttribute("role", "listitem");
    wrap.appendChild(dot);
  }
  container.appendChild(wrap);
}

ActivityShell.init({
  rootId: "activity-root",
  title: "Understanding 'Omic Signatures",
  dataUrl: "../../data/omic-signatures.json",
  defaultSeed: 2026,
  instructions:
    "Predict, then reveal. Each step adds one new signature to a fixed reference set of 16 disease samples (8 diseases, " +
    "2 samples each) across 100 genes. You can randomize a step's new signature to try a different case, then continue " +
    "when you're ready for the next step.",

  render(data, { rng, container }) {
    let currentStep = 0;
    const stepMount = document.createElement("div");
    const indicatorMount = document.createElement("div");
    container.appendChild(indicatorMount);
    container.appendChild(stepMount);

    // Fixed by the page's own seed (default 2026) so the first thing every
    // student sees is the same; each step's own "randomize" button below
    // draws fresh, independent of this.
    const initialShuffleOrder = rng.shuffle(data.chemicals.map((c, i) => i));
    const step2TargetPair = data.pairs[rng.int(0, data.pairs.length)];
    const step3TargetPair = data.pairs[rng.int(0, data.pairs.length)];

    function renderIndicator() {
      indicatorMount.innerHTML = "";
      stepIndicator(indicatorMount, 3, currentStep);
    }

    function renderStep1() {
      stepMount.innerHTML = "";
      const heading = document.createElement("h3");
      heading.textContent = "Step 1 — Do you see any signatures?";
      stepMount.appendChild(heading);

      const svg = SvgUtils.svgEl("svg", { class: "os-heatmap" });
      stepMount.appendChild(svg);

      const description = document.createElement("p");
      description.className = "os-description";
      description.setAttribute("aria-live", "polite");
      stepMount.appendChild(description);

      let order = initialShuffleOrder;
      function draw() {
        drawHeatmap(svg, data, order.map((i) => ({ vector: columnVector(data, i) })));
      }
      draw();
      description.textContent =
        "16 samples (columns), 100 genes (rows, unlabeled). Column order is currently shuffled.";

      const predictMount = document.createElement("div");
      stepMount.appendChild(predictMount);
      const widget = PredictionComponent.createPredictionWidget(predictMount, {
        prompt: "Do you see evidence of disease signatures — samples that behave similarly to each other — in this heatmap?",
        inputType: "select",
        options: [{ id: "yes", label: "Yes, I can see some groups" }, { id: "no", label: "Not really, it looks random" }],
        commitLabel: "Lock in answer"
      });

      const actions = document.createElement("div");
      actions.className = "os-actions";
      const revealBtn = document.createElement("button");
      revealBtn.type = "button"; revealBtn.className = "touch-target";
      revealBtn.textContent = "Reveal — cluster the heatmap";
      const shuffleBtn = document.createElement("button");
      shuffleBtn.type = "button"; shuffleBtn.className = "touch-target";
      shuffleBtn.textContent = "Reshuffle column order";
      shuffleBtn.addEventListener("click", () => { order = rng.shuffle(order); draw(); });
      const continueBtn = document.createElement("button");
      continueBtn.type = "button"; continueBtn.className = "touch-target"; continueBtn.hidden = true;
      continueBtn.textContent = "Continue to step 2 →";
      continueBtn.addEventListener("click", () => { currentStep = 1; renderIndicator(); renderStep2(); });
      actions.appendChild(revealBtn);
      actions.appendChild(shuffleBtn);
      actions.appendChild(continueBtn);
      stepMount.appendChild(actions);

      revealBtn.addEventListener("click", () => {
        const vectors = data.chemicals.map((c, i) => columnVector(data, i));
        const D = Clustering.distanceMatrix(vectors, "correlation");
        const dendro = Clustering.dendrogramLayout(
          Clustering.agglomerativeCluster(D, "average"),
          data.chemicals.map((c) => sampleLabel(c))
        );
        order = dendro.leafOrder;
        draw();
        widget.reveal("clustered", () => ({
          status: "correct",
          label: "Clustered",
          detail: "Whatever you predicted, here's what the data actually shows: hierarchical clustering pulls out " +
            "8 tight groups, one per disease (two samples each). Each disease shares a coordinated pattern across a small set of genes — everything else " +
            "is noise."
        }));
        description.textContent =
          "Reclustered: " + data.pairs.map((p) => {
            const members = data.chemicals.filter((c) => c.pairId === p.id).map((c) => sampleLabel(c));
            return `${members.join(" + ")}`;
          }).join("; ") + ".";
        revealBtn.disabled = true;
        shuffleBtn.disabled = true;
        continueBtn.hidden = false;
      });
    }

    function renderExtraSignatureStep(opts) {
      const { stepNum, title, prompt, targetPairDefault, invert, revealLabel, isLast, extraLabel = "?", pairLabel = diseaseLabel, intro } = opts;
      stepMount.innerHTML = "";
      const heading = document.createElement("h3");
      heading.textContent = title;
      stepMount.appendChild(heading);

      const svg = SvgUtils.svgEl("svg", { class: "os-heatmap" });
      stepMount.appendChild(svg);

      const description = document.createElement("p");
      description.className = "os-description";
      description.setAttribute("aria-live", "polite");
      stepMount.appendChild(description);

      const baseVectors = data.chemicals.map((c, i) => columnVector(data, i));
      let targetPair = targetPairDefault;
      let extraVec = generateSignature(rng, data, targetPair, invert);

      function draw() {
        const cols = data.chemicals.map((c, i) => ({ vector: baseVectors[i] }));
        cols.push({ vector: extraVec, extra: true, label: extraLabel });
        drawHeatmap(svg, data, cols);
      }
      draw();
      description.textContent = intro || `16 reference chemicals plus one new signature (outlined, rightmost column).`;

      const predictMount = document.createElement("div");
      stepMount.appendChild(predictMount);
      const widget = PredictionComponent.createPredictionWidget(predictMount, {
        prompt,
        inputType: "select",
        options: data.pairs.map((p) => ({ id: p.id, label: pairLabel(p) })),
        commitLabel: "Lock in answer"
      });

      const actions = document.createElement("div");
      actions.className = "os-actions";
      const revealBtn = document.createElement("button");
      revealBtn.type = "button"; revealBtn.className = "touch-target";
      revealBtn.textContent = revealLabel;
      const randomizeBtn = document.createElement("button");
      randomizeBtn.type = "button"; randomizeBtn.className = "touch-target";
      randomizeBtn.textContent = "Randomize this signature";
      randomizeBtn.addEventListener("click", () => {
        const freshRng = PRNG.createRNG(PRNG.randomSeed());
        targetPair = data.pairs[freshRng.int(0, data.pairs.length)];
        extraVec = generateSignature(freshRng, data, targetPair, invert);
        draw();
        widget.reset();
        revealBtn.disabled = false;
        continueBtn.hidden = true;
      });
      const continueBtn = document.createElement("button");
      continueBtn.type = "button"; continueBtn.className = "touch-target"; continueBtn.hidden = true;
      continueBtn.textContent = isLast ? "Restart activity" : `Continue to step ${stepNum + 1} →`;
      continueBtn.addEventListener("click", () => {
        if (isLast) { currentStep = 0; renderIndicator(); renderStep1(); }
        else { currentStep = stepNum; renderIndicator(); renderStep3(); }
      });
      actions.appendChild(revealBtn);
      actions.appendChild(randomizeBtn);
      actions.appendChild(continueBtn);
      stepMount.appendChild(actions);

      revealBtn.addEventListener("click", () => {
        const ranked = rankPairsByCorrelation(data, extraVec);
        const best = invert ? ranked[ranked.length - 1] : ranked[0];
        const guessedPair = data.pairs.find((p) => p.id === widget.getPrediction());
        const correct = guessedPair && guessedPair.id === best.pair.id;
        widget.reveal(pairLabel(best.pair), () => ({
          status: correct ? "correct" : "incorrect",
          label: correct ? "Correct!" : "Not quite",
          detail: invert
            ? `The drug's signature is most strongly inverse to ${pairLabel(best.pair)} (r = ${MathUtils.formatNumber(best.corr, 2)}): it pushes the same genes in the opposite direction to the disease, so ${pairLabel(best.pair)} is the disease it could most plausibly reverse. ` +
              `Notice it's a strong negative correlation, not r = -1.00 — even a clear inverse match is never perfect, and a candidate still has to be tested.`
            : `This sample is most similar to ${pairLabel(best.pair)} (r = ${MathUtils.formatNumber(best.corr, 2)}) — clearly ` +
              `related, but not r = 1.00. Similarity here is measured, not just "same vs. different."`
        }));
        revealBtn.disabled = true;
        continueBtn.hidden = false;
      });
    }

    function renderStep2() {
      renderExtraSignatureStep({
        stepNum: 2,
        title: "Step 2 — Which disease is this sample most similar to?",
        prompt: "The new column is a sample from a patient. Which disease’s samples does it most resemble?",
        intro: "Sixteen reference samples (two for each of eight diseases) plus one new sample (outlined, rightmost column).",
        targetPairDefault: step2TargetPair,
        invert: false,
        extraLabel: "Sample",
        revealLabel: "Reveal — find the closest disease",
        isLast: false
      });
    }

    function renderStep3() {
      renderExtraSignatureStep({
        stepNum: 3,
        title: "Step 3 — Which disease might this drug treat?",
        prompt: "The new column is a drug's signature. Treat each of the 8 reference groups as a disease signature (disease vs. healthy). Which disease would this drug most likely be effective against?",
        intro: "Eight disease signatures (the same reference columns, now read as disease vs. healthy) plus one new drug signature (outlined, rightmost column). A drug is most likely to help the disease it pushes in the opposite direction.",
        targetPairDefault: step3TargetPair,
        invert: true,
        extraLabel: "Drug",
                revealLabel: "Reveal — find the best match",
        isLast: true
      });
    }

    renderIndicator();
    renderStep1();

    return {
      reset() {
        currentStep = 0;
        renderIndicator();
        renderStep1();
      }
    };
  }
});
