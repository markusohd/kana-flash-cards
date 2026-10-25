# Kana Flash Cards

Flash cards for learning Japanese for a trip to Japan. Works on phone and desktop.

Three sections, chosen on the start page:

- **Kana**: all hiragana and katakana (208 cards). Each card shows a **"sounds like"** hint
  (a Filipino and an English word that share the sound, for example か (ka): Filipino **ka**in,
  English **ca**r), a sample word, and a full example sentence.
- **Travel words**: 50 useful words (station, exit, bill, cash, hospital...).
- **Travel phrases**: 50 polite phrases for stations, hotels, restaurants, shops and emergencies.

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
- `scripts/check-data.py`: checks the data (`python scripts/check-data.py`)
- `REVIEW.md`: words and choices waiting for a human check
