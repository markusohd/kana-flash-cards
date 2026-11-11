// Drawing for writing practice:
//   - WritingPad: a grid box you write in with a finger (or mouse / stylus)
//   - samplePaths: turns KanjiVG stroke paths into point lists for checking
//   - drawModel / animateModel: shows the model character and its stroke order
//
// All coordinates use KanjiVG's 109 x 109 box, so strokes stay in place when
// the box changes size (for example when the tablet is rotated).

import { strokeLength, MIN_STROKE_LENGTH } from "./stroke-check.js";

const BOX = 109;
const INK_WIDTH = 6; // stroke thickness in box units (thick enough for a finger)

// Colours come from CSS variables on the canvas, with fallbacks.
function colour(el, name, fallback) {
  return getComputedStyle(el).getPropertyValue(name).trim() || fallback;
}

export class WritingPad {
  constructor(canvas, { onChange } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.onChange = onChange ?? (() => {});
    this.strokes = []; // finished strokes, each a list of [x, y] points
    this.current = null; // the stroke being drawn right now
    this.pointerId = null; // the one finger allowed to draw; others are ignored
    this.result = null; // last check result, used to colour strokes

    // Stop the browser from scrolling or zooming while writing.
    canvas.style.touchAction = "none";

    canvas.addEventListener("pointerdown", (e) => this.#start(e));
    canvas.addEventListener("pointermove", (e) => this.#move(e));
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
      canvas.addEventListener(type, (e) => this.#end(e));
    }

    // Keep the canvas sharp at its current size, and redraw after any resize.
    new ResizeObserver(() => this.#resize()).observe(canvas);
    this.#resize();
  }

  // Remove the last stroke.
  undo() {
    this.strokes.pop();
    this.#edited();
  }

  // Remove every stroke.
  clear() {
    this.strokes = [];
    this.current = null;
    this.pointerId = null;
    this.#edited();
  }

  // Colour strokes by a check result (green = right, red = wrong); null removes colours.
  showResult(result) {
    this.result = result;
    this.redraw();
  }

  redraw() {
    const { ctx, canvas } = this;
    const scale = canvas.width / BOX;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);

    // Grid: dotted cross through the middle (the border is drawn by CSS).
    ctx.strokeStyle = colour(canvas, "--grid", "#c9c3b5");
    ctx.lineWidth = 0.8;
    ctx.setLineDash([2.5, 2.5]);
    ctx.beginPath();
    ctx.moveTo(BOX / 2, 0);
    ctx.lineTo(BOX / 2, BOX);
    ctx.moveTo(0, BOX / 2);
    ctx.lineTo(BOX, BOX / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Ink
    const ink = colour(canvas, "--ink", "#1f2430");
    const good = colour(canvas, "--good", "#2e7d4f");
    const bad = colour(canvas, "--bad", "#c0392b");
    ctx.lineWidth = INK_WIDTH;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const all = this.current ? [...this.strokes, this.current] : this.strokes;
    all.forEach((points, i) => {
      const verdict = this.result?.strokes?.[i];
      ctx.strokeStyle = verdict ? (verdict.ok ? good : bad) : ink;
      ctx.beginPath();
      ctx.moveTo(...points[0]);
      for (const p of points.slice(1)) ctx.lineTo(...p);
      if (points.length === 1) ctx.lineTo(points[0][0] + 0.01, points[0][1]);
      ctx.stroke();
    });
  }

  // ---------- internals ----------

  #resize() {
    const rect = this.canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const size = Math.max(1, Math.round(rect.width * ratio));
    if (this.canvas.width !== size || this.canvas.height !== size) {
      this.canvas.width = size;
      this.canvas.height = size;
    }
    this.redraw();
  }

  // Page position -> box coordinates (kept inside the box).
  #toBox(e) {
    const rect = this.canvas.getBoundingClientRect();
    const clamp = (v) => Math.min(BOX, Math.max(0, v));
    return [clamp(((e.clientX - rect.left) / rect.width) * BOX), clamp(((e.clientY - rect.top) / rect.height) * BOX)];
  }

  #start(e) {
    if (this.pointerId !== null) return; // already drawing with another finger
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    this.pointerId = e.pointerId;
    try {
      this.canvas.setPointerCapture(e.pointerId); // keep getting moves if the finger slides off
    } catch {
      // Not a real active pointer (e.g. synthetic event); drawing still works.
    }
    this.current = [this.#toBox(e)];
    this.redraw();
  }

  #move(e) {
    if (e.pointerId !== this.pointerId || !this.current) return;
    const p = this.#toBox(e);
    const last = this.current.at(-1);
    if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 0.3) return; // skip tiny jitters
    this.current.push(p);
    this.redraw();
  }

  #end(e) {
    if (e.pointerId !== this.pointerId) return;
    const stroke = this.current;
    this.pointerId = null;
    this.current = null;
    // Very short strokes are accidental taps.
    if (stroke && strokeLength(stroke) >= MIN_STROKE_LENGTH) this.strokes.push(stroke);
    this.#edited();
  }

  // Any change clears the old check colours.
  #edited() {
    this.result = null;
    this.redraw();
    this.onChange();
  }
}

