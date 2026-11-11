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
