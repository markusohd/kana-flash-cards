# CLAUDE.md: Kana Flash Cards

## What this project is

A flash card web app for learning **hiragana and katakana**, with "sounds like" hints:
a Filipino word and an English word that share each kana's sound. The app has **no audio**.
It is for one learner (Mark) who is starting Japanese from zero. His long-term goal is to
**speak, read and write** Japanese. This app is step one: recognize every kana on sight and
know how it sounds.

The app must work well on **both mobile (phone, one hand, touch) and desktop (mouse and keyboard)**.

Mark is a Filipino speaker of English and Tagalog. Pronunciation tips should compare Japanese
sounds to Tagalog where it helps (Japanese vowels a, i, u, e, o are close to Tagalog vowels).

## Scope

### Version 1 (build this)
- A landing page with three sections: **Kana**, **Travel words** (50) and **Travel phrases** (50)
- Flash cards for hiragana and katakana
- "Sounds like" hints for each character (see below)
- An example sentence on every kana card (see "Example sentences")
- Travel word and phrase cards (see "Travel words and phrases"); added at Mark's request on 2026-10-25
- Study modes and filters (see below)
- Simple progress tracking saved on the device
- Works offline and can be installed on a phone's home screen (PWA)

### Not in version 1 (do not build yet)
- Stroke order animations or writing/tracing practice (planned for version 2, likely using KanjiVG data)
- Kanji study, grammar lessons, vocabulary beyond the two travel decks
- User accounts, login, or any server or database
- Quizzes that require typing
- Audio or voice playback of any kind. Kokoro (female jf_alpha, male jm_kumo) and VOICEVOX
  male voices were tried; Mark found them unnatural, so all audio was removed on 2026-10-25.
  Do not add audio back unless Mark asks.

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
- "Sounds like": a Filipino word and an English word with the matching letters highlighted
  (for example か: Filipino **ka**in "to eat", English **ca**r). Combinations also show how
  they are built (ひ (hi) + や (ya), said as one beat).
- A sample word:
  - the word in kana, with the target character highlighted
  - romaji of the word
  - English meaning
- A full example sentence using the sample word (kana with the word highlighted, kanji version
  small, romaji, English)
- A short pronunciation tip when useful (for example: "う (u) is softer than Tagalog u, lips not rounded")

**Interaction**
- Flip: tap or click the card, or press Space
- Next / previous: swipe left/right on mobile, arrow keys on desktop, plus visible buttons
- Rating after flip: "Still learning" and "I know it" buttons (keys `1` and `2`)

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

## Example sentences

Every kana card has one sentence that uses its sample word, and it teaches how Japanese
sentences are built (Mark asked for this on 2026-10-25).
- Short, polite (です/ます) sentences Mark can use while traveling: convenience stores,
  restaurants, airports, hotels, stations. Avoid sentences about a life he doesn't have
  (children, university, a nickname). Use **describing words** often (big, cold, near, quiet,
  more ___, the most ___, ___-er than, not ___, was ___, a [thing] that ___).
- `kana`: hiragana/katakana with **spaces between words** (particles stay attached:
  `つめたい あめが ふって います。`), ending in 。 or ？. It must contain the sample word.
- `kanji`: the normal written form, shown small. `romaji`: Hepburn, particles written
  wa / o / e. `en`: natural English.
- `parts`: `[kana, meaning]` pairs that add up exactly to the sentence (spaces and
  punctuation ignored), shown as "How it's built" on the card.
- `pattern` / `patternEn`: the reusable pattern, e.g. `[thing] は とても [describing word] です`
  / `[thing] is very ___`. `swap`: `{ "kana", "en" }`, the same pattern with other words.

## Travel words and phrases

`data/words.json` and `data/phrases.json`, 50 entries each:
`{ "id": "w-eki", "kana": "えき", "kanji": "駅", "romaji": "eki", "en": "train station",
"category": "Getting around", "note": null }` (phrase ids start with `p-`).
- Practical for a trip to Osaka: getting around, hotel, food, shopping, emergencies, basics.
- Phrases are polite (です/ます). Kana with spaces between words, like the example sentences.
- `kanji` is `null` when the word is normally written in kana. `note` gives a short usage tip.
- Cards show Japanese (kana) on the front by default; a setting puts English on the front.

