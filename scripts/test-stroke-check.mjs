// Unit tests for the stroke checker (js/stroke-check.js).
// Run: node --test scripts/test-stroke-check.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { checkStrokes, resample } from "../js/stroke-check.js";

// A made-up 3-stroke "character" in KanjiVG's 109 x 109 box.
const A = [[20, 30], [90, 30]]; // horizontal
const B = [[55, 15], [55, 95]]; // vertical
const C = [[25, 90], [85, 60]]; // diagonal
const REF = [A, B, C];

// Turn a 2-point line into many points, like a finger stroke would give.
const dense = (stroke) => resample(stroke, 30);

test("exact copy passes", () => {
  const r = checkStrokes(REF.map(dense), REF);
  assert.equal(r.ok, true);
  assert.equal(r.countOk, true);
  assert.equal(r.message, "Nice! ✓");
});

test("wobbly, shifted, scaled copy passes", () => {
  const offsets = [6, -4, 2, -6, 5, -2, 0, 4, -5, 3];
  let k = 0;
  const wobble = (stroke) =>
    dense(stroke).map(([x, y]) => {
      const dx = offsets[k++ % offsets.length];
      const dy = offsets[k++ % offsets.length];
      // scale x0.9 around the centre, then shift (+8, -6), then wobble
      return [54.5 + (x - 54.5) * 0.9 + 8 + dx, 54.5 + (y - 54.5) * 0.9 - 6 + dy];
    });
  const r = checkStrokes(REF.map(wobble), REF);
  assert.equal(r.ok, true, r.message);
});

test("reversed stroke is backwards", () => {
  const r = checkStrokes([dense(A), dense([...B].reverse()), dense(C)], REF);
  assert.equal(r.strokes[1].problem, "backwards");
  assert.equal(r.ok, false);
  assert.match(r.message, /stroke 2 is backwards/i);
});

test("swapped strokes report order", () => {
  const r = checkStrokes([dense(B), dense(A), dense(C)], REF);
  assert.equal(r.strokes[0].problem, "order");
  assert.equal(r.strokes[0].looksLike, 2);
  assert.match(r.message, /stroke 1 looks like stroke 2/i);
});

test("missing stroke fails count", () => {
  const r = checkStrokes([dense(A), dense(B)], REF);
  assert.equal(r.countOk, false);
  assert.equal(r.ok, false);
  assert.ok(r.message.startsWith("You used 2 strokes; this has 3."), r.message);
});

test("extra stroke fails count", () => {
  const r = checkStrokes([dense(A), dense(B), dense(C), dense([[10, 10], [30, 10]])], REF);
  assert.equal(r.countOk, false);
  assert.equal(r.strokes[3].problem, "off");
});

test("nothing written", () => {
  const r = checkStrokes([], REF);
  assert.equal(r.empty, true);
  assert.equal(r.ok, false);
  assert.equal(r.message, "Write the character first.");
});

test("resample spacing", () => {
  assert.deepEqual(resample([[0, 0], [10, 0]], 3), [[0, 0], [5, 0], [10, 0]]);
});

// ======================================================================
// Real kana (KanjiVG strokes from data/strokes.json)
// ======================================================================

import { readFileSync } from "node:fs";

const STROKES = JSON.parse(readFileSync(new URL("../data/strokes.json", import.meta.url), "utf8"));
delete STROKES._source;

// KanjiVG paths only use "M x,y" and relative cubic curves "c x1,y1 x2,y2 x,y".
function pathPoints(d) {
  const nums = (d.match(/-?(?:\d+\.?\d*|\.\d+)/g) || []).map(Number);
  const points = [[nums[0], nums[1]]];
  let [x, y] = points[0];
  for (let i = 2; i + 5 < nums.length; i += 6) {
    const [c1x, c1y, c2x, c2y, ex, ey] = nums.slice(i, i + 6).map((v, k) => v + (k % 2 ? y : x));
    for (let t = 0.1; t <= 1.0001; t += 0.1) {
      const u = 1 - t;
      points.push([
        u * u * u * x + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * ex,
        u * u * u * y + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * ey,
      ]);
    }
    [x, y] = [ex, ey];
  }
  return points;
}
const kana = (ch) => STROKES[ch].map(pathPoints);
const CHARS = Object.keys(STROKES);

