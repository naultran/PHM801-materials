/**
 * Standalone demo/reference implementation for js/before-after-component.js.
 * Illustrates "bulk vs single-cell resolution" — the same teaching contrast
 * used more fully in the Mixture Simulator and Spatial Explorer activities.
 */

function bar(label, value, maxValue, seriesClass) {
  const row = document.createElement("div");
  row.className = "demo-bar-row";
  const labelEl = document.createElement("span");
  labelEl.className = "demo-bar-row__label";
  labelEl.textContent = label;
  const track = document.createElement("div");
  track.className = "demo-bar-row__track";
  const fill = document.createElement("div");
  fill.className = `demo-bar-row__fill ${seriesClass || ""}`;
  fill.style.width = `${Math.max(2, (value / maxValue) * 100)}%`;
  track.appendChild(fill);
  const valueEl = document.createElement("span");
  valueEl.className = "control-row__value";
  valueEl.textContent = MathUtils.formatNumber(value, 1);
  row.appendChild(labelEl);
  row.appendChild(track);
  row.appendChild(valueEl);
  return row;
}

ActivityShell.init({
  rootId: "activity-root",
  title: "Component Demo: Before/After Reveal Comparison",
  defaultSeed: 777,
  instructions:
    "This page demonstrates the reusable before/after component used inside other activities " +
    "(for example, the Bulk-Tissue Mixture Simulator and the Spatial Transcriptomics Explorer). " +
    "The \"before\" view shows a single pooled bulk-tissue average; press Reveal to see the " +
    "single-cell resolution hidden underneath it.",
  render(data, { rng, container }) {
    const cellTypes = [
      { label: "Hepatocytes", series: "" },
      { label: "Macrophages", series: "series-2" },
      { label: "Endothelial cells", series: "series-3" },
      { label: "Stellate cells", series: "series-4" }
    ];
    const perCellValues = cellTypes.map((c) => rng.range(2, 20));
    const bulkAverage = MathUtils.mean(perCellValues);
    const maxValue = Math.max(...perCellValues, bulkAverage) * 1.1;

    const mount = document.createElement("div");
    container.appendChild(mount);

    BeforeAfterComponent.createBeforeAfter(mount, {
      revealLabel: "Reveal single-cell resolution",
      beforeRenderFn(el) {
        const p = document.createElement("p");
        p.textContent = "Bulk tissue measurement (all cells pooled together):";
        el.appendChild(p);
        el.appendChild(bar("Whole-tissue average", bulkAverage, maxValue));
      },
      afterRenderFn(el) {
        const p = document.createElement("p");
        p.textContent = "The same tissue, resolved by cell type:";
        el.appendChild(p);
        cellTypes.forEach((c, i) => el.appendChild(bar(c.label, perCellValues[i], maxValue, c.series)));
        const note = document.createElement("p");
        note.style.marginTop = "12px";
        note.style.color = "var(--color-text-muted)";
        note.textContent =
          "The bulk average looked uniform, but it was hiding substantial cell-type-level variation — " +
          "this is the core motivation for single-cell approaches.";
        el.appendChild(note);
      }
    });
  }
});
