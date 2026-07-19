# flowcode leaderboard worker

The daily leaderboard for [flowcode](../README.md). A Cloudflare Worker with a D1
database, deployed separately from the game — GitHub Pages serves static files and
cannot store anything, so this is the only piece that needs a server.

The game works perfectly well without it. Leave `leaderboardApi` empty in
[`js/config.js`](../js/config.js) and no leaderboard UI appears and no request is
ever made.

## Why it stores a keystroke tape and not a score

A browser game cannot be trusted to report its own score — anyone can open devtools
and `fetch` a made-up number. So the client submits **what it typed and when**, and
the Worker decides what that was worth.

This works because the daily challenge is fully reproducible. Its word list comes
from `Words.sequence()` seeded with the UTC date, cubes spawn on a fixed cadence,
and each one lives a fixed time. Given only the day, the Worker rebuilds the exact
run the player saw, replays the tape against it — respecting lock-on, expiry and
combo rules — and computes the score itself. Anything the client claims is ignored.

On top of the replay, [`js/verify.js`](../js/verify.js) rejects tapes that are not
physically plausible: keystrokes closer together than 12 ms, machine-regular typing
cadence within words, runs longer than the time limit, and results above 300 wpm.
None of this is unbreakable — a patient bot can synthesise human-looking timings —
but it ends the one-line console cheat, which is what actually matters.

Verification logic is covered by [`tests/verify.test.js`](../tests/verify.test.js).

## Deploy

You need a free Cloudflare account. From this directory:

```bash
npm install
npx wrangler login              # opens a browser to authorise
npx wrangler d1 create flowcode # prints a database_id
```

Paste that `database_id` into [`wrangler.toml`](wrangler.toml), then create the
tables and ship it:

```bash
npm run db:remote               # applies schema.sql to the live database
npm run deploy                  # prints your worker URL
```

Finally, put that URL into `leaderboardApi` in [`js/config.js`](../js/config.js),
and add your Pages origin to `ALLOWED_ORIGINS` in [`src/index.js`](src/index.js) if
you host the game somewhere other than `maybaah.github.io`.

## Local development

```bash
npm run db:local                # local sqlite copy of the schema
npm run dev                     # http://127.0.0.1:8787
```

Point the game at it by setting `leaderboardApi` to `http://127.0.0.1:8787` — that
origin is already allowed.

## API

| Method | Path | Purpose |
| :-- | :-- | :-- |
| `GET` | `/api/leaderboard?day=YYYYMMDD` | Top 50 for a day. Defaults to today. |
| `POST` | `/api/submit` | Body `{day, name, player, keys}`. Replays and stores. |
| `GET` | `/api/health` | Liveness plus the current day seed. |

`keys` is the tape: an array of `[character, millisecondsSinceRunStart]`.

Submissions are limited to the current and previous UTC day, one row per player per
day (a better run replaces a worse one), 40 submissions per IP per day, and 128 KB
per request.

## Cost

Comfortably inside the free tier: 100,000 Worker requests per day and 100,000 D1
row writes per day. A busy day for this game is a few hundred of each.
