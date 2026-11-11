// Writing practice screen: practice (copy the model) and quiz (write from memory).
//
// The screen builds its own markup inside <main id="writing-screen">.
// app.js decides which characters to practise and calls startWriting().

import { WritingPad, samplePaths, drawModel, animateModel } from "./writing-pad.js";
import { checkStrokes } from "./stroke-check.js";
import * as storage from "./storage.js";

const $ = (id) => document.getElementById(id);
const SCRIPT_NAMES = { hiragana: "Hiragana", katakana: "Katakana" };

const state = {
  strokes: {}, // character -> KanjiVG paths
  announce: () => {},
  mode: "practice", // "practice" or "quiz"
  deck: [],
  index: 0,
  pads: [], // one WritingPad per character of the current card
  lastPad: null, // the box written in most recently (for Undo)
  checked: false, // quiz: Check has been pressed for this card
};

const currentCard = () => state.deck[state.index];

const MARKUP = `
  <p class="w-prompt" id="w-prompt"></p>
  <div class="w-sheet">
    <section class="w-model" id="w-model" aria-label="Model character">
      <div class="w-model-chars" id="w-model-chars"></div>
      <p class="w-model-info"><span class="romaji" id="w-romaji"></span> <span class="w-script" id="w-script"></span></p>
      <button type="button" class="big-btn" id="w-play">▶ Stroke order</button>
    </section>
    <section class="w-write" aria-label="Write here">
      <div class="w-boxes" id="w-boxes"></div>
      <p class="w-message" id="w-message" aria-live="polite"></p>
      <div class="w-tools">
        <button type="button" class="nav-btn" id="w-undo">↶ Undo</button>
        <button type="button" class="nav-btn" id="w-clear">Clear</button>
        <button type="button" class="nav-btn flip-btn" id="w-check">Check</button>
      </div>
      <div class="rating" id="w-rate" hidden>
        <button type="button" class="rate-btn learning" id="w-missed">✗ Still learning</button>
        <button type="button" class="rate-btn known" id="w-got">✓ Got it</button>
      </div>
    </section>
  </div>
  <nav class="nav" aria-label="Character navigation">
    <button type="button" class="nav-btn" id="w-prev" aria-label="Previous character"><span aria-hidden="true">‹</span> Prev</button>
    <button type="button" class="nav-btn" id="w-next" aria-label="Next character">Next <span aria-hidden="true">›</span></button>
  </nav>`;

// Build the screen and wire its buttons (call once at startup).
export function initWriting({ strokes, announce }) {
  state.strokes = strokes;
  state.announce = announce;
  $("writing-screen").innerHTML = MARKUP;

  $("w-play").addEventListener("click", playStrokeOrder);
  $("w-undo").addEventListener("click", () => (state.lastPad ?? state.pads.at(-1))?.undo());
  $("w-clear").addEventListener("click", () => state.pads.forEach((pad) => pad.clear()));
  $("w-check").addEventListener("click", check);
  $("w-prev").addEventListener("click", () => go(-1));
  $("w-next").addEventListener("click", () => go(1));
  $("w-got").addEventListener("click", () => rate(true));
  $("w-missed").addEventListener("click", () => rate(false));

  // Ink and grid colours follow the theme: redraw when it changes
  // (the ◐ button sets data-theme; the device setting can change too).
  const redrawAll = () => state.pads.forEach((pad) => pad.redraw());
  new MutationObserver(redrawAll).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", redrawAll);
}

// Show the writing screen for `deck`, starting at `startIndex`.
export function startWriting(mode, deck, startIndex = 0) {
  state.mode = mode;
  state.deck = deck;
  state.index = Math.min(Math.max(startIndex, 0), deck.length - 1);
  showCard();
}

// ---------- One character ----------

function showCard() {
  const card = currentCard();
  const chars = Array.from(card.char); // きゃ -> ["き", "ゃ"]
  const quiz = state.mode === "quiz";
  state.checked = false;

  $("counter").textContent = `${state.index + 1} / ${state.deck.length}`;
  $("w-prompt").hidden = !quiz;
  $("w-prompt").textContent = `${card.romaji} · ${SCRIPT_NAMES[card.script]}`;
  $("w-model").hidden = quiz;
  $("w-rate").hidden = true;
  $("w-message").textContent = quiz ? "Write it from memory, then tap Check." : "";

  // Model: one SVG per character.
  $("w-model-chars").replaceChildren(
    ...chars.map((ch) => {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("class", "w-model-svg");
      svg.setAttribute("role", "img");
      svg.setAttribute("aria-label", ch);
      drawModel(svg, state.strokes[ch] ?? []);
      return svg;
    })
  );
  $("w-romaji").textContent = card.romaji;
  $("w-script").textContent = SCRIPT_NAMES[card.script];

  // Writing boxes: one per character.
  const boxes = $("w-boxes");
  $("writing-screen").style.setProperty("--n", chars.length); // boxes and model size by this
  state.pads = chars.map((ch, i) => {
    const canvas = document.createElement("canvas");
    canvas.className = "w-box";
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", chars.length > 1 ? `Writing box ${i + 1} of ${chars.length}` : "Writing box");
    return canvas;
  });
  boxes.replaceChildren(...state.pads);
  WritingPad.activePointer = null; // a finger left on the old card's box must not block the new one
  state.pads = state.pads.map(
    (canvas) => new WritingPad(canvas, { onChange: onPadChange, onStart: (pad) => (state.lastPad = pad) })
  );
  state.lastPad = null;
}

// Writing again after a check hides the old message (practice only; the quiz keeps its answer).
function onPadChange() {
  if (state.mode === "practice") $("w-message").textContent = "";
}

function playStrokeOrder() {
  const card = currentCard();
  const svgs = [...$("w-model-chars").querySelectorAll("svg")];
  // Animate the characters one after another (き, then ゃ).
  (async () => {
    for (const [i, ch] of Array.from(card.char).entries()) {
      if (currentCard() !== card) return;
      await animateModel(svgs[i], state.strokes[ch] ?? []);
    }
  })();
}

// ---------- Check, rate, move ----------

function check() {
  const card = currentCard();
  const chars = Array.from(card.char);
  const results = state.pads.map((pad, i) => {
    const ref = samplePaths(state.strokes[chars[i]] ?? []);
    const result = checkStrokes(pad.strokes, ref);
    pad.showResult(result);
    return result;
  });

  if (results.every((r) => r.empty)) {
    $("w-message").textContent = "Write the character first.";
    return;
  }

  const allOk = results.every((r) => r.ok);
  let message;
  if (allOk) message = "Nice! ✓";
  else if (results.length === 1) message = results[0].message;
  else message = results.map((r, i) => `${chars[i]}: ${r.message}`).join("  ");
  $("w-message").textContent = message;
  state.announce(message);

  if (state.mode === "practice") {
    storage.markSeen(card.id);
  } else {
    state.checked = true;
    $("w-model").hidden = false; // reveal the answer
    $("w-rate").hidden = false;
  }
}

function rate(known) {
  if (state.mode !== "quiz" || !state.checked) return;
  storage.rateCard(currentCard().id, known);
  go(1);
}

// step = +1 next, -1 previous (wraps around)
function go(step) {
  const n = state.deck.length;
  state.index = (state.index + step + n) % n;
  showCard();
  state.announce(`Character ${state.index + 1} of ${n}.`);
}
