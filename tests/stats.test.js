"use strict";
/* flowcode — unit tests for the pure game math. Run: node --test tests/ */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const M = require("../js/stats.js");

test("wpm: standard 5-chars-per-word with implicit spaces", () => {
  // 200 correct chars + 50 finished words in 60s → 250/5 = 50 wpm
  assert.equal(M.wpm(200, 50, 60), 50);
  // half the time, double the rate
  assert.equal(M.wpm(100, 25, 30), 50);
  // guards against div-by-zero on instant runs
  assert.equal(M.wpm(10, 2, 0), Math.round(12 / 5 / (1 / 60)));
});

test("raw includes wrong keystrokes, wpm does not", () => {
  const clean = M.wpm(200, 50, 60);
  const raw = M.raw(200, 50, 50, 60);
  assert.equal(raw, 60);
  assert.ok(raw > clean);
});

test("accuracy: edge cases and rounding", () => {
  assert.equal(M.accuracy(0, 0), 100);           // untouched keyboard is not a failure
  assert.equal(M.accuracy(9, 1), 90);
  assert.equal(M.accuracy(2, 1), 66.7);          // 1 decimal by default
  assert.equal(M.accuracy(2, 1, 0), 67);         // integer for the HUD
  assert.equal(M.accuracy(0, 5), 0);
});

test("consistency: flat is perfect, chaos is low, short runs are 0", () => {
  assert.equal(M.consistency([50, 50, 50, 50]), 100);
  assert.equal(M.consistency([40, 60]), 0);      // < 3 samples
  assert.equal(M.consistency([]), 0);
  assert.equal(M.consistency(null), 0);
  const flat = M.consistency([48, 52, 50, 49, 51]);
  const wild = M.consistency([10, 90, 5, 95, 20]);
  assert.ok(flat > 90);
  assert.ok(wild < flat);
  assert.equal(M.consistency([0, 0, 0]), 0);     // zero mean
});

test("wordPoints: base, early bonus, x2, combo tiers and cap", () => {
  assert.equal(M.wordPoints(4, 0, false, false), 42);        // 10 + 4*8
  assert.equal(M.wordPoints(4, 0, true, false), 63);         // ×1.5 rounded
  assert.equal(M.wordPoints(4, 0, false, true), 84);         // ×2
  assert.equal(M.wordPoints(4, 8, false, false), 84);        // tier 2 at combo 8
  assert.equal(M.wordPoints(4, 7, false, false), 42);        // still tier 1 at 7
  // cap at ×6: combo 48 and combo 480 pay the same
  assert.equal(M.wordPoints(4, 48, false, false), M.wordPoints(4, 480, false, false));
  assert.equal(M.wordPoints(4, 48, false, false), 252);
});

test("mulberry32: deterministic, seed-sensitive, in [0,1)", () => {
  const a1 = M.mulberry32(123), a2 = M.mulberry32(123), b = M.mulberry32(124);
  const s1 = [a1(), a1(), a1(), a1(), a1()];
  const s2 = [a2(), a2(), a2(), a2(), a2()];
  const s3 = [b(), b(), b(), b(), b()];
  assert.deepEqual(s1, s2);
  assert.notDeepEqual(s1, s3);
  for (const v of s1) assert.ok(v >= 0 && v < 1);
});

test("dateSeed and dailyNumber are UTC-stable", () => {
  const d = new Date(Date.UTC(2026, 6, 18, 23, 59));
  assert.equal(M.dateSeed(d), 20260718);
  assert.equal(M.dailyNumber(d), 199);           // Jan 1 2026 is daily #1
  const jan1 = new Date(Date.UTC(2026, 0, 1, 0, 0));
  assert.equal(M.dailyNumber(jan1), 1);
  // same UTC day, different wall-clock hours → same seed
  const early = new Date(Date.UTC(2026, 6, 18, 0, 1));
  assert.equal(M.dateSeed(early), M.dateSeed(d));
});
