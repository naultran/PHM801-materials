/**
 * Reads/writes the shared `?seed=` query-string contract that every activity
 * understands, and provides a tiny pub/sub controller so an activity's own
 * seed controls can update state without a full reload.
 *
 * Depends on: prng.js (load first, for seedFromString/randomSeed).
 */

function readParams() {
  return new URLSearchParams(window.location.search);
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
 * Bundles seed state for one activity page with a subscribe() hook so
 * activity-shell.js (and the activity's own render function) can react when
 * the seed controls change, without reloading the iframe.
 */
function createSeedController(opts = {}) {
  let seed = getSeedFromURL(opts.defaultSeed !== undefined ? opts.defaultSeed : PRNG.randomSeed());
  const listeners = [];
  function notify() {
    listeners.forEach((fn) => fn({ seed }));
  }
  return {
    get seed() { return seed; },
    setSeed(newSeed) {
      seed = newSeed;
      setURLParam("seed", seed);
      notify();
    },
    subscribe(fn) { listeners.push(fn); },
    shareableURL() { return buildShareableURL({ seed }); }
  };
}

window.ModeManager = { getSeedFromURL, setURLParam, buildShareableURL, createSeedController };
