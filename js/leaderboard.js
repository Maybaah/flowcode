"use strict";
/* flowcode: leaderboard client.

   Submits the keystroke tape of a ranked run, not a score: the Worker replays
   it against the run's seed and decides what the run was worth. Every mode has
   its own daily board. Everything here degrades to a no-op when no API URL is
   configured. */
const Leaderboard = (() => {
  const NAME_KEY = "fc-name";
  const PLAYER_KEY = "fc-player";

  const api = () => (window.FC_CONFIG && window.FC_CONFIG.leaderboardApi || "").replace(/\/+$/, "");
  const enabled = () => !!api();

  function playerId() {
    let id = null;
    try { id = localStorage.getItem(PLAYER_KEY); } catch {}
    if (!id || !/^[a-zA-Z0-9-]{8,64}$/.test(id)) {
      id = (crypto.randomUUID ? crypto.randomUUID() : "p-" + Math.random().toString(36).slice(2) + Date.now().toString(36))
        .replace(/[^a-zA-Z0-9-]/g, "");
      try { localStorage.setItem(PLAYER_KEY, id); } catch {}
    }
    return id;
  }

  function name(v) {
    if (v === undefined) {
      try { return localStorage.getItem(NAME_KEY) || ""; } catch { return ""; }
    }
    try { localStorage.setItem(NAME_KEY, v); } catch {}
    return v;
  }

  async function top(day, mode) {
    if (!enabled()) return null;
    const q = new URLSearchParams();
    if (day) q.set("day", day);
    if (mode) q.set("mode", mode);
    const qs = q.toString();
    const url = api() + "/api/leaderboard" + (qs ? "?" + qs : "");
    const res = await fetch(url, { headers: { "Accept": "application/json" } });
    if (!res.ok) throw new Error("leaderboard unavailable (" + res.status + ")");
    return res.json();
  }

  async function submit(run, playerName, day) {
    if (!enabled()) return null;
    const res = await fetch(api() + "/api/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        v: 2,
        day,
        mode: run.mode,
        seed: run.seed,
        flow: run.flow,
        time: run.timeSet,
        words: run.wordsSet,
        lang: run.lang,
        name: playerName,
        player: playerId(),
        keys: run.keys,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(body.reason || body.error || "submission failed");
      err.status = res.status;
      throw err;
    }
    return body;
  }

  return { enabled, top, submit, playerId, name };
})();
