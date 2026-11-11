# Writing practice: design

Date: 2026-11-11. Requested by Mark. This is the "version 2" writing practice that
`CLAUDE.md` already plans for (KanjiVG stroke data).

## Goal

A practice sheet for **writing** hiragana and katakana on a **tablet with a finger**.
Mark copies a model character into a grid box, can watch the stroke order, and the app
checks his strokes. A quiz mode tests writing from memory. Success: he can practise any
kana, see whether his stroke count, order and direction are right, and track which
characters he can write.

What Mark chose:
- Device: tablet, **finger only** (no stylus). Must also stay usable on a phone and desktop.
- Guide: **grid lines** in the writing box (dotted centre cross), with a **model character
  beside the grid** (nothing drawn inside the box).
- Characters: **everything**: basic, voiced, combinations, plus extended katakana (ティ, ファ…).
- Extras: **quiz / recall mode**, **progress tracking**, **stroke checking**.
- Location: this repo, as a new section of the existing app.

## Where it lives

A fourth tile on the landing page: **Writing 書く**. It reuses the existing app shell (top bar,
theme toggle, back button, hash routing, settings panel style). Routes:

- `#writing`: section home (progress, Start practice, Start quiz, Settings)
- `#writing/practice`: practice screen
- `#writing/quiz`: quiz screen

The flash card sections are unchanged.

## Characters

- The 208 entries in `data/kana.json` (basic, voiced, combinations, both scripts). Used as-is.
- **Extended katakana** in a new file `data/extra-kana.json` (writing only, so the flash card
  data and its check script stay unchanged). Same fields as needed here:
  `{ "id": "k-ti", "char": "ティ", "script": "katakana", "stage": 4, "row": "extra", "romaji": "ti" }`.
  List (20): ティ ti, ディ di, トゥ tu, ドゥ du, ファ fa, フィ fi, フェ fe, フォ fo, ウィ wi,
  ウェ we, ウォ wo, ヴァ va, ヴィ vi, ヴ vu, ヴェ ve, ヴォ vo, シェ she, ジェ je, チェ che, ツァ tsa.
- Writing settings get a 4th stage, **Extended katakana**, shown only when katakana is on.
- A multi-character entry (きゃ, ティ) is written in **one box per character**: き in the first
  box, ゃ in the second. Each box is checked on its own.

## Stroke data

- New script `scripts/build-strokes.py` (Python standard library only) downloads the KanjiVG
  SVG for every character used (including small kana ぁぃぅぇぉゃゅょァィゥェォャュョ and ヴ),
  pulls out each stroke's path in order, and writes `data/strokes.json`:
  `{ "あ": ["M31.5,24.5c...", "...", "..."], ... }` (KanjiVG 109 × 109 coordinates).
  It fails loudly if any character is missing.
- The app loads only `data/strokes.json`, so writing practice works offline.
- `scripts/check-data.py` gains a check: every character used by writing has stroke data.
- KanjiVG is CC BY-SA 3.0 (Ulrich Apel). Credit it in the About section and in `data/strokes.json`'s
  source note in the README.

## Practice screen

Layout: model on the left, writing box on the right on a tablet or desktop; stacked
(model above, box below) on a narrow phone.

- **Model panel**: the character large (drawn from the stroke paths so it matches the checker),
  romaji, script label. Button **▶ Stroke order**: clears the model and draws each stroke in turn
  in order and direction, with a small number at each stroke's start. Respects
  `prefers-reduced-motion` (shows numbered strokes without animation).
- **Writing box(es)**: square, as large as fits (target about 320–420 px on a tablet), with a
  solid border and a dotted centre cross. Thick, rounded ink sized for a finger.
  - Pointer Events with `touch-action: none`, so writing never scrolls or zooms the page.
  - Only one pointer draws at a time; a second finger is ignored.
  - Strokes shorter than a few pixels (accidental taps) are dropped.
- **Buttons** (at least 44 px): Undo stroke, Clear, Check, Next (and Previous).
- Counter in the top bar like the flash cards (e.g. 3 / 46).

## Stroke checking

A pure module `js/stroke-check.js` (no DOM) compares the user's strokes with the reference
strokes, both as point lists in the 109 × 109 box. The screen samples reference paths to points
with a hidden SVG (`getPointAtLength`) once per character.

Steps:
1. **Count**: compare the number of strokes. If different, report it ("You used 4 strokes;
   あ has 3") and still compare the strokes that line up.
2. **Pair in order**: user stroke *i* is compared with reference stroke *i*.
3. For each pair, resample both to 16 evenly spaced points and compute:
   - **Direction**: if the user's start is near the reference end and the end near the
     reference start (and not the other way round) → "stroke *i* is backwards".
   - **Shape and position**: average distance between matching points. Within the tolerance
     → good. Otherwise, if the stroke matches a *different* reference stroke well → "stroke *i*
     looks like stroke *j*: check the order"; else "stroke *i* is off".
4. Tolerances are lenient for finger writing (start/end within about 25% of the box, average
   distance within about 18%). They are named constants so they can be tuned.

Result: `{ ok, countOk, strokes: [{ ok, problem }], message }`. The box redraws good strokes
green and problem strokes red, and a short message appears under the box. A pass shows
"Nice! ✓". Checking a practice character counts as "practised" for progress.

## Quiz mode

- Shows only the prompt: romaji and script (e.g. "shi · hiragana"); the model panel is hidden.
- Mark writes, taps **Check**: stroke checking runs and the model is revealed (with the
  Stroke order button).
- He marks himself **✓ Got it** or **✗ Still learning**. That rating moves the progress box.
- Order: shuffled, with weaker characters shown more often (same idea as flash card shuffle).

## Settings and progress

- Settings (own `localStorage` key `writing-filters`): script (hiragana / katakana / both),
  stages (basic, voiced, combinations, extended katakana), rows, chart order or shuffled for
  practice. Default: basic hiragana. Reset writing progress with a confirmation.
- Progress uses the existing storage helpers and 0–4 boxes, with ids prefixed `wr:`
  (e.g. `wr:h-a`) so writing progress stays separate from flash card progress.
  Quiz ✓ moves a character up one box, ✗ to box 0. Practice checks mark it as seen.
- Section home: per-script summary (practised, can write = box ≥ 3) and a character chart
  coloured by box (not started / learning / can write). Tapping a chart character opens
  practice on it.

## Files

- New: `js/writing.js` (section screens, events), `js/stroke-check.js` (checking logic),
  `js/writing-pad.js` (canvas drawing, model drawing and animation),
  `data/strokes.json`, `data/extra-kana.json`, `scripts/build-strokes.py`,
  `scripts/test-stroke-check.mjs` (Node tests for the checker).
- Changed: `index.html` (writing screens), `js/app.js` (fourth section and routes),
  `css/styles.css`, `sw.js` (new files, bump cache version), `scripts/check-data.py`,
  `README.md`, `CLAUDE.md` (writing practice now in scope).

## Testing

- `node scripts/test-stroke-check.mjs`: feeding the reference strokes passes; reversed
  stroke → "backwards"; swapped strokes → order problem; missing/extra stroke → count problem;
  mildly wobbly, shifted and scaled copies still pass.
- `python scripts/check-data.py` passes, including the new stroke data check.
- Playwright run in a tablet viewport (iPad-size, touch) and at 360 px: draw strokes with
  touch input, check, quiz flow, progress survives reload, no page scroll while drawing,
  light and dark mode, works offline after the first visit.

## Not included

- Handwriting recognition of arbitrary characters (we only check against the expected one).
- Audio (still out of scope per `CLAUDE.md`).
- Printable PDF worksheets.