// Deterministic small wobble, like a finger.
function wobbly(strokes, transform) {
  const offsets = [3, -2, 1, -3, 2, -1, 0, 2, -3, 1];
  let k = 0;
  return strokes.map((s) =>
    resample(s, 24).map(([x, y]) => {
      const [tx, ty] = transform([x, y]);
      return [tx + offsets[k++ % 10], ty + offsets[k++ % 10]];
    })
  );
}

test("every real kana passes when copied exactly", () => {
  const failed = CHARS.filter((ch) => !checkStrokes(kana(ch), kana(ch)).ok);
  assert.deepEqual(failed, []);
});

test("honest off-centre, smaller, bigger or wider writing passes", () => {
  const C = 54.5;
  const variants = {
    shifted15: ([x, y]) => [x + 15, y + 15],
    smaller: ([x, y]) => [C + (x - C) * 0.8 + 8, C + (y - C) * 0.8 - 8],
    smallerUpLeft: ([x, y]) => [C + (x - C) * 0.7 - 12, C + (y - C) * 0.7 - 12],
    bigger: ([x, y]) => [C + (x - C) * 1.15, C + (y - C) * 1.15],
    wider: ([x, y]) => [C + (x - C) * 1.1, y],
  };
  for (const [name, f] of Object.entries(variants)) {
    const failed = CHARS.filter((ch) => !checkStrokes(wobbly(kana(ch), f), kana(ch)).ok);
    assert.deepEqual(failed, [], `${name} failed for ${failed.join("")}`);
  }
});

test("look-different kana do not pass for each other", () => {
  for (const [written, asked] of [["し", "く"], ["く", "し"], ["そ", "る"], ["さ", "エ"], ["ま", "モ"], ["コ", "ユ"], ["ア", "ヤ"], ["い", "ハ"]]) {
    assert.equal(checkStrokes(kana(written), kana(asked)).ok, false, `${written} passed as ${asked}`);
  }
});

test("direction matters: シ is not ツ, ソ is not ン", () => {
  assert.equal(checkStrokes(kana("シ"), kana("ツ")).ok, false);
  assert.equal(checkStrokes(kana("ツ"), kana("シ")).ok, false);
  assert.equal(checkStrokes(kana("ソ"), kana("ン")).ok, false);
  assert.equal(checkStrokes(kana("ン"), kana("ソ")).ok, false);
});

test("a dakuten tick drawn backwards is caught", () => {
  const user = kana("が");
  const last = user.length - 1;
  user[last] = [...user[last]].reverse();
  const r = checkStrokes(user, kana("が"));
  assert.equal(r.ok, false);
  assert.equal(r.strokes[last].problem, "backwards");
});

test("dakuten ticks written in swapped order are caught", () => {
  const user = kana("が");
  const n = user.length;
  [user[n - 2], user[n - 1]] = [user[n - 1], user[n - 2]];
  assert.equal(checkStrokes(user, kana("が")).ok, false);
});

test("a handakuten circle drawn the other way round is caught", () => {
  const user = kana("ぱ");
  const last = user.length - 1;
  user[last] = [...user[last]].reverse();
  assert.equal(checkStrokes(user, kana("ぱ")).ok, false);
});

test("short strokes drawn backwards are caught (う, ふ, シ)", () => {
  for (const [ch, i] of [["う", 0], ["ふ", 0], ["シ", 2]]) {
    const user = kana(ch);
    user[i] = [...user[i]].reverse();
    assert.equal(checkStrokes(user, kana(ch)).strokes[i].problem, "backwards", `${ch} stroke ${i + 1}`);
  }
});

test("few same-stroke-count kana are confused with each other", () => {
  const confused = [];
  for (const a of CHARS) {
    for (const b of CHARS) {
      if (a !== b && STROKES[a].length === STROKES[b].length && checkStrokes(kana(a), kana(b)).ok) confused.push(`${a}→${b}`);
    }
  }
  assert.ok(confused.length <= 45, `${confused.length} confusions: ${confused.join(" ")}`);
});
