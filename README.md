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

## Project files

- `data/kana.json`: all card content
- `scripts/check-data.py`: checks the data (`python scripts/check-data.py`)
- `scripts/generate_audio.py`: makes the audio with Kokoro (setup steps are in the file)
- `REVIEW.md`: words and readings waiting for a human check
- `audio/LICENSE.md`: audio license
