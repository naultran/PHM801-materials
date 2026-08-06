# Interactivity Guide

Instructor-facing reference for every activity in this template: the teaching question it
supports, what students manipulate, what recalculates, which files to edit, and known limits.
See `README.md` for general setup and `TECHNICAL-LIMITS.md` for what's practical to build in
this style of site at all.

Every activity shares the same architecture: `data/<slug>.json` holds all replaceable
scientific content, `activities/<slug>/<slug>.js` holds the behavior, and
`js/activity-shell.js` provides the common header/mode-badge/seed-controls/reset-button chrome
so the activity file only implements its own visualization and controls.

---

## 1. Biological Signature Matcher

- **Teaching question:** Is one marker gene enough to identify a sample, or do you need a
  coordinated multigene signature?
- **Students manipulate:** 8 gene-expression sliders on an "unknown" sample, the similarity
  metric (Pearson / cosine / Euclidean), one-marker-only vs. multigene mode, noise level, and a
  randomize/reveal-answer flow with a prediction commitment.
- **What recalculates:** all three reference-tissue similarity scores, the ranking, and the
  best-vs-second-best separation — on every slider move.
- **Data file:** `data/signature-matcher.json` (`genes[]`, `candidates[]` with `values[]`,
  `defaultNoiseSd`)
- **Behavior file:** `activities/signature-matcher/signature-matcher.js`; math in
  `js/similarity.js`
- **Replace the example:** swap `genes[]` labels and each candidate's `values[]` (same length
  as `genes[]`) for real markers and real reference tissue/cell-type profiles.
- **Known limits:** no 2D reference-space projection (marked optional in the original design;
  the PCA Explorer activity covers that idea more fully).
- **Accessibility:** all sliders are native `<input type="range">` with `aria-label`s; metric
  and mode are native `<select>`s.
- **Performance:** trivial at 3 candidates × ≤10 genes; scales fine to a few dozen genes.

## 2. Dynamic Heatmap & Hierarchical Clustering

- **Teaching question:** How much of a clustering result comes from the data itself, versus
  from preprocessing and analysis choices?
- **Students manipulate:** distance metric, linkage rule, row z-score toggle, "freeze sample
  order," per-gene/per-sample include-exclude checkboxes, a noise slider, and a one-cell value
  "nudge" control.
- **What recalculates:** the full distance matrix, agglomerative clustering, dendrogram, and
  heatmap column order — live, on every relevant change (unless frozen).
- **Data file:** `data/heatmap-clustering.json` (`genes[]`, `samples[]` with `group`,
  `matrix[gene][sample]`)
- **Behavior file:** `activities/heatmap-clustering/heatmap-clustering.js`; math in
  `js/clustering.js`
- **Replace the example:** swap in real gene/sample labels and a real `matrix`; keep it
  ≤30×30 (see Technical Limits).
- **Known limits:** only the sample (column) dendrogram is computed, not an optional gene-side
  dendrogram (marked optional in the original design).
- **Accessibility:** all controls are native checkboxes/selects/sliders; the SVG heatmap has
  per-cell `<title>` tooltips with the exact value; sample labels are focusable/clickable
  buttons (not color-only) for the nearest-neighbor panel.
- **Performance:** instant to ~30×30; hundreds of cells would need debouncing (see
  TECHNICAL-LIMITS.md).

## 3. Pathway & Mechanism Construction

- **Teaching question:** How do individual genes/events organize into biological pathways and
  a mechanistic sequence — and where is that categorization genuinely ambiguous?
- **Students manipulate:** drag-and-drop cards into pathway categories (stage 1) and into a
  mechanistic sequence (stage 2), or the keyboard-alternative dropdowns.
- **What recalculates:** correctness feedback on "Check arrangement" (per-card, allowing
  multi-valid placements) and hint suggestions.
- **Data file:** `data/pathway-construction.json` (`stage1`/`stage2`, each with `slots[]` and
  `items[]` — `correctSlots` is an array, so an item can validly belong to more than one slot)
- **Behavior file:** `activities/pathway-construction/pathway-construction.js`; drag/keyboard
  infrastructure in `js/dnd-utils.js`
- **Replace the example:** edit `items[].label`/`explanation`/`correctSlots` and
  `slots[].label`; both stages use the identical JSON shape.
- **Known limits:** no automatic layout validation of `correctSlots` against `slots` — a typo
  will just make that placement always show "incorrect" (no error will point to the typo).
