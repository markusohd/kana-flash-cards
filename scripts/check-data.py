"""Check data/kana.json for mistakes.

Run from the project folder:
    python scripts/check-data.py

Exits with code 1 if any error is found.
"""

import json
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_FILE = ROOT / "data" / "kana.json"

# How many cards each (script, stage) should have when complete.
# Stage 1 = basic gojuon, 2 = dakuten/handakuten, 3 = yoon combinations.
EXPECTED_COUNTS = {
    ("hiragana", 1): 46,
    ("hiragana", 2): 25,
    ("hiragana", 3): 33,
    ("katakana", 1): 46,
    ("katakana", 2): 25,
    ("katakana", 3): 33,
}

REQUIRED_FIELDS = ["id", "char", "script", "stage", "row", "romaji", "word", "soundsLike"]
REQUIRED_WORD_FIELDS = ["kana", "romaji", "en"]

# Hiragana and katakana sit 0x60 apart in Unicode (あ U+3042, ア U+30A2).
KANA_OFFSET = 0x60


def other_script(text):
    """Swap hiragana <-> katakana, e.g. 'ヲ' -> 'を', 'みょ' -> 'ミョ'."""
    out = []
    for ch in text:
        code = ord(ch)
        if 0x3041 <= code <= 0x3096:
            code += KANA_OFFSET
        elif 0x30A1 <= code <= 0x30F6:
            code -= KANA_OFFSET
        out.append(chr(code))
    return "".join(out)


def check_sounds_like(label, sounds, errors):
    """Each "sounds like" word must contain its highlighted part; every card needs
    at least one hint (a Filipino word, an English word, or a blend for combinations)."""
    for lang in ("fil", "en"):
        if lang not in sounds:
            errors.append(f"{label}: soundsLike is missing '{lang}' (use null if there is no good word)")
            continue
        entry = sounds[lang]
        if entry is None:
            continue
        if not entry.get("word") or not entry.get("part"):
            errors.append(f"{label}: soundsLike.{lang} needs 'word' and 'part'")
        elif entry["part"] not in entry["word"]:
            errors.append(f"{label}: soundsLike.{lang} part '{entry['part']}' is not in '{entry['word']}'")
        if lang == "fil" and not entry.get("en"):
            errors.append(f"{label}: soundsLike.fil needs an English meaning ('en')")
    if not (sounds.get("fil") or sounds.get("en") or sounds.get("blend")):
        errors.append(f"{label}: soundsLike has no Filipino word, English word or blend")


def main():
    errors = []
    warnings = []

    try:
        cards = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        print(f"ERROR: could not read {DATA_FILE}: {e}")
        sys.exit(1)

    # --- Required fields on every card ---
    for i, card in enumerate(cards):
        label = card.get("id", f"entry #{i}")
        for field in REQUIRED_FIELDS:
            if not card.get(field):
                errors.append(f"{label}: missing '{field}'")
        word = card.get("word") or {}
        for field in REQUIRED_WORD_FIELDS:
            if not word.get(field):
                errors.append(f"{label}: word is missing '{field}'")
        # The sample word must contain the character so it can be highlighted.
        # For very rare kana (e.g. katakana ヲ) the word may use the other script's
        # version instead (を); those cards are listed in REVIEW.md.
        char, kana = card.get("char"), word.get("kana")
        if char and kana and char not in kana and other_script(char) not in kana:
            errors.append(f"{label}: word '{kana}' does not contain '{char}'")
        if card.get("script") not in ("hiragana", "katakana"):
            errors.append(f"{label}: unknown script '{card.get('script')}'")
        if isinstance(card.get("soundsLike"), dict):
            check_sounds_like(label, card["soundsLike"], errors)

    # --- No duplicate ids or characters ---
    for key in ("id", "char"):
        counts = Counter(card.get(key) for card in cards)
        for value, n in counts.items():
            if n > 1:
                errors.append(f"duplicate {key} '{value}' appears {n} times")

    # --- Counts per script and stage ---
    actual = Counter((card.get("script"), card.get("stage")) for card in cards)
    for (script, stage), expected in EXPECTED_COUNTS.items():
        n = actual.get((script, stage), 0)
        if n == 0:
            warnings.append(f"{script} stage {stage}: not added yet (expected {expected})")
        elif n != expected:
            errors.append(f"{script} stage {stage}: has {n} cards, expected {expected}")
    for key in actual:
        if key not in EXPECTED_COUNTS:
            errors.append(f"unexpected script/stage {key}")

    # --- Report ---
    print(f"Checked {len(cards)} cards in {DATA_FILE.relative_to(ROOT)}")
    for (script, stage), n in sorted(actual.items()):
        print(f"  {script} stage {stage}: {n}")
    for w in warnings:
        print(f"WARNING: {w}")
    for e in errors:
        print(f"ERROR: {e}")

    if errors:
        print(f"\nFAILED with {len(errors)} error(s).")
        sys.exit(1)
    print("\nPASSED")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")  # so kana print correctly in the Windows console
    main()
