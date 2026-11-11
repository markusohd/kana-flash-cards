# Writing Practice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fourth section, **Writing 書く**, where Mark writes kana with a finger in a grid box, watches stroke order, gets his strokes checked, takes a writing quiz and tracks progress.

**Architecture:** Stroke paths come from KanjiVG via a one-off Python build script into `data/strokes.json`. A pure, DOM-free checker (`js/stroke-check.js`) compares point lists. A drawing module (`js/writing-pad.js`) handles the canvas and the model SVG. A screen module (`js/writing.js`) runs practice and quiz. `js/app.js` treats Writing as another section, reusing routing, the section home, the settings dialog, `deck.js` and `storage.js`.

**Tech Stack:** Plain HTML/CSS/JS ES modules, no libraries, no build step. Python 3 standard library for scripts. Node 22 for unit tests. Pre-installed Playwright (`require('playwright')`) for the browser test.

**Spec:** `docs/superpowers/specs/2026-11-11-writing-practice-design.md`

## Global Constraints

- No new libraries in the app. Readable, commented code (Mark is learning).
- Every `localStorage` access goes through `js/storage.js` (already try/catch wrapped).
- Writing card ids are the kana id prefixed `wr:` (e.g. `wr:h-a`, `wr:k-ti`); writing progress never touches flash card ids.
- Reference coordinates are KanjiVG's 109 × 109 box; user strokes are stored in the same units.
- Tolerances (named constants in `js/stroke-check.js`): `END_TOLERANCE = 0.25 * 109`, `SHAPE_TOLERANCE = 0.18 * 109`, `SAMPLE_POINTS = 16`, `MIN_STROKE_LENGTH = 3` (109 units).
- Buttons at least 44 px; works at 360 px wide (no horizontal scroll) and on an iPad-size touch viewport; light and dark mode; `prefers-reduced-motion` respected.
- No audio. `data/kana.json` and its existing checks stay unchanged.
- KanjiVG credit (CC BY-SA 3.0, Ulrich Apel, kanjivg.tagaini.net) in the About section and README.

## Review Focus

- A palm or second finger touches the box mid-stroke: it must be ignored, and the first finger's stroke continues (Task 3 test).
- A finger slides off the box or the browser cancels the touch: the stroke ends cleanly with the points so far, no stuck "drawing" state (Task 3 test).
- The tablet rotates or the window resizes after strokes are drawn: strokes redraw in the right place at the new size, since they are stored in 109 units (Task 3 test).
- Check tapped with nothing written: friendly "Write the character first" message, no crash, no progress change (Task 1 test + Task 4 test).
- Filters that match no characters: Start practice and Start quiz are disabled, with the existing "No cards match" text (Task 5 test).

---

### Task 1: Stroke checker (pure logic)

**Files:**
- Create: `js/stroke-check.js`
- Test: `scripts/test-stroke-check.mjs`

**Interfaces:**
- Produces:
  - `resample(points: [number, number][], n = SAMPLE_POINTS): [number, number][]`: n points evenly spaced along the polyline's length (a single point repeats n times).
  - `strokeLength(points): number`
  - `checkStrokes(user: Point[][], ref: Point[][]): CheckResult` where
    `CheckResult = { ok: boolean, countOk: boolean, empty: boolean, strokes: { ok: boolean, problem: null | "backwards" | "order" | "off", looksLike?: number }[], message: string }`.
    `strokes` has one entry per user stroke; extra user strokes beyond `ref.length` get `problem: "off"`.
  - Constants listed in Global Constraints, exported.

- [ ] **Step 1: Write the failing tests** in `scripts/test-stroke-check.mjs` using `node:test` and `node:assert/strict`. Reference fixture: a 3-stroke "character": `A = [[20,30],[90,30]]` (horizontal), `B = [[55,15],[55,95]]` (vertical), `C = [[25,90],[85,60]]` (diagonal).
  - `exact copy passes`: `checkStrokes([A,B,C],[A,B,C])` → `ok === true`, `countOk === true`, `message === "Nice! ✓"`.
  - `wobbly, shifted, scaled copy passes`: each point moved by up to ±6 deterministic offsets, the whole drawing shifted by (+8,−6) and scaled ×0.9 around (54.5,54.5) → `ok === true`.
  - `reversed stroke is backwards`: `[A, B.reverse() copy, C]` → `strokes[1].problem === "backwards"`, `ok === false`, message contains `"stroke 2 is backwards"`.
  - `swapped strokes report order`: `[B, A, C]` → `strokes[0].problem === "order"`, `strokes[0].looksLike === 2`, message contains `"stroke 1 looks like stroke 2"`.
  - `missing stroke fails count`: `[A, B]` → `countOk === false`, message starts with `"You used 2 strokes; this has 3."`.
  - `extra stroke fails count`: `[A, B, C, [[10,10],[30,10]]]` → `countOk === false`, `strokes[3].problem === "off"`.
  - `nothing written`: `checkStrokes([], [A,B,C])` → `empty === true`, `ok === false`, `message === "Write the character first."`.
  - `resample spacing`: `resample([[0,0],[10,0]], 3)` deep-equals `[[0,0],[5,0],[10,0]]`.

