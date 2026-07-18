<div align="center">

<img src="assets/hero.svg" alt="flowcode — words fly at you inside 3D cubes and drift toward a red horizon line" width="100%">

<br>

**A typing trainer where the words fight back.**

Words fly at you inside 3D cubes and drift toward a red line on the horizon.<br>
Finish each word before its cube crosses it. You set the pace — 20 to 200 words per minute.

<br>

<img src="https://img.shields.io/badge/dependencies-0-ffb86b?style=for-the-badge&labelColor=0b0e1a" alt="0 dependencies">
<img src="https://img.shields.io/badge/build_step-none-7bffb2?style=for-the-badge&labelColor=0b0e1a" alt="no build step">
<img src="https://img.shields.io/badge/vanilla-JS-ffd75e?style=for-the-badge&labelColor=0b0e1a" alt="vanilla JavaScript">
<img src="https://img.shields.io/badge/3D-CSS_transforms-7fd6ff?style=for-the-badge&labelColor=0b0e1a" alt="CSS 3D transforms">
<a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-7bffb2?style=for-the-badge&labelColor=0b0e1a" alt="MIT license"></a>

</div>

<br>

## Why

Typing tests measure you. This one *chases* you.

On monkeytype the text sits still and waits — your only opponent is the clock. Here the words have a lifespan. A cube spawns, drifts toward the horizon, and if you haven't finished its word by the time it crosses the red line, it's gone. Miss enough and the run ends.

The flow rate is a slider, not a difficulty preset. Set it to 40 wpm to warm up, or 160 to find out exactly where your hands fall apart.

## Quick start

No install, no bundler, no `node_modules`. Clone and open:

```bash
git clone https://github.com/Maybaah/flowcode.git
cd flowcode
node server.js      # → http://localhost:4173
```

Any static server works, and `index.html` opens straight from disk too.

## How it plays

Just start typing — the first keystroke begins the run.

That first letter **locks onto the nearest matching cube**, and everything you type after goes to that word. Finish it and the cube bursts. There's no clicking, no selecting, no aiming — the closest threat that starts with your letter is the one you get.

| Key | Does |
| :-- | :-- |
| any letter | start the run · lock a cube · type |
| <kbd>space</kbd> | drop the current target and pick a new one |
| <kbd>backspace</kbd> | step back one letter |
| <kbd>tab</kbd> | restart |
| <kbd>esc</kbd> | pause / resume |
| <kbd>enter</kbd> | end the run (while paused) |

## Modes

| Mode | The rule |
| :-- | :-- |
| **time** | Fixed run of 15, 30, 60 or 120 seconds. |
| **words** | Fixed count of 10, 25, 50 or 100 words. |
| **survival** | Three lives, endless flow. Every escaped cube costs one. |
| **flawless** | One typo or one escaped cube and it's over. |
| **rush** | Flow speeds up by 4 wpm every 8 seconds. Three lives. Find your ceiling. |
| **zen** | No timer, no limit, no lives. Stop when you want to. |

## Power-up cubes

Gold cubes appear once a run is underway. The bonus fires the moment you finish the word.

| | Bonus | Effect |
| :-: | :-- | :-- |
| ❄ | **freeze** | The whole flow stops dead for 3 seconds. |
| 🐌 | **slow motion** | Half speed for 6 seconds. |
| 💥 | **bomb** | Every cube on screen detonates at once. |
| ★ | **double** | Score ×2 for 10 seconds. |
| ♥ | **extra life** | +1 life, or +250 points in modes without lives. |

<br>

<details>
<summary><b>Scoring &amp; stats</b></summary>

<br>

Each word pays `10 + 8 × length`, multiplied by your combo tier — the multiplier climbs one step per 8 chained words and tops out at ×6. Kill a cube while it's still close and the word is worth **1.5×**; a single typo resets the combo to zero.

The results screen gives you:

- **wpm** and **raw** — corrected and uncorrected speed
- **accuracy** — correct keystrokes over total
- **consistency** — how flat your speed curve was, derived from the standard deviation of your per-second wpm
- **chars**, **words**, **escaped**, **max combo**, **score**, **time**
- a **per-second wpm chart** with a dashed average line and red crosses marking every mistake
- a **bar chart of your recent runs**

Personal bests are tracked per mode / length / language / flow rate, so raising the flow doesn't quietly wipe your record. History keeps the last 30 runs. All of it lives in `localStorage` — nothing is uploaded, there is no account, and there is no analytics.

</details>

<details>
<summary><b>Themes</b></summary>

<br>

Five themes, switchable from the ◐ button, remembered between sessions.

<img src="https://img.shields.io/badge/midnight-ffb86b?style=flat-square&labelColor=0b0e1a" alt="midnight">
<img src="https://img.shields.io/badge/serika-e2b714?style=flat-square&labelColor=323437" alt="serika">
<img src="https://img.shields.io/badge/matrix-37ff8b?style=flat-square&labelColor=020a04" alt="matrix">
<img src="https://img.shields.io/badge/glacier-0d67c4?style=flat-square&labelColor=eef3f8" alt="glacier">
<img src="https://img.shields.io/badge/blood-ff4d6a?style=flat-square&labelColor=120507" alt="blood">

Every colour in the app — cubes, particles, charts, the horizon glow — is a CSS custom property, so a theme is about a dozen lines in `style.css` and it repaints everything including the canvas charts.

</details>

<details>
<summary><b>How the 3D works</b></summary>

<br>

There is no WebGL and no 3D library. The scene is a CSS `perspective` container with `transform-style: preserve-3d`, and every cube is five plain `<div>` faces — front, top, bottom, and two sides — positioned with `rotateY` / `rotateX` and `translateZ`.

A single `requestAnimationFrame` loop walks the live cubes each tick and writes one `translate3d(x, y, z)` per cube, so depth, the drift toward the horizon, the idle bob and the spawn pop are all one transform. The floor is two `repeating-linear-gradient`s on a plane rotated flat, masked so it dissolves into the fog at the horizon.

Cube lifespan is derived straight from the flow setting: `clamp(260 / wpm, 2.2s, 9s)`. Cubes spawn across four lanes, never twice in the same lane back to back, and the generator retries to avoid a first letter another cube on screen already claims — so the lock-on stays unambiguous.

</details>

<details>
<summary><b>Word lists &amp; layout</b></summary>

<br>

English and Russian lists, roughly 250 common words each, weighted toward short ones. Toggle **@ punct** to fold in punctuation, capitals and the occasional parenthesis, and **# numbers** to mix in numerals.

Russian is forgiving about `ё` — typing `е` matches either way.

```
index.html      markup
style.css       themes, 3D scene, layout
assets/         hero art
js/game.js      engine — spawn, motion, input, scoring
js/main.js      UI, settings, results, charts
js/words.js     word lists and generator
js/audio.js     WebAudio sound effects
server.js       static dev server
```

</details>

<br>

## Details that matter

- **Sound with no audio files.** Every effect — keystroke, word burst, combo, miss, game over, new record — is synthesised at runtime with WebAudio oscillators.
- **CapsLock warning**, because a locked CapsLock silently destroys a run.
- **Auto-pause** the moment the window loses focus, so a stray notification doesn't cost you three lives.
- **Touch support** — tap the scene on mobile to summon the keyboard.
- **Reduced-motion aware** — the screen shake respects `prefers-reduced-motion`.

## License

[MIT](LICENSE) — do what you like with it.

<br>

<div align="center">
<sub>Built with vanilla JavaScript and no dependencies · <a href="https://github.com/Maybaah/flowcode">github.com/Maybaah/flowcode</a></sub>
</div>
