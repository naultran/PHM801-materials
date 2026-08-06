/**
 * Seeded pseudo-random number generator (mulberry32) plus a small helper API.
 *
 * IMPORTANT for reproducibility: always call createRNG(seed) fresh at the start
 * of a computation you want to be reproducible from a given seed (e.g. once per
 * "simulate" call), rather than reusing one long-lived RNG instance across many
 * unrelated interactions. A long-lived shared stream means the same seed value
 * produces different output depending on how many times it was previously drawn
 * from, which breaks "copy seed" / "instructor seed" reproducibility.
 */

/** @param {number} seed 32-bit unsigned integer seed */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Derive a 32-bit integer seed from an arbitrary string (for typed/copied seeds). */
function seedFromString(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

/** A cryptographically-sourced random 32-bit seed, for the "new random seed" control. */
function randomSeed() {
  const arr = new Uint32Array(1);
  (window.crypto || window.msCrypto).getRandomValues(arr);
  return arr[0];
}

/**
 * Create a fresh RNG bound to a seed. Every method draws from the same
 * underlying stream, so a full sequence of calls (e.g. gaussian() then
 * shuffle()) is itself reproducible for a given seed, as long as the *number
 * and order* of calls made against it is the same each time.
 */
function createRNG(seed) {
  const rand = mulberry32(typeof seed === "number" ? seed : seedFromString(String(seed)));
  let spareGaussian = null;

  return {
    seed: seed,
    /** Uniform float in [0, 1) */
    random() {
      return rand();
    },
    /** Uniform integer in [min, maxExclusive) */
    int(min, maxExclusive) {
      return min + Math.floor(rand() * (maxExclusive - min));
    },
    /** Uniform float in [min, max) */
    range(min, max) {
      return min + rand() * (max - min);
    },
    /** Standard normal via Box-Muller, cached spare for efficiency */
    gaussian(mean = 0, sd = 1) {
      if (spareGaussian !== null) {
        const v = spareGaussian;
        spareGaussian = null;
        return mean + sd * v;
      }
      let u1 = 0;
      let u2 = 0;
      while (u1 === 0) u1 = rand();
      u2 = rand();
      const mag = Math.sqrt(-2 * Math.log(u1));
      const z0 = mag * Math.cos(2 * Math.PI * u2);
      const z1 = mag * Math.sin(2 * Math.PI * u2);
      spareGaussian = z1;
      return mean + sd * z0;
    },
    /** Fisher-Yates shuffle, returns a new array */
    shuffle(arr) {
      const out = arr.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = this.int(0, i + 1);
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
    /** Pick one random element */
    pick(arr) {
      return arr[this.int(0, arr.length)];
    }
  };
}

window.PRNG = { mulberry32, seedFromString, randomSeed, createRNG };
