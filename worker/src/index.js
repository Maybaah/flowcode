/* flowcode leaderboard: Cloudflare Worker + D1.

   Clients submit the keystroke tape of a ranked run, never a score. The Worker
   rebuilds that run's word sequence from its seed, replays the tape, and stores
   the score it computed itself. Every mode has its own daily board.
   See js/verify.js for the replay. */
"use strict";
import Verify from "../../js/verify.js";
import GameMath from "../../js/stats.js";

const ALLOWED_ORIGINS = [
  "https://maybaah.github.io",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
];

const PROTOCOL = 2;            // bumped when the replay rules change
const MAX_BODY = 128 * 1024;   // a full tape is a few KB; this is generous
const MAX_PER_IP_PER_DAY = 60;
const TOP_N = 50;

const TOP_QUERY =
  `SELECT name, wpm, acc, score, words, max_combo AS maxCombo, flow, created_at AS at
     FROM scores WHERE day = ?1 AND mode = ?2
    ORDER BY score DESC, wpm DESC, created_at ASC
    LIMIT ?3`;

function cors(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function json(body, status, origin, extra) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      ...cors(origin),
      ...extra,
    },
  });
}

/* Throttling needs to recognise a repeat caller, not identify a person, so the
   address is never stored. The day is mixed in as a rotating salt, which also
   means the counters cannot be correlated across days. */
async function ipKey(ip, day, env) {
  const salt = (env && env.RATE_SALT) || "flowcode";
  const bytes = new TextEncoder().encode(`${salt}:${day}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].slice(0, 12)
    .map(b => b.toString(16).padStart(2, "0")).join("");
}

const todaySeed = () => GameMath.dateSeed(new Date());

function yesterdaySeed() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return GameMath.dateSeed(d);
}

/* ── GET /api/leaderboard?day=YYYYMMDD&mode=time ── */
async function handleLeaderboard(req, env, origin) {
  const url = new URL(req.url);
  const raw = url.searchParams.get("day");
  const day = raw ? Number(raw) : todaySeed();
  if (!Number.isInteger(day) || day < 20260101 || day > 21000101) {
    return json({ error: "bad day" }, 400, origin);
  }
  const mode = url.searchParams.get("mode") || "daily";
  if (!Verify.MODES[mode]) return json({ error: "bad mode" }, 400, origin);

  const { results } = await env.DB.prepare(TOP_QUERY).bind(day, mode, TOP_N).all();

  return json({ day, mode, count: results.length, entries: results }, 200, origin, {
    "Cache-Control": "public, max-age=10",
  });
}

/* ── POST /api/submit ── */
async function handleSubmit(req, env, origin) {
  // content-length can be absent or wrong, so measure what actually arrived
  const declared = Number(req.headers.get("content-length") || 0);
  if (declared > MAX_BODY) return json({ error: "payload too large" }, 413, origin);

  const raw = await req.text();
  if (raw.length > MAX_BODY) return json({ error: "payload too large" }, 413, origin);

  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "invalid json" }, 400, origin);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json({ error: "invalid body" }, 400, origin);
  }

  if (body.v !== PROTOCOL) {
    return json({ error: "client out of date, reload the page" }, 400, origin);
  }

  const day = Number(body.day);
  if (day !== todaySeed() && day !== yesterdaySeed()) {
    return json({ error: "that challenge is closed" }, 400, origin);
  }

  const name = Verify.cleanName(body.name);
  if (!name) return json({ error: "a name is required" }, 400, origin);

  const player = typeof body.player === "string" ? body.player.slice(0, 64) : "";
  if (!/^[a-zA-Z0-9-]{8,64}$/.test(player)) {
    return json({ error: "bad player id" }, 400, origin);
  }

  const conf = Verify.checkConfig({
    mode: body.mode, day,
    seed: body.seed, flow: body.flow,
    time: body.time, words: body.words, lang: body.lang,
  });
  if (!conf.ok) return json({ error: "run rejected", reason: conf.reason }, 422, origin);
  const cfg = conf.cfg;

  // A read straight after a write can land on a replica that has not caught up,
  // which would tell a player who just placed first that the board is empty.
  // Pinning this request to the primary gives it read-your-writes.
  const db = typeof env.DB.withSession === "function"
    ? env.DB.withSession("first-primary")
    : env.DB;

  // cheap per-caller throttle so a script cannot hammer the replay
  const caller = await ipKey(req.headers.get("cf-connecting-ip") || "unknown", day, env);
  const hit = await db.prepare(
    `INSERT INTO rate (ip, day, n) VALUES (?1, ?2, 1)
       ON CONFLICT(ip, day) DO UPDATE SET n = n + 1
     RETURNING n`
  ).bind(caller, day).first();
  if (hit && hit.n > MAX_PER_IP_PER_DAY) {
    return json({ error: "too many submissions today" }, 429, origin);
  }

  // counters are only useful while the challenge is open, so drop the rest
  if (Math.random() < 0.05) {
    const cutoff = GameMath.dateSeed(new Date(Date.now() - 3 * 86400000));
    await db.prepare(`DELETE FROM rate WHERE day < ?1`).bind(cutoff).run();
  }

  const run = Verify.replay(cfg, body.keys);
  if (!run.ok) return json({ error: "run rejected", reason: run.reason }, 422, origin);

  // one row per player per board; keep their best
  await db.prepare(
    `INSERT INTO scores (day, mode, player, name, wpm, acc, score, words, max_combo, flow, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
     ON CONFLICT(day, mode, player) DO UPDATE SET
       name = excluded.name, wpm = excluded.wpm, acc = excluded.acc,
       score = excluded.score, words = excluded.words,
       max_combo = excluded.max_combo, flow = excluded.flow,
       created_at = excluded.created_at
     WHERE excluded.score > scores.score`
  ).bind(day, cfg.mode, player, name, run.wpm, run.acc, run.score, run.words, run.maxCombo, cfg.flow, Date.now()).run();

  const rank = await db.prepare(
    `SELECT COUNT(*) + 1 AS rank FROM scores WHERE day = ?1 AND mode = ?2 AND score > ?3`
  ).bind(day, cfg.mode, run.score).first();

  // hand back the fresh board so the client never has to re-read a lagging replica
  const { results } = await db.prepare(TOP_QUERY).bind(day, cfg.mode, TOP_N).all();

  return json({
    ok: true,
    verified: run,
    rank: rank ? rank.rank : null,
    entries: results,
  }, 200, origin);
}

export default {
  async fetch(req, env) {
    const origin = req.headers.get("origin") || "";
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });

    const { pathname } = new URL(req.url);
    try {
      if (req.method === "GET" && pathname === "/api/leaderboard") {
        return await handleLeaderboard(req, env, origin);
      }
      if (req.method === "POST" && pathname === "/api/submit") {
        return await handleSubmit(req, env, origin);
      }
      if (req.method === "GET" && pathname === "/api/health") {
        return json({ ok: true, day: todaySeed(), v: PROTOCOL }, 200, origin);
      }
      return json({ error: "not found" }, 404, origin);
    } catch (err) {
      // log for the tail, but never hand internals to the caller
      console.error("unhandled", err && err.stack || err);
      return json({ error: "internal error" }, 500, origin);
    }
  },
};
