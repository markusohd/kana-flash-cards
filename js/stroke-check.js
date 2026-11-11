// Stroke checking for writing practice.
//
// Compares the strokes Mark wrote with the correct (reference) strokes.
// Everything here is plain math on point lists, with no page or canvas code,
// so it can be tested on its own (scripts/test-stroke-check.mjs).
//
// A point is [x, y] in KanjiVG's 109 x 109 box. A stroke is a list of points.
//
// Before comparing, both drawings are moved to the middle and scaled to the same
// size (NORM_SIZE), so a character written a bit small or off-centre still counts.
// What matters is the shape of each stroke, its place within the character, its
// direction and its order.

const BOX = 109;
const CENTRE = BOX / 2;

export const NORM_SIZE = 60; // both drawings are scaled so their larger side is this long
// How forgiving the check is, in normalised units (finger writing is wobbly).
export const END_TOLERANCE = 18; // start/end may be this far from the right spot
export const SHAPE_TOLERANCE = 10; // average distance allowed along the stroke
export const MAX_POINT_TOLERANCE = 22; // no single point may be further off than this
export const ORDER_RATIO = 0.6; // another stroke fits this much better...
export const ORDER_MARGIN = 3; // ...and by at least this much -> wrong order
export const SAMPLE_POINTS = 16; // points compared per stroke
export const MIN_STROKE_LENGTH = 3; // (box units) shorter strokes are accidental taps

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

// Move a whole drawing to the middle of the box and scale it so its larger
// side is NORM_SIZE long (same scale for x and y, so shapes are not distorted).
export function normalise(strokes) {
  const all = strokes.flat();
  const xs = all.map((p) => p[0]);
  const ys = all.map((p) => p[1]);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const size = Math.max(maxX - minX, maxY - minY);
  const scale = size > 1 ? NORM_SIZE / size : 1;
  const [cx, cy] = [(minX + maxX) / 2, (minY + maxY) / 2];
  return strokes.map((s) => s.map(([x, y]) => [CENTRE + (x - cx) * scale, CENTRE + (y - cy) * scale]));
}

// Average and largest distance between matching points of two resampled strokes.
const meanDistance = (a, b) => a.reduce((sum, p, k) => sum + distance(p, b[k]), 0) / a.length;
const maxDistance = (a, b) => Math.max(...a.map((p, k) => distance(p, b[k])));

// Does stroke `u` fit reference stroke `r` (both resampled and normalised)?
function fits(u, r) {
  return (
    meanDistance(u, r) <= SHAPE_TOLERANCE &&
    maxDistance(u, r) <= MAX_POINT_TOLERANCE &&
    distance(u[0], r[0]) <= END_TOLERANCE &&
    distance(u.at(-1), r.at(-1)) <= END_TOLERANCE
  );
}

// Judge user stroke number i (resampled `u`) against all reference strokes.
function judgeStroke(u, i, refs) {
  const r = refs[i];
  const reversed = [...u].reverse();
  const forward = meanDistance(u, r);
  // Backwards: drawn the other way round fits better. This also catches short
  // strokes (dakuten ticks) and circles (handakuten), whose ends are close together.
  if (meanDistance(reversed, r) < forward && fits(reversed, r)) return { ok: false, problem: "backwards" };
  // Another stroke of the character fits (much better)? Then the order is wrong.
  const other = (better) =>
    refs.findIndex((o, k) => {
      if (k === i || !fits(u, o)) return false;
      const d = meanDistance(u, o);
      return !better || (d < ORDER_RATIO * forward && forward - d >= ORDER_MARGIN);
    });
  if (fits(u, r)) {
    const j = other(true);
    return j === -1 ? { ok: true, problem: null } : { ok: false, problem: "order", looksLike: j + 1 };
  }
  const j = other(false);
  if (j !== -1) return { ok: false, problem: "order", looksLike: j + 1 };
  return { ok: false, problem: "off" };
}

const strokesWord = (n) => `${n} stroke${n === 1 ? "" : "s"}`;

// Compare what was written (`user`) with the correct strokes (`ref`).
// Returns { ok, countOk, empty, strokes: [{ ok, problem, looksLike? }], message }.
export function checkStrokes(user, ref) {
  if (user.length === 0) {
    return { ok: false, countOk: false, empty: true, strokes: [], message: "Write the character first." };
  }

  const refs = normalise(ref).map((s) => resample(s));
  const users = normalise(user).map((s) => resample(s));
  const strokes = users.map((u, i) => {
    if (i >= ref.length) return { ok: false, problem: "off" }; // an extra stroke
    return judgeStroke(u, i, refs);
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
