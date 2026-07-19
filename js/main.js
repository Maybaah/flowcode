"use strict";
/* flowcode — UI, settings, results */
(() => {
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];

  const SETTINGS_KEY = "fc-settings";
  const HIST_KEY = "fc-history";
  const BEST_KEY = "fc-best";
  const KEYS_KEY = "fc-keystats";
  const CUSTOM_KEY = "fc-custom";

  const DEFAULTS = {
    mode: "time", time: 30, words: 25,
    punct: false, nums: false, lang: "en",
    flow: 40, theme: "midnight", sound: true,
    focus: false, custom: false,
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
    $("#tg-focus").classList.toggle("on", S.focus);
    $("#tg-custom").classList.toggle("on", S.custom);
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
  $("#tg-focus").onclick = () => { S.focus = !S.focus; applySettings(); saveSettings(); };
  $("#tg-custom").onclick = () => {
    if (S.custom) { S.custom = false; applySettings(); saveSettings(); }
    else openCustomModal();
  };
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

  /* ── custom text modal ── */

  function customList() {
    const raw = localStorage.getItem(CUSTOM_KEY) || "";
    return raw.split(/\s+/).map(w => w.slice(0, 16)).filter(Boolean);
  }

  function openCustomModal() {
    $("#custom-text").value = localStorage.getItem(CUSTOM_KEY) || "";
    $("#custom-modal").classList.remove("hidden");
    $("#custom-text").focus();
  }

  function closeCustomModal() {
    $("#custom-modal").classList.add("hidden");
    $("#custom-text").blur();
  }

  $("#custom-save").onclick = () => {
    const raw = $("#custom-text").value.trim();
    const words = raw.split(/\s+/).filter(Boolean);
    if (words.length < 10) {
      $("#custom-text").placeholder = "need at least 10 words — paste a longer text";
      $("#custom-text").value = raw;
      return;
    }
    try { localStorage.setItem(CUSTOM_KEY, raw); } catch {}
    S.custom = true;
    applySettings(); saveSettings();
    closeCustomModal();
  };
  $("#custom-off").onclick = () => {
    S.custom = false;
    applySettings(); saveSettings();
    closeCustomModal();
  };

  /* ── per-key stats ── */

  function mergeKeyStats(keyHit, keyMiss) {
    const st = loadJSON(KEYS_KEY, {});
    for (const [ch, n] of Object.entries(keyHit)) {
      (st[ch] = st[ch] || [0, 0])[0] += n;
    }
    for (const [ch, n] of Object.entries(keyMiss)) {
      (st[ch] = st[ch] || [0, 0])[1] += n;
    }
    saveJSON(KEYS_KEY, st);
    return st;
  }

  // chars ranked by miss rate; only keys seen enough to mean something
  function weakKeys(minPresses = 8) {
    const st = loadJSON(KEYS_KEY, {});
    return Object.entries(st)
      .map(([ch, [hit, miss]]) => ({ ch, hit, miss, total: hit + miss, rate: miss / (hit + miss) }))
      .filter(k => k.total >= minPresses && k.miss > 0)
      .sort((a, b) => b.rate - a.rate);
  }

  function renderWeakKeys() {
    const wrap = $("#res-weak-wrap");
    const box = $("#res-weak");
    const top = weakKeys().slice(0, 6);
    wrap.classList.toggle("hidden", top.length === 0);
    box.innerHTML = "";
    for (const k of top) {
      const chip = document.createElement("span");
      chip.className = "weak-chip";
      chip.innerHTML = `<b>${k.ch === " " ? "␣" : k.ch}</b> ${Math.round(k.rate * 100)}%`;
      chip.title = `${k.miss} missed of ${k.total} presses`;
      box.appendChild(chip);
    }
  }

  /* ── daily leaderboard ── */

  function medal(i) { return i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : String(i + 1); }

  function boardStatus(text, kind) {
    const el = $("#board-status");
    el.textContent = text || "";
    el.className = kind || "";
  }

  function renderBoard(data, mine) {
    const list = $("#res-board");
    list.innerHTML = "";
    if (!data || !data.entries.length) {
      const li = document.createElement("li");
      li.className = "board-empty";
      li.textContent = "no runs yet today — be the first";
      list.appendChild(li);
      return;
    }
    data.entries.forEach((e, i) => {
      const li = document.createElement("li");
      li.className = "board-row" + (mine && e.name === mine && i + 1 === lastRank ? " mine" : "");
      // every field is written as text — nothing from the API reaches the parser
      const cell = (cls, text) => {
        const s = document.createElement("span");
        s.className = cls;
        s.textContent = text;
        return s;
      };
      li.append(
        cell("board-rank", medal(i)),
        cell("board-name", e.name),
        cell("board-score", e.score),
        cell("board-meta", `${e.wpm} wpm · ${e.acc}% · ${e.words}w`),
      );
      list.appendChild(li);
    });
  }

  let lastRank = 0;

  async function loadBoard() {
    try {
      boardStatus("loading…");
      const data = await Leaderboard.top(lastResults && lastResults.seed);
      boardStatus("");
      renderBoard(data, Leaderboard.name());
    } catch (err) {
      boardStatus(err.message, "board-err");
      renderBoard(null);
    }
  }

  async function submitRun() {
    if (!lastResults || lastResults.mode !== "daily") return;
    const nameInput = $("#board-name");
    const playerName = nameInput.value.trim();
    if (!playerName) {
      boardStatus("enter a name first", "board-err");
      nameInput.focus();
      return;
    }
    Leaderboard.name(playerName);
    const btn = $("#board-send");
    btn.disabled = true;
    boardStatus("verifying…");
    try {
      const res = await Leaderboard.submit(lastResults, playerName);
      lastRank = res.rank || 0;
      boardStatus(`verified: ${res.verified.wpm} wpm · rank #${res.rank}`, "board-ok");
      // the response carries the board as of the write, so no second read is needed
      renderBoard(res.entries ? { entries: res.entries } : await Leaderboard.top(lastResults.seed), playerName);
      btn.textContent = "submitted";
    } catch (err) {
      // the server recomputes the score, so a rejection means the run itself failed
      boardStatus(err.status === 422 ? "run rejected: " + err.message : err.message, "board-err");
      btn.disabled = false;
    }
  }

  $("#board-send").onclick = submitRun;

  function setupBoard(res) {
    const wrap = $("#res-board-wrap");
    const show = res.mode === "daily" && Leaderboard.enabled();
    wrap.classList.toggle("hidden", !show);
    if (!show) return;
    const btn = $("#board-send");
    btn.disabled = false;
    btn.textContent = "submit run";
    $("#board-name").value = Leaderboard.name();
    lastRank = 0;
    boardStatus("");
    renderBoard(null);
    loadBoard();
  }

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

  const PRIMARY_LABEL = { time: "sec", words: "left", endless: "words", sudden: "words", ramp: "words", zen: "sec", daily: "sec" };
  const DAILY = { time: 60, flow: 50, lang: "en" };

  function onHud(h) {
    let primary;
    if (S.mode === "time") primary = Math.max(0, Math.ceil(S.time - h.elapsed));
    else if (S.mode === "daily") primary = Math.max(0, Math.ceil(DAILY.time - h.elapsed));
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
    let cfg;
    if (S.mode === "daily") {
      // fixed and seeded so every player gets the same run today
      cfg = {
        mode: "daily", time: DAILY.time, flow: DAILY.flow, lang: DAILY.lang,
        punct: false, nums: false,
        seed: GameMath.dateSeed(new Date()), noPowerups: true,
      };
    } else {
      cfg = {
        mode: S.mode, time: S.time, words: S.words,
        punct: S.punct, nums: S.nums, lang: S.lang, flow: S.flow,
        customList: S.custom ? customList() : null,
        weakChars: S.focus ? weakKeys().slice(0, 3).map(k => k.ch) : null,
      };
    }
    Game.start(cfg, { onHud, onEnd, onBanner: banner });
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

    mergeKeyStats(res.keyHit || {}, res.keyMiss || {});

    const meaningful = res.time >= 10 || res.hits >= 10;
    let isPB = false;
    if (meaningful) {
      const best = loadJSON(BEST_KEY, {});
      const param = res.mode === "time" ? S.time
        : res.mode === "words" ? S.words
        : res.mode === "daily" ? res.seed
        : "-";
      const key = `${res.mode}|${param}|${res.lang}|${res.flow}`;
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

    $("#res-foot-note").textContent = res.mode === "daily"
      ? `daily #${GameMath.dailyNumber(new Date())} · score ${res.score}`
      : "";
    renderWeakKeys();
    setupBoard(res);
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
    const ctx = setupCanvas($("#res-graph"), 760, 220);
    graphCore(ctx, 0, 0, 760, 220, res);
  }

  // shared by the results screen and the share card
  function graphCore(ctx, ox, oy, W, H, res) {
    const L = 46, R = 16, T = 18, B = 30;
    const samples = res.samples;
    ctx.save();
    ctx.translate(ox, oy);
    ctx.font = "11px 'JetBrains Mono', monospace";

    if (samples.length < 2) {
      ctx.fillStyle = cssVar("--dim");
      ctx.textAlign = "center";
      ctx.fillText("run too short to chart", W / 2, H / 2);
      ctx.restore();
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
    ctx.restore();
  }

  /* ── share card ── */

  function drawCard(res) {
    const W = 1000, H = 520;
    const cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    const ctx = cv.getContext("2d");
    const bg = cssVar("--bg"), panel = cssVar("--panel"), line = cssVar("--line");
    const text = cssVar("--text"), dim = cssVar("--dim"), accent = cssVar("--accent");

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = line;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(6, 6, W - 12, H - 12, 18); ctx.stroke();

    // wordmark
    ctx.save();
    ctx.translate(52, 44);
    ctx.rotate(-8 * Math.PI / 180);
    ctx.fillStyle = accent;
    ctx.beginPath(); ctx.roundRect(-13, -13, 26, 26, 7); ctx.fill();
    ctx.restore();
    ctx.font = "500 30px 'Chakra Petch', monospace";
    ctx.textAlign = "left";
    ctx.fillStyle = dim;
    ctx.fillText("flow", 84, 55);
    ctx.font = "700 30px 'Chakra Petch', monospace";
    ctx.fillStyle = text;
    ctx.fillText("code", 145, 55);

    // context line
    const when = new Date().toISOString().slice(0, 10);
    const label = res.mode === "daily"
      ? `daily #${GameMath.dailyNumber(new Date())} · ${when}`
      : `${res.mode} · ${res.lang} · flow ${res.flow} wpm · ${when}`;
    ctx.font = "15px 'JetBrains Mono', monospace";
    ctx.fillStyle = dim;
    ctx.textAlign = "right";
    ctx.fillText(label, W - 48, 55);

    // headline numbers
    ctx.textAlign = "left";
    ctx.font = "700 96px 'Chakra Petch', monospace";
    ctx.fillStyle = accent;
    ctx.fillText(String(res.wpm), 48, 190);
    ctx.font = "13px 'JetBrains Mono', monospace";
    ctx.fillStyle = dim;
    ctx.fillText("WPM", 52, 214);

    const cols = [
      [res.acc + "%", "accuracy"], [res.raw, "raw"], [res.cons + "%", "consistency"],
      [res.maxCombo, "max combo"], [res.score, "score"],
    ];
    let cx0 = 320;
    for (const [v, lbl] of cols) {
      ctx.font = "700 40px 'Chakra Petch', monospace";
      ctx.fillStyle = text;
      ctx.fillText(String(v), cx0, 175);
      ctx.font = "12px 'JetBrains Mono', monospace";
      ctx.fillStyle = dim;
      ctx.fillText(lbl, cx0 + 1, 200);
      cx0 += 135;
    }

    // graph panel
    ctx.fillStyle = panel;
    ctx.beginPath(); ctx.roundRect(40, 240, W - 80, 220, 14); ctx.fill();
    ctx.strokeStyle = line;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(40, 240, W - 80, 220, 14); ctx.stroke();
    graphCore(ctx, 40, 240, W - 80, 220, res);

    ctx.font = "13px 'JetBrains Mono', monospace";
    ctx.fillStyle = dim;
    ctx.textAlign = "center";
    ctx.fillText("finish the word before its cube crosses the line — github.com/Maybaah/flowcode", W / 2, H - 26);
    return cv;
  }

  $("#btn-card").onclick = () => {
    if (!lastResults) return;
    drawCard(lastResults).toBlob(blob => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `flowcode-${lastResults.wpm}wpm.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    });
  };

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

    // while the custom-text modal is open, keys belong to its textarea
    if (!$("#custom-modal").classList.contains("hidden")) {
      if (k === "Escape") { e.preventDefault(); closeCustomModal(); }
      return;
    }

    // typing a leaderboard name must not drive the game
    const el = e.target;
    if (el && el.id === "board-name") {
      if (k === "Enter") { e.preventDefault(); submitRun(); }
      else if (k === "Escape") el.blur();
      return;
    }

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

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
})();