- [ ] **Step 2: Run to verify it fails**

Run: `node --test scripts/test-stroke-check.mjs`
Expected: FAIL (cannot find module `../js/stroke-check.js`).

- [ ] **Step 3: Implement `js/stroke-check.js`**

Algorithm (the tests don't pin the details):
```
for each pair i < min(user.length, ref.length):
  u = resample(user[i]); r = resample(ref[i])
  forward  = mean distance(u[k], r[k])
  if forward <= SHAPE_TOLERANCE and dist(u0,r0) <= END_TOLERANCE and dist(uEnd,rEnd) <= END_TOLERANCE → ok
  else if mean distance(u reversed, r) <= SHAPE_TOLERANCE → "backwards"
  else if some other ref stroke j matches forward within SHAPE_TOLERANCE → "order", looksLike = j+1
  else → "off"
ok = countOk && every stroke ok
message: empty → "Write the character first."; ok → "Nice! ✓";
  otherwise join: count sentence ("You used N strokes; this has M.") then the first two stroke
  problems: "stroke i is backwards" / "stroke i looks like stroke j: check the order" / "stroke i is off",
  joined with ". " and ending with "."
```
Number words: "1 stroke" vs "2 strokes".

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test scripts/test-stroke-check.mjs`
Expected: all 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add js/stroke-check.js scripts/test-stroke-check.mjs
git commit -m "Add stroke checker for writing practice"
```

---

### Task 2: Stroke data and extended katakana

**Files:**
- Create: `scripts/build-strokes.py`, `data/strokes.json` (generated), `data/extra-kana.json`
- Modify: `scripts/check-data.py`

**Interfaces:**
- Produces:
  - `data/extra-kana.json`: 20 entries, `{ "id", "char", "script": "katakana", "stage": 4, "row": "extra", "romaji" }`, ids `k-ti, k-di, k-tu, k-du, k-fa, k-fi, k-fe, k-fo, k-wi, k-we, k-wo, k-va, k-vi, k-vu, k-ve, k-vo, k-she, k-je, k-che, k-tsa` in the spec's order and romaji.
  - `data/strokes.json`: `{ "_source": "KanjiVG (CC BY-SA 3.0) …", "<single char>": ["<svg path d>", …] }` with a key for every individual character appearing in `kana.json` and `extra-kana.json` `char` fields (so ゃ, ィ, ヴ etc. are included). Stroke order = KanjiVG `-sN` order.

- [ ] **Step 1: Add the failing check** to `scripts/check-data.py`: load `extra-kana.json` (20 entries, unique ids not clashing with `kana.json`, required fields, stage 4) and `strokes.json`; for every character in every `char` of both files assert a non-empty stroke list exists. Run `python scripts/check-data.py` → FAIL (files missing).

- [ ] **Step 2: Write `data/extra-kana.json`** (values from Interfaces above).

- [ ] **Step 3: Implement `scripts/build-strokes.py`**: collect the characters, fetch `https://raw.githubusercontent.com/KanjiVG/kanjivg/master/kanji/{ord(ch):05x}.svg` with `urllib.request`, extract `<path id="kvg:XXXXX-sN" d="…">` with a regex, sort by N, write `data/strokes.json` (UTF-8, `ensure_ascii=False`, one character per line). Exit non-zero naming any character that fails.

- [ ] **Step 4: Run build and check**

Run: `python scripts/build-strokes.py && python scripts/check-data.py`
Expected: build reports the number of characters written; check passes. Spot-check: `あ` has 3 strokes, `ア` 2, `ゃ` 3, `ヴ` 5.

- [ ] **Step 5: Commit**

```bash
git add scripts/build-strokes.py scripts/check-data.py data/strokes.json data/extra-kana.json
git commit -m "Add KanjiVG stroke data and extended katakana for writing"
```

---

### Task 3: Writing pad and model drawing

**Files:**
- Create: `js/writing-pad.js`
- Test: `scripts/test-writing.mjs` (Playwright; this task adds the pad tests, Task 4–5 extend it)

**Interfaces:**
- Consumes: `checkStrokes` result shape from Task 1 (`strokes[i].ok`).
- Produces:
  - `class WritingPad { constructor(canvas: HTMLCanvasElement, { onChange?: () => void }); strokes: [number,number][][] /* 109 units */; undo(); clear(); showResult(result: CheckResult | null); redraw(); }`. Draws grid (solid border, dotted centre cross), ink width ≈ 6 units, round caps. After `showResult`, stroke *i* is green if `result.strokes[i].ok` else red; any edit clears the result colours. Resizes via `ResizeObserver` (canvas pixel size = CSS size × devicePixelRatio) and redraws.
  - Input: Pointer Events, `touch-action: none` on the canvas, one active `pointerId` at a time (others ignored), `setPointerCapture`; `pointerup`/`pointercancel`/`lostpointercapture` end the stroke; strokes shorter than `MIN_STROKE_LENGTH` are dropped.
  - `samplePaths(paths: string[]): [number,number][][]`: uses one hidden `<svg viewBox="0 0 109 109">` and `getPointAtLength` (about one point per unit length) to turn path strings into point lists.
  - `drawModel(svg: SVGSVGElement, paths: string[], { numbers = false })`: renders the paths in that SVG (stroke-width 5, round caps, `currentColor`), with small stroke numbers at each start when `numbers`.
  - `animateModel(svg, paths): Promise<void>`: draws strokes one after another using `stroke-dasharray`/`stroke-dashoffset` (≈0.5 s per stroke, 0.15 s gap); under `prefers-reduced-motion` it calls `drawModel(..., { numbers: true })` and resolves immediately. Calling again cancels a running animation.

- [ ] **Step 1: Write the failing Playwright tests** in `scripts/test-writing.mjs`. The script starts `python3 -m http.server 8123` from the repo root, launches Chromium with `hasTouch: true`, viewport 1024 × 768, opens a test page `scripts/pad-fixture.html` (create it: one 400 px canvas with a `WritingPad` exposed as `window.pad`), and asserts with `node:assert`:
  - `drag draws one stroke`: a touch drag across the canvas → `pad.strokes.length === 1`, points within 0–109.
  - `tap is ignored`: a touch tap (no movement) → stroke count unchanged.
  - `second finger ignored`: start a stroke with pointer 1, put down pointer 2 and move it, finish pointer 1 (dispatch `PointerEvent`s with distinct `pointerId`s via `page.evaluate`) → exactly one new stroke, built from pointer 1's points only.
  - `cancel ends stroke`: pointerdown + moves + `pointercancel` → the stroke is kept, and a following new pointerdown starts a new stroke.
  - `resize keeps strokes`: draw, change canvas CSS width to 300 px, wait for redraw → `pad.strokes` unchanged and the canvas has non-blank ink pixels near the scaled stroke position.
  - `undo and clear`: undo removes the last stroke; clear empties.
  - `samplePaths`: for `M10,10L60,10` returns first point ≈ [10,10] and last ≈ [60,10].
  Add `"scripts/test-writing.mjs"` usage to the README Project files list later (Task 6).

- [ ] **Step 2: Run to verify it fails**

Run: `node scripts/test-writing.mjs`
Expected: FAIL (module/fixture not found).

- [ ] **Step 3: Implement `js/writing-pad.js` and `scripts/pad-fixture.html`** per Interfaces.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node scripts/test-writing.mjs`
Expected: all pad tests pass.

- [ ] **Step 5: Commit**

```bash
git add js/writing-pad.js scripts/test-writing.mjs scripts/pad-fixture.html
git commit -m "Add finger writing pad and stroke order drawing"
```

---

### Task 4: Practice and quiz screens

**Files:**
- Create: `js/writing.js`
- Modify: `index.html` (new `<main class="writing" id="writing-screen" hidden>`), `css/styles.css` (writing layout)
- Test: extend `scripts/test-writing.mjs`

**Interfaces:**
- Consumes: `WritingPad`, `samplePaths`, `drawModel`, `animateModel` (Task 3); `checkStrokes` (Task 1); `storage.markSeen(id)`, `storage.rateCard(id, known)` (existing).
- Produces (used by Task 5):
  - `initWriting({ strokes: Record<string,string[]>, announce: (msg) => void })`: wires buttons once.
  - `startWriting(mode: "practice" | "quiz", deck: Card[], startIndex = 0): void`: shows `deck[startIndex]`; sets `#counter` text `"i / n"`.
  - `Card` = writing card: kana/extra entry with `id` = `wr:<kana id>`.

Screen markup (ids are the contract for tests and CSS):
- `#w-prompt` (quiz prompt, e.g. `shi · Hiragana`), `#w-model` panel with `<svg id="w-model-svg">` per character (one per char, side by side), `#w-romaji`, `#w-script`, button `#w-play` "▶ Stroke order".
- `#w-boxes`: one `<canvas class="w-box">` per character of `card.char` (`Array.from(card.char)`).
- `#w-message` (`aria-live="polite"`).
- Buttons: `#w-undo` (undo on the box last drawn in), `#w-clear` (clears all boxes), `#w-check`, `#w-prev`, `#w-next`; quiz rating row `#w-rate` with `#w-got` "✓ Got it" and `#w-missed` "✗ Still learning" (hidden until checked).

Behaviour:
- Practice: model visible. Check runs `checkStrokes` per box against `samplePaths(strokes[ch])`, calls `pad.showResult`, shows the messages (box 2's message prefixed with the character when there are two boxes), and calls `storage.markSeen(card.id)` unless every box is empty.
- Quiz: model hidden, `#w-prompt` shown. Check shows results, reveals the model and `#w-rate`. Got it → `rateCard(id, true)`, Still learning → `rateCard(id, false)`, then next card. Rating buttons only work after Check.
- Prev/Next wrap around and clear boxes; layout: model left / boxes right at ≥ 700 px wide, stacked below that; boxes as large as fit (`min(42vw, 420px)`-ish on tablet, full width minus gutter on phone).

- [ ] **Step 1: Write the failing tests** (in `scripts/test-writing.mjs`, against `index.html#writing/practice` after Task 5 routes exist; until then open a fixture `scripts/screen-fixture.html` that imports `writing.js`, loads the JSON files and calls `startWriting` on basic hiragana):
  - `practice shows model and box`: あ shows `#w-model-svg` with 3 paths and one `.w-box`.
  - `check correct strokes passes`: draw あ by replaying its sampled reference strokes scaled to the canvas with touch drags → `#w-message` contains "Nice!".
  - `check with nothing written`: tap `#w-check` with no strokes → message "Write the character first." and `localStorage` has no `wr:h-a` in `kana:seen`.
  - `combination has two boxes`: a deck of きゃ → two `.w-box` canvases.
  - `quiz hides model until check`: `startWriting("quiz", …)` → `#w-model` hidden, `#w-prompt` visible; after Check the model shows; tapping `#w-got` stores box 1 for that id in `kana:progress`.

- [ ] **Step 2: Run to verify they fail**

Run: `node scripts/test-writing.mjs`
Expected: the new tests FAIL.

- [ ] **Step 3: Implement** `js/writing.js`, the markup in `index.html` and styles in `css/styles.css` per the contract above.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node scripts/test-writing.mjs`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add js/writing.js index.html css/styles.css scripts/test-writing.mjs scripts/screen-fixture.html
git commit -m "Add writing practice and quiz screens"
```

---

### Task 5: Writing section in the app (routing, home, settings, progress chart)

**Files:**
- Modify: `js/app.js`, `index.html`, `css/styles.css`
- Test: extend `scripts/test-writing.mjs`; remove the Task 4 fixture use in favour of the real routes

**Interfaces:**
- Consumes: `initWriting`, `startWriting` (Task 4); `buildDeck`, `availableRows` (existing `deck.js`, unchanged).
- Produces: routes `#writing`, `#writing/practice`, `#writing/practice/<kana id>`, `#writing/quiz`.

Decisions:
- `SECTIONS.writing = { title: "Writing", jp: "書く", tileChar: "書", description: "Write hiragana and katakana with your finger: stroke order, checking and a quiz.", type: "writing", filtersKey: "writing-filters", defaults: DEFAULT_FILTERS, cardLabel: "" }`. Its card list is built at startup from `kana.json` + `extra-kana.json`, each mapped to `{ ...c, id: "wr:" + c.id }`; `data/strokes.json` is loaded at the same time and passed to `initWriting`.
- `parseHash` returns `screen: "practice" | "quiz"` for writing (third segment = kana id to start on); `showScreen` gains `"writing"`; the back button from practice/quiz goes to `#writing`.
- Section home for writing: progress rows per script read "`N / M practised · K can write`" where practised = in `seen`, can write = box ≥ 3. `#start` is labelled "Start practice"; a new `#start-quiz` "Start quiz" button is shown only for writing. Both disabled when the deck is empty.
- New `#writing-chart` panel on the section home (writing only): every character in the current filters as a small button, class `box-0`… by progress (`not started` = unseen, `learning` = box 0–2, `can write` = box 3–4, with a legend). Tapping one navigates to `#writing/practice/<kana id>` and starts practice on that character within the filtered deck.
- Settings: kana fieldsets show for writing too (`data-for="kana writing"`, update the visibility check to `split(" ").includes(type)`); a 4th stage chip `4 · Extended katakana <span lang="ja">ティ</span>` with `data-for="writing"`, hidden when katakana is off. Quiz always uses `buildDeck(cards, { ...filters, order: "shuffle" }, progress)`.
- Landing tile progress for writing: "`K / M can write`".

- [ ] **Step 1: Write the failing tests** (switch the screen tests to `index.html` routes):
  - `landing has writing tile`: 4 tiles; the last reads "Writing".
  - `writing home`: `#writing` shows Start practice, Start quiz and a chart with 46 buttons by default.
  - `chart opens practice`: tap the か button → hash `#writing/practice/h-ka`, model shows か.
  - `extended katakana stage`: enable katakana + stage 4 in settings → chart includes ティ.
  - `no matches disables buttons`: choose rows so nothing matches (e.g. katakana only + stage 4 + row `a`) → both start buttons disabled and the summary says no cards match.
  - `progress survives reload`: quiz ✓ on one character, reload `#writing` → chart button has the `learning` class.
  - `phone width`: at 360 × 740 on `#writing/practice`, `document.documentElement.scrollWidth <= 360`.
  - `flash cards unaffected`: `#kana/study` still flips a card.

- [ ] **Step 2: Run to verify they fail**

Run: `node scripts/test-writing.mjs`
Expected: the new tests FAIL.

- [ ] **Step 3: Implement** the changes in `js/app.js`, `index.html`, `css/styles.css`; delete `scripts/screen-fixture.html` once the tests use real routes.

- [ ] **Step 4: Run all tests**

Run: `node --test scripts/test-stroke-check.mjs && python scripts/check-data.py && node scripts/test-writing.mjs`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add -A js index.html css scripts
git commit -m "Add Writing section with chart, settings and quiz"
```

---

### Task 6: Offline, docs, final check

**Files:**
- Modify: `sw.js`, `README.md`, `CLAUDE.md`, `index.html` (About + help text)
- Test: extend `scripts/test-writing.mjs`

- [ ] **Step 1: Write the failing test** `works offline`: load the app once, wait for the service worker to control the page, `context.setOffline(true)`, reload `#writing/practice` → model and box render.

- [ ] **Step 2: Run to verify it fails**

Run: `node scripts/test-writing.mjs`
Expected: `works offline` FAILS (new files not cached).

- [ ] **Step 3: Update files**
  - `sw.js`: add `js/writing.js`, `js/writing-pad.js`, `js/stroke-check.js`, `data/strokes.json`, `data/extra-kana.json`; `CACHE_VERSION = "v5"`.
  - `index.html` About: `Stroke order data: <a href="https://kanjivg.tagaini.net">KanjiVG</a> by Ulrich Apel (CC BY-SA 3.0).` Tile/intro text mentions writing.
  - `README.md`: a **Writing** bullet (practice, stroke checking, quiz, progress chart), controls for the writing screen, project files (`data/strokes.json`, `data/extra-kana.json`, `scripts/build-strokes.py`, the two test scripts and how to run them), KanjiVG credit.
  - `CLAUDE.md`: move writing practice from "Not in version 1" to a "Version 2: writing practice" scope line pointing at the spec.

- [ ] **Step 4: Run everything, then screenshot**

Run: `node --test scripts/test-stroke-check.mjs && python scripts/check-data.py && node scripts/test-writing.mjs`
Expected: all pass. Take screenshots of `#writing` and `#writing/practice` (light + dark, iPad and 360 px) and look at them.

- [ ] **Step 5: Commit and push**

```bash
git add -A
git commit -m "Writing practice: offline cache, docs and credits"
git push -u origin ccr-0e8dbe86-jj982l
```
