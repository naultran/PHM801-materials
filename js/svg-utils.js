/**
 * Minimal SVG DOM-builder + scale/axis helpers shared by every hand-rolled
 * chart (Signature Matcher, Heatmap dendrogram, Dose-Response, Experimental
 * Design volcano/power plots, PCA scatter). Deliberately not a charting
 * library — just enough to avoid re-deriving axis/scale math per activity.
 */

const SVG_NS = "http://www.w3.org/2000/svg";

function svgEl(tag, attrs = {}, children = []) {
  const node = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (v !== null && v !== undefined) node.setAttribute(k, v);
  });
  children.forEach((c) => node.appendChild(typeof c === "string" ? document.createTextNode(c) : c));
  return node;
}

function clearSVG(svgNode) {
  while (svgNode.firstChild) svgNode.removeChild(svgNode.firstChild);
}

/** value -> pixel, linear. Also exposes .invert(pixel) -> value. */
function linearScale(domain, range) {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0 || 1;
  const scale = (v) => r0 + ((v - d0) / span) * (r1 - r0);
  scale.invert = (px) => d0 + ((px - r0) / (r1 - r0 || 1)) * span;
  return scale;
}

/** value -> pixel, log10. Domain values must be > 0. */
function logScale(domain, range) {
  const d0 = Math.log10(domain[0]);
  const d1 = Math.log10(domain[1]);
  const [r0, r1] = range;
  const span = d1 - d0 || 1;
  const scale = (v) => r0 + ((Math.log10(v) - d0) / span) * (r1 - r0);
  scale.invert = (px) => Math.pow(10, d0 + ((px - r0) / (r1 - r0 || 1)) * span);
  return scale;
}

function niceLinearTicks(domain, count = 5) {
  const [d0, d1] = domain;
  const step = (d1 - d0) / Math.max(count - 1, 1);
  return Array.from({ length: count }, (_, i) => d0 + i * step);
}

/** One tick per power of ten between the domain's exponents (for logScale axes). */
function logTicks(domain) {
  const lo = Math.floor(Math.log10(domain[0]));
  const hi = Math.ceil(Math.log10(domain[1]));
  const ticks = [];
  for (let e = lo; e <= hi; e++) ticks.push(Math.pow(10, e));
  return ticks;
}

/**
 * Build a <g> of tick marks + labels for a scale.
 * @param {{scale:Function, ticks:number[], orientation:'bottom'|'left', tickFormat?:Function}} opts
 */
function axis({ scale, ticks, orientation = "bottom", tickFormat }) {
  const g = svgEl("g", { class: `svg-axis svg-axis-${orientation}` });
  ticks.forEach((t) => {
    const pos = scale(t);
    const label = tickFormat ? tickFormat(t) : MathUtils.formatNumber(t, 1);
    if (orientation === "bottom") {
      g.appendChild(svgEl("line", { x1: pos, x2: pos, y1: 0, y2: 6, class: "svg-axis-tick" }));
      g.appendChild(svgEl("text", { x: pos, y: 20, "text-anchor": "middle", class: "svg-axis-label" }, [label]));
    } else {
      g.appendChild(svgEl("line", { x1: -6, x2: 0, y1: pos, y2: pos, class: "svg-axis-tick" }));
      g.appendChild(svgEl("text", { x: -10, y: pos + 4, "text-anchor": "end", class: "svg-axis-label" }, [label]));
    }
  });
  return g;
}

window.SvgUtils = { svgEl, clearSVG, linearScale, logScale, niceLinearTicks, logTicks, axis };
