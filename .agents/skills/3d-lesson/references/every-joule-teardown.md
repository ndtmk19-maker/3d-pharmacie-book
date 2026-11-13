# Every Joule · Lesson 1: teardown

Source: https://iamtechartist.github.io/every-joule-lesson1/ (by "Techartist", © 2026; the author says it was built with
Three.js and Claude Opus 5.5). Analysed 2026-10-26 with REA `analyze_javascript_application` (Evidence
`ev_f909ca29…`, 7 JS files parsed, 0 failures; static parse only, nothing executed) plus a read of the shipped
bundle text. Treat this as a description of *techniques*, not code to copy: the template in `../template` is a fresh
implementation.

## Stack (observed in the bundle)

| Piece | What | Evidence |
|---|---|---|
| Build | Vite (`__vite__mapDeps`, `modulepreload` polyfill, hashed `assets/*.js`) and plain ES modules, no framework | `main-*.js` header |
| 3D | three.js **r170** (`REVISION "170"`) | `three-*.js` |
| Post | **pmndrs/postprocessing v6.36.4**: AO pass, SMAA (HIGH), Vignette (offset .28, darkness .42), ToneMapping NEUTRAL, mipmap Bloom, plus 2 custom effects `HueToneMap` and `LiquidGlass` (the UI capsule) | `post-*.js` licence header, `main-*.js` |
| Fonts | Source Serif 4 Variable (self-hosted woff2, roman + italic) | `index.html` |
| Hosting | GitHub Pages, relative `./assets` base | URL |
| Lazy lessons | `qo = {1: () => import("./stores-*.js")}`: one module per lesson, loaded on demand | `main-*.js` |

Chunks: `main` (book, pages, UI, quiz, a11y), `stores` (lesson 1 scene + sim), `numbers` (cited values and source
list, every value keyed), `index` (physics core: splines, ODE integrator, energy ledger, lesson sims), `post`, `three`,
`sourcelist` (Markdown list of sources).

## The ideas that make it look like that

1. **A real book.** A cloth cover (MeshPhysical with weave normal map, sheen, gold foil via `onBeforeCompile`), paper
   pages with printed canvas textures, page-turn leaves (`ej-page` and `ej-cloth` shader keys), page edges with ruled
   lines. Spreads: 0 = cover, 1 = contents, 2–11 = lessons 1–10, 12 index, 13 quiz, 14 sources.
2. **The drawing lifts off the page** (`popWorld` in `stores-*.js`). Each object is modelled in 3D, then a vertex
   shader blends between a flat *cabinet projection* lying on the paper (`uCab = 0.4·(cos .61, sin .61)`) and the
   standing object, rotating about the page's baseline with a smoothstep angle and `pow(u, 8)` depth growth.
3. **Pen-drawn ink.** Lines are custom ribbons with per-vertex arc length `vS`; a moving `vHead` reveals the stroke as
   if drawn by a pen, with a flat copy and a standing copy that hand over (`uCopyAlpha` / `uStandAlpha`). A cut-away
   plane (`uClip`) slices objects open (used to show inside the AA cell). Hatching uses `uHatchA/B`, `uSpacing`.
4. **Energy is glowing liquid in jars**, one jar per store, in a fixed order and colour:
   kinetic, gravitational, elastic, thermal, chemical, magnetic, electrostatic, nuclear. The loader cycles
   `#2f7bff #8a4dff #ff3fb4 #ff7a1c #26c75a #e8233a #18c4dc #ffcf1a` (pairing to that order is inferred).
   The liquid shader adds rim light, a brighter meniscus top and slow internal currents so it never reads as flat
   paint; its colour × glow exceeds 1.0, so bloom makes it glow.
5. **Flows are tubes between stores** whose colour blends source→destination *round the hue circle the short way*
   (an RGB mix of complementary colours goes grey), with pulses moving at a speed set by the power in watts.
6. **Every joule is accounted for.** A ledger (`ledger.move/transfer(from, to, J, kind)`) with accounts like
   `gravitational:ball`, `thermal:surroundings`; `flows()` returns watts per pair; the jars and tubes are driven only
   by it. Sims are exact (spline track, Gauss–Legendre arc length, event-detecting ODE integrator) and slowed by a
   `SLOW` factor so a 0.5 s fall can be watched.
7. **Every number is sourced.** `numbers-*.js` holds keyed values with publisher, URL and access date
   (AQA spec, FIBA, ITF…). Values with no source are flagged `example: true` or `qualitative: true` and the UI says so
   ("no source gives a number for this store, so its jar lights without one"). Each jar has its own scale text
   ("full jar = one second of sunshine").
8. **The teaching loop on each spread:** Predict (tick an option first) → Watch (the drawing lifts) → Try it (tap or
   drag; the jars show where every joule goes) → Why? (lift the flap) → Challenge (meet it to earn a stamp). A
   "Watch the demonstration" camera tour (keyframes `{cam:{pos, look|follow}, act}`; Space pauses, Escape stops).
9. **Lesson record shape** (one per lesson in `main-*.js`):
   `{n, title, folios, figure, explanation[], equation:{symbols, words}, keywords[{term, definition}],
   predict:{question, options[], answer}, explain, tryHint, challenge:{text, done}}`, plus generated quiz questions
   whose numbers come from the cited values.
10. **Accessibility and robustness:** a full HTML text version of every spread in a `.sr` `<main>` that becomes
    visible on focus, an `aria-live` region, arrow keys to turn pages, `prefers-reduced-motion` and a remembered
    "still" mode, a no-WebGL fallback, quality tiers (`high/medium/low`: pixel ratio 1.5/1.25/1, bloom resolution
    .5/.35/.25, shadow map 2048/1024, AO off below high) chosen by sampling frame times, and progress (stamps,
    bookmark, quiz) in local storage.
11. **Look:** desk `#b9b0a2`, paper `#efe7d6`/`#f6efe0`, ink `#1c2433`, red accent `#9a3b2a`, navy cloth `#1f2b52`,
    gold `#c8961e`. The loader writes the author mark in ink letter by letter and drops a glowing dot that cycles the
    store colours.

## Unknowns

Static analysis only: the exact AO effect class, the page-turn maths and the runtime frame budget were not traced
in detail. Nothing here was observed running.