- **Accessibility:** pointer drag (via Pointer Events, works with touch) has a fully equivalent
  keyboard path (select item → select destination → "Place") that calls the identical
  placement function, so neither path can behave differently.
- **Performance:** trivial at this scale (≤10 items per stage).

## 4. Bulk-Tissue Mixture Simulator

- **Teaching question:** Can a bulk measurement tell you whether a change came from cell
  *composition* or cell *state* — or are those two indistinguishable without single-cell data?
- **Students manipulate:** per-cell-type abundance and activation-state sliders, two preset
  buttons isolating "more of a cell type" vs. "an angrier cell type," and a hidden-target
  match score.
- **What recalculates:** the weighted-sum bulk profile, inflammation/fibrosis scores, and match
  score against the hidden target — on every slider move.
- **Data file:** `data/mixture-simulator.json` (`genes[]` with optional `inflammatory`/
  `fibrotic` flags + `activationGain`, `cellTypes[]` with `signature[]`, `target`)
- **Behavior file:** `activities/mixture-simulator/mixture-simulator.js`
- **Replace the example:** edit `cellTypes[].signature` (same length/order as `genes[]`) and
  `target.trueProportions`/`trueActivation`.
- **Known limits:** activation scales *all* flagged genes uniformly across every cell type
  (not per-cell-type gene lists) — a deliberate simplification to keep the JSON schema simple;
  it's harmless because baseline signatures already differ appropriately by cell type.
- **Accessibility:** all sliders are native range inputs with visible labels; the reveal panel
  uses the shared before/after component (instant swap under reduced motion).
- **Performance:** trivial (4 cell types × 8 genes).

## 5. Dose-Response Laboratory

- **Teaching question:** Can you tell a genuine target-specific effect from a nonspecific
  cytotoxicity artifact that only appears at high dose?
- **Students manipulate:** top/bottom/EC50/Hill-slope curve parameters, replicate noise and
  count, a response-shape toggle (monotonic / nonmonotonic / adaptive / cytotoxicity-driven),
  and a cytotoxicity threshold.
- **What recalculates:** the smooth "true" curve and the noisy replicate scatter, on every
  control change; replicate noise is deterministically re-seeded per computation so results
  stay reproducible.
- **Data file:** `data/dose-response.json` (`compounds[]` with default curve parameters,
  `defaultNoiseSd`, `defaultReplicates`)
- **Behavior file:** `activities/dose-response/dose-response.js`; math in
  `js/dose-response-model.js`
- **Replace the example:** edit `compounds[0]`'s parameters, or add more compounds and a
  selector (requires a small JS change to loop over `data.compounds`).
- **Known limits:** the four response "shapes" are simplified illustrative models, not fits to
  any real mechanistic ODE system.
- **Accessibility:** all controls are native sliders/selects; the cytotoxic region is shown as
  a shaded band *and* a dashed line *and* a text readout, never color alone.
- **Performance:** trivial (≤120 curve points, ≤10 dose × 8 replicate points).

## 6. Experimental Design & Statistical Power

- **Teaching question:** How do replicate count, variability, effect size, and multiple-testing
  correction jointly determine what a study can actually detect?
- **Students manipulate:** replicate count (n), gene count, % of genes truly affected, true
  effect size, a combined variability slider, FDR threshold (alpha), and a "Reseed" button.
- **What recalculates:** a full synthetic two-group experiment (Welch's t-test + Benjamini-
  Hochberg FDR per gene), the volcano plot, true/false positive counts, and the power-vs-n
  curve.
- **Data file:** `data/experimental-design.json` (defaults and ranges for every control)
- **Behavior file:** `activities/experimental-design/experimental-design.js`; math in
  `js/stats-utils.js`
- **Replace the example:** this activity's "data" is entirely simulation parameters, not real
  gene identities — adjust the defaults/ranges to match the scale you want to teach with.
- **Known limits:** "variability" combines biological and technical noise into one slider
  (see TECHNICAL-LIMITS.md); the p-value comes from a numerical incomplete-beta approximation
  of the t-distribution, accurate to the precision needed for teaching but not meant for
  publication-grade statistics.
- **Accessibility:** volcano-plot significance is shown with *both* fill (solid vs. open) and
  size, never color alone.
- **Performance:** comfortable up to the full 500-gene range on the slider; would need
  precomputation well beyond that (see TECHNICAL-LIMITS.md).

## 7. PCA / Dimensionality Reduction Explorer

- **Teaching question:** What does a principal component axis actually summarize, and how does
  that change when you change which genes are included?
