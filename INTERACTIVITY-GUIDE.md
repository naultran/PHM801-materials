# Interactivity Guide

Instructor-facing reference for the nine activities: the teaching question each supports, what
students do, and which files to edit. See `README.md` for setup and `TECHNICAL-LIMITS.md` for what
is practical in this style of site.

Every activity shares one architecture. `activities/<slug>/<slug>.js` holds the behaviour and calls
`ActivityShell.init(...)` from `js/activity-shell.js`, which provides the header, seed controls and
Reset button. Most activities build their (synthetic) data from the seed with the seeded random
generator in `js/prng.js`, so a given `?seed=` always gives the same scenario. Two read a data file
from `data/`. A new seed (the "New random seed" button) changes the scenario, and the lectures fix a
seed on every embed so the projected scenario is reproducible.

Shared helpers: `js/math-utils.js`, `js/stats-utils.js` (Fisher's exact test),
`js/similarity.js` (Pearson), `js/clustering.js` (hierarchical clustering and dendrograms),
`js/svg-utils.js`, `js/prediction-component.js` (the "lock in your answer, then reveal" widget) and
`css/activity-widgets.css` (shared `aw-*` styles). Heatmaps use one diverging scale everywhere:
blue = repressed, white = no change, red = induced.

---

## Lecture 1 — Transcriptomics

### 1. Systems Biology, Pharmacology, and Toxicology (LO 1) — `systems-pharm-network`
- **Teaching question:** why does one drug acting on one receptor lead to different outcomes in
  different organs?
- **Students do:** switch the systems, pharmacology and toxicology views on and off.
- **What happens:** systems adds the network, pharmacology shows the drug and the organ-specific
  pathway, toxicology adds the adverse endpoint (and the drug node, even if pharmacology is off).
- **Files:** `systems-pharm-network.js` / `.css`; content in `data/systems-pharm-network.json`
  (`drug`, `receptor`, `genes`, `responses`, `geneResponse`, `organs`).

### 2. Understanding 'Omic Signatures (LO 2) — `omic-signatures`
- **Teaching question:** what is a signature, and how can similarity between signatures answer
  questions about disease and drugs?
- **Students do:** three predict-then-reveal steps. (1) Does the unclustered heatmap hide real
  signatures? Reveal with hierarchical clustering. (2) Which disease are a new sample's genes most
  similar to? (3) Which disease would a drug (the inverse of one signature) most likely treat?
- **Files:** `omic-signatures.js` / `.css`; content in `data/omic-signatures.json` (`genes`,
  `chemicals`, `pairs`, `matrix`). Uses `js/clustering.js` and `js/similarity.js`.

### 3. Mode of Action Discovery (LO 3) — `mode-of-action`
- **Teaching question:** how do you work out which receptor a compound acts through?
- **Students do:** read a clustered heatmap of 10 compounds × 48 genes whose genes are annotated
  by receptor target (GR, ER, PPARα, AhR, PXR), decide which receptor a starred pair acts through,
  and lock in an answer. Click a receptor chip to highlight its genes.
- **Reveal:** an over-representation test (Fisher's exact) for each receptor's target set among the
  genes changed in both compounds, and any cross-talk. A new seed changes the starred pair, values
  and noise.
- **Files:** `mode-of-action.js` / `.css` (receptor gene sets are defined in the script).

### 4. Over-Representation or Ranked? (LO 3) — `enrichment-methods`
- **Teaching question:** how do over-representation analysis and ranked methods (GSEA-style)
  differ, and when do they disagree?
- **Students do:** look at 20 ranked genes, lock in which pathway is enriched, then compare both
  methods on the same data. Each seed has exactly one truly enriched pathway.
- **Files:** `enrichment-methods.js` / `.css`; uses `js/stats-utils.js`.

### 5. From Gene Curves to a Dose (LO 4) — `pathway-point-of-departure`
- **Teaching question:** how do thousands of gene dose-response curves become one point of
  departure, and does the definition matter?
- **Students do:** Step 1, 80 gene curves, each with a benchmark dose (BMD), grouped by pathway
  chips. Step 2, BMDs by pathway with a dose slider and a Fisher's exact enrichment test at each
  dose. Step 3, ten established ways to define the point of departure, listed side by side on one
  dose axis (no right answer).
- **Design:** every seed guarantees three real pathways that become enriched, a cell-cycle label
  that never does, and one outlier gene far below the rest, so most methods land in a similar
  range and only extremes stand apart.
- **Files:** `pathway-point-of-departure.js` / `.css` (the ten methods are in `buildMethods`).

## Lecture 2 — Single-Cell and Spatial

### 6. Bulk or Mixed? Composition vs. State (LO 1) — `composition-vs-state`
- **Teaching question:** can a bulk measurement tell more cells from a change in what each cell does?
- **Students do:** a toy liver of 10 cells × 10 genes. Slide the number of immune cells, then turn
  up immune genes inside a fixed number of immune cells, then compare the two stories.
- **Files:** `composition-vs-state.js` / `.css`.

### 7. Seeing Space in a Tissue Measurement (LO 2) — `spatial-composition`
- **Teaching question:** what does a bulk measurement lose that single-cell resolution with
  position keeps?
- **Students do:** raise the immune-cell share of a 20 × 20 tissue (clustered or scattered) and
  watch three views: the dot map, a compressed 10-gene single-cell heatmap, and the single bulk
  column those cells collapse into.
- **Design:** a cell's expression depends only on its type, never its position, so switching
  between clustered and scattered moves the dots but leaves the heatmap and bulk column unchanged.
- **Files:** `spatial-composition.js` / `.css`.

### 8. Screening by Cell-Specific Signature (LO 3) — `cell-specific-screening`
- **Teaching question:** if a disease is driven by one cell type, which drug should you test, and
  what would a bulk screen have chosen?
- **Students do:** compare two candidate drugs against hepatocyte and immune-cell disease
  signatures, pick the drug that is the mirror image of the immune signature, then check.
- **Reveal:** correlations with each cell type and with the bulk (85% hepatocyte) signature; the
  feedback depends on the answer. Which letter is correct changes with the seed.
- **Files:** `cell-specific-screening.js` / `.css`.

### 9. Cell-Specific vs. Tissue-Level Dose-Response (LO 4) — `cell-specific-dose-response`
- **Teaching question:** how does a bulk dose-response curve hide a sensitive subpopulation?
- **Students do:** start from one bulk curve and its 10%-response dose, then tick "Split into cell
  types", "Split into regions (portal / central)", or both (a portal and a central curve per cell
  type, central dashed). A dose slider reads each curve's response.
- **Files:** `cell-specific-dose-response.js` / `.css`.

---

## Reusable component: prediction, commitment and feedback

`js/prediction-component.js` (`PredictionComponent.createPredictionWidget`) renders a question, a
commit ("lock in") button and a reveal that reports correct/incorrect with an explanation. It
supports select and numeric inputs, and a `reveal(correctValue, evaluate)` call. If a student reveals without locking in, the
current selection is committed first. Use it in a new activity when
the point is "predict, then see".
