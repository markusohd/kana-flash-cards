# Kana Flash Cards

Flash cards for learning **hiragana and katakana**. Works on phone and desktop.

Each card shows a **"sounds like"** hint: a Filipino word and an English word that share
the kana's sound, for example か (ka): Filipino **ka**in, English **ca**r.

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

From the home screen, **Settings** lets you choose:

- Script (hiragana, katakana or both) and stages (basic, voiced, combinations)
- Rows (for example only the か and さ rows)
- Chart order or shuffled (shuffle shows cards you're still learning more often)
- Review only: cards you last marked "Still learning"
- Reset progress

Progress and settings are saved in the browser on this device.

## Project files

- `data/kana.json`: all card content
- `scripts/check-data.py`: checks the data (`python scripts/check-data.py`)
- `REVIEW.md`: words and choices waiting for a human check
