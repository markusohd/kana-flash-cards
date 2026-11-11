// Stroke checking for writing practice.
//
// Compares the strokes Mark wrote with the correct (reference) strokes.
// Everything here is plain math on point lists, with no page or canvas code,
// so it can be tested on its own (scripts/test-stroke-check.mjs).
//
// A point is [x, y] in KanjiVG's 109 x 109 box. A stroke is a list of points.

const BOX = 109;

// How forgiving the check is. Finger writing is wobbly, so these are generous.
export const END_TOLERANCE = 0.25 * BOX; // start/end may be this far from the right spot
export const SHAPE_TOLERANCE = 0.18 * BOX; // average distance allowed along the stroke
export const SAMPLE_POINTS = 16; // points compared per stroke
export const MIN_STROKE_LENGTH = 3; // shorter strokes are treated as accidental taps

const distance = ([x1, y1], [x2, y2]) => Math.hypot(x2 - x1, y2 - y1);

// Total length of a stroke.
export function strokeLength(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += distance(points[i - 1], points[i]);
  return total;
}

// Return n points spread evenly along the stroke, so two strokes drawn at
// different speeds can be compared point by point.
export function resample(points, n = SAMPLE_POINTS) {
  const total = strokeLength(points);
  if (points.length === 1 || total === 0) return Array.from({ length: n }, () => [...points[0]]);

  const step = total / (n - 1);
  const result = [[...points[0]]];
  let walked = 0; // distance covered up to points[i - 1]
  let i = 1;
  for (let k = 1; k < n - 1; k++) {
    const target = k * step;
    // Move along the stroke until the segment that contains `target`.
    while (walked + distance(points[i - 1], points[i]) < target) {
      walked += distance(points[i - 1], points[i]);
      i++;
    }
    const [a, b] = [points[i - 1], points[i]];
    const t = (target - walked) / distance(a, b);
    result.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  result.push([...points.at(-1)]);
  return result;
}

// Average distance between matching points of two resampled strokes.
const meanDistance = (a, b) => a.reduce((sum, p, k) => sum + distance(p, b[k]), 0) / a.length;

// Does user stroke `u` match reference stroke `r` (both resampled), in the right direction?
function matches(u, r) {
  return (
    meanDistance(u, r) <= SHAPE_TOLERANCE &&
    distance(u[0], r[0]) <= END_TOLERANCE &&
    distance(u.at(-1), r.at(-1)) <= END_TOLERANCE
  );
}

const strokesWord = (n) => `${n} stroke${n === 1 ? "" : "s"}`;

// Compare what was written (`user`) with the correct strokes (`ref`).
// Returns { ok, countOk, empty, strokes: [{ ok, problem, looksLike? }], message }.
export function checkStrokes(user, ref) {
  if (user.length === 0) {
    return { ok: false, countOk: false, empty: true, strokes: [], message: "Write the character first." };
  }

  const refSampled = ref.map((s) => resample(s));
  const strokes = user.map((stroke, i) => {
    if (i >= ref.length) return { ok: false, problem: "off" }; // an extra stroke
    const u = resample(stroke);
    const r = refSampled[i];
    if (matches(u, r)) return { ok: true, problem: null };
    if (matches([...u].reverse(), r)) return { ok: false, problem: "backwards" };
    // Right shape, wrong place in the order?
    const j = refSampled.findIndex((other, k) => k !== i && matches(u, other));
    if (j !== -1) return { ok: false, problem: "order", looksLike: j + 1 };
    return { ok: false, problem: "off" };
  });

  const countOk = user.length === ref.length;
  const ok = countOk && strokes.every((s) => s.ok);
  if (ok) return { ok, countOk, empty: false, strokes, message: "Nice! ✓" };

  // Build a short message: the stroke count first, then up to two stroke problems.
  const notes = [];
  if (!countOk) notes.push(`You used ${strokesWord(user.length)}; this has ${ref.length}`);
  const problems = strokes
    .map((s, i) => ({ ...s, n: i + 1 }))
    .filter((s) => !s.ok && s.n <= ref.length)
    .slice(0, 2)
    .map((s) => {
      if (s.problem === "backwards") return `stroke ${s.n} is backwards`;
      if (s.problem === "order") return `stroke ${s.n} looks like stroke ${s.looksLike}: check the order`;
      return `stroke ${s.n} is off`;
    });
  notes.push(...problems);
  const message = notes.join(". ").replace(/^./, (c) => c.toUpperCase()) + ".";
  return { ok, countOk, empty: false, strokes, message };
}
