# Audio license

The audio files in this folder were generated with **Kokoro-82M**
(https://github.com/hexgrad/kokoro, model: https://huggingface.co/hexgrad/Kokoro-82M).

- Model and code: **Apache License 2.0**
- Voices used, both at speed 0.85:
  - `jf_alpha` (Japanese, female): `audio/char/`, `audio/word/`
  - `jm_kumo` (Japanese, male): `audio/male/char/`, `audio/male/word/`
- Kokoro's voice list (VOICES.md) marks its Japanese voices as **CC BY**; credit is given here.
  Some Japanese voices were trained on text from the koniwa project
  (https://github.com/koniwa/koniwa).

The files were generated once by `scripts/generate_audio.py`; the app does not run a voice model.
