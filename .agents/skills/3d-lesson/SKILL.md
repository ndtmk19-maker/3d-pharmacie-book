---
name: 3d-lesson
description: Turn a lesson (pasted text, notes, a PDF, a syllabus point or just a topic) into an interactive 3D "book" web page in the style of Every Joule (iamtechartist.github.io/every-joule-lesson1) — three.js r170 + postprocessing, an ink drawing that a pen draws flat on the page and then lifts off into 3D, glowing liquid jars for the quantities, colour-blended flow tubes, an exact simulation, and the Predict → Try it → Why? → Challenge loop. Use when the user passes a lesson and wants it as a 3D/interactive webpage, says "make this lesson 3D", "turn this into a lesson page", "like the Every Joule page", or "/3d-lesson".
---

# 3D lesson page

The user passes a lesson; you return a working, verified page built from `template/`. Read
`references/every-joule-teardown.md` once for the look and the reasons behind it (it is the reverse-engineered
analysis of the original). The template is a fresh, working implementation of the same ideas. Build on it; do not
copy code from the original site.

## 1. Read the lesson and plan the page (before writing code)

Pull out, in the lesson's own words where possible:

| Field | What it is |
|---|---|
| `title`, `n`, `figure` | lesson name, number, a 3–6 word figure caption |
| `explanation[]` | 1–3 short sentences: the core idea |
| `equation` | `{symbols: 'E_p = m g h', words: '…'}` (`_x` is a subscript, `^2` a square). Leave it out if there is none |
| `keywords[]` | 3–5 `{term, definition}` |
| `predict` | a question that tests the lesson's **main misconception**, 2–3 options, `answer` index |
| `tryHint` | one line: what to tap or drag |
| `explain` | the "Why?" under the flap: 2–4 sentences that resolve the prediction |
| `challenge` | `{text, done}`: a goal you can measure (find all X, make the ball just reach the flag, hit 50 % efficiency) |
| `things[]` | 3–8 objects to draw, each tied to one jar (`store`) with a `work` block: equation, inputs, `J` |
| `jars` | the quantities to show as glowing jars. Energy lessons use the default eight stores; other topics pass their own `[{id, name, color}]` (for example a charge, a mass or a population) |
| `event` | optional: one process to simulate (a fall, a collision, heating) that moves quantity between jars |
| `watch[]` | a 3–5 step camera tour that taps things and runs the event |

Show the user this plan in a short table and go on unless something is missing or ambiguous (for example, which
misconception to target, or numbers that need a source).

**Numbers:** every number is either cited (keep a `sources` note or comment with the publisher and URL) or marked
`example: true`. Something with no defensible number is `qualitative: true`: its jar lights without a level. Never
make up a "fact"; the original's credibility comes from this.

## 2. Make the project

```bash
DEST=~/Desktop/project/3D-lesson/lessons/<nn-slug>      # default location, unless the user names one
mkdir -p "$DEST" && cp -R ~/.claude/skills/3d-lesson/template/. "$DEST"
cd "$DEST" && npm install
```

Then write `src/lessons/<slug>.js` (copy `lesson1.js` as the starting shape) and change the import at the top of
`src/main.js` to it. Set the `<title>` in `index.html`.

## 3. Draw the things (the part that needs taste)

Use the `P` helpers from `engine/ink.js` (`box, cyl, cone, sphere, torus, tube`). The rules the lift shader depends on:

- The **base sits on y = 0** and the object faces **+z** (the reader). It lifts by rotating about that baseline.
- About **5 units wide and 2–5 tall**. Two rows of four fit a page (`at` is set by `lesson1.js`'s layout line; keep it).
- Transforms are **baked into the geometry** (the helpers do this). Do not set `mesh.position` on parts.
- `tone: 'paper' | 'shade' | 'ink'` gives the three-value ink-drawing palette. Use `ink` for small dark accents only.
- Thin tubes (springs, strings, steam) use `edges: false`; boxy parts keep crease lines.
- A part that must move in the event goes in a named `group` (for example `group: 'book'`). Move only that
  sub-group, and only after the lift has finished.
- Fewer, recognisable shapes beat detail. It is a drawing in a book, not a game asset.

## 4. The event (if the lesson has a process)

Copy `bookDrop()` in `lesson1.js`. The contract is `{label, accounts[], capacity, thing, reset, start, begin(L),
step(dt, L), pose(thing), readout(L), peakWatts?}`. Move quantities only with `L.move(from, to, amount, dt)`. The
jars and the flow tubes are driven from the ledger, so a flow appears wherever you move something. Use the exact
solution where there is one, slow it with a `SLOW` factor so it can be watched, and check that `L.total()` stays
constant. The readout shows it.

## 5. Build and verify (always)

```bash
npm run build && (npx vite preview --port 4173 --strictPort &) && sleep 2
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --user-data-dir=/tmp/lesson-chrome \
  --use-angle=metal --remote-debugging-port=9333 about:blank & sleep 3
node ~/.claude/skills/3d-lesson/scripts/verify.mjs http://localhost:4173/ ./shots 9333
```

Open the PNGs with Read and check that:
- all things lift and are recognisable
- the jars fill and glow
- the flow tube appears on tap and during the event
- the readout total is conserved
- the mobile layout fits
- the script reports no console errors

Fix what you see and run it again. Stop the preview and Chrome afterwards. Report what was verified, and say
plainly if something was not.

## 6. Ship (only when asked)

`vite.config.js` uses `base: './'`, so `dist/` works on GitHub Pages or any static host. Publishing is outward-facing:
ask first.

## Style constants (keep them unless the user wants a different look)

Desk `#b9b0a2` · paper `#f4eddd` · ink `#1c2433` · accent `#9a3b2a` · cloth `#1f2b52` · Source Serif 4.
The energy-store colours are in `src/stores.js`. Bloom only catches values above 1.0 (lit liquid and flows), so keep
paper lighting below that. Respect `prefers-reduced-motion` (the template already does).

## Template map

`src/main.js` (scene, state, picking, frame loop) · `engine/ink.js` (lift shader, pen-drawn edges, `P`, `makeThing`) ·
`engine/book.js` (desk, cover, printed pages) · `engine/jars.js` (glowing liquid) · `engine/flows.js` (hue-blended
tubes) · `engine/ledger.js` · `engine/post.js` (bloom, tone mapping, vignette, SMAA, quality tiers) ·
`engine/tour.js` (Watch) · `ui/panel.js` (lesson card) · `ui/a11y.js` (text version) · `lessons/lesson1.js` (example).
