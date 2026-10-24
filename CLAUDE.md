# CLAUDE.md: Kana Flash Cards

## What this project is

A flash card web app for learning **hiragana and katakana**, with audio pronunciation.
It is for one learner (Mark) who is starting Japanese from zero. His long-term goal is to
**speak, read and write** Japanese. This app is step one: recognize every kana on sight and
know how it sounds.

The app must work well on **both mobile (phone, one hand, touch) and desktop (mouse and keyboard)**.

Mark is a Filipino speaker of English and Tagalog. Pronunciation tips should compare Japanese
sounds to Tagalog where it helps (Japanese vowels a, i, u, e, o are close to Tagalog vowels).

## Scope

### Version 1 (build this)
- Flash cards for hiragana and katakana
- Audio for each character and each sample word
- Study modes and filters (see below)
- Simple progress tracking saved on the device
- Works offline and can be installed on a phone's home screen (PWA)

### Not in version 1 (do not build yet)
- Stroke order animations or writing/tracing practice (planned for version 2, likely using KanjiVG data)
- Kanji, vocabulary decks, grammar
- User accounts, login, or any server or database
- Quizzes that require typing

Keep the code organized so writing practice can be added later without a rewrite
(for example, keep card data separate from UI, and leave room on the card back for a
"stroke order" section).

## The flash card

**Front**
- The character only, very large and centered (for example あ).
- Small label showing the script: "Hiragana" or "Katakana".

**Back (after flipping)**
- The character again (smaller than the front, still clearly visible)
- Romaji in Hepburn style (for example `a`, `shi`, `tsu`)
- A ▶ play button for the character's sound
- A sample word:
  - the word in kana, with the target character highlighted
  - romaji of the word
  - English meaning
  - its own ▶ play button
- A short pronunciation tip when useful (for example: "う (u) is softer than Tagalog u, lips not rounded")

**Interaction**
- Flip: tap or click the card, or press Space
- Next / previous: swipe left/right on mobile, arrow keys on desktop, plus visible buttons
- Play sound: tap the ▶ buttons, or press `P` (character) and `W` (sample word) on desktop
- Rating after flip: "Still learning" and "I know it" buttons (keys `1` and `2`)
- Optional setting: auto-play the character sound when the card is flipped

## Character sets

All characters for both scripts, grouped into stages the learner can turn on or off:

1. **Basic (gojūon)**: 46 characters per script (あ to ん, ア to ン)
2. **Voiced (dakuten / handakuten)**: が ざ だ ば ぱ rows and katakana equivalents
3. **Combinations (yōon)**: きゃ, しゅ, ちょ, etc. and katakana equivalents

Default view: Stage 1 hiragana only. The learner can add stages and katakana from settings.

Filters:
- Script: hiragana, katakana, or both
- Row: あ row, か row, さ row, and so on (multi-select)
- Order: chart order or shuffled
- "Review only": cards marked "Still learning"

Romaji rules (Hepburn):
- し shi, ち chi, つ tsu, ふ fu, じ ji, ぢ ji, づ zu
- を shown as `o` (note: sometimes written `wo`)
- ん shown as `n`
- Note on ぢ/づ cards that they sound the same as じ/ず and are rarely used

## Sample words

Each character needs one sample word. Rules:
- The word should **start with** the target character when possible. If not possible
  (ん, を, some combinations), use a common word that contains it.
- Use simple, common, beginner words. No rare or vulgar words.
- **Hiragana cards**: native Japanese words written in hiragana (for example あめ ame "rain",
  さくら sakura "cherry blossom").
- **Katakana cards**: loanwords Mark will recognize (for example ホテル hoteru "hotel",
  カメラ kamera "camera", タクシー takushī "taxi").
- Prefer travel words where they fit naturally (station, exit, hotel, food, shopping), since
  Mark is also preparing for a trip to Osaka. Examples: でぐち deguchi "exit", えき eki
  "station", ラーメン rāmen "ramen", コンビニ konbini "convenience store".
- If a word is normally written with kanji, store the kanji too (shown small, optional),
  but the card displays the kana form.
- Double-check every word's meaning and reading. Accuracy matters more than cleverness.
  Flag any word you are unsure of in a `REVIEW.md` list instead of guessing.

## Data

All card content lives in one file: `data/kana.json`. One entry per character:

```json
{
  "id": "h-a",
  "char": "あ",
  "script": "hiragana",
  "stage": 1,
  "row": "a",
  "romaji": "a",
  "tip": "Like the 'a' in Tagalog 'aso'.",
  "word": {
    "kana": "あめ",
    "kanji": "雨",
    "romaji": "ame",
    "en": "rain"
  },
  "audio": {
    "char": "audio/char/h-a.mp3",
    "word": "audio/word/h-a.mp3"
  }
}
```

Write a small check script (`scripts/check-data.js` or `.py`) that asserts:
- correct counts per script and stage (46 basic per script, etc.)
- no duplicate ids
- every entry has romaji and a sample word
- every audio path points to a file that exists

## Audio

Goal: correct, natural Japanese pronunciation, free and open-source, working offline.

### Plan
1. **Pre-generate audio files once** with an open-source Japanese text-to-speech model and
   ship them as small static files in `audio/`. The app does not run a voice model at runtime.
2. First choice of model: **Kokoro** (Apache 2.0 license, github.com/hexgrad/kokoro), which has
   Japanese voices. Japanese support needs extra packages (check the Kokoro README for the
   current install, for example `misaki[ja]`). Verify voice names and install steps from the
   repo; do not assume.