- **Students manipulate:** which genes are included, standardize toggle, "only highly-variable
  genes," a noise slider, a one-value nudge, which two PCs are plotted, and which sample
  attribute ("treatment" or "batch") drives point color.
- **What recalculates:** the full PCA (covariance matrix + eigendecomposition), animated as an
  eased transition between old and new sample positions, plus the "what drives this axis"
  loadings panel.
- **Data file:** `data/pca-explorer.json` (`genes[]` tagged `kind: biology|batch|noise`,
  `samples[]` tagged by `treatment` and `batch`, `matrix[sample][gene]`)
- **Behavior file:** `activities/pca-explorer/pca-explorer.js`; math in `js/pca.js`
- **Replace the example:** the default dataset is deliberately built so a technical batch
  effect (genes tagged `"kind": "batch"`) is *stronger* than the real treatment effect and
  dominates PC1 until those genes are excluded — preserve that structure if you want the same
  teaching moment, or build your own contrast.
- **Known limits:** no UMAP (the original design explicitly marks it optional, since UMAP's
  sensitivity to parameters/initialization makes it easy to over-interpret in a short demo).
- **Accessibility:** the animated transition snaps instantly under `prefers-reduced-motion`;
  loadings are shown as a sorted bar list (not just visually encoded on the scatter plot).
- **Performance:** the eigendecomposition (Jacobi algorithm) is fine up to a few dozen genes;
  don't scale this activity's gene count into the hundreds.

## 8. Spatial Transcriptomics Explorer

- **Teaching question:** What information does homogenizing a tissue for bulk sequencing throw
  away, and how does capture-spot size trade resolution for signal averaging?
- **Students manipulate:** which gene's spatial pattern to view, capture-area size (σ), spot
  spacing, a spot-center overlay toggle, and clicking any single location on the true map.
- **What recalculates:** the Gaussian-kernel-weighted "captured" raster and its bulk/regional/
  single-location summary readouts, live on every slider change.
- **Data file:** `data/spatial-explorer.json` (`gridSize`, `genes[]` each with a hand-editable
  2D `grid`, capped at 60×60)
- **Behavior file:** `activities/spatial-explorer/spatial-explorer.js`
- **Replace the example:** hand-edit a `grid` (or generate one offline and paste it in) — grids
  are plain nested arrays, not procedurally generated at runtime, specifically so they're easy
  to author without touching JS.
- **Known limits:** capped at 60×60 per gene (see TECHNICAL-LIMITS.md); this is a 2D
  illustrative grid, not a georeferenced/real coordinate system.
- **Accessibility:** clicking uses standard click events (works with switch-access/assistive
  pointers); the sequential color scale is paired with a readout of the exact numeric value.
- **Performance:** Canvas-based rendering handles the capped grid size instantly.

## Reusable component 1: Prediction, Commitment & Feedback

- **Teaching question (infrastructure):** commits students to a guess before revealing a
  computed result, so the reveal is a genuine test of their prediction rather than something
  they can passively watch happen.
- **Behavior file:** `js/prediction-component.js`; standalone demo at
  `activities/prediction-demo/`
- **Used inside:** Activity 1 (Signature Matcher).
- **How to reuse it:** `PredictionComponent.createPredictionWidget(containerEl, {prompt,
  inputType, options, commitLabel})` returns `{getPrediction(), reveal(actual, feedbackFn),
  reset()}`.

## Reusable component 2: Before/After Reveal Comparison

- **Teaching question (infrastructure):** lets students see a "before" state, form an
  expectation, then reveal an "after" state for direct comparison.
- **Behavior file:** `js/before-after-component.js`; standalone demo at
  `activities/before-after-demo/`
- **Used inside:** Activity 4 (Mixture Simulator).
- **How to reuse it:** `BeforeAfterComponent.createBeforeAfter(containerEl, {beforeRenderFn,
  afterRenderFn, revealLabel})` returns `{reveal(), reset(), isRevealed()}`. Both render
  functions receive a mount element to build their content into.

## Placeholder activities (design mockups only, not implemented)

These seven appear in the Activity Gallery as "coming soon" cards with a title, description,
and static preview image, sourced from `data/placeholders.json` — no working simulation yet:
Gene-to-Pathway Interpretation, Biomarker Panel Builder, Mechanistic Network Explorer,
Match-the-Mechanism Puzzle, Sequencing Method Selection Challenge, Sequencing Pipeline
Assembly, and Annotation and Classification Game. To build a real implementation for one of
these later, delete its `activities/placeholder-*/` folder and follow "How to add an
interactive activity" in `README.md`.
