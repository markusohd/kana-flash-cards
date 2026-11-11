# Kana Flash Cards

Flash cards for learning Japanese for a trip to Japan. Works on phone and desktop.

Four sections, chosen on the start page:

- **Kana**: all hiragana and katakana (208 cards). Each card shows a **"sounds like"** hint
  (a Filipino and an English word that share the sound, for example か (ka): Filipino **ka**in,
  English **ca**r), a sample word, and a full example sentence.
- **Travel words**: 50 useful words (station, exit, bill, cash, hospital...).
- **Travel phrases**: 50 polite phrases for stations, hotels, restaurants, shops and emergencies.
- **Writing**: write every hiragana and katakana (plus extended katakana like ティ and ファ) with
  your finger on a tablet or phone. A model character sits beside a grid box; **▶ Stroke order**
  animates the strokes. **Check** tells you if your stroke count, order and direction are right
  (green = good, red = fix it). **Quiz** shows only the romaji; write from memory, check, then mark
  ✓ or ✗. The Writing home shows a chart of every character coloured by progress; tap one to
  practise it. A little chime plays when you get it right and a soft boop when a stroke is off
  (turn it off with **Sounds on/off** under Prev / Next). Mt. Fuji and sakura sit in the
  background, in light and dark mode.

## Use it on your phone

Open **https://markusohd.github.io/kana-flash-cards/** and install it:

- **Android (Chrome):** menu ⋮ → **Install app** (or "Add to Home screen")
- **iPhone (Safari):** Share → **Add to Home Screen**

After the first visit it works offline. Updates arrive the next time you open it online
(close and reopen the app once to see them).

## Run it on your computer

Serve the folder with any static server, then open it in a browser:

```
python -m http.server
```

Open http://localhost:8000. (Opening `index.html` directly as a file won't load the cards.)

## Controls

| Action | Phone | Desktop |
| --- | --- | --- |
| Flip card | Tap card | Click or `Space` |
| Next / previous | Swipe left / right | `→` / `←` |
| Still learning / I know it | Buttons | `1` / `2` |
| Shortcuts help | | `?` |

Writing screen: write in the box with one finger (a resting palm or second finger is ignored),
then **Check**. **Undo** removes your last stroke, **Clear** empties the box, **Prev / Next**
(under ▶ Stroke order) move between characters. Combinations like きゃ have two boxes: き, then a small ゃ.

## Settings

Each section has its own **Settings** and progress.

- Kana: script (hiragana, katakana or both), stages (basic, voiced, combinations) and rows
- Travel words / phrases: card front shows Japanese (reading practice) or English
  (practice saying it yourself)
- All sections: chart/list order or shuffled (shuffle shows cards you're still learning more
  often), review only (cards you last marked "Still learning"), reset progress

Progress and settings are saved in the browser on this device.

## Project files

- `data/kana.json`: kana cards (with sounds-like hints and sentences)
- `data/words.json`, `data/phrases.json`: travel words and phrases
- `data/extra-kana.json`: extended katakana (ティ, ファ, ヴ...) for writing practice
- `data/strokes.json`: stroke paths for every character, from KanjiVG
- `scripts/build-strokes.py`: rebuilds `data/strokes.json` from KanjiVG (needs internet)
- `scripts/check-data.py`: checks the data (`python scripts/check-data.py`)
- `scripts/test-stroke-check.mjs`: tests for the stroke checker (`node --test scripts/test-stroke-check.mjs`)
- `scripts/test-writing.mjs`: browser tests for writing practice (`node scripts/test-writing.mjs`, needs Playwright)
- `REVIEW.md`: words and choices waiting for a human check

## Credits

- Font: Noto Sans JP (SIL Open Font License)
- Stroke order data: [KanjiVG](https://kanjivg.tagaini.net) by Ulrich Apel, CC BY-SA 3.0.
  Small kana are drawn smaller than in the original (see `scripts/build-strokes.py`).
