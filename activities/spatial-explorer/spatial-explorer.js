/**
 * Activity 10 — Spatial Transcriptomics Explorer.
 * Data: ../../data/spatial-explorer.json (per-gene 2D grids, <=60x60)
 * Teaching point: capture-area size trades spatial resolution for signal
 * averaging — as the "spot" gets bigger, local signals merge, boundaries
 * blur, and cell types mix together, exactly what a bulk measurement does
 * to an entire tissue at once.
 */

function sequentialColor(t) {
  t = MathUtils.clamp(t, 0, 1);
  const low = [244, 246, 248]; // --color-bg-alt
  const high = [27, 58, 92]; // --color-primary
  const rgb = low.map((v, i) => Math.round(v + (high[i] - v) * t));
  return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
}

function computeCapturedGrid(trueGrid, width, height, spacing, sigma) {
  const spotCols = Math.max(1, Math.round(width / spacing));
  const spotRows = Math.max(1, Math.round(height / spacing));
  const captured = [];
  const centers = [];
  for (let sr = 0; sr < spotRows; sr++) {
    const row = [];
    for (let sc = 0; sc < spotCols; sc++) {
      const cx = Math.min(width - 1, (sc + 0.5) * (width / spotCols));
      const cy = Math.min(height - 1, (sr + 0.5) * (height / spotRows));
      centers.push([cx, cy]);
      const radius = Math.max(1, Math.ceil(sigma * 3));
      let wSum = 0, vSum = 0;
      const x0 = Math.max(0, Math.floor(cx - radius)), x1 = Math.min(width - 1, Math.ceil(cx + radius));
      const y0 = Math.max(0, Math.floor(cy - radius)), y1 = Math.min(height - 1, Math.ceil(cy + radius));
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const d2 = (x - cx) ** 2 + (y - cy) ** 2;
          const w = Math.exp(-d2 / (2 * sigma * sigma || 1e-6));
          wSum += w;
          vSum += w * trueGrid[y][x];
        }
      }
      row.push(wSum > 0 ? vSum / wSum : trueGrid[Math.round(cy)][Math.round(cx)]);
    }
    captured.push(row);
  }
  return { grid: captured, spotCols, spotRows, centers };
}

