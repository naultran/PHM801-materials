/**
 * Dose-response simulation model for the Dose-Response Laboratory activity.
 *
 * Depends on: math-utils.js, prng.js (load first).
 */

/** Standard 4-parameter Hill / logistic dose-response equation. */
function hillResponse(dose, { top, bottom, ec50, hillSlope }) {
  return bottom + (top - bottom) / (1 + Math.pow(ec50 / dose, hillSlope));
}

/** Log-spaced dose series across [10^loExp, 10^hiExp]. */
function generateDoseSeries(doseRangeLog10, count = 100) {
  return MathUtils.logspace(doseRangeLog10[0], doseRangeLog10[1], count);
}

/**
 * The "true" underlying biological response for a given response-shape
 * teaching scenario. Each shape reuses the same top/bottom/EC50/hillSlope
 * controls but composes them differently so the curve's *meaning* changes,
 * not just its numbers:
 *  - monotonic: textbook Hill curve.
 *  - nonmonotonic: response rises then falls off at high dose (bell-shaped),
 *    e.g. receptor desensitization/off-target effects at high concentration.
 *  - adaptive: response rises then partially relaxes toward an intermediate
 *    plateau at sustained high dose (partial adaptation).
 *  - cytotoxicity: the true target-specific response is flat at baseline —
 *    any apparent rise students see (added in computeApparentResponse) is a
 *    nonspecific cytotoxic-stress artifact, not a real target effect.
 */
function computeTrueResponse(dose, params, shape) {
  const hill = hillResponse(dose, params);
  switch (shape) {
    case "nonmonotonic": {
      const highDose = params.ec50 * 30;
      const decay = 1 / (1 + Math.pow(dose / highDose, 4));
      return params.bottom + (hill - params.bottom) * decay;
    }
    case "adaptive": {
      const adaptDose = params.ec50 * 10;
      const adaptWeight = 1 / (1 + Math.pow(dose / adaptDose, 3));
      const adaptedLevel = params.bottom + (params.top - params.bottom) * 0.4;
      return adaptWeight * hill + (1 - adaptWeight) * adaptedLevel;
    }
    case "cytotoxicity":
      return params.bottom;
    case "monotonic":
    default:
      return hill;
  }
}

/** 0 (healthy) to 1 (fully cytotoxic), a sigmoid centered on the threshold dose. */
function cytotoxicityFraction(dose, threshold, steepness = 6) {
  if (!threshold || threshold <= 0 || !isFinite(threshold)) return 0;
  return 1 / (1 + Math.pow(threshold / dose, steepness));
}

/**
 * The response an assay would actually *measure*. For the "cytotoxicity"
 * shape this includes a nonspecific artifact rising with cell stress past
 * cytotoxicityThreshold — deliberately shown alongside the (flat) true
 * target-specific response so students can see the two diverge.
 */
function computeApparentResponse(dose, params, shape, cytotoxicityThreshold) {
  const trueVal = computeTrueResponse(dose, params, shape);
  const cytoFrac = cytotoxicityFraction(dose, cytotoxicityThreshold);
  const artifactWeight = shape === "cytotoxicity" ? 1 : 0;
  return trueVal + cytoFrac * (params.top - params.bottom) * artifactWeight;
}

/**
 * Simulate noisy replicate measurements across a dose series. Re-seeds a
 * fresh RNG on every call (rather than reusing a shared stream) so the same
 * seed always reproduces the same replicate values regardless of how many
 * times the activity's controls were previously touched.
 */
function simulateReplicates(doses, params, opts) {
  const {
    noiseSd = 0, replicates = 3, seed = 0,
    shape = "monotonic", cytotoxicityThreshold = Infinity
  } = opts;
  const rng = PRNG.createRNG(seed);
  return doses.map((dose) => {
    const trueValue = computeApparentResponse(dose, params, shape, cytotoxicityThreshold);
    const replicateValues = [];
    for (let r = 0; r < replicates; r++) replicateValues.push(trueValue + rng.gaussian(0, noiseSd));
    return { dose, trueValue, replicateValues };
  });
}

window.DoseResponseModel = {
  hillResponse, generateDoseSeries, computeTrueResponse,
  cytotoxicityFraction, computeApparentResponse, simulateReplicates
};
