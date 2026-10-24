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
    .venv\\Scripts\\python scripts/generate_audio.py --voice male   # male voice, into audio/male/

The female voice uses the paths in kana.json (audio/char/..., audio/word/...).
The male voice mirrors them under audio/male/ (audio/male/char/..., audio/male/word/...).

Output: mono mp3, silence trimmed, volume normalized, small (target < 30 KB).
"""

import argparse
import json
import re
import sys
from pathlib import Path

import lameenc
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
DATA_FILE = ROOT / "data" / "kana.json"
SAMPLE_DIR = ROOT / "audio" / "sample"

# ---- Voice settings (change here after listening to the test batch) ----
# Kokoro voice names and the folder each voice's files go in (see VOICES.md on Hugging Face).
VOICES = {
    "female": {"name": "jf_alpha", "folder": "audio"},  # best-rated Japanese voice
    "male": {"name": "jm_kumo", "folder": "audio/male"},  # the only Japanese male voice
}
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

# Texts the text-to-phoneme step gets wrong, with the correct phonemes written
# out by hand (same symbols Kokoro uses for the cards it reads correctly).
PHONEMES_INSTEAD = {
    # Read as grammar particles ("wa", "e") when on their own
    "は": "ha",
    "へ": "he",
    # Combinations split into two beats (e.g. みょ read as "mi-yo")
    "にゅ": "ɲɨ",
    "ひゃ": "ça", "ひゅ": "çɨ", "ひょ": "ço",
    "みゃ": "mʲa", "みゅ": "mʲɨ", "みょ": "mʲo", "ミョ": "mʲo",
    "りゃ": "ɾʲa", "りゅ": "ɾʲɨ", "りょ": "ɾʲo", "リョ": "ɾʲo",
    "ぎょ": "ɡʲo", "ギョ": "ɡʲo",
    "びゃ": "bʲa", "びゅ": "bʲɨ", "びょ": "bʲo",
    "ぴゃ": "pʲa", "ぴょ": "pʲo",
    # Words with the same problem
    "りゃく": "ɾʲakɯ",
    "さんびゃく": "sambʲakɯ",
    "はっぴゃく": "haʔpʲakɯ",
}

# A combination like みょ split in two shows up as "mʲijo" / "çija" / "ɲijɯ" (sometimes with a space).
SPLIT_YOON = re.compile(r"[ʲçɲ]i ?j")


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

def synthesize(pipeline, text, voice_name):
    """Return (audio as float array, phonemes used)."""
    # Japanese text -> phonemes (sound symbols), unless we have a hand-written fix.
    phonemes = PHONEMES_INSTEAD.get(text) or pipeline.g2p(text)[0]
    if SPLIT_YOON.search(phonemes):
        print(f"  WARNING: {text} may be read as two beats [{phonemes}]; add it to PHONEMES_INSTEAD")

    chunks = []
    for result in pipeline.generate_from_tokens(phonemes, voice=voice_name, speed=SPEED):
        if result.audio is not None:
            chunks.append(result.audio.numpy())
    if not chunks:
        raise RuntimeError(f"no audio produced for {text!r}")
    audio = np.concatenate(chunks).astype(np.float32)
    return fade(normalize(trim_silence(audio))), phonemes


def voice_path(path, voice):
    """'audio/char/h-a.mp3' -> ROOT/audio/char/h-a.mp3 (female) or ROOT/audio/male/char/h-a.mp3 (male)."""
    inside_audio = path.removeprefix("audio/")
    return ROOT / VOICES[voice]["folder"] / inside_audio


def make_file(pipeline, text, path, force, voice_name):
    rel = path.relative_to(ROOT).as_posix()
    if path.exists() and not force:
        print(f"  skip   {rel} (exists)")
        return
    audio, phonemes = synthesize(pipeline, text, voice_name)
    size = save_mp3(audio, path)
    warn = "  <-- over 30 KB" if size > 30_000 else ""
    print(f"  wrote  {rel}  {text}  [{phonemes}]  {len(audio) / SAMPLE_RATE:.2f}s  {size / 1000:.1f} KB{warn}")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--sample", action="store_true", help="only generate the test batch into audio/sample/")
    parser.add_argument("--force", action="store_true", help="overwrite files that already exist")
    parser.add_argument("--voice", choices=VOICES, default="female", help="which voice to generate (default: female)")
    args = parser.parse_args()

    # Imported here so --help works even before Kokoro is installed.
    from kokoro import KPipeline

    pipeline = KPipeline(lang_code="j", repo_id="hexgrad/Kokoro-82M")
    voice_name = VOICES[args.voice]["name"]
    print(f"Voice {voice_name} ({args.voice}), speed {SPEED}")

    if args.sample:
        sample_dir = SAMPLE_DIR if args.voice == "female" else SAMPLE_DIR / args.voice
        for name, text in SAMPLE_ITEMS:
            make_file(pipeline, text, sample_dir / f"{name}.mp3", args.force, voice_name)
        return

    cards = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    for card in cards:
        for kind, text in (("char", card["char"]), ("word", card["word"]["kana"])):
            path = voice_path(card["audio"][kind], args.voice)
            make_file(pipeline, text, path, args.force, voice_name)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")  # so kana print correctly in the Windows console
    main()
