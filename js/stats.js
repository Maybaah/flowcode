"use strict";
/* flowcode — pure game math, shared by the engine and the node test suite */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.GameMath = api;
})(typeof self !== "undefined" ? self : globalThis, function () {
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  // standard wpm: a word is 5 chars; each finished word also pays its implicit space
  function wpm(correctChars, words, seconds) {
    const min = Math.max(seconds, 1) / 60;
    return Math.round((correctChars + words) / 5 / min);
  }

  function raw(correctChars, wrongChars, words, seconds) {
    const min = Math.max(seconds, 1) / 60;
    return Math.round((correctChars + wrongChars + words) / 5 / min);
  }

  // dp = decimal places
  function accuracy(correct, wrong, dp = 1) {
    if (correct + wrong === 0) return 100;
    const f = Math.pow(10, dp);
    return Math.round(correct / (correct + wrong) * 100 * f) / f;
  }

  // 100 = perfectly flat speed; falls with the coefficient of variation
  function consistency(samples) {
    if (!samples || samples.length < 3) return 0;
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    if (mean <= 0) return 0;
    const sd = Math.sqrt(samples.reduce((a, b) => a + (b - mean) ** 2, 0) / samples.length);
    return clamp(Math.round((1 - sd / mean) * 100), 0, 100);
  }

  // combo multiplier climbs one tier per 8 chained words, capped at ×6
  function wordPoints(len, combo, early, x2) {
    const mult = Math.min(1 + Math.floor(combo / 8), 6);
    let pts = (10 + len * 8) * mult;
    if (early) pts = Math.round(pts * 1.5);
    if (x2) pts *= 2;
    return pts;
  }

  // deterministic PRNG for the daily challenge
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // same UTC day → same seed for everyone
  function dateSeed(d) {
    return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
  }

  function dailyNumber(d) {
    const day = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    return Math.floor((day - Date.UTC(2026, 0, 1)) / 86400000) + 1;
  }

  return { wpm, raw, accuracy, consistency, wordPoints, mulberry32, dateSeed, dailyNumber };
});