## Data

Kana card content lives in `data/kana.json`. One entry per character:

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
  "sentence": {
    "kana": "あめが ふって います。",
    "kanji": "雨が降っています。",
    "romaji": "Ame ga futte imasu.",
    "en": "It is raining."
  },
  "soundsLike": {
    "fil": { "word": "aso", "part": "a", "en": "dog" },
    "en": { "word": "father", "part": "a" }
  }
}
```

`soundsLike.fil` or `soundsLike.en` is `null` when there is no good word. Combination cards
(stage 3) also have `"blend": "ひ (hi) + や (ya)"`.

Write a small check script (`scripts/check-data.js` or `.py`) that asserts:
- correct counts per script and stage (46 basic per script, etc.)
- no duplicate ids
- every entry has romaji and a sample word
- every "sounds like" word contains its highlighted part, and every card has at least one hint
- every kana card has a sentence that contains its sample word
- words.json and phrases.json have 50 entries each, unique ids and all required fields

## "Sounds like" hints

Goal: help Mark hear each kana in his head using words he already knows.

- **Filipino word** (`soundsLike.fil`): a common Filipino/Tagalog word containing the same
  sound, with its English meaning. Filipino spelling matches Japanese sounds closely (same
  five vowels, tapped r), so this is the main guide. Filipino spelling "ts" is often said
  "ch" (tsinelas, tsaa) and "dy" is said "j" (dyip); those may be used for ch/j sounds.
- **English word** (`soundsLike.en`): an English word with a similar sound. English vowels
  differ, so these are approximate. Use `null` for the r row (English r is a different
  sound) and wherever no honest match exists.
- `part` is the letters that make the sound; the app highlights them. It must appear in the word.
- Combinations (stage 3) also get a `blend`: the two kana they are built from.
- Never force a match. If no common word fits, use `null` and rely on the blend or tip.
  List questionable choices in `REVIEW.md`.

## Tech stack

- **Plain HTML, CSS and JavaScript** (ES modules). No framework, no build step required.
- Must run by opening with a simple local server (for example `python -m http.server`).
- Font: **Noto Sans JP** from Google Fonts, with a system Japanese font fallback.
  Make sure kana render correctly on Android, iPhone, Windows and Mac.
- Save progress and settings in `localStorage`. Wrap every read and write in `try/catch`
  so the app still works if storage is blocked.
- PWA: `manifest.json` and a service worker that caches the app, data and fonts
  for offline use.
- Hosting: GitHub Pages (static files only).
- Python is only used for the data check script, not by the app itself.

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
│   └── storage.js         # localStorage helpers
├── data/
│   ├── kana.json
│   ├── words.json         # 50 travel words
│   └── phrases.json       # 50 travel phrases
├── icons/                 # PWA icons
├── scripts/
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
  3. ~~Audio test batch~~ (removed; see "Not in version 1")
  4. "Sounds like" hints (replaced audio generation and playback)
  5. Remaining stages and katakana data
  6. Filters, settings, progress tracking
  7. PWA offline support
  8. Final review (see checklist)
- Keep code simple and commented. Mark is learning, so prefer readable code over clever code.
- Never invent a Japanese reading or meaning you are unsure of. Add it to `REVIEW.md`.
- Do not add libraries unless clearly needed. If you do, explain why.

## Done checklist (before calling a version finished)

- [x] `check-data` script passes (counts, ids, words, "sounds like" hints)
- [ ] Every card shows correct kana, romaji, sample word and "sounds like" hints
      (all 308 cards render fully, checked 2026-10-26; word choices wait on Mark's `REVIEW.md` check)
- [x] Tested at phone width (360 px) and desktop width; no horizontal scroll
- [x] Swipe, tap, and keyboard controls all work
- [x] Progress survives a page reload
- [x] App loads with the network turned off (after first visit)
- [x] Light and dark mode both readable (all text colors pass WCAG AA contrast)
- [x] Font license noted in the About section
