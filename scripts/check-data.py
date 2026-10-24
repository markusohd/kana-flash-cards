"""Check data/kana.json for mistakes.

Run from the project folder:
    python scripts/check-data.py              # full check
    python scripts/check-data.py --no-audio   # skip audio file checks (before audio is generated)

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

REQUIRED_FIELDS = ["id", "char", "script", "stage", "row", "romaji", "word", "audio"]
REQUIRED_WORD_FIELDS = ["kana", "romaji", "en"]


def main():
    check_audio = "--no-audio" not in sys.argv
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
        if card.get("char") and word.get("kana") and card["char"] not in word["kana"]:
            errors.append(f"{label}: word '{word['kana']}' does not contain '{card['char']}'")
        if card.get("script") not in ("hiragana", "katakana"):
            errors.append(f"{label}: unknown script '{card.get('script')}'")

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

    # --- Audio files exist ---
    if check_audio:
        for card in cards:
            for kind, path in (card.get("audio") or {}).items():
                if not (ROOT / path).is_file():
                    errors.append(f"{card.get('id')}: {kind} audio file not found: {path}")
    else:
        warnings.append("audio file check skipped (--no-audio)")

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
    main()
