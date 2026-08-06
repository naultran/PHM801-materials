# Technical Limits

What's practical to build in a fully static, GitHub-Pages-only, no-backend lecture site —
and, specifically, what simplifications this template made and why. Read this before deciding
how far to push the fictional examples toward real, large-scale data.

## The core constraint

Everything here runs entirely in the student's browser. There is no server to precompute
anything, no database, and no API to call. That means:

- All computation (similarity, clustering, PCA, statistics, simulation) happens client-side,
  in JavaScript, on every interaction.
- All data has to be small enough to both ship in the page load and recompute fast enough to
  feel live (well under a second, ideally instant) on an ordinary student laptop.
- `fetch()` of a local `data/*.json` file is blocked by the browser under a bare `file://` URL
  (opened by double-clicking the HTML file). This is a browser security restriction, not a bug
  in this site — always use `quarto preview`, or serve `_site/` with any static file server, or
  the deployed GitHub Pages URL. See README.md section 2.

## Straightforward and strongly supported (used throughout this template)

Sliders, toggles, dropdowns, buttons, randomization with a seeded PRNG, immediate
recalculation, dynamic SVG/Canvas plots, heatmaps with live row/column reordering,
hierarchical clustering and dendrograms on small datasets (≤30×30 here), drag-and-drop with a
full keyboard-operable alternative, puzzle-piece-style placement, seeded dose-response and
statistical simulations, small PCA (≤~30 variables), spatial raster maps with Canvas,
downloading a small JSON/PNG result to the student's own machine, and encoding small state in
a URL query string (`?mode=`/`?seed=`).

## Practical with care (used more cautiously here)

Hundreds to a couple thousand plotted points; the Experimental Design activity's volcano plot
comfortably handles its full 500-gene slider range but would need debouncing or a coarser
redraw strategy well beyond that. Browser-based PCA via a Jacobi eigendecomposition is fine
for a few dozen genes (this template caps at 12) but is the wrong tool for hundreds. Larger
heatmaps than this template's (≤30×30) are possible with canvas instead of SVG rendering, at
the cost of losing per-cell hover tooltips without extra work.

## Deliberately out of scope for this first-pass template

- **Full transcriptome datasets** (tens of thousands of genes) or **large single-cell
  datasets** (hundreds of thousands of cells) — this template intentionally uses 5–30 genes
  and 5–30 samples per activity, following the "reduced fictional dataset" principle in the
  original project brief.
- **Computationally intensive UMAP** — deliberately not implemented (the PCA Explorer notes
  this explicitly); UMAP's sensitivity to parameters and random initialization makes it easy
  to over-interpret distances in a short classroom demo, and a from-scratch implementation
  would be a poor use of client-side compute for the pedagogical payoff.
- **Large-scale differential expression or a full pathway-enrichment database loaded into the
  browser** — the Experimental Design activity simulates a bounded, illustrative gene universe
  rather than testing against a real annotation database.
- **Arbitrary code execution, long-running optimization, large file uploads** — none of these
  fit a static-hosting model.
- **Real-time collaborative student responses, secure access control, persistent accounts,
  cross-device saved results, or grading integration** — explicitly excluded by design (see
  "Saving and Sharing Student States" in the project brief); this template collects nothing
  and transmits nothing.

These heavier needs normally require precomputation, data reduction, a real backend, an
institutional platform, a separate analysis notebook, or a dedicated application — not a
static lecture site.

## Specific simplifications made in this template (and why)

- **Experimental Design's "variability" slider** combines biological and technical noise into
  one control, rather than two independently tunable sources. A fully separable two-source
  noise model is realistic but adds a control most students won't yet have the background to
  interpret independently; one combined slider keeps the panel teachable while still
  demonstrating the core lesson (more variability → less power).
- **Mixture Simulator's activation gain** applies uniformly to any cell type carrying a
  flagged inflammatory/fibrotic gene, rather than requiring a separate per-cell-type gene list
  in the data schema. This keeps `data/mixture-simulator.json` simpler to hand-edit without
  changing the qualitative story, since baseline signatures already differ appropriately by
  cell type.
- **Spatial Explorer's grids are capped at 60×60 per gene** and are stored as plain nested
  arrays in JSON (hand-editable, not procedurally generated at runtime) — this keeps the
  activity fast, keeps the data instructor-editable without touching JavaScript, and avoids
  suggesting false precision about real spatial coordinates.
- **The t-distribution p-value** in Experimental Design uses a numerical incomplete-beta
  continued-fraction approximation rather than a statistics library. It's accurate to
  well beyond teaching-relevant precision (validated against textbook critical-value tables)
  but should not be mistaken for publication-grade statistical software.
- **PCA uses a classical Jacobi eigendecomposition**, not a numerical library — chosen because
  it reliably recovers *all* eigenpairs of a small dense symmetric matrix in a compact,
  auditable amount of code, which matters for a teaching tool where the implementation itself
  is sometimes worth showing students.
- **No external visualization or drag-and-drop library** (D3, Plotly, Observable Plot,
  SortableJS, Interact.js, Cytoscape.js) is used anywhere in the eight core activities. At this
  template's data scale, hand-rolled SVG/Canvas/Pointer-Events code is simpler to read, modify,
  and keep dependency-free than adapting a general-purpose library's data model to this
  project's specific keyboard-parity and reproducible-seeding requirements.

## Performance ballpark (what to expect on an ordinary laptop)

| Activity | Data scale used | Recompute cost |
|---|---|---|
| Signature Matcher | 3 candidates × 8 genes | instant |
| Heatmap & Clustering | 12 samples × 12 genes | instant |
| Pathway Construction | ≤10 items/stage | instant |
| Mixture Simulator | 4 cell types × 8 genes | instant |
| Dose-Response Lab | 120 curve points + ≤80 replicate points | instant |
| Experimental Design | up to 500 genes × Welch's t-test + BH-FDR | well under 100ms |
| PCA Explorer | 16 samples × 12 genes | well under 100ms, animated over ~500ms |
| Spatial Explorer | ≤60×60 grid × up to 4 genes | instant (Canvas) |

If you significantly scale up any dataset beyond these ranges, re-check recompute time before
using it live in front of a class — a control that used to feel instant can start to feel
laggy well before the browser actually struggles, which undermines the "immediate feedback"
teaching mechanism these activities rely on.