ActivityShell.init({
  rootId: "activity-root",
  title: "Spatial Transcriptomics Explorer",
  dataUrl: "../../data/spatial-explorer.json",
  defaultSeed: 9003,
  instructions:
    "Click any location on the true-resolution map to inspect a single point. Increase the capture-area " +
    "size to see local signals merge — this is exactly what happens when a bulk or low-resolution " +
    "measurement averages across a mix of cell types and locations.",

  render(data, { container }) {
    const { width, height } = data.gridSize;
    const genes = data.genes;
    let geneIndex = 0;
    let sigma = data.defaultBlurSigma;
    let spacing = data.defaultSpotSpacing;
    let showSpotOverlay = false;
    let selectedCell = null;

    const layout = document.createElement("div");
    layout.className = "sp-layout";
    container.appendChild(layout);
    const controls = document.createElement("div");
    const mainCol = document.createElement("div");
    layout.appendChild(controls);
    layout.appendChild(mainCol);

    const geneRow = document.createElement("div");
    geneRow.className = "control-row";
    const geneLabel = document.createElement("label"); geneLabel.className = "field-label"; geneLabel.textContent = "Gene";
    const geneSelect = document.createElement("select"); geneSelect.className = "touch-target";
    genes.forEach((g, i) => { const o = document.createElement("option"); o.value = i; o.textContent = g.label; geneSelect.appendChild(o); });
    geneSelect.addEventListener("change", () => { geneIndex = Number(geneSelect.value); selectedCell = null; update(); });
    geneRow.appendChild(geneLabel); geneRow.appendChild(geneSelect);
    controls.appendChild(geneRow);

    const geneDescription = document.createElement("p");
    geneDescription.style.fontSize = "var(--font-size-sm)";
    geneDescription.style.color = "var(--color-text-muted)";
    controls.appendChild(geneDescription);

    function sliderRow(labelText, min, max, step, value, onInput, formatFn) {
      const row = document.createElement("div");
      row.className = "control-row";
      const label = document.createElement("label"); label.className = "field-label"; label.textContent = labelText;
      const input = document.createElement("input");
      input.type = "range"; input.min = String(min); input.max = String(max); input.step = String(step); input.value = String(value);
      const valueEl = document.createElement("span"); valueEl.className = "control-row__value";
      valueEl.textContent = (formatFn || String)(value);
      input.addEventListener("input", () => {
        const v = Number(input.value);
        valueEl.textContent = (formatFn || String)(v);
        onInput(v);
      });
      row.appendChild(label); row.appendChild(input); row.appendChild(valueEl);
      return row;
    }

    controls.appendChild(sliderRow("Capture-area size (σ)", 0.3, 8, 0.1, sigma, (v) => { sigma = v; update(); }));
    controls.appendChild(sliderRow("Spot spacing (grid cells)", 1, 10, 1, spacing, (v) => { spacing = v; update(); }));

    const overlayRow = document.createElement("label");
    overlayRow.className = "control-row";
    overlayRow.style.display = "flex"; overlayRow.style.alignItems = "center"; overlayRow.style.gap = "6px";
    const overlayCb = document.createElement("input");
    overlayCb.type = "checkbox";
    overlayCb.addEventListener("change", () => { showSpotOverlay = overlayCb.checked; update(); });
    overlayRow.appendChild(overlayCb);
    overlayRow.append(" Show capture-spot centers on true map");
    controls.appendChild(overlayRow);

    const sp_legend = document.createElement("div");
    sp_legend.className = "sp-legend";
    sp_legend.innerHTML = '<span>Low</span><span class="sp-legend-swatch"></span><span>High</span>';
    controls.appendChild(sp_legend);

    const canvasesRow = document.createElement("div");
    canvasesRow.className = "sp-canvases";
    mainCol.appendChild(canvasesRow);

    const trueBox = document.createElement("div");
    trueBox.className = "sp-canvas-box";
    trueBox.innerHTML = "<h4>True single-cell resolution</h4>";
    const trueCanvas = document.createElement("canvas");
    trueBox.appendChild(trueCanvas);
    canvasesRow.appendChild(trueBox);

    const capturedBox = document.createElement("div");
    capturedBox.className = "sp-canvas-box";
    capturedBox.innerHTML = "<h4>Captured (spot-averaged) view</h4>";
    const capturedCanvas = document.createElement("canvas");
    capturedBox.appendChild(capturedCanvas);
    canvasesRow.appendChild(capturedBox);

    const readouts = document.createElement("div");
    readouts.className = "sp-readouts";
    mainCol.appendChild(readouts);

    const CELL_PX = 8;

    function drawGrid(canvas, grid, cellPx, minV, maxV, overlayCenters) {
      const w = grid[0].length, h = grid.length;
      canvas.width = w * cellPx;
      canvas.height = h * cellPx;
      const ctx = canvas.getContext("2d");
      const span = Math.max(maxV - minV, 1e-6);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          ctx.fillStyle = sequentialColor((grid[y][x] - minV) / span);
          ctx.fillRect(x * cellPx, y * cellPx, cellPx, cellPx);
        }
      }
      if (overlayCenters) {
        overlayCenters.forEach(([cx, cy]) => {
          ctx.beginPath();
          ctx.arc(cx * cellPx, cy * cellPx, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = "#b5651d";
          ctx.fill();
        });
      }
      if (selectedCell) {
        ctx.strokeStyle = "#b5651d";
        ctx.lineWidth = 2;
        ctx.strokeRect(selectedCell.x * cellPx, selectedCell.y * cellPx, cellPx, cellPx);
      }
    }

    trueCanvas.addEventListener("click", (e) => {
      const rect = trueCanvas.getBoundingClientRect();
      const scaleX = trueCanvas.width / rect.width;
      const scaleY = trueCanvas.height / rect.height;
      const x = Math.floor(((e.clientX - rect.left) * scaleX) / CELL_PX);
      const y = Math.floor(((e.clientY - rect.top) * scaleY) / CELL_PX);
      if (x >= 0 && x < width && y >= 0 && y < height) {
        selectedCell = { x, y };
        update();
      }
    });

    function update() {
      const gene = genes[geneIndex];
      const grid = gene.grid;
      geneDescription.textContent = gene.description;

      const allValues = grid.flat();
      const minV = Math.min(...allValues), maxV = Math.max(...allValues);

      const { grid: capturedGrid, centers } = computeCapturedGrid(grid, width, height, spacing, sigma);
      const capturedCellPx = Math.max(2, Math.floor((width * CELL_PX) / capturedGrid[0].length));

      drawGrid(trueCanvas, grid, CELL_PX, minV, maxV, showSpotOverlay ? centers : null);
      drawGrid(capturedCanvas, capturedGrid, capturedCellPx, minV, maxV, null);

      const bulkAvg = MathUtils.mean(allValues);
      const leftHalf = grid.map((row) => row.slice(0, Math.floor(width / 2))).flat();
      const rightHalf = grid.map((row) => row.slice(Math.floor(width / 2))).flat();
      const regionScore = MathUtils.mean(rightHalf) - MathUtils.mean(leftHalf);
      const resolutionLabel = spacing <= 2 ? "High" : spacing <= 5 ? "Medium" : "Low";
      const singleValue = selectedCell ? grid[selectedCell.y][selectedCell.x] : null;

      readouts.innerHTML = "";
      const tiles = [
        ["Bulk average (whole tissue)", MathUtils.formatNumber(bulkAvg, 2)],
        ["Region score (right − left half)", MathUtils.formatNumber(regionScore, 2)],
        ["Resolution", `${resolutionLabel} (1 spot ≈ ${spacing}×${spacing} cells)`]
      ];
      if (singleValue !== null) {
        tiles.push([`Single location (${selectedCell.x}, ${selectedCell.y})`, MathUtils.formatNumber(singleValue, 2)]);
      }
      tiles.forEach(([label, value]) => {
        const tile = document.createElement("div");
        tile.className = "sp-readout-tile";
        tile.innerHTML = `<span class="sp-readout-tile__label">${label}</span><span class="sp-readout-tile__value">${value}</span>`;
        readouts.appendChild(tile);
      });
    }

    update();
  }
});
