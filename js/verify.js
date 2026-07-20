"use strict";
/* flowcode: server-side replay of a seeded run.

   A ranked run draws its words from a list derived purely from its seed, and
   cubes spawn on a deterministic cadence, so the whole run is reproducible.
   A submission therefore carries the keystroke tape rather than a score: this
   module rebuilds the run, replays the tape against it, and returns the score
   it actually earned. Client-reported numbers are never trusted.

   The tape holds every key the player pressed: characters, plus two control
   sentinels the engine records so replay state matches lock state exactly,
   " " (drop the locked target) and "\b" (backspace one letter). */
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

  // geometry shared with js/game.js: spawn depth, kill line, early-bonus line
  const SPAWN_Z = 120, MISS_Z = -2300, EARLY_Z = -700;
  const EARLY_SHARE = (SPAWN_Z - EARLY_Z) / (SPAWN_Z - MISS_Z);

  // must mirror the client's daily config: one minute that keeps speeding up
  const DAILY = {
    time: 60, flow: 45, lang: "en",
    ramp: { step: 5, every: 8, cap: 90 },
  };

  // rush mode's ramp, mirrored from the engine
  const RUSH_RAMP = { step: 4, every: 8, cap: 260 };

  const MODES = {
    daily:   { label: "daily" },
    time:    { label: "time" },
    words:   { label: "words" },
    endless: { label: "survival" },
    sudden:  { label: "flawless" },
    ramp:    { label: "rush" },
  };

  const LANGS = ["en", "ru", "code"];
  const TIMES = [15, 30, 60, 120];
  const COUNTS = [10, 25, 50, 100];

  const LIMITS = {
    maxKeys: 4000,
    maxNameLen: 16,
    maxRunSeconds: 900,     // open-ended modes cannot stretch past this
    minInterval: 12,        // ms; faster than any human double-tap
    maxFastRatio: 0.05,     // tolerate a few, not a stream
    maxWpm: 300,            // above the world record by a wide margin
    graceMs: 2500,          // clock skew / last keystroke landing late
    wordGapMs: 400,         // longer than this and they were waiting, not typing
    minJitter: 0.08,        // coefficient of variation floor for human typing
  };

  function fail(reason) { return { ok: false, reason }; }

  /* ── config: what a ranked run is allowed to look like ── */
  function checkConfig(b) {
    if (!b || typeof b !== "object") return fail("bad config");
    const mode = b.mode;
    if (typeof mode !== "string" || !MODES[mode]) return fail("unknown mode");

    if (mode === "daily") {
      const day = b.day;
      if (!Number.isInteger(day)) return fail("bad day");
      return {
        ok: true,
        cfg: {
          mode, time: DAILY.time, flow: DAILY.flow, lang: DAILY.lang,
          ramp: DAILY.ramp, seed: day >>> 0, lives: 0,
        },
      };
    }

    const flow = b.flow;
    if (!Number.isInteger(flow) || flow < 20 || flow > 200) return fail("bad flow");
    if (!LANGS.includes(b.lang)) return fail("bad language");
    const seed = b.seed;
    if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) return fail("bad seed");

    const cfg = { mode, flow, lang: b.lang, seed, lives: 0 };
    if (mode === "time") {
      if (!TIMES.includes(b.time)) return fail("bad time limit");
      cfg.time = b.time;
    }
    if (mode === "words") {
      if (!COUNTS.includes(b.words)) return fail("bad word count");
      cfg.words = b.words;
    }
    if (mode === "endless" || mode === "ramp") cfg.lives = 3;
    if (mode === "ramp") cfg.ramp = RUSH_RAMP;
    return { ok: true, cfg };
  }

  /* ── deterministic flow / spawn model, mirrored from the engine ── */

  const lifetime = flow => clamp(260 / flow, 2.2, 9);

  function flowAt(cfg, t) {
    const r = cfg.ramp;
    if (!r) return cfg.flow;
    return clamp(cfg.flow + r.step * Math.floor(t / r.every), cfg.flow, r.cap);
  }

  /* The engine primes its spawn accumulator with one full interval, so the
     first cube appears at t=0, and refills it in real time; with a ramping
     flow the interval is piecewise constant, so exact spawn times fall out of
     walking the accumulator segment by segment. */
  function buildSchedule(cfg, maxCount, maxTime) {
    const times = [];
    let acc = 60 / cfg.flow;
    let t = 0, guard = 0;
    while (times.length < maxCount && t <= maxTime && guard++ < 100000) {
      const interval = 60 / flowAt(cfg, t);
      if (acc >= interval - 1e-9) {
        acc -= interval;
        times.push(t);
        continue;
      }
      const need = interval - acc;
      const boundary = cfg.ramp ? (Math.floor(t / cfg.ramp.every) + 1) * cfg.ramp.every : Infinity;
      const toBoundary = boundary - t;
      if (need <= toBoundary || flowAt(cfg, boundary) === flowAt(cfg, t)) {
        t += need;
        acc = interval;
      } else {
        // the flow steps up before the accumulator fills; carry it across
        t = boundary;
        acc += toBoundary;
      }
    }
    return times;
  }

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
  function replay(cfg, keys) {
    const timed = cfg.mode === "time" || cfg.mode === "daily";
    const horizon = timed ? cfg.time : LIMITS.maxRunSeconds;
    const tape = checkTape(keys, horizon);
    if (!tape.ok) return tape;

    const words = Words.sequence(
      { lang: cfg.lang, punct: false, nums: false },
      GameMath.mulberry32(cfg.seed),
      400
    );
    const maxCount = cfg.mode === "words" ? cfg.words : Infinity;
    const spawn = buildSchedule(cfg, maxCount, horizon);
    const life = spawn.map(t => lifetime(flowAt(cfg, t)));
    const n = spawn.length;
    // the engine wraps around its 400-word list on very long runs; mirror that
    const wordAt = i => words[i % words.length];

    const done = new Set();
    let locked = -1, typed = 0;
    let correct = 0, wrong = 0, hits = 0, misses = 0;
    let combo = 0, maxCombo = 0, score = 0;
    let lives = cfg.lives || 0;
    let expiredUpTo = -1;
    let endAt = Infinity;   // set when lives run out or a flawless run breaks
    let lastEvent = 0;

    // cubes that drifted past the line before time t: misses, and maybe the run
    function processExpiries(t) {
      for (let i = expiredUpTo + 1; i < n; i++) {
        const ex = spawn[i] + life[i];
        if (ex > t || ex >= endAt) break;
        expiredUpTo = i;
        if (done.has(i)) continue;
        misses++;
        combo = 0;
        lastEvent = ex;
        if (locked === i) { locked = -1; typed = 0; }
        if (cfg.mode === "sudden") { endAt = ex; break; }
        if (lives > 0) {
          lives--;
          if (lives === 0) { endAt = ex; break; }
        }
      }
    }

    function finishWord(i, t) {
      const early = (t - spawn[i]) < life[i] * EARLY_SHARE;
      score += GameMath.wordPoints(wordAt(i).length, combo, early, false);
      combo++;
      maxCombo = Math.max(maxCombo, combo);
      hits++;
      done.add(i);
      locked = -1;
      typed = 0;
      lastEvent = t;
    }

    for (const [rawCh, ms] of keys) {
      const t = ms / 1000;
      if (t >= endAt) break;
      if (timed && t > cfg.time) break;
      processExpiries(t);
      if (t >= endAt) break;

      const ch = norm(rawCh);

      // sentinels: the player dropped the target or erased a letter
      if (ch === " ") {
        if (locked >= 0) { locked = -1; typed = 0; }
        continue;
      }
      if (ch === "\b") {
        if (locked >= 0 && typed > 0) typed--;
        continue;
      }

      if (locked < 0) {
        // lock the cube closest to the line, i.e. the oldest live match
        let pick = -1;
        for (let i = expiredUpTo + 1; i < n; i++) {
          if (spawn[i] > t) break;
          if (!done.has(i) && spawn[i] + life[i] > t && norm(wordAt(i)[0]) === ch) { pick = i; break; }
        }
        if (pick < 0) {
          wrong++;
          combo = 0;
          if (cfg.mode === "sudden") { endAt = t; break; }
          continue;
        }
        locked = pick;
        typed = 1;
        correct++;
        lastEvent = t;
        if (typed === wordAt(pick).length) finishWord(pick, t);
        continue;
      }

      const w = wordAt(locked);
      if (norm(w[typed]) === ch) {
        typed++;
        correct++;
        lastEvent = t;
        if (typed === w.length) finishWord(locked, t);
      } else {
        wrong++;
        combo = 0;
        if (cfg.mode === "sudden") { endAt = t; break; }
      }
    }

    processExpiries(timed ? cfg.time : horizon);

    let elapsed;
    if (timed) elapsed = cfg.time;
    else if (Number.isFinite(endAt)) elapsed = endAt;
    else elapsed = lastEvent;

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
      elapsed: Math.round(elapsed * 10) / 10,
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

  return {
    replay, checkTape, checkConfig, cleanName, buildSchedule, flowAt,
    DAILY, MODES, LIMITS,
  };
});
