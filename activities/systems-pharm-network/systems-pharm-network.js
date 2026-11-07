/**
 * Activity — Systems Biology, Pharmacology & Toxicology.
 * Data: ../../data/systems-pharm-network.json (drug, receptor, genes, responses,
 * gene->response mapping, two organs each naming which response it favors and
 * what adverse endpoint the toxicology view adds)
 * Teaching point: the same receptor and the same drug can still produce
 * different tissue outcomes — network complexity alone doesn't explain that,
 * organ context does. Three checkboxes ("systems", "pharmacology",
 * "toxicology") independently control network complexity, drug presence, and
 * adverse endpoints; only once systems + pharmacology are both on does the
 * organ-specific therapeutic path become visible.
 *
 * Toxicology adds (yellow, dashed): per organ, an adverse endpoint, plus —
 * when the systems view is also on — the genes behind it. Without the
 * systems view you see the endpoint but not the mechanism, mirroring how
 * classical toxicology observed outcomes before the genes were known.
 */

const VB_W = 650, VB_H = 320, VB_H_TOX = 392;
const DRUG_POS = { x: 70, y: 160 };
const GR_POS = { x: 230, y: 160 };
const GENE_X = 360;
const GENE_Y = [40, 88, 136, 184, 232, 280];
const RESPONSE_X = 560;
// Toxicology layout: gene row sits in the empty lower-left area under GR/drug,
// the endpoint fans in beneath it; endpoints that hang off a response sit
// below that response instead.
const TOX_ROW_Y = 262, TOX_ROW_X0 = 40, TOX_ROW_STEP = 78, TOX_ENDPOINT_Y = 350;
const TOX_ATTACHED_Y = 330;

function toxRowXs(n) {
  return Array.from({ length: n }, (_, i) => TOX_ROW_X0 + i * TOX_ROW_STEP);
}

function computeGraph(data, systemsOn, pharmOn, toxOn, organ) {
  const nodes = [{ id: "GR", label: data.receptor, x: GR_POS.x, y: GR_POS.y, kind: "receptor" }];
  const edges = [];

  if (pharmOn) {
    nodes.push({ id: "drug", label: data.drug, x: DRUG_POS.x, y: DRUG_POS.y, kind: "drug" });
    edges.push({ from: "drug", to: "GR" });
  }

  if (systemsOn) {
    const responseY = {};
    data.responses.forEach((r) => {
      const geneYs = data.genes
        .filter((g) => data.geneResponse[g] === r.id)
        .map((g) => GENE_Y[data.genes.indexOf(g)]);
      responseY[r.id] = geneYs.reduce((a, b) => a + b, 0) / geneYs.length;
    });
    data.responses.forEach((r) => {
      nodes.push({ id: r.id, label: r.label, x: RESPONSE_X, y: responseY[r.id], kind: "response" });
    });
    data.genes.forEach((gene, i) => {
      nodes.push({ id: gene, label: gene, x: GENE_X, y: GENE_Y[i], kind: "gene" });
      edges.push({ from: "GR", to: gene });
      edges.push({ from: gene, to: data.geneResponse[gene] });
    });
  } else {
    nodes.push({ id: "response", label: "Response", x: RESPONSE_X, y: (GENE_Y[0] + GENE_Y[5]) / 2, kind: "response" });
    edges.push({ from: "GR", to: "response" });
  }

  if (systemsOn && pharmOn) {
    const target = organ.highlightedResponse;
    edges.forEach((e) => {
      e.highlighted =
        (e.from === "drug" && e.to === "GR") ||
        (e.from === "GR" && data.geneResponse[e.to] === target) ||
        (e.to === target);
    });
    nodes.forEach((n) => {
      n.highlighted =
        n.id === "drug" || n.id === "GR" || n.id === target || data.geneResponse[n.id] === target;
    });
  } else if (!systemsOn && pharmOn && organ.classicalEndpoint) {
    // Classical (pre-systems) pharmacology already knew this much: this
    // specific organ's endpoint responds to the drug — that's exactly the
    // single-endpoint result the field had before a systems view existed.
    edges.forEach((e) => { e.highlighted = true; });
    nodes.forEach((n) => { n.highlighted = true; });
  }

  // Added after the red-highlight pass on purpose, so toxicity never gets
  // swept into the therapeutic (red) path.
  if (toxOn && organ.toxicology) {
    const tox = organ.toxicology;
    const toxGenes = systemsOn ? (tox.genes || []) : [];
    const attached = Boolean(tox.attachTo);
    const source = attached ? (systemsOn ? tox.attachTo : "response") : "GR";

    const rowXs = toxRowXs((tox.genes || []).length);
    const endpointPos = attached
      ? { x: RESPONSE_X, y: TOX_ATTACHED_Y }
      : { x: rowXs.length ? (rowXs[0] + rowXs[rowXs.length - 1]) / 2 : GR_POS.x, y: TOX_ENDPOINT_Y };

    nodes.push({ id: "toxEndpoint", label: tox.endpoint, x: endpointPos.x, y: endpointPos.y, kind: "toxendpoint", tox: true });

    if (toxGenes.length) {
      toxGenes.forEach((gene, i) => {
        const id = `tox:${gene}`;
        nodes.push({ id, label: gene, x: rowXs[i], y: TOX_ROW_Y, kind: "toxgene", tox: true });
        edges.push({ from: source, to: id, tox: true });
        edges.push({ from: id, to: "toxEndpoint", tox: true });
      });
    } else {
      edges.push({ from: source, to: "toxEndpoint", tox: true });
    }
  }

  return { nodes, edges };
}

