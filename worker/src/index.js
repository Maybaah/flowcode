/* flowcode leaderboard — Cloudflare Worker + D1.

   Clients submit the keystroke tape of a daily run, never a score. The Worker
   rebuilds that day's word sequence from its seed, replays the tape, and stores
   the score it computed itself. See js/verify.js for the replay. */
"use strict";
import Verify from "../../js/verify.js";
import GameMath from "../../js/stats.js";

const ALLOWED_ORIGINS = [
  "https://maybaah.github.io",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
];

const MAX_BODY = 128 * 1024;   // a full tape is a few KB; this is generous
const MAX_PER_IP_PER_DAY = 40;
const TOP_N = 50;

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

function json(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...cors(origin) },
  });
}

const todaySeed = () => GameMath.dateSeed(new Date());

function yesterdaySeed() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return GameMath.dateSeed(d);
}

/* ── GET /api/leaderboard?day=YYYYMMDD ── */
async function handleLeaderboard(req, env, origin) {
  const url = new URL(req.url);
  const raw = url.searchParams.get("day");
  const day = raw ? Number(raw) : todaySeed();
  if (!Number.isInteger(day) || day < 20260101 || day > 21000101) {
    return json({ error: "bad day" }, 400, origin);
  }
  const { results } = await env.DB.prepare(
    `SELECT name, wpm, acc, score, words, max_combo AS maxCombo, created_at AS at
       FROM scores WHERE day = ?1
      ORDER BY score DESC, wpm DESC, created_at ASC
      LIMIT ?2`
  ).bind(day, TOP_N).all();

  return json({ day, count: results.length, entries: results }, 200, origin);
}

/* ── POST /api/submit ── */
async function handleSubmit(req, env, origin) {
  const len = Number(req.headers.get("content-length") || 0);
  if (len > MAX_BODY) return json({ error: "payload too large" }, 413, origin);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid json" }, 400, origin);
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

  // cheap per-IP throttle so a script cannot hammer the replay
  const ip = req.headers.get("cf-connecting-ip") || "unknown";
  const hit = await env.DB.prepare(
    `INSERT INTO rate (ip, day, n) VALUES (?1, ?2, 1)
       ON CONFLICT(ip, day) DO UPDATE SET n = n + 1
     RETURNING n`
  ).bind(ip, day).first();
  if (hit && hit.n > MAX_PER_IP_PER_DAY) {
    return json({ error: "too many submissions today" }, 429, origin);
  }

  const run = Verify.replay(day, body.keys);
  if (!run.ok) return json({ error: "run rejected", reason: run.reason }, 422, origin);

  // one row per player per day; keep their best
  await env.DB.prepare(
    `INSERT INTO scores (day, player, name, wpm, acc, score, words, max_combo, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
     ON CONFLICT(day, player) DO UPDATE SET
       name = excluded.name, wpm = excluded.wpm, acc = excluded.acc,
       score = excluded.score, words = excluded.words,
       max_combo = excluded.max_combo, created_at = excluded.created_at
     WHERE excluded.score > scores.score`
  ).bind(day, player, name, run.wpm, run.acc, run.score, run.words, run.maxCombo, Date.now()).run();

  const rank = await env.DB.prepare(
    `SELECT COUNT(*) + 1 AS rank FROM scores WHERE day = ?1 AND score > ?2`
  ).bind(day, run.score).first();

  return json({ ok: true, verified: run, rank: rank ? rank.rank : null }, 200, origin);
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
        return json({ ok: true, day: todaySeed() }, 200, origin);
      }
      return json({ error: "not found" }, 404, origin);
    } catch (err) {
      return json({ error: "internal", detail: String(err && err.message || err) }, 500, origin);
    }
  },
};
