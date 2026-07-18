# flowcode

A 3D typing trainer: words fly at you inside cubes and drift toward a red horizon line. Finish each word before its cube crosses the line. You set the flow rate yourself — 20 to 200 words per minute.

Think monkeytype's stats and Piano Tiles' pressure, in one page. No build step, no dependencies, no tracking: plain HTML, CSS 3D transforms and vanilla JavaScript.

## Run it

Any static server works. The repo ships with a tiny one:

```bash
node server.js      # http://localhost:4173
```

Or just open `index.html` in a browser.

## How to play

Start typing and the flow begins. The first letter you press locks onto the nearest matching cube; keep typing to finish that word. A completed cube bursts, an escaped one costs you.

| Key | Action |
| --- | --- |
| `tab` | restart |
| `esc` | pause / resume |
| `space` | drop the current target |
| `backspace` | step back one letter |
| `enter` | finish the run (while paused) |

## Modes

- **time** — fixed 15/30/60/120 second run
- **words** — fixed 10/25/50/100 words
- **survival** — three lives, endless flow
- **flawless** — one mistake and the run ends
- **rush** — flow speeds up by 4 wpm every 8 seconds
- **zen** — no limits, stop whenever

## Power-up cubes

Gold cubes carry a bonus that fires the moment you finish the word: ❄ freeze the flow, 🐌 slow motion, 💥 clear every cube on screen, ★ double score, ♥ an extra life.

## Everything else

Combo multiplier that grows as you chain words, early-kill score bonus, optional punctuation / numbers / capitals, English and Russian word lists, five themes, WebAudio sound effects, CapsLock warning, auto-pause when the window loses focus, and touch support.

Results give you wpm, raw wpm, accuracy, consistency, a per-second wpm chart with error markers, plus a bar chart of recent runs. Personal bests and history live in `localStorage` — nothing leaves the browser.

## Layout

```
index.html      markup
style.css       themes, 3D scene, layout
js/game.js      engine: spawn, motion, input, scoring
js/main.js      UI, settings, results, charts
js/words.js     word lists and generator
js/audio.js     WebAudio sound effects
server.js       static dev server
```