function nodeSize(kind) {
  if (kind === "gene") return { rx: 16, ry: 16 };
  if (kind === "response") return { w: 150, h: 50 };
  if (kind === "toxgene") return { w: 72, h: 28 };
  if (kind === "toxendpoint") return { w: 170, h: 44 };
  if (kind === "drug") return { w: 130, h: 46 }; // "Dexamethasone" is wider than the receptor box
  return { w: 100, h: 46 }; // receptor
}

/** Split a long label onto two lines at the space nearest its middle. */
function labelLines(label) {
  if (label.length <= 17 || label.indexOf(" ") < 0) return [label];
  const mid = label.length / 2;
  let best = -1;
  for (let i = 0; i < label.length; i++) {
    if (label[i] === " " && (best < 0 || Math.abs(i - mid) < Math.abs(best - mid))) best = i;
  }
  return [label.slice(0, best), label.slice(best + 1)];
}

function renderPanel(svg, graph, height) {
  SvgUtils.clearSVG(svg);
  svg.setAttribute("viewBox", `0 0 ${VB_W} ${height}`);

  const byId = {};
  graph.nodes.forEach((n) => (byId[n.id] = n));

  const edgesLayer = SvgUtils.svgEl("g", { class: "spn-edges" });
  graph.edges.forEach((e) => {
    const a = byId[e.from], b = byId[e.to];
    if (!a || !b) return;
    edgesLayer.appendChild(SvgUtils.svgEl("line", {
      x1: a.x, y1: a.y, x2: b.x, y2: b.y,
      class: "spn-edge" + (e.highlighted ? " spn-edge--highlighted" : "") + (e.tox ? " spn-edge--tox" : "")
    }));
  });
  svg.appendChild(edgesLayer);

  const nodesLayer = SvgUtils.svgEl("g", { class: "spn-nodes" });
  graph.nodes.forEach((n) => {
    const g = SvgUtils.svgEl("g", { class: `spn-node spn-node--${n.kind}` + (n.highlighted ? " spn-node--highlighted" : "") });
    if (n.kind === "gene") {
      const { rx } = nodeSize(n.kind);
      g.appendChild(SvgUtils.svgEl("circle", { cx: n.x, cy: n.y, r: rx, class: "spn-shape" }));
      g.appendChild(SvgUtils.svgEl("text", { x: n.x + rx + 8, y: n.y + 4, class: "spn-label spn-label--left" }, [n.label]));
    } else {
      const { w, h } = nodeSize(n.kind);
      g.appendChild(SvgUtils.svgEl("rect", {
        x: n.x - w / 2, y: n.y - h / 2, width: w, height: h, rx: 10, class: "spn-shape"
      }));
      const lines = labelLines(n.label);
      if (lines.length === 1) {
        g.appendChild(SvgUtils.svgEl("text", { x: n.x, y: n.y + 5, class: "spn-label" }, [lines[0]]));
      } else {
        const text = SvgUtils.svgEl("text", { x: n.x, y: n.y - 3, class: "spn-label" });
        text.appendChild(SvgUtils.svgEl("tspan", { x: n.x }, [lines[0]]));
        text.appendChild(SvgUtils.svgEl("tspan", { x: n.x, dy: 17 }, [lines[1]]));
        g.appendChild(text);
      }
    }
    nodesLayer.appendChild(g);
  });
  svg.appendChild(nodesLayer);
}

function describeTox(data, systemsOn, organs) {
  const parts = organs.filter((o) => o.toxicology).map((o) => {
    const t = o.toxicology;
    let s = `${o.label}: adverse endpoint "${t.endpoint}"`;
    if (systemsOn && t.attachTo) {
      const r = data.responses.find((r) => r.id === t.attachTo);
      if (r) s += `, building on the "${r.label}"`;
    }
    if (systemsOn && t.genes && t.genes.length) s += ` (via ${t.genes.join(", ")})`;
    return s;
  });
  return `Toxicology approach on: adverse endpoints appear in yellow with dashed lines — ${parts.join("; ")}.` +
    (systemsOn ? "" : " Without the systems view you can see the endpoint but not the genes behind it.");
}