3. If Kokoro's Japanese output sounds wrong, try alternatives and report back before
   switching: VOICEVOX (free, but check each voice's credit/terms) or Open JTalk.
4. **Fallback in the app**: if an audio file is missing or fails to load, use the browser's
   Web Speech API with a `ja-JP` voice, also slowed down (`rate` 0.85) to match the
   generated files. If no Japanese voice is available, hide the
   play button and show a small note rather than an error.

### Generation script
`scripts/generate_audio.py`:
- Reads `data/kana.json`
- Generates one file per character and one per sample word
- Output: mp3 (or ogg + mp3 if needed for Safari compatibility), mono, trimmed silence,
  normalized volume, kept small (target under 30 KB each)
- Speaks a little slower for clarity: generate at **0.85x speed** using Kokoro's own `speed` setting
  (not by stretching the audio afterwards, which sounds robotic). Keep the speed in one
  constant so it is easy to change after Mark listens to the test batch.
- Skips files that already exist unless `--force` is passed
- Can generate a test batch only (`--sample`) so quality can be checked first

### Important: test before generating everything
Single characters said on their own can sound odd from a voice model (clipped, wrong
pitch, or read as a letter name). Before generating the full set:
1. Generate about 10 test files: あ, し, つ, ふ, ん, を, が, きゃ, ア, and one sample word.
2. Stop and ask Mark to listen and approve.
3. If single kana sound bad, try workarounds (for example, add a short pause or say it
   slowly) and test again.

Write the license of the voice model used into `audio/LICENSE.md` and the app's About section.

## Tech stack

- **Plain HTML, CSS and JavaScript** (ES modules). No framework, no build step required.
- Must run by opening with a simple local server (for example `python -m http.server`).
- Font: **Noto Sans JP** from Google Fonts, with a system Japanese font fallback.
  Make sure kana render correctly on Android, iPhone, Windows and Mac.
- Save progress and settings in `localStorage`. Wrap every read and write in `try/catch`
  so the app still works if storage is blocked.
- PWA: `manifest.json` and a service worker that caches the app, data, fonts and all audio
  for offline use.
- Hosting: GitHub Pages (static files only).
- Python is only used for the audio generation script, not by the app itself.

## Suggested file structure

```
/
├── index.html
├── manifest.json
├── sw.js                  # service worker (offline cache)
├── css/
│   └── styles.css
├── js/
│   ├── app.js             # startup, routing between screens
│   ├── deck.js            # filtering, ordering, review logic
│   ├── card.js            # card rendering and flip
│   ├── audio.js           # play files, Web Speech fallback
│   └── storage.js         # localStorage helpers
├── data/
│   └── kana.json
├── audio/
│   ├── char/
│   ├── word/
│   └── LICENSE.md
├── icons/                 # PWA icons
├── scripts/
│   ├── generate_audio.py
│   └── check-data.(js|py)
├── REVIEW.md              # words or readings that need a human check
└── README.md
```

## Progress tracking

Keep it simple (Leitner-style boxes):
- Each card has a box number from 0 to 4, stored per card id.
- "Still learning" moves it to box 0. "I know it" moves it up one box.
- Lower boxes appear more often in shuffled mode.
- Show a small progress summary on the home screen: cards seen, cards known, per script.
- Settings include "Reset progress" with a confirmation.

## Design

- Clean, calm, easy to read. The character is the hero of the screen.
- Light Japanese touch, not cluttered: an optional faint seigaiha (wave) pattern or
  Mt. Fuji outline in the background, similar to Mark's earlier "Travel Japanese" PDF.
- Light and dark mode (follow system setting, with a manual toggle).
- Card flip animation (3D flip), with reduced motion respected (`prefers-reduced-motion`).

### Mobile
- Design for 360 px wide screens first.
- Card fills most of the screen; buttons large enough for thumbs (at least 44 px).
- Swipe gestures for next/previous. Avoid accidental flips while swiping.
- No horizontal scrolling. Respect safe areas on iPhone (notch, home bar).

### Desktop
- Card centered with a max width; keyboard shortcuts shown in a small help panel (`?` key).

### Accessibility
- Buttons have clear labels (`aria-label` for icon buttons).
- Good color contrast in both themes.
- The card's flipped state is announced to screen readers.

## Working style for Claude Code

- Before big steps, say briefly what you are about to do.
- Build in this order and check each step works before moving on:
  1. Data file for **Stage 1 hiragana** only, plus the check script
  2. Card UI with flip, next/previous, on mobile and desktop
  3. Audio test batch, then pause for Mark to listen and approve
  4. Full audio generation and audio playback in the app
  5. Remaining stages and katakana data
  6. Filters, settings, progress tracking
  7. PWA offline support
  8. Final review (see checklist)
- Keep code simple and commented. Mark is learning, so prefer readable code over clever code.
- Never invent a Japanese reading or meaning you are unsure of. Add it to `REVIEW.md`.
- Do not add libraries unless clearly needed. If you do, explain why.

## Done checklist (before calling a version finished)

- [ ] `check-data` script passes (counts, ids, words, audio paths)
- [ ] Every card shows correct kana, romaji and sample word
- [ ] Every play button plays the right sound; fallback works when a file is missing
- [ ] Tested at phone width (360 px) and desktop width; no horizontal scroll
- [ ] Swipe, tap, and keyboard controls all work
- [ ] Progress survives a page reload
- [ ] App loads and plays audio with the network turned off (after first visit)
- [ ] Light and dark mode both readable
- [ ] Audio license recorded in `audio/LICENSE.md` and the About section