// ---------- Model character (SVG) ----------

const SVG_NS = "http://www.w3.org/2000/svg";
let sampler = null; // one hidden SVG reused for measuring paths

// KanjiVG path strings -> point lists (about one point per box unit).
export function samplePaths(paths) {
  if (!sampler) {
    sampler = document.createElementNS(SVG_NS, "svg");
    sampler.setAttribute("viewBox", `0 0 ${BOX} ${BOX}`);
    sampler.setAttribute("aria-hidden", "true");
    sampler.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
    document.body.append(sampler);
  }
  return paths.map((d) => {
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", d);
    sampler.append(path);
    const length = path.getTotalLength();
    const n = Math.max(2, Math.ceil(length));
    const points = [];
    for (let i = 0; i < n; i++) {
      const p = path.getPointAtLength((length * i) / (n - 1));
      points.push([p.x, p.y]);
    }
    path.remove();
    return points;
  });
}

function makePath(d) {
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", d);
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "5");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  return path;
}

// Small stroke number placed just before the stroke's start.
function makeNumber(path, n) {
  const start = path.getPointAtLength(0);
  const text = document.createElementNS(SVG_NS, "text");
  text.setAttribute("x", Math.max(4, start.x - 6));
  text.setAttribute("y", Math.max(8, start.y - 3));
  text.setAttribute("class", "stroke-num");
  text.setAttribute("font-size", "9");
  text.textContent = n;
  return text;
}

// Draw the whole model character; with numbers = true, label each stroke's start.
export function drawModel(svg, paths, { numbers = false } = {}) {
  svg._animation = (svg._animation ?? 0) + 1; // cancel any running animation
  svg.setAttribute("viewBox", `0 0 ${BOX} ${BOX}`);
  svg.replaceChildren(...paths.map(makePath));
  if (numbers) {
    [...svg.querySelectorAll("path")].forEach((path, i) => svg.append(makeNumber(path, i + 1)));
  }
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Draw the strokes one by one, in order and direction.
export async function animateModel(svg, paths) {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  drawModel(svg, paths, { numbers: reduceMotion });
  if (reduceMotion) return;

  const run = svg._animation; // drawModel above started a new run
  const strokes = [...svg.querySelectorAll("path")];
  // Hide every stroke: a dash as long as the stroke, shifted fully out of view.
  for (const path of strokes) {
    const length = path.getTotalLength() + 1;
    path.style.strokeDasharray = length;
    path.style.strokeDashoffset = length;
  }
  for (const [i, path] of strokes.entries()) {
    if (svg._animation !== run) return; // a newer draw/animation took over
    svg.append(makeNumber(path, i + 1));
    path.getBoundingClientRect(); // apply the hidden state before animating
    path.style.transition = "stroke-dashoffset 0.5s ease-in-out";
    path.style.strokeDashoffset = 0;
    await wait(650);
  }
}
