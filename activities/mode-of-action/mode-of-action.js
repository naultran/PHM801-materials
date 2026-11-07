/**
 * Activity — Mode of Action Discovery.
 * Data: ../../data/omic-signatures.json (same 16-chemical / 8-pair / 100-gene
 * base matrix as Understanding 'Omic Signatures, plus a pathwayGeneSets
 * entry per pair: its true ~20-gene pathway definition, and two 20-gene
 * distractor sets — used for the Fisher's exact enrichment step below).
 *
 * Teaching point: picking two chemicals because they "look similar" is a
 * hypothesis, not an answer — clustering checks it, and the genes actually
 * driving that similarity can be tested for real pathway enrichment rather
 * than eyeballed. Column labels during selection are neutral numbers, not
 * the chemical names, so the pairing can't be guessed from naming alone.
 */

const CELL_W = 28, CELL_H = 6, CELL_GAP_X = 3;
const PATHWAY_LABELS = ["PPAR targets", "ER targets", "GR targets"];

function divergingColor(t) {
  t = MathUtils.clamp(t, -1, 1);
  const lerp = (c1, c2, s) => c1.map((v, i) => Math.round(v + (c2[i] - v) * s));
  const rgb = t < 0
    ? lerp([27, 58, 92], [255, 255, 255], t + 1)
    : lerp([255, 255, 255], [181, 101, 29], t);
  return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
}

function columnVector(data, chemIndex) {
  return data.genes.map((g, gi) => data.matrix[gi][chemIndex]);
}

/**
 * Genes most likely driving two profiles' similarity: both must move the
 * same direction from baseline, ranked by whichever of the two moved less
 * (a conservative "both clearly elevated/depressed together" score). Smallest
 * pairwise |a-b| difference (Clustering.topContributingGenes) sounds like the
 * same idea but isn't, here — two genes that are both just near-zero noise
 * are also "close together," so it tends to pull in baseline noise alongside
 * real signature genes rather than picking out the coordinated ones.
 */
function topSharedSignatureGenes(vecA, vecB, geneLabels, topN) {
  return geneLabels
    .map((label, i) => {
      const sameSign = Math.sign(vecA[i]) === Math.sign(vecB[i]) && vecA[i] !== 0;
      const score = sameSign ? Math.min(Math.abs(vecA[i]), Math.abs(vecB[i])) : -1;
      return { gene: label, score, a: vecA[i], b: vecB[i] };
    })
    .sort((x, y) => y.score - x.score)
    .slice(0, topN);
}

function drawSelectableHeatmap(svg, data, order, displayNumbers, selected, maxAbs) {
  SvgUtils.clearSVG(svg);
  const width = order.length * (CELL_W + CELL_GAP_X);
  const height = data.genes.length * CELL_H;
  svg.setAttribute("viewBox", `0 0 ${width} ${height + 16}`);

  order.forEach((chemIdx, ci) => {
    const x = ci * (CELL_W + CELL_GAP_X);
    const vec = columnVector(data, chemIdx);
    vec.forEach((v, gi) => {
      svg.appendChild(SvgUtils.svgEl("rect", {
        x, y: gi * CELL_H + 16, width: CELL_W, height: CELL_H, fill: divergingColor(v / maxAbs)
      }));
    });
    if (selected.includes(chemIdx)) {
      svg.appendChild(SvgUtils.svgEl("rect", {
        x: x - 1, y: 15, width: CELL_W + 2, height: height + 2,
        fill: "none", stroke: "#a3291e", "stroke-width": 2
      }));
    }
    svg.appendChild(SvgUtils.svgEl("text", {
      x: x + CELL_W / 2, y: 11, "text-anchor": "middle", class: "svg-axis-label"
    }, [String(displayNumbers[chemIdx])]));
  });
}

function drawZoomHeatmap(svg, geneRows, labels) {
  SvgUtils.clearSVG(svg);
  const cols = labels.length;
  const width = cols * 70;
  const height = geneRows.length * 20;
  svg.setAttribute("viewBox", `0 0 ${width} ${height + 16}`);
  const allVals = geneRows.flatMap((r) => r.values);
  const maxAbs = Math.max(...allVals.map(Math.abs), 1e-6);
  labels.forEach((label, ci) => {
    svg.appendChild(SvgUtils.svgEl("text", {
      x: ci * 70 + 35, y: 11, "text-anchor": "middle", class: "svg-axis-label"
    }, [label]));
  });
  geneRows.forEach((row, gi) => {
    row.values.forEach((v, ci) => {
      svg.appendChild(SvgUtils.svgEl("rect", {
        x: ci * 70 + 4, y: gi * 20 + 16, width: 62, height: 18, fill: divergingColor(v / maxAbs)
      }));
    });
  });
}

