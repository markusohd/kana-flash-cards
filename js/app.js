// App startup and controls: flip, next/previous, swipe, keyboard, rating, theme.

import { loadCards, buildDeck, DEFAULT_FILTERS } from "./deck.js";
import { renderCard, setFlipped } from "./card.js";
import { play } from "./audio.js";
import * as storage from "./storage.js";

const $ = (id) => document.getElementById(id);

const state = {
  deck: [], // cards currently being studied
  index: 0, // position in the deck
  flipped: false,
};

const currentCard = () => state.deck[state.index];

// ---------- Screen reader announcements ----------

function announce(message) {
  $("announcer").textContent = message;
}

// ---------- Card actions ----------

function showCard() {
  const card = currentCard();
  renderCard(card);
  state.flipped = false;
  $("counter").textContent = `${state.index + 1} / ${state.deck.length}`;
}

function flip() {
  state.flipped = !state.flipped;
  setFlipped(state.flipped);
  const card = currentCard();
  announce(
    state.flipped
      ? `Back of card: ${card.romaji}. Example: ${card.word.romaji}, ${card.word.en}.`
      : "Front of card."
  );
}

// step = +1 for next, -1 for previous (wraps around at the ends)
function go(step) {
  const n = state.deck.length;
  state.index = (state.index + step + n) % n;
  showCard();
  announce(`Card ${state.index + 1} of ${n}.`);
}

function rate(known) {
  if (!state.flipped) return;
  storage.rateCard(currentCard().id, known);
  go(1);
}

async function playSound(kind) {
  const card = currentCard();
  const ok =
    kind === "char"
      ? await play(card.audio.char, card.char)
      : await play(card.audio.word, card.word.kana);
  if (!ok) {
    // No audio file and no Japanese voice: hide the play buttons, show a note.
    $("play-char").hidden = true;
    $("play-word").hidden = true;
    $("audio-note").hidden = false;
  }
}

// ---------- Theme (light / dark) ----------

function effectiveTheme() {
  const saved = document.documentElement.dataset.theme;
  if (saved) return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme) {
  // theme is "light", "dark", or "system" (follow the device setting)
  if (theme === "light" || theme === "dark") {
    document.documentElement.dataset.theme = theme;
  } else {
    delete document.documentElement.dataset.theme;
  }
  const next = effectiveTheme() === "dark" ? "light" : "dark";
  $("theme-toggle").setAttribute("aria-label", `Switch to ${next} mode`);
}

function toggleTheme() {
  const theme = effectiveTheme() === "dark" ? "light" : "dark";
  applyTheme(theme);
  storage.save("theme", theme);
}

// ---------- Help panel ----------

function toggleHelp() {
  const help = $("help");
  if (help.open) help.close();
  else help.showModal();
}

// ---------- Touch / mouse: tap to flip, swipe to change card ----------

function setUpCardGestures() {
  const cardEl = $("card");
  const SWIPE_DISTANCE = 50; // px needed to count as a swipe
  const TAP_SLOP = 10; // px of wobble still allowed for a tap
  let start = null;
  let ignoreNextClick = false;

  cardEl.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    start = { x: e.clientX, y: e.clientY };
  });

  cardEl.addEventListener("pointerup", (e) => {
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    start = null;

    const isSwipe = Math.abs(dx) > SWIPE_DISTANCE && Math.abs(dx) > Math.abs(dy) * 1.5;
    if (isSwipe) {
      go(dx < 0 ? 1 : -1); // swipe left = next card
    }
    // A swipe or a drag (e.g. scrolling the back) should not also flip the card.
    ignoreNextClick = isSwipe || Math.abs(dx) > TAP_SLOP || Math.abs(dy) > TAP_SLOP;
  });

  cardEl.addEventListener("pointercancel", () => {
    start = null;
  });

  cardEl.addEventListener("click", (e) => {
    if (ignoreNextClick) {
      ignoreNextClick = false;
      return;
    }
    if (e.target.closest("button")) return; // play buttons don't flip
    flip();
  });
}

// ---------- Keyboard ----------

function setUpKeyboard() {
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    // While the help panel is open, only "?" (and Esc, handled by the dialog) work.
    if ($("help").open) {
      if (e.key === "?") toggleHelp();
      return;
    }

    switch (e.key) {
      case " ":
        e.preventDefault(); // stop page scroll / button press
        flip();
        break;
      case "ArrowRight":
        go(1);
        break;
      case "ArrowLeft":
        go(-1);
        break;
      case "p":
      case "P":
        if (state.flipped) playSound("char");
        break;
      case "w":
      case "W":
        if (state.flipped) playSound("word");
        break;
      case "1":
        rate(false);
        break;
      case "2":
        rate(true);
        break;
      case "?":
        toggleHelp();
        break;
    }
  });

  // Space on a focused button would also "click" it on key release; block that
  // so Space always means "flip".
  document.addEventListener("keyup", (e) => {
    if (e.key === " " && e.target.closest?.("button")) e.preventDefault();
  });
}

// ---------- Startup ----------

async function start() {
  applyTheme(storage.load("theme", "system"));

  $("theme-toggle").addEventListener("click", toggleTheme);
  $("help-open").addEventListener("click", toggleHelp);

  let cards;
  try {
    cards = await loadCards();
  } catch (err) {
    const msg = $("load-error");
    msg.textContent =
      "Could not load the cards. Open the app through a local server " +
      "(for example: python -m http.server) rather than as a file.";
    msg.hidden = false;
    $("card").hidden = true;
    console.error(err);
    return;
  }

  state.deck = buildDeck(cards, storage.load("filters", DEFAULT_FILTERS));
  if (state.deck.length === 0) {
    state.deck = buildDeck(cards, DEFAULT_FILTERS);
  }

  setUpCardGestures();
  setUpKeyboard();
  $("flip").addEventListener("click", flip);
  $("prev").addEventListener("click", () => go(-1));
  $("next").addEventListener("click", () => go(1));
  $("rate-learning").addEventListener("click", () => rate(false));
  $("rate-known").addEventListener("click", () => rate(true));
  $("play-char").addEventListener("click", () => playSound("char"));
  $("play-word").addEventListener("click", () => playSound("word"));

  showCard();
}

start();
