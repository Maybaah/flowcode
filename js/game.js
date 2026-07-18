"use strict";
/* flowcode — 3d typing flow engine */
const Game = (() => {
  const SPAWN_Z = 120;        // where a cube is born
  const MISS_Z = -2300;       // red horizon line (see style.css #horizon-line)
  const DANGER_Z = -1600;     // alarm zone
  const CUBE_H = 64, CUBE_D = 46;
  const BASE_Y = 96;
  const LANES = [-470, -160, 160, 470];
  const MAX_CUBES = 12;

  const POWER_DEFS = {
    freeze: { icon: "❄", label: "freeze!" },
    slow:   { icon: "🐌", label: "slow motion!" },
    bomb:   { icon: "💥", label: "boom!" },
    star:   { icon: "★", label: "score ×2!" },
    heart:  { icon: "♥", label: "+1 life!" },
  };

  let cubesEl, particlesEl, sceneWrap, horizonEl;
  let cubes = [], particles = [];
  let running = false, paused = false, raf = 0, lastT = 0;
  let cfg = null, hooks = {}, st = null, lastLane = -1;

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const norm = ch => ch === "ё" ? "е" : ch === "Ё" ? "Е" : ch;

  function init() {
    cubesEl = document.getElementById("cubes");
    particlesEl = document.getElementById("particles");
    sceneWrap = document.getElementById("scene-wrap");
    horizonEl = document.getElementById("horizon-line");
  }

  const lifetime = flow => clamp(260 / flow, 2.2, 9);
  const speed = flow => (SPAWN_Z - MISS_Z) / lifetime(flow);
  const livesFor = mode => mode === "endless" || mode === "ramp" ? 3 : 0;
  const livesMode = () => cfg.mode === "endless" || cfg.mode === "ramp";

  /* ── start / stop ── */

  function start(config, h) {
    if (!cubesEl) init();
    stop();
    cfg = config;
    hooks = h || {};
    st = {
      elapsed: 0, spawnAcc: 60 / config.flow, spawned: 0,
      hits: 0, misses: 0, correct: 0, wrong: 0,
      combo: 0, maxCombo: 0, score: 0,
      lives: livesFor(config.mode),
      flow: config.flow,
      locked: null,
      samples: [], sampleAcc: 0, lastCum: 0,
      errorsAt: [],
      freezeUntil: 0, slowUntil: 0, x2Until: 0,
      over: false,
    };
    lastLane = -1;
    running = true; paused = false;
    lastT = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    running = false; paused = false;
    cancelAnimationFrame(raf);
    for (const c of cubes) c.el.remove();
    cubes = [];
    for (const p of particles) p.el.remove();
    particles = [];
    if (horizonEl) horizonEl.classList.remove("alarm");
    if (st) st.over = true;
  }

  function pause() { if (running && !paused) paused = true; }
  function resume() { if (running && paused) { paused = false; lastT = performance.now(); } }
  function finish() { if (running) endRun("finish"); }

  /* ── main loop ── */

  function frame(t) {
    const dt = Math.min((t - lastT) / 1000, 0.05);
    lastT = t;
    if (running && !paused) step(dt);
    if (running) raf = requestAnimationFrame(frame);
  }

  function step(dt) {
    st.elapsed += dt;

    if (cfg.mode === "ramp") {
      st.flow = clamp(cfg.flow + 4 * Math.floor(st.elapsed / 8), cfg.flow, 260);
    }

    const frozen = st.elapsed < st.freezeUntil;
    const factor = frozen ? 0 : (st.elapsed < st.slowUntil ? 0.5 : 1);

    // spawn
    if (!frozen && canSpawn()) {
      st.spawnAcc += dt;
      const interval = 60 / st.flow;
      while (st.spawnAcc >= interval && canSpawn()) {
        st.spawnAcc -= interval;
        spawnCube();
      }
    }

    // motion
    const v = speed(st.flow) * factor;
    let danger = false;
    for (let i = cubes.length - 1; i >= 0; i--) {
      const c = cubes[i];
      c.z -= v * dt;
      if (c.z <= MISS_Z) {
        missCube(c);
        if (st.over) return;
        continue;
      }
      const isDanger = c.z < DANGER_Z;
      if (isDanger !== c.danger) {
        c.danger = isDanger;
        c.el.classList.toggle("danger", isDanger);
      }
      if (isDanger) danger = true;
      renderCube(c);
    }
    horizonEl.classList.toggle("alarm", danger);

    // particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { p.el.remove(); particles.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.vy += 900 * dt;
      p.el.style.transform = `translate(-50%,-50%) translate3d(${p.x}px,${p.y}px,${p.z}px)`;
      p.el.style.opacity = Math.min(1, p.life / 0.3);
    }

    // sample wpm once per second — feeds the chart
    st.sampleAcc += dt;
    if (st.sampleAcc >= 1) {
      st.sampleAcc -= 1;
      const cum = st.correct + st.hits;
      st.samples.push(Math.round((cum - st.lastCum) * 12));
      st.lastCum = cum;
    }

    if (cfg.mode === "time" && st.elapsed >= cfg.time) return endRun("time");
    if (cfg.mode === "words" && st.spawned >= cfg.words && cubes.length === 0) return endRun("words");

    if (hooks.onHud) hooks.onHud(getHud());
  }

  function canSpawn() {
    if (cubes.length >= MAX_CUBES) return false;
    if (cfg.mode === "words") return st.spawned < cfg.words;
    if (cfg.mode === "time") return st.elapsed < cfg.time;
    return true;
  }

  /* ── cubes ── */

  function pickLane() {
    const idx = [0, 1, 2, 3];
    const free = i => !cubes.some(c => c.lane === i && c.z > SPAWN_Z - 640);
    let cand = idx.filter(i => i !== lastLane && free(i));
    if (!cand.length) cand = idx.filter(free);
    if (!cand.length) cand = idx.filter(i => i !== lastLane);
    return cand[(Math.random() * cand.length) | 0];
  }

  function spawnCube() {
    st.spawned++;
    let power = null;
    if (st.spawned > 6 && st.elapsed > 8 && Math.random() < 0.06) {
      const pool = ["freeze", "slow", "bomb", "star", livesMode() ? "heart" : "star"];
      power = pool[(Math.random() * pool.length) | 0];
    }
    let word, tries = 0;
    do {
      word = power ? Words.shortWord(cfg) : Words.next(cfg);
      tries++;
    } while (tries < 16 && cubes.some(c => c.word === word || norm(c.word[0]) === norm(word[0])));

    const lane = pickLane();
    const c = {
      word, power, lane, x: LANES[lane], z: SPAWN_Z, typed: 0,
      born: st.elapsed, phase: Math.random() * 6.28, danger: false,
      el: null, letters: null,
    };
    buildCubeEl(c);
    renderCube(c);
    cubesEl.appendChild(c.el);
    cubes.push(c);
    lastLane = lane;
  }

  function buildCubeEl(c) {
    const w = Math.max(96, Math.round(c.word.length * 17.5 + 42));
    const el = document.createElement("div");
    el.className = "cube" + (c.power ? " power" : "");
    const box = document.createElement("div");
    box.className = "box";
    box.style.width = w + "px";
    box.style.height = CUBE_H + "px";

    const mk = (cls, fw, fh, tf) => {
      const f = document.createElement("div");
      f.className = "face " + cls;
      f.style.width = fw + "px";
      f.style.height = fh + "px";
      f.style.left = "50%";
      f.style.top = "50%";
      f.style.transform = tf;
      return f;
    };
    box.appendChild(mk("side", w, CUBE_D, `translate(-50%,-50%) rotateX(90deg) translateZ(${CUBE_H / 2}px)`));
    box.appendChild(mk("side", w, CUBE_D, `translate(-50%,-50%) rotateX(-90deg) translateZ(${CUBE_H / 2}px)`));
    box.appendChild(mk("side", CUBE_D, CUBE_H, `translate(-50%,-50%) rotateY(-90deg) translateZ(${w / 2}px)`));
    box.appendChild(mk("side", CUBE_D, CUBE_H, `translate(-50%,-50%) rotateY(90deg) translateZ(${w / 2}px)`));

    const front = mk("front", w, CUBE_H, `translate(-50%,-50%) translateZ(${CUBE_D / 2}px)`);
    if (c.word.length > 13) front.style.fontSize = "19px";
    else if (c.word.length > 10) front.style.fontSize = "22px";
    if (c.power) front.dataset.icon = POWER_DEFS[c.power].icon;
    c.letters = [];
    for (const ch of c.word) {
      const s = document.createElement("span");
      s.className = "ch";
      s.textContent = ch;
      front.appendChild(s);
      c.letters.push(s);
    }
    box.appendChild(front);
    el.appendChild(box);
    c.el = el;
  }

  function renderCube(c) {
    const age = st.elapsed - c.born;
    const k = Math.min(1, age / 0.22);
    const scale = 0.6 + 0.4 * (1 - (1 - k) * (1 - k));
    const y = BASE_Y + Math.sin(st.elapsed * 2 + c.phase) * 5;
    const ry = Math.sin(st.elapsed * 1.2 + c.phase) * 5;
    c.el.style.transform =
      `translate(-50%,-50%) translate3d(${c.x}px, ${y}px, ${c.z}px) rotateY(${ry}deg) scale(${scale})`;
  }

  function updateLetters(c) {
    c.letters.forEach((s, i) => {
      s.classList.toggle("done", i < c.typed);
      s.classList.toggle("next", st.locked === c && i === c.typed);
    });
  }

  function removeCube(c, dying) {
    if (st.locked === c) st.locked = null;
    const i = cubes.indexOf(c);
    if (i >= 0) cubes.splice(i, 1);
    const el = c.el;
    if (dying) {
      el.classList.add("dying");
      el.style.transform += " scale(1.3)";
      setTimeout(() => el.remove(), 220);
    } else el.remove();
  }

  /* ── input ── */

  function handleChar(ch) {
    if (!running || paused || st.over) return;
    if (!st.locked) {
      let best = null;
      for (const c of cubes) {
        if (norm(c.word[0]) === norm(ch) && (!best || c.z < best.z)) best = c;
      }
      if (!best) return typoFx(null);
      st.locked = best;
      best.typed = 1;
      st.correct++;
      best.el.classList.add("locked");
      updateLetters(best);
      Sfx.key();
      if (best.typed === best.word.length) completeWord(best);
      return;
    }
    const c = st.locked;
    if (norm(c.word[c.typed]) === norm(ch)) {
      c.typed++;
      st.correct++;
      Sfx.key();
      updateLetters(c);
      if (c.typed === c.word.length) completeWord(c);
    } else {
      typoFx(c);
    }
  }

  function typoFx(c) {
    st.wrong++;
    st.combo = 0;
    st.errorsAt.push(Math.floor(st.elapsed));
    Sfx.error();
    if (c) {
      c.el.classList.add("err");
      setTimeout(() => c.el && c.el.classList.remove("err"), 180);
    }
    if (cfg.mode === "sudden") endRun("sudden");
  }

  function resetLock() {
    const c = st && st.locked;
    if (!c) return;
    c.typed = 0;
    st.locked = null;
    c.el.classList.remove("locked");
    updateLetters(c);
  }

  function backspace() {
    const c = st && st.locked;
    if (!c || c.typed === 0) return;
    c.typed--;
    updateLetters(c);
  }

  function completeWord(c) {
    const mult = Math.min(1 + Math.floor(st.combo / 8), 6);
    st.hits++;
    st.combo++;
    st.maxCombo = Math.max(st.maxCombo, st.combo);
    let pts = (10 + c.word.length * 8) * mult;
    if (c.z > -700) pts = Math.round(pts * 1.5);   // early-kill bonus
    if (st.elapsed < st.x2Until) pts *= 2;
    st.score += pts;
    Sfx.word();
    if (st.combo % 10 === 0 && hooks.onBanner) {
      hooks.onBanner(`combo ×${st.combo}`);
      Sfx.combo();
    }
    if (c.power) applyPower(c.power);
    burst(c);
    removeCube(c, true);
  }

  function missCube(c) {
    st.misses++;
    st.combo = 0;
    Sfx.miss();
    shake();
    removeCube(c, true);
    if (livesMode()) {
      st.lives--;
      if (hooks.onBanner) hooks.onBanner("cube escaped! −1 life");
      if (st.lives <= 0) return endRun("lives");
    } else if (cfg.mode === "sudden") {
      return endRun("sudden");
    }
  }

  /* ── power-ups ── */

  function applyPower(p) {
    const d = POWER_DEFS[p];
    if (hooks.onBanner) hooks.onBanner(`${d.icon} ${d.label}`);
    Sfx.power();
    switch (p) {
      case "freeze": st.freezeUntil = st.elapsed + 3; break;
      case "slow": st.slowUntil = st.elapsed + 6; break;
      case "star": st.x2Until = st.elapsed + 10; break;
      case "heart":
        if (livesMode()) st.lives = Math.min(st.lives + 1, 5);
        else st.score += 250;
        break;
      case "bomb":
        for (const c of [...cubes]) {
          st.score += 40;
          burst(c);
          removeCube(c, true);
        }
        break;
    }
  }

  /* ── effects ── */

  function burst(c) {
    for (let i = 0; i < 12; i++) {
      const el = document.createElement("div");
      el.className = "particle";
      if (c.power) el.style.background = "var(--gold)";
      particlesEl.appendChild(el);
      particles.push({
        el, x: c.x, y: BASE_Y, z: c.z,
        vx: (Math.random() - 0.5) * 620,
        vy: -80 - Math.random() * 380,
        vz: (Math.random() - 0.5) * 340,
        life: 0.65,
      });
    }
  }

  let shakeT = 0;
  function shake() {
    sceneWrap.classList.remove("shake");
    void sceneWrap.offsetWidth;
    sceneWrap.classList.add("shake");
    clearTimeout(shakeT);
    shakeT = setTimeout(() => sceneWrap.classList.remove("shake"), 320);
  }

  /* ── run summary ── */

  function getHud() {
    const wpm = st.elapsed > 1
      ? Math.round((st.correct + st.hits) / 5 / (st.elapsed / 60))
      : 0;
    const acc = st.correct + st.wrong
      ? Math.round(st.correct / (st.correct + st.wrong) * 100)
      : 100;
    return {
      elapsed: st.elapsed, flow: st.flow, wpm, acc,
      combo: st.combo, lives: st.lives,
      hits: st.hits, misses: st.misses,
      buffer: st.locked ? st.locked.word.slice(0, st.locked.typed) : "",
    };
  }

  function endRun(reason) {
    if (st.over) return;
    st.over = true;
    running = false; paused = false;
    cancelAnimationFrame(raf);
    for (const c of [...cubes]) {
      c.el.classList.add("dying");
      const el = c.el;
      setTimeout(() => el.remove(), 220);
    }
    cubes = [];
    for (const p of particles) p.el.remove();
    particles = [];
    horizonEl.classList.remove("alarm");

    const min = Math.max(st.elapsed, 1) / 60;
    const wpm = Math.round((st.correct + st.hits) / 5 / min);
    const raw = Math.round((st.correct + st.wrong + st.hits) / 5 / min);
    const acc = st.correct + st.wrong
      ? Math.round(st.correct / (st.correct + st.wrong) * 1000) / 10
      : 100;
    let cons = 0;
    if (st.samples.length >= 3) {
      const mean = st.samples.reduce((a, b) => a + b, 0) / st.samples.length;
      if (mean > 0) {
        const sd = Math.sqrt(st.samples.reduce((a, b) => a + (b - mean) ** 2, 0) / st.samples.length);
        cons = clamp(Math.round((1 - sd / mean) * 100), 0, 100);
      }
    }
    const res = {
      reason, mode: cfg.mode, lang: cfg.lang, flow: cfg.flow,
      wpm, raw, acc, cons,
      correct: st.correct, wrong: st.wrong,
      hits: st.hits, misses: st.misses,
      maxCombo: st.maxCombo, score: st.score,
      time: st.elapsed,
      samples: st.samples.slice(),
      errorsAt: st.errorsAt.slice(),
    };
    if (hooks.onEnd) hooks.onEnd(res);
  }

  return {
    start, stop, pause, resume, finish,
    handleChar, resetLock, backspace,
    get running() { return running; },
    get paused() { return paused; },
  };
})();
