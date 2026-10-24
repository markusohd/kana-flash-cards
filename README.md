# Kana Flash Cards

Flash cards for learning **hiragana and katakana**, with audio. Works on phone and desktop.

## Run it

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
| Play character / word | ▶ buttons | `P` / `W` |
| Still learning / I know it | Buttons | `1` / `2` |
| Shortcuts help | | `?` |

## Settings

From the home screen, **Settings** lets you choose:

- Script (hiragana, katakana or both) and stages (basic, voiced, combinations)
- Rows (for example only the か and さ rows)
- Chart order or shuffled (shuffle shows cards you're still learning more often)
- Review only: cards you last marked "Still learning"
- Female or male voice, and auto-play when a card is flipped
- Reset progress

Progress and settings are saved in the browser on this device.

## Project files

- `data/kana.json`: all card content
- `scripts/check-data.py`: checks the data (`python scripts/check-data.py`)
- `scripts/generate_audio.py`: makes the audio with Kokoro (setup steps are in the file;
  `--voice male` makes the male set in `audio/male/`)
- `REVIEW.md`: words and readings waiting for a human check
- `audio/LICENSE.md`: audio license
