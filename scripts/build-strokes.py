"""Download stroke order data from KanjiVG into data/strokes.json.

Run from the project folder (needs internet, only when the character list changes):
    python scripts/build-strokes.py

For every character used by writing practice (data/kana.json and data/extra-kana.json,
including the small kana inside combinations such as ゃ in きゃ), this fetches the
KanjiVG drawing and keeps each stroke's SVG path, in stroke order.
The paths use KanjiVG's 109 x 109 box.

Small kana (ゃ, ュ, ァ ...) are drawn only slightly smaller than full-size kana in
KanjiVG; this script shrinks them further toward the bottom of the box so they look
small next to the full-size character, as when written by hand.

KanjiVG is by Ulrich Apel, licensed CC BY-SA 3.0: https://kanjivg.tagaini.net
"""

import json
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCES = [ROOT / "data" / "kana.json", ROOT / "data" / "extra-kana.json"]
OUT_FILE = ROOT / "data" / "strokes.json"
URL = "https://raw.githubusercontent.com/KanjiVG/kanjivg/master/kanji/{code:05x}.svg"

# <path id="kvg:03042-s1" ... d="M31.5,24.5c..."/>  (attribute order can vary)
PATH_TAG = re.compile(r"<path\b[^>]*>")
STROKE_ID = re.compile(r'id="kvg:[0-9a-f]+-s(\d+)"')
PATH_D = re.compile(r'\sd="([^"]+)"')

SMALL_KANA = "ぁぃぅぇぉゃゅょァィゥェォャュョ"
SMALL_SCALE = 0.75  # extra shrink for small kana...
SMALL_ANCHOR = (54.5, 100.0)  # ...toward this point (bottom centre of the box)
TOKEN = re.compile(r"[A-Za-z]|-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?")


def scale_path(d, k, cx, cy):
    """Scale an SVG path by k around (cx, cy). Handles the commands KanjiVG uses:
    M L C S (absolute x,y pairs), their lowercase relative forms, H/h, V/v and Z."""
    out, command, index = [], None, 0
    for token in TOKEN.findall(d):
        if token.isalpha():
            command, index = token, 0
            out.append(token)
            continue
        value = float(token)
        if command in "MLCS":  # absolute: alternate x, y
            value = (cx + (value - cx) * k) if index % 2 == 0 else (cy + (value - cy) * k)
        elif command == "H":
            value = cx + (value - cx) * k
        elif command == "V":
            value = cy + (value - cy) * k
        else:  # relative commands: just scale
            value *= k
        index += 1
        out.append(f"{value:.2f}".rstrip("0").rstrip("."))
    # Join, keeping a separator between numbers (a leading "-" also separates).
    text = ""
    for token in out:
        if text and not token.isalpha() and not text[-1].isalpha() and not token.startswith("-"):
            text += ","
        text += token
    return text


def characters():
    """Every single character used by writing practice, in a stable order."""
    chars = []
    for path in SOURCES:
        for entry in json.loads(path.read_text(encoding="utf-8")):
            for ch in entry["char"]:
                if ch not in chars:
                    chars.append(ch)
    return chars


def fetch_strokes(ch):
    """Return the list of stroke paths for one character, in stroke order."""
    url = URL.format(code=ord(ch))
    with urllib.request.urlopen(url, timeout=30) as response:
        svg = response.read().decode("utf-8")
    strokes = []
    for tag in PATH_TAG.findall(svg):
        number, d = STROKE_ID.search(tag), PATH_D.search(tag)
        if number and d:
            strokes.append((int(number.group(1)), d.group(1)))
    if not strokes:
        raise ValueError("no strokes found")
    paths = [d for _, d in sorted(strokes)]
    if ch in SMALL_KANA:
        paths = [scale_path(d, SMALL_SCALE, *SMALL_ANCHOR) for d in paths]
    return paths


def main():
    data = {
        "_source": "KanjiVG by Ulrich Apel (CC BY-SA 3.0), https://kanjivg.tagaini.net. "
        "Paths use a 109 x 109 box. Built by scripts/build-strokes.py.",
    }
    failed = []
    chars = characters()
    for ch in chars:
        try:
            data[ch] = fetch_strokes(ch)
        except Exception as e:  # network error, missing file, bad SVG
            failed.append(f"{ch} (U+{ord(ch):04X}): {e}")

    if failed:
        print("FAILED for:")
        for line in failed:
            print("  " + line)
        sys.exit(1)

    # One character per line keeps the file readable and diffs small.
    lines = [f"  {json.dumps(k, ensure_ascii=False)}: {json.dumps(v, ensure_ascii=False)}" for k, v in data.items()]
    OUT_FILE.write_text("{\n" + ",\n".join(lines) + "\n}\n", encoding="utf-8")
    print(f"Wrote stroke data for {len(chars)} characters to {OUT_FILE.relative_to(ROOT)}")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
