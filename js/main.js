"use strict";
/* flowcode — UI, settings, results */
(() => {
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];

  const SETTINGS_KEY = "fc-settings";
  const HIST_KEY = "fc-history";
  const BEST_KEY = "fc-best";

  const DEFAULTS = {
    mode: "time", time: 30, words: 25,
    punct: false, nums: false, lang: "en",
    flow: 40, theme: "midnight", sound: true,
  };

  let S = loadJSON(SETTINGS_KEY, DEFAULTS);
  S = { ...DEFAULTS, ...S };

  // idle | run | pause | results
  let state = "idle";
  let lastResults = null;

  function loadJSON(key, fallback) {
    try {
      const v = JSON.parse(localStorage.getItem(key));
      return v == null ? fallback : v;
    } catch { return fallback; }
  }
  function saveJSON(key, v) {
    try { localStorage.setItem(key, JSON.stringify(v)); } catch {}
  }
  const saveSettings = () => saveJSON(SETTINGS_KEY, S);

  /* ── settings → UI ── */

  function applySettings() {
    $$("#cfg-mode .pill").forEach(b => b.classList.toggle("on", b.dataset.mode === S.mode));
    $$("#cfg-time .pill").forEach(b => b.classList.toggle("on", +b.dataset.time === S.time));
    $$("#cfg-words .pill").forEach(b => b.classList.toggle("on", +b.dataset.words === S.words));
    $("#cfg-time").classList.toggle("hidden", S.mode !== "time");
    $("#cfg-words").classList.toggle("hidden", S.mode !== "words");
    $("#tg-punct").classList.toggle("on", S.punct);
    $("#tg-nums").classList.toggle("on", S.nums);
    $$("#cfg-lang .pill").forEach(b => b.classList.toggle("on", b.dataset.lang === S.lang));
    $("#wpm-slider").value = S.flow;
    $("#wpm-value").textContent = S.flow;
    applyTheme();
    Sfx.setEnabled(S.sound);
    $("#btn-sound").classList.toggle("off", !S.sound);
  }

  function applyTheme() {
    if (S.theme === "midnight") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = S.theme;
    $$("#theme-menu button").forEach(b => b.classList.toggle("on", b.dataset.theme === S.theme));
  }

  /* ── control bindings ── */

  $$("#cfg-mode .pill").forEach(b => b.onclick = () => { S.mode = b.dataset.mode; applySettings(); saveSettings(); });
  $$("#cfg-time .pill").forEach(b => b.onclick = () => { S.time = +b.dataset.time; applySettings(); saveSettings(); });
  $$("#cfg-words .pill").forEach(b => b.onclick = () => { S.words = +b.dataset.words; applySettings(); saveSettings(); });
  $("#tg-punct").onclick = () => { S.punct = !S.punct; applySettings(); saveSettings(); };
  $("#tg-nums").onclick = () => { S.nums = !S.nums; applySettings(); saveSettings(); };
  $$("#cfg-lang .pill").forEach(b => b.onclick = () => { S.lang = b.dataset.lang; applySettings(); saveSettings(); });
  $("#wpm-slider").oninput = e => {
    S.flow = +e.target.value;
    $("#wpm-value").textContent = S.flow;
    saveSettings();
  };
  $("#btn-sound").onclick = () => { S.sound = !S.sound; applySettings(); saveSettings(); };
  $("#btn-theme").onclick = e => { e.stopPropagation(); $("#theme-menu").classList.toggle("hidden"); };
  $$("#theme-menu button").forEach(b => b.onclick = () => {
    S.theme = b.dataset.theme;
    applyTheme(); saveSettings();
    $("#theme-menu").classList.add("hidden");
  });
  document.addEventListener("click", e => {
    if (!e.target.closest("#theme-menu") && !e.target.closest("#btn-theme")) {
      $("#theme-menu").classList.add("hidden");
    }
  });

  /* ── effect banner ── */

  let bannerT = 0;
  function banner(text) {
    const el = $("#effect-banner");
    el.textContent = text;
    el.classList.remove("hidden");
    el.style.animation = "none";
    void el.offsetWidth;
    el.style.animation = "";
    clearTimeout(bannerT);
    bannerT = setTimeout(() => el.classList.add("hidden"), 1500);
  }

  /* ── HUD ── */

  const PRIMARY_LABEL = { time: "sec", words: "left", endless: "words", sudden: "words", ramp: "words", zen: "sec" };

  function onHud(h) {
    let primary;
    if (S.mode === "time") primary = Math.max(0, Math.ceil(S.time - h.elapsed));
    else if (S.mode === "words") primary = Math.max(0, S.words - h.hits - h.misses);
    else if (S.mode === "zen") primary = Math.floor(h.elapsed);
    else primary = h.hits;
    $("#hud-primary").textContent = primary;
    $("#hud-wpm").textContent = h.wpm;
    $("#hud-acc").textContent = h.acc;
    $("#hud-combo").textContent = h.combo;
    $(".hud-combo").classList.toggle("hot", h.combo >= 10);
    if (h.lives > 0) $("#hud-lives").textContent = "♥".repeat(h.lives);
    if (S.mode === "ramp") $("#hud-flow").textContent = h.flow;
    $("#buffer").textContent = h.buffer;
  }

  /* ── run states ── */

  function startRun() {
    state = "run";
    document.body.classList.add("playing");
    $("#start-hint").classList.add("hidden");
    $("#results").classList.add("hidden");
    $("#pause-overlay").classList.add("hidden");
    $("#hud").classList.remove("hidden");
    $("#hud").setAttribute("aria-hidden", "false");
    $("#hud-primary-label").textContent = PRIMARY_LABEL[S.mode];
    const livesMode = S.mode === "endless" || S.mode === "ramp";
    $("#hud-lives-wrap").classList.toggle("hidden", !livesMode);
    $("#hud-flow-wrap").classList.toggle("hidden", S.mode !== "ramp");
    $("#buffer").textContent = "";
    Game.start(
      { mode: S.mode, time: S.time, words: S.words, punct: S.punct, nums: S.nums, lang: S.lang, flow: S.flow },
      { onHud, onEnd, onBanner: banner },
    );
  }

  function toIdle() {
    Game.stop();
    state = "idle";
    document.body.classList.remove("playing");
    $("#hud").classList.add("hidden");
    $("#hud").setAttribute("aria-hidden", "true");
    $("#pause-overlay").classList.add("hidden");
    $("#results").classList.add("hidden");
    $("#start-hint").classList.remove("hidden");
    $("#buffer").textContent = "";
  }

  function pauseGame() {
    Game.pause();
    state = "pause";
    $("#pause-overlay").classList.remove("hidden");
  }

  function resumeGame() {
    Game.resume();
    state = "run";
    $("#pause-overlay").classList.add("hidden");
  }

  /* ── results ── */

  function onEnd(res) {
    lastResults = res;
    state = "results";
    document.body.classList.remove("playing");
    $("#hud").classList.add("hidden");
    $("#pause-overlay").classList.add("hidden");

    const meaningful = res.time >= 10 || res.hits >= 10;
    let isPB = false;
    if (meaningful) {
      const best = loadJSON(BEST_KEY, {});
      const key = `${res.mode}|${res.mode === "time" ? S.time : res.mode === "words" ? S.words : "-"}|${res.lang}|${res.flow}`;
      if (res.wpm > (best[key] || 0)) {
        best[key] = res.wpm;
        saveJSON(BEST_KEY, best);
        isPB = true;
      }
      const hist = loadJSON(HIST_KEY, []);
      hist.push({ ts: Date.now(), wpm: res.wpm, acc: res.acc, mode: res.mode, flow: res.flow, lang: res.lang, score: res.score });
      while (hist.length > 30) hist.shift();
      saveJSON(HIST_KEY, hist);
    }

    $("#res-wpm").textContent = res.wpm;
    $("#res-acc").textContent = res.acc + "%";
    $("#res-raw").textContent = res.raw;
    $("#res-cons").textContent = res.cons + "%";
    $("#res-chars").textContent = `${res.correct}/${res.wrong}`;
    $("#res-words").textContent = res.hits;
    $("#res-missed").textContent = res.misses;
    $("#res-combo").textContent = res.maxCombo;
    $("#res-score").textContent = res.score;
    $("#res-time").textContent = res.time.toFixed(1) + "s";
    $("#res-pb").classList.toggle("hidden", !isPB);

    drawGraph(res);
    drawHistory(loadJSON(HIST_KEY, []));
    $("#results").classList.remove("hidden");

    if (isPB) { Sfx.record(); banner("new record!"); }
    else Sfx.over();
  }

  /* ── charts ── */

  const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

  function setupCanvas(cv, W, H) {
    const dpr = window.devicePixelRatio || 1;
    cv.style.width = W + "px";
    cv.style.height = H + "px";
    cv.width = W * dpr;
    cv.height = H * dpr;
    const ctx = cv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    return ctx;
  }

  function drawGraph(res) {
    const W = 760, H = 220;
    const ctx = setupCanvas($("#res-graph"), W, H);
    const L = 46, R = 16, T = 18, B = 30;
    const samples = res.samples;
    ctx.font = "11px 'JetBrains Mono', monospace";

    if (samples.length < 2) {
      ctx.fillStyle = cssVar("--dim");
      ctx.textAlign = "center";
      ctx.fillText("run too short to chart", W / 2, H / 2);
      return;
    }

    // smooth with a ±1 window
    const sm = samples.map((v, i) => {
      const a = samples[Math.max(0, i - 1)], b = samples[Math.min(samples.length - 1, i + 1)];
      return (a + v + b) / 3;
    });
    const maxV = Math.max(10, Math.ceil(Math.max(...sm, res.wpm) * 1.15 / 10) * 10);
    const px = i => L + i / (sm.length - 1) * (W - L - R);
    const py = v => T + (1 - v / maxV) * (H - T - B);

    // grid
    ctx.strokeStyle = cssVar("--line");
    ctx.fillStyle = cssVar("--dim");
    ctx.lineWidth = 1;
    ctx.textAlign = "right";
    for (let g = 0; g <= 4; g++) {
      const v = maxV / 4 * g;
      ctx.beginPath();
      ctx.moveTo(L, py(v));
      ctx.lineTo(W - R, py(v));
      ctx.stroke();
      ctx.fillText(Math.round(v), L - 8, py(v) + 4);
    }
    // second labels
    ctx.textAlign = "center";
    const stepS = Math.max(1, Math.ceil(sm.length / 8));
    for (let i = 0; i < sm.length; i += stepS) {
      ctx.fillText((i + 1) + "s", px(i), H - 10);
    }

    // area under the line
    const accent = cssVar("--accent");
    const grad = ctx.createLinearGradient(0, T, 0, H - B);
    grad.addColorStop(0, accent + "44");
    grad.addColorStop(1, accent + "00");
    ctx.beginPath();
    ctx.moveTo(px(0), py(sm[0]));
    for (let i = 1; i < sm.length; i++) ctx.lineTo(px(i), py(sm[i]));
    ctx.lineTo(px(sm.length - 1), H - B);
    ctx.lineTo(px(0), H - B);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // average wpm — dashed
    ctx.strokeStyle = cssVar("--dim");
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(L, py(res.wpm));
    ctx.lineTo(W - R, py(res.wpm));
    ctx.stroke();
    ctx.setLineDash([]);

    // wpm line
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(px(0), py(sm[0]));
    for (let i = 1; i < sm.length; i++) ctx.lineTo(px(i), py(sm[i]));
    ctx.stroke();

    // errors — crosses
    const danger = cssVar("--danger");
    ctx.strokeStyle = danger;
    ctx.lineWidth = 2;
    const errCount = {};
    for (const sec of res.errorsAt) errCount[sec] = (errCount[sec] || 0) + 1;
    for (const sec of Object.keys(errCount)) {
      const i = Math.min(sm.length - 1, +sec);
      const x = px(i), y = py(sm[i]) - 12;
      ctx.beginPath();
      ctx.moveTo(x - 4, y - 4); ctx.lineTo(x + 4, y + 4);
      ctx.moveTo(x + 4, y - 4); ctx.lineTo(x - 4, y + 4);
      ctx.stroke();
    }
  }

  function drawHistory(hist) {
    const W = 760, H = 60;
    const ctx = setupCanvas($("#res-history-chart"), W, H);
    const items = hist.slice(-20);
    if (!items.length) return;
    const maxV = Math.max(...items.map(h => h.wpm), 10);
    const bw = Math.min(30, (W - 10) / items.length - 6);
    const accent = cssVar("--accent"), line = cssVar("--line"), dim = cssVar("--dim");
    ctx.font = "10px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    items.forEach((h, i) => {
      const x = 5 + i * ((W - 10) / items.length) + ((W - 10) / items.length - bw) / 2;
      const bh = Math.max(3, h.wpm / maxV * (H - 16));
      const last = i === items.length - 1;
      ctx.fillStyle = last ? accent : line;
      ctx.beginPath();
      ctx.roundRect(x, H - 2 - bh, bw, bh, 3);
      ctx.fill();
      if (last || i % 4 === 0) {
        ctx.fillStyle = last ? accent : dim;
        ctx.fillText(h.wpm, x + bw / 2, H - 4 - bh - 2);
      }
    });
  }

  /* ── keyboard ── */

  function updateCaps(e) {
    if (!e.getModifierState) return;
    $("#capslock-warn").classList.toggle("hidden", !e.getModifierState("CapsLock"));
  }

  window.addEventListener("keydown", e => {
    updateCaps(e);
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;

    if (k === "Tab") {
      e.preventDefault();
      toIdle();
      return;
    }

    if (state === "results") {
      if (k === "Escape" || k === "Enter") { e.preventDefault(); toIdle(); }
      return;
    }

    if (k === "Escape") {
      e.preventDefault();
      if (state === "run") pauseGame();
      else if (state === "pause") resumeGame();
      else $("#theme-menu").classList.add("hidden");
      return;
    }

    if (state === "pause") {
      if (k === "Enter") { e.preventDefault(); Game.finish(); }
      return;
    }

    if (state === "idle") {
      // first letter press starts the flow
      if (k.length === 1 && k !== " " && !e.repeat) {
        if (document.activeElement && document.activeElement.closest("#config, .top-icons, #theme-menu")) return;
        e.preventDefault();
        startRun();
      }
      return;
    }

    // state === run
    if (k === " ") { e.preventDefault(); Game.resetLock(); return; }
    if (k === "Backspace") { e.preventDefault(); Game.backspace(); return; }
    if (k.length === 1 && !e.repeat) { e.preventDefault(); Game.handleChar(k); }
  });

  window.addEventListener("keyup", updateCaps);

  // auto-pause when the window loses focus
  window.addEventListener("blur", () => { if (state === "run") pauseGame(); });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state === "run") pauseGame();
  });

  /* ── mobile input ── */

  const mob = $("#mobile-input");
  $("#scene-wrap").addEventListener("touchstart", () => mob.focus({ preventScroll: true }), { passive: true });
  mob.addEventListener("input", () => {
    const v = mob.value;
    mob.value = "";
    if (!v) return;
    const ch = v[v.length - 1];
    if (state === "idle") { startRun(); return; }
    if (state === "run") {
      if (ch === " ") Game.resetLock();
      else Game.handleChar(ch);
    }
  });
  mob.addEventListener("keydown", e => {
    if (e.key === "Backspace" && state === "run") Game.backspace();
  });

  /* ── boot ── */

  applySettings();
  toIdle();
})();
