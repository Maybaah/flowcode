"use strict";
/* flowcode — server-side replay of a seeded run.

   The daily challenge draws its words from a list derived purely from the day's
   seed, and cubes spawn on a fixed cadence, so the whole run is reproducible.
   A submission therefore carries the keystroke tape rather than a score: this
   module rebuilds the run, replays the tape against it, and returns the score
   it actually earned. Client-reported numbers are never trusted. */
(function (root, factory) {
  const api = factory(
    typeof require === "function" ? require("./stats.js") : root.GameMath,
    typeof require === "function" ? require("./words.js") : root.Words
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.Verify = api;
})(typeof self !== "undefined" ? self : globalThis, function (GameMath, Words) {
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const norm = ch => ch === "ё" ? "е" : ch === "Ё" ? "Е" : ch;

  // must mirror the client's daily config
  const DAILY = { time: 60, flow: 50, lang: "en" };

  const LIMITS = {
    maxKeys: 4000,
    maxNameLen: 16,
    minInterval: 12,        // ms; faster than any human double-tap
    maxFastRatio: 0.05,     // tolerate a few, not a stream
    maxWpm: 300,            // above the world record by a wide margin
    graceMs: 2500,          // clock skew / last keystroke landing late
    wordGapMs: 400,         // longer than this and they were waiting, not typing
    minJitter: 0.08,        // coefficient of variation floor for human typing
  };

  function fail(reason) { return { ok: false, reason }; }

  /* ── tape sanity, before any replay work ── */
  function checkTape(keys, timeLimit) {
    if (!Array.isArray(keys)) return fail("keys must be an array");
    if (keys.length === 0) return fail("empty run");
    if (keys.length > LIMITS.maxKeys) return fail("too many keystrokes");

    let last = -1, fast = 0;
    const gaps = [];
    for (const k of keys) {
      if (!Array.isArray(k) || k.length !== 2) return fail("malformed keystroke");
      const [ch, ms] = k;
      if (typeof ch !== "string" || [...ch].length !== 1) return fail("malformed character");
      if (typeof ms !== "number" || !Number.isFinite(ms) || ms < 0) return fail("malformed timestamp");
      if (ms < last) return fail("timestamps must not go backwards");
      if (last >= 0) {
        const gap = ms - last;
        gaps.push(gap);
        if (gap < LIMITS.minInterval) fast++;
      }
      last = ms;
    }
    if (last > timeLimit * 1000 + LIMITS.graceMs) return fail("run longer than the time limit");
    if (gaps.length >= 20 && fast / gaps.length > LIMITS.maxFastRatio) {
      return fail("inhuman keystroke intervals");
    }
    // Judge regularity on within-word intervals only. Pauses between words track
    // when cubes appear, so they are irregular even for a bot; the giveaway is a
    // fixed cadence while actually typing a word.
    const typing = gaps.filter(g => g < LIMITS.wordGapMs);
    if (typing.length >= 20) {
      const mean = typing.reduce((a, b) => a + b, 0) / typing.length;
      const sd = Math.sqrt(typing.reduce((a, b) => a + (b - mean) ** 2, 0) / typing.length);
      if (mean > 0 && sd / mean < LIMITS.minJitter) return fail("keystroke timing is too regular");
    }
    return { ok: true };
  }

  /* ── replay ── */
  function replay(day, keys, opts) {
    const cfg = Object.assign({ time: DAILY.time, flow: DAILY.flow, lang: DAILY.lang }, opts || {});
    const tape = checkTape(keys, cfg.time);
    if (!tape.ok) return tape;

    const interval = 60 / cfg.flow;
    const lifetime = clamp(260 / cfg.flow, 2.2, 9);
    // z > -700 earns the early-kill bonus; express that as a share of a cube's life
    const earlyWindow = lifetime * (120 + 700) / (120 + 2300);

    const words = Words.sequence(
      { lang: cfg.lang, punct: false, nums: false },
      GameMath.mulberry32(day),
      400
    );
    const spawnAt = i => i * interval;
    const lastIndex = Math.min(words.length - 1, Math.floor(cfg.time / interval));

    const done = new Set();
    let locked = -1, typed = 0;
    let correct = 0, wrong = 0, hits = 0, misses = 0;
    let combo = 0, maxCombo = 0, score = 0;
    let expiredUpTo = -1;

    // cubes that drifted past the line before time t: they break the combo
    function processExpiries(t) {
      for (let i = expiredUpTo + 1; i <= lastIndex; i++) {
        if (spawnAt(i) + lifetime > t) break;
        expiredUpTo = i;
        if (done.has(i)) continue;
        misses++;
        combo = 0;
        if (locked === i) { locked = -1; typed = 0; }
      }
    }

    const alive = (i, t) => spawnAt(i) <= t && spawnAt(i) + lifetime > t && !done.has(i);

    function finish(i, t) {
      const early = (t - spawnAt(i)) < earlyWindow;
      score += GameMath.wordPoints(words[i].length, combo, early, false);
      combo++;
      maxCombo = Math.max(maxCombo, combo);
      hits++;
      done.add(i);
      locked = -1;
      typed = 0;
    }

    for (const [rawCh, ms] of keys) {
      const t = ms / 1000;
      processExpiries(t);
      const ch = norm(rawCh);

      if (locked < 0) {
        // lock the cube closest to the line, i.e. the oldest live match
        let pick = -1;
        for (let i = Math.max(0, expiredUpTo); i <= lastIndex; i++) {
          if (spawnAt(i) > t) break;
          if (alive(i, t) && norm(words[i][0]) === ch) { pick = i; break; }
        }
        if (pick < 0) { wrong++; combo = 0; continue; }
        locked = pick;
        typed = 1;
        correct++;
        if (typed === words[pick].length) finish(pick, t);
        continue;
      }

      const w = words[locked];
      if (norm(w[typed]) === ch) {
        typed++;
        correct++;
        if (typed === w.length) finish(locked, t);
      } else {
        wrong++;
        combo = 0;
      }
    }

    processExpiries(cfg.time);

    const elapsed = cfg.time;
    const wpm = GameMath.wpm(correct, hits, elapsed);
    if (wpm > LIMITS.maxWpm) return fail("score above the plausible ceiling");
    if (hits === 0) return fail("no words completed");

    return {
      ok: true,
      wpm,
      acc: GameMath.accuracy(correct, wrong, 1),
      raw: GameMath.raw(correct, wrong, hits, elapsed),
      score,
      words: hits,
      missed: misses,
      maxCombo,
      correct,
      wrong,
      keystrokes: keys.length,
    };
  }

  function cleanName(name) {
    if (typeof name !== "string") return "";
    // strip control characters, collapse whitespace, cap the length
    const stripped = [...name]
      .filter(c => {
        const cp = c.codePointAt(0);
        return cp > 0x1f && !(cp >= 0x7f && cp <= 0x9f) &&
               !(cp >= 0x200b && cp <= 0x200f) &&
               cp !== 0x2028 && cp !== 0x2029 && cp !== 0xfeff;
      })
      .join("")
      .split(/\s+/).join(" ")
      .trim();
    return [...stripped].slice(0, LIMITS.maxNameLen).join("").trim();
  }

  return { replay, checkTape, cleanName, DAILY, LIMITS };
});
