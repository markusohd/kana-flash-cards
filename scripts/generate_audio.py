"""Generate audio files for every card with the Kokoro text-to-speech model.

Setup (once, from the project folder):
    python -m venv .venv
    .venv\\Scripts\\python -m pip install torch --index-url https://download.pytorch.org/whl/cpu
    .venv\\Scripts\\python -m pip install "kokoro>=0.9.4" misaki fugashi jaconv mojimoji unidic-lite pyopenjtalk-plus lameenc numpy
    (pyopenjtalk-plus is a prebuilt replacement for pyopenjtalk, which needs CMake to build on Windows.)

Usage:
    .venv\\Scripts\\python scripts/generate_audio.py --sample   # ~10 test files into audio/sample/
    .venv\\Scripts\\python scripts/generate_audio.py            # all cards in data/kana.json
    .venv\\Scripts\\python scripts/generate_audio.py --force    # regenerate files that already exist

Output: mono mp3, silence trimmed, volume normalized, small (target < 30 KB).
"""

import argparse
import json
import sys
from pathlib import Path

import lameenc
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
DATA_FILE = ROOT / "data" / "kana.json"
SAMPLE_DIR = ROOT / "audio" / "sample"

# ---- Voice settings (change here after listening to the test batch) ----
VOICE = "jf_alpha"  # best-rated Kokoro Japanese voice (see VOICES.md on Hugging Face)
SPEED = 0.85  # a little slower than normal, for clarity
SAMPLE_RATE = 24000  # Kokoro outputs 24 kHz audio
MP3_BITRATE = 48  # kbps; plenty for speech and keeps files small

# Test batch: the tricky cases from CLAUDE.md. (file name, text to speak)
SAMPLE_ITEMS = [
    ("a", "あ"),
    ("shi", "し"),
    ("tsu", "つ"),
    ("fu", "ふ"),
    ("n", "ん"),
    ("wo", "を"),
    ("ga", "が"),
    ("kya", "きゃ"),
    ("katakana-a", "ア"),
    ("word-eki", "えき"),
]


# ---------- Audio clean-up ----------

def trim_silence(audio, threshold=0.02, pad_seconds=0.05):
    """Cut quiet parts from the start and end, keeping a short pad."""
    loud = np.where(np.abs(audio) > threshold * np.max(np.abs(audio)))[0]
    if len(loud) == 0:
        return audio
    pad = int(pad_seconds * SAMPLE_RATE)
    start = max(loud[0] - pad, 0)
    end = min(loud[-1] + pad, len(audio))
    return audio[start:end]


def normalize(audio, peak=0.89):
    """Scale so the loudest point is about -1 dB, so all files sound equally loud."""
    loudest = np.max(np.abs(audio))
    return audio if loudest == 0 else audio * (peak / loudest)


def fade(audio, fade_seconds=0.01):
    """Very short fade in/out so clips don't start or end with a click."""
    n = min(int(fade_seconds * SAMPLE_RATE), len(audio) // 2)
    if n > 0:
        ramp = np.linspace(0, 1, n)
        audio[:n] *= ramp
        audio[-n:] *= ramp[::-1]
    return audio


def save_mp3(audio, path):
    pcm = (np.clip(audio, -1, 1) * 32767).astype(np.int16)
    encoder = lameenc.Encoder()
    encoder.set_bit_rate(MP3_BITRATE)
    encoder.set_in_sample_rate(SAMPLE_RATE)
    encoder.set_channels(1)
    encoder.set_quality(2)  # 2 = high quality, 7 = fastest
    data = encoder.encode(pcm.tobytes()) + encoder.flush()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return len(data)


# ---------- Speech ----------

def synthesize(pipeline, text):
    """Return (audio as float array, phonemes Kokoro used)."""
    chunks, phonemes = [], []
    for result in pipeline(text, voice=VOICE, speed=SPEED):
        if result.audio is not None:
            chunks.append(result.audio.numpy())
        phonemes.append(result.phonemes)
    if not chunks:
        raise RuntimeError(f"no audio produced for {text!r}")
    audio = np.concatenate(chunks).astype(np.float32)
    return fade(normalize(trim_silence(audio))), " ".join(phonemes)


def make_file(pipeline, text, path, force):
    rel = path.relative_to(ROOT).as_posix()
    if path.exists() and not force:
        print(f"  skip   {rel} (exists)")
        return
    audio, phonemes = synthesize(pipeline, text)
    size = save_mp3(audio, path)
    warn = "  <-- over 30 KB" if size > 30_000 else ""
    print(f"  wrote  {rel}  {text}  [{phonemes}]  {len(audio) / SAMPLE_RATE:.2f}s  {size / 1000:.1f} KB{warn}")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--sample", action="store_true", help="only generate the test batch into audio/sample/")
    parser.add_argument("--force", action="store_true", help="overwrite files that already exist")
    args = parser.parse_args()

    # Imported here so --help works even before Kokoro is installed.
    from kokoro import KPipeline

    pipeline = KPipeline(lang_code="j", repo_id="hexgrad/Kokoro-82M")
    print(f"Voice {VOICE}, speed {SPEED}")

    if args.sample:
        for name, text in SAMPLE_ITEMS:
            make_file(pipeline, text, SAMPLE_DIR / f"{name}.mp3", args.force)
        return

    cards = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    for card in cards:
        make_file(pipeline, card["char"], ROOT / card["audio"]["char"], args.force)
        make_file(pipeline, card["word"]["kana"], ROOT / card["audio"]["word"], args.force)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")  # so kana print correctly in the Windows console
    main()
