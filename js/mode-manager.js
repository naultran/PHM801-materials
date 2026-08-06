/**
 * Reads/writes the shared `?mode=` and `?seed=` query-string contract that
 * every activity understands, and provides a tiny pub/sub controller so an
 * activity's own visible mode toggle can update state without a full reload.
 *
 * Depends on: prng.js (load first, for seedFromString/randomSeed).
 */

const VALID_MODES = ["instructor", "student-exploration", "review"];

function readParams() {
  return new URLSearchParams(window.location.search);
}

function getMode(defaultMode = "student-exploration") {
  const m = readParams().get("mode");
  return VALID_MODES.includes(m) ? m : defaultMode;
}

function getSeedFromURL(defaultSeed = null) {
  const s = readParams().get("seed");
  if (s === null || s === "") return defaultSeed;
  const n = Number(s);
  return Number.isFinite(n) ? n : PRNG.seedFromString(s);
}

function setURLParam(key, value) {
  const url = new URL(window.location.href);
  if (value === null || value === undefined) url.searchParams.delete(key);
  else url.searchParams.set(key, String(value));
  window.history.replaceState({}, "", url.toString());
}

function buildShareableURL(params) {
  const url = new URL(window.location.href);
  Object.entries(params).forEach(([k, v]) => {
    if (v === null || v === undefined) url.searchParams.delete(k);
    else url.searchParams.set(k, String(v));
  });
  return url.toString();
}

/**
 * Bundles mode+seed state for one activity page with a subscribe() hook so
 * activity-shell.js (and the activity's own render function) can react when
 * the visible mode/seed controls change, without reloading the iframe.
 */
function createModeController(opts = {}) {
  let mode = getMode(opts.defaultMode || "student-exploration");
  let seed = getSeedFromURL(opts.defaultSeed !== undefined ? opts.defaultSeed : PRNG.randomSeed());
  const listeners = [];
  function notify() {
    listeners.forEach((fn) => fn({ mode, seed }));
  }
  return {
    get mode() { return mode; },
    get seed() { return seed; },
    setMode(newMode) {
      if (!VALID_MODES.includes(newMode)) return;
      mode = newMode;
      setURLParam("mode", mode);
      notify();
    },
    setSeed(newSeed) {
      seed = newSeed;
      setURLParam("seed", seed);
      notify();
    },
    subscribe(fn) { listeners.push(fn); },
    shareableURL() { return buildShareableURL({ mode, seed }); }
  };
}

window.ModeManager = { VALID_MODES, getMode, getSeedFromURL, setURLParam, buildShareableURL, createModeController };