ActivityShell.init({
  rootId: "activity-root",
  title: "Mode of Action Discovery",
  dataUrl: "../../data/omic-signatures.json",
  defaultSeed: 2026,
  instructions:
    "Pick two chemicals you think share a mode of action, then reveal to check with real clustering. From there, " +
    "zoom into the genes actually driving that similarity and test whether they land in a known pathway more " +
    "than chance would predict.",

  render(data, { rng, container }) {
    const geneIndexByLabel = new Map(data.genes.map((g, i) => [g, i]));
    const allVectors = data.chemicals.map((c, i) => columnVector(data, i));
    const allValuesFlat = data.matrix.flat();
    const maxAbs = Math.max(...allValuesFlat.map(Math.abs), 1e-6);

    let order = rng.shuffle(data.chemicals.map((c, i) => i));
    const displayNumbers = {};
    order.forEach((chemIdx, i) => { displayNumbers[chemIdx] = i + 1; });

    let selected = [];
    let phase = "select"; // 'select' -> 'paired' -> 'pathway'
    let revealResult = null; // { truePartner, correct } once revealed

    const pairingSection = document.createElement("section");
    const pathwaySection = document.createElement("section");
    container.appendChild(pairingSection);
    container.appendChild(pathwaySection);

    function renderPairing() {
      pairingSection.innerHTML = "";
      const heading = document.createElement("h3");
      heading.textContent = "Which two chemicals share a mode of action?";
      pairingSection.appendChild(heading);

      const chipsRow = document.createElement("div");
      chipsRow.className = "moa-chips";
      chipsRow.setAttribute("role", "group");
      chipsRow.setAttribute("aria-label", "Select exactly two chemicals");
      order.forEach((chemIdx) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "touch-target moa-chip" + (selected.includes(chemIdx) ? " moa-chip--selected" : "");
        chip.textContent = String(displayNumbers[chemIdx]);
        chip.disabled = phase !== "select";
        chip.addEventListener("click", () => {
          if (selected.includes(chemIdx)) {
            selected = selected.filter((i) => i !== chemIdx);
          } else if (selected.length < 2) {
            selected = selected.concat([chemIdx]);
          }
          renderPairing();
        });
        chipsRow.appendChild(chip);
      });
      pairingSection.appendChild(chipsRow);

      const svg = SvgUtils.svgEl("svg", { class: "moa-heatmap" });
      pairingSection.appendChild(svg);
      drawSelectableHeatmap(svg, data, order, displayNumbers, selected, maxAbs);

      const description = document.createElement("p");
      description.className = "moa-description";
      description.setAttribute("aria-live", "polite");
      if (revealResult) {
        description.innerHTML = "";
        const badge = document.createElement("span");
        badge.className = `badge badge-${revealResult.correct ? "correct" : "incorrect"}`;
        badge.textContent = revealResult.correct ? "Correct!" : "Not quite";
        description.appendChild(badge);
        const detail = document.createElement("p");
        detail.textContent = `${data.chemicals[selected[0]].label}'s actual nearest neighbor is ` +
          `${data.chemicals[revealResult.truePartner].label}. Clustered order and real labels are now shown above.`;
        description.appendChild(detail);
      } else {
        description.textContent =
          `${selected.length} of 2 chemicals selected. 100 genes (rows, unlabeled), unclustered order.`;
      }
      pairingSection.appendChild(description);

      const actions = document.createElement("div");
      actions.className = "moa-actions";
      if (phase === "select") {
        const revealBtn = document.createElement("button");
        revealBtn.type = "button"; revealBtn.className = "touch-target";
        revealBtn.textContent = "Reveal — cluster and check";
        revealBtn.disabled = selected.length !== 2;
        revealBtn.addEventListener("click", () => {
          const D = Clustering.distanceMatrix(allVectors, "correlation");
          const nn = Clustering.nearestNeighbors(D);
          const dendro = Clustering.dendrogramLayout(
            Clustering.agglomerativeCluster(D, "average"),
            data.chemicals.map((c) => c.label)
          );
          order = dendro.leafOrder;
          data.chemicals.forEach((c, i) => { displayNumbers[i] = c.label; });

          const truePartner = nn[selected[0]].index;
          revealResult = { truePartner, correct: selected.includes(truePartner) };
          phase = "paired";
          renderPairing();
        });
        actions.appendChild(revealBtn);
      } else {
        const continueBtn = document.createElement("button");
        continueBtn.type = "button"; continueBtn.className = "touch-target";
        continueBtn.textContent = "Continue — zoom into the shared genes →";
        continueBtn.addEventListener("click", () => {
          phase = "pathway";
          renderPathway(selected[0], revealResult.truePartner);
        });
        actions.appendChild(continueBtn);
      }
      pairingSection.appendChild(actions);
    }

    function renderPathway(chemA, chemPartner) {
      pathwaySection.innerHTML = "";
      const heading = document.createElement("h3");
      heading.textContent = "What pathway do these shared genes belong to?";
      pathwaySection.appendChild(heading);

      const top = topSharedSignatureGenes(
        allVectors[chemA], allVectors[chemPartner], data.genes, 12
      );
      const queryIndices = top.map((t) => geneIndexByLabel.get(t.gene));

      const zoomSvg = SvgUtils.svgEl("svg", { class: "moa-zoom-heatmap" });
      pathwaySection.appendChild(zoomSvg);
      drawZoomHeatmap(
        zoomSvg,
        top.map((t) => ({ values: [t.a, t.b] })),
        [data.chemicals[chemA].label, data.chemicals[chemPartner].label]
      );

      const description = document.createElement("p");
      description.className = "moa-description";
      description.textContent =
        `The 12 genes where ${data.chemicals[chemA].label} and ${data.chemicals[chemPartner].label} are most ` +
        `alike — this is the gene list to test.`;
      pathwaySection.appendChild(description);

      // Randomize which of the 3 fixed labels is the true match this time,
      // so the dropdown position of the right answer isn't a fixed pattern.
      const pair = data.pairs.find((p) => p.id === data.chemicals[chemA].pairId) ||
        data.pairs.find((p) => p.geneIndices.some((g) => queryIndices.includes(g)));
      const shuffledLabels = rng.shuffle(PATHWAY_LABELS);
      const options = [
        { label: shuffledLabels[0], geneIndices: pair.pathwayGeneSets.correct, isCorrect: true },
        { label: shuffledLabels[1], geneIndices: pair.pathwayGeneSets.distractor1, isCorrect: false },
        { label: shuffledLabels[2], geneIndices: pair.pathwayGeneSets.distractor2, isCorrect: false }
      ];
      const optionsByLabel = new Map(options.map((o) => [o.label, o]));

      const predictMount = document.createElement("div");
      pathwaySection.appendChild(predictMount);
      const widget = PredictionComponent.createPredictionWidget(predictMount, {
        prompt: "Which category are these genes most likely part of? (placeholder names — real pathways to come)",
        inputType: "select",
        options: PATHWAY_LABELS.map((l) => ({ id: l, label: l })),
        commitLabel: "Lock in answer"
      });

      const resultsMount = document.createElement("div");
      pathwaySection.appendChild(resultsMount);

      const actions = document.createElement("div");
      actions.className = "moa-actions";
      const revealBtn = document.createElement("button");
      revealBtn.type = "button"; revealBtn.className = "touch-target";
      revealBtn.textContent = "Reveal — test for enrichment";
      revealBtn.addEventListener("click", () => {
        resultsMount.innerHTML = "";
        const table = document.createElement("table");
        table.className = "moa-fisher-table";
        table.innerHTML =
          "<thead><tr><th>Candidate pathway</th><th>Overlap</th><th>2×2 table (in list / not)</th><th>p-value</th></tr></thead>";
        const tbody = document.createElement("tbody");
        let bestOption = null, bestP = Infinity;
        options.forEach((opt) => {
          const pSet = new Set(opt.geneIndices);
          const a = queryIndices.filter((g) => pSet.has(g)).length;
          const b = queryIndices.length - a;
          const c = opt.geneIndices.length - a;
          const d = data.genes.length - a - b - c;
          const p = StatsUtils.fishersExactTest(a, b, c, d);
          if (p < bestP) { bestP = p; bestOption = opt; }
          const tr = document.createElement("tr");
          tr.className = opt.isCorrect ? "moa-fisher-row--true" : "";
          tr.innerHTML = `<td>${opt.label}</td><td>${a} of ${queryIndices.length}</td>` +
            `<td>${a} / ${b} — ${c} / ${d}</td><td>${p < 0.001 ? p.toExponential(2) : MathUtils.formatNumber(p, 3)}</td>`;
          tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        resultsMount.appendChild(table);

        const guessedLabel = widget.getPrediction();
        const guessedOpt = optionsByLabel.get(guessedLabel);
        const correct = guessedOpt && guessedOpt.isCorrect;
        widget.reveal(bestOption.label, () => ({
          status: correct ? "correct" : "incorrect",
          label: correct ? "Correct!" : "Not quite",
          detail: `${bestOption.label} shows the smallest p-value (${bestP < 0.001 ? bestP.toExponential(2) : MathUtils.formatNumber(bestP, 3)}) ` +
            `— a real, testable enrichment, not just "looks similar."`
        }));
        revealBtn.disabled = true;
      });
      actions.appendChild(revealBtn);
      pathwaySection.appendChild(actions);
    }

    renderPairing();

    return {
      reset() {
        order = rng.shuffle(data.chemicals.map((c, i) => i));
        order.forEach((chemIdx, i) => { displayNumbers[chemIdx] = i + 1; });
        selected = [];
        phase = "select";
        revealResult = null;
        pathwaySection.innerHTML = "";
        renderPairing();
      }
    };
  }
});
