# Technical Limits

What is practical to build in a fully static, GitHub-Pages-only, no-backend lecture site, and how
the activities in this course are scaled to fit.

## The core constraint

Everything runs entirely in the student's browser. There is no server to precompute anything, no
database and no API to call. That means:

- All computation (similarity, clustering, enrichment statistics, simulation) happens client-side,
  in JavaScript, on every interaction.
- Data must be small enough to ship with the page and recompute fast enough to feel live (well
  under a second, ideally instant) on an ordinary student laptop.
- `fetch()` of a local `data/*.json` file is blocked under a bare `file://` URL (double-clicking
  the HTML file). This is a browser security restriction, not a bug. Use `quarto preview`, serve
  `_site/` with a static file server, or use the deployed GitHub Pages URL.

## Straightforward and well supported (used throughout)

Sliders, toggles, dropdowns and checkboxes; randomisation with a seeded generator (the same
`?seed=` always gives the same scenario); immediate recalculation; dynamic SVG and Canvas plots;
heatmaps; hierarchical clustering and dendrograms on small matrices; Fisher's exact tests;
bootstrap-style resampling on small datasets; and encoding small state in a URL query string.

## Practical with care

A few hundred to a couple of thousand plotted points. The single-cell view in *Seeing Space*
draws 400 cells × 10 genes to a Canvas, averaging cells per pixel column, which is instant;
much larger heatmaps would need the same Canvas approach and lose per-cell hover tooltips.

## Deliberately out of scope

- **Full transcriptomes or real single-cell datasets** (tens of thousands of genes, hundreds of
  thousands of cells). The activities use 10 to 100 genes and small synthetic cell counts so
  each isolates one idea.
- **UMAP and other compute-heavy embeddings.** Distances in a UMAP are easy to over-interpret in
  a short demo, and a from-scratch implementation is a poor use of client-side compute.
- **A real annotation database in the browser.** The enrichment activities test against small
  invented gene sets, not Gene Ontology or Reactome.
- **Arbitrary code execution, long-running optimisation, large file uploads.**
- **Collaboration, accounts, grading or saved results across devices.** The site collects and
  transmits nothing; each browser tab is independent.

These needs normally call for precomputation, a backend, an institutional platform, a separate
analysis notebook or a dedicated application, not a static lecture site.

## Simplifications made (and why)

- **Synthetic data.** Every activity is built so its single teaching point holds for every seed
  (for example, exactly one truly enriched pathway; a drug that matches the immune signature but
  not the bulk one). That means the data are tuned for teaching, not realistic noise.
- **Statistics are hand-rolled.** Fisher's exact test, Pearson correlation, hierarchical
  clustering and the benchmark-dose calculations are small, auditable implementations, accurate
  for teaching but not a substitute for statistical software.
- **No visualisation library.** There is no D3, Plotly or similar; hand-written SVG and Canvas is
  simpler to read and keeps each activity dependency-free.
- **Bulk is a weighted average.** Bulk signals are the average of cell values weighted by
  how many cells of each type there are, ignoring differences in RNA content per cell.

## Performance ballpark (ordinary laptop)

| Activity | Data scale | Recompute |
|---|---|---|
| Systems Biology, Pharmacology, and Toxicology | 6 genes, 2 organs | instant |
| Understanding 'Omic Signatures | 100 genes × 16 samples, clustered live | instant |
| Mode of Action Discovery | 10 compounds × 48 genes, clustered on both axes | instant |
| Over-Representation or Ranked? | 20 genes, permutation test | instant |
| From Gene Curves to a Dose | 80 genes, ten point-of-departure methods | instant |
| Bulk or Mixed? | 10 cells × 10 genes | instant |
| Seeing Space in a Tissue Measurement | 400 cells × 10 genes (Canvas) | instant |
| Screening by Cell-Specific Signature | 30 genes × 2 cell types, 2 drugs | instant |
| Cell-Specific vs. Tissue-Level Dose-Response | up to 8 curves + bulk | instant |

If you scale any dataset well past these ranges, re-check recompute time before using it live: a
control can start to feel laggy long before the browser struggles, which undermines the "immediate
feedback" these activities rely on.