function describeState(data, systemsOn, pharmOn, toxOn, organs) {
  let base;
  if (!systemsOn && !pharmOn) {
    base = `Systems and pharmacology approaches are off: every organ shows the same minimal picture — ${data.receptor} leading to a single generic response.`;
  } else if (systemsOn && !pharmOn) {
    base = `Systems approach on: ${data.receptor} now branches to ${data.genes.length} genes, which converge into two response pathways ` +
      `(${data.responses.map((r) => r.label).join(", ")}). Still identical across organs — nothing organ-specific yet.`;
  } else if (!systemsOn && pharmOn) {
    const known = organs.find((o) => o.classicalEndpoint);
    base = `Pharmacology approach on: ${data.drug} now activates ${data.receptor}. Without the expanded network there's only one generic ` +
      `response to show, but classical pharmacology already knew this much: ${known ? known.label : "one organ"} shows a measurable ` +
      `response at this endpoint. The other organ wasn't part of that classical picture — not because nothing was happening there, ` +
      `but because no one had looked.`;
  } else {
    const parts = organs.map((o) => {
      const r = data.responses.find((r) => r.id === o.highlightedResponse);
      return `${o.label} highlights the path toward "${r.label}"`;
    });
    base = `Systems and pharmacology approaches on: ${data.drug} activates the same ${data.receptor} in every organ, but each organ favors a different downstream ` +
      `pathway — ${parts.join("; ")}. Same drug, same receptor, different outcome.`;
  }
  return toxOn ? `${base} ${describeTox(data, systemsOn, organs)}` : base;
}

ActivityShell.init({
  rootId: "activity-root",
  title: "Systems Biology, Pharmacology & Toxicology",
  dataUrl: "../../data/systems-pharm-network.json",
  defaultSeed: 4200,
  instructions:
    "Turn the three approaches on and off independently. \"Systems\" controls how much of the network you can see; " +
    "\"Pharmacology\" adds the drug; \"Toxicology\" adds each organ's adverse endpoint. With systems and pharmacology " +
    "both on, it becomes clear why the same drug and receptor can still produce a different outcome in each organ — " +
    "and toxicology shows the unwanted outcomes that come along with it.",

  render(data, { container }) {
    let systemsOn = false;
    let pharmOn = false;
    let toxOn = false;

    const controls = document.createElement("fieldset");
    controls.className = "control-group spn-controls";
    controls.innerHTML = "<legend>Approach</legend>";

    function checkboxRow(labelText, onChange) {
      const row = document.createElement("label");
      row.className = "spn-checkbox-row";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.addEventListener("change", () => { onChange(cb.checked); update(); });
      row.appendChild(cb);
      row.append(" " + labelText);
      controls.appendChild(row);
      return cb;
    }

    const systemsCb = checkboxRow("Turn on systems approach", (v) => { systemsOn = v; });
    const pharmCb = checkboxRow("Turn on pharmacology approach", (v) => { pharmOn = v; });
    const toxCb = checkboxRow("Turn on toxicology approach", (v) => { toxOn = v; });
    container.appendChild(controls);

    const description = document.createElement("p");
    description.className = "spn-description";
    description.setAttribute("aria-live", "polite");
    container.appendChild(description);

    const legend = document.createElement("div");
    legend.className = "spn-legend";
    legend.innerHTML =
      '<span><span class="spn-legend-swatch"></span> pathway</span>' +
      '<span><span class="spn-legend-swatch spn-legend-swatch--highlighted"></span> this organ\'s dominant pathway</span>' +
      '<span><span class="spn-legend-swatch spn-legend-swatch--tox"></span> adverse (toxicity) endpoint</span>';
    container.appendChild(legend);

    const panelsRow = document.createElement("div");
    panelsRow.className = "spn-panels";
    container.appendChild(panelsRow);

    const panelEls = data.organs.map((organ) => {
      const panel = document.createElement("div");
      panel.className = "spn-panel";
      const h3 = document.createElement("h3");
      h3.textContent = organ.label;
      const svg = SvgUtils.svgEl("svg", { class: "spn-svg", role: "img" });
      panel.appendChild(h3);
      panel.appendChild(svg);
      panelsRow.appendChild(panel);
      return { organ, svg };
    });

    function update() {
      description.textContent = describeState(data, systemsOn, pharmOn, toxOn, data.organs);
      // Both panels share one height so they stay aligned side by side.
      const height = toxOn ? VB_H_TOX : VB_H;
      panelEls.forEach(({ organ, svg }) => {
        const graph = computeGraph(data, systemsOn, pharmOn, toxOn, organ);
        renderPanel(svg, graph, height);
      });
    }

    update();

    return {
      reset() {
        systemsOn = false; pharmOn = false; toxOn = false;
        systemsCb.checked = false; pharmCb.checked = false; toxCb.checked = false;
        update();
      }
    };
  }
});
