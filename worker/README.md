# flowcode leaderboard worker

The leaderboards for [flowcode](../README.md). A Cloudflare Worker with a D1
database, deployed separately from the game: GitHub Pages serves static files and
cannot store anything, so this is the only piece that needs a server.

On maybaah.github.io the rows go into the `arcade` database shared with the
other mini-games, in one `scores` table keyed `(game, board, player)`: game
`flowcode`, board `<mode>-<day>`. That table sorts ascending, so a row holds the
negated score and keeps the real points in `detail` next to wpm, accuracy, words
and combo. The replay stays in this Worker rather than the arcade one because it
needs this game's word engine. Deploying standalone works the same way against a
database of your own.

The game works perfectly well without it. Leave `leaderboardApi` empty in
[`js/config.js`](../js/config.js) and no leaderboard UI appears and no request is
ever made.

Every mode except zen has its own daily board: the daily challenge is always
ranked, and any other mode becomes rankable when the player arms the 🏆 ranked
toggle, which seeds the run and disables power-ups and modifiers.

## Why it stores a keystroke tape and not a score

A browser game cannot be trusted to report its own score; anyone can open devtools
and `fetch` a made-up number. So the client submits **what it typed and when**, and
the Worker decides what that was worth.

This works because a ranked run is fully reproducible. Its word list comes from
`Words.sequence()` seeded with the UTC date (daily) or a per-run seed sent with the
submission, cubes spawn on a deterministic cadence, and each keeps the speed it was
born with even when the flow ramps. Given the seed and config, the Worker rebuilds
the exact run the player saw, replays the tape against it (respecting lock-on,
expiry, lives, sudden-death and combo rules), and computes the score itself.
Anything the client claims is ignored. The tape also records target drops (space)
and backspaces, so replay lock state tracks the player's exactly.

On top of the replay, [`js/verify.js`](../js/verify.js) validates the submitted
config against each mode's allowed values and rejects tapes that are not
physically plausible: keystrokes closer together than 12 ms, machine-regular typing
cadence within words, runs longer than the limit, and results above 300 wpm.
None of this is unbreakable (a patient bot can synthesise human-looking timings)
but it ends the one-line console cheat, which is what actually matters.

Verification logic is covered by [`tests/verify.test.js`](../tests/verify.test.js).

## Deploy

You need a free Cloudflare account. From this directory:

```bash
npm install
npx wrangler login              # opens a browser to authorise
npx wrangler d1 create arcade   # prints a database_id
```

Paste that `database_id` into [`wrangler.toml`](wrangler.toml), create the table
with the schema from the [site repo](https://github.com/Maybaah/Maybaah.github.io)
(`worker/schema.sql`), then ship it:

```bash
npm run deploy                  # prints your worker URL
```

Finally, put that URL into `leaderboardApi` in [`js/config.js`](../js/config.js),
and add your Pages origin to `ALLOWED_ORIGINS` in [`src/index.js`](src/index.js) if
you host the game somewhere other than `maybaah.github.io`.

## Local development

```bash
wrangler d1 execute arcade --local --file=/path/to/site/worker/schema.sql
npm run dev                     # http://127.0.0.1:8787
```

Point the game at it by setting `leaderboardApi` to `http://127.0.0.1:8787`; that
origin is already allowed.

## API

| Method | Path | Purpose |
| :-- | :-- | :-- |
| `GET` | `/api/leaderboard?day=YYYYMMDD&mode=time` | Top 50 for a board. Defaults to today's daily. |
| `POST` | `/api/submit` | Body `{v: 2, day, mode, seed, flow, time, words, lang, name, player, keys}`. Replays and stores. |
| `GET` | `/api/health` | Liveness, the current day seed, and the protocol version. |

`keys` is the tape: an array of `[character, millisecondsSinceRunStart]`, where
the character is a typed key, `" "` (target drop) or `"\b"` (backspace).

Submissions are limited to the current and previous UTC day, one row per player per
board (a better run replaces a worse one), 60 submissions per IP per day, and 128 KB
per request. Submissions with the wrong protocol version are rejected with a
"reload the page" error so stale clients fail loudly instead of silently.

## Cost

Comfortably inside the free tier: 100,000 Worker requests per day and 100,000 D1
row writes per day. A busy day for this game is a few hundred of each.
