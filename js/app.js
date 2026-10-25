// App startup and controls: home screen, settings, and the study screen
// (flip, next/previous, swipe, keyboard, rating, theme).

import { loadCards, buildDeck, availableRows, DEFAULT_FILTERS } from "./deck.js";
import { renderCard, setFlipped } from "./card.js";
import * as storage from "./storage.js";

const $ = (id) => document.getElementById(id);

const SCRIPT_NAMES = { hiragana: "Hiragana", katakana: "Katakana" };
const STAGE_NAMES = { 1: "Basic", 2: "Voiced", 3: "Combinations" };

const state = {
  cards: [], // every card in kana.json
  filters: { ...DEFAULT_FILTERS },
  deck: [], // cards currently being studied
  index: 0, // position in the deck
  flipped: false,
  openedStudyFromHome: false, // so "back to home" can use the browser's back history
};

const currentCard = () => state.deck[state.index];
const makeDeck = () => buildDeck(state.cards, state.filters, storage.getProgress());

// ---------- Screen reader announcements ----------

function announce(message) {
  $("announcer").textContent = message;
}

// ======================================================================
// Screens: #study shows the cards, anything else shows home.
// Using the URL hash means the phone's back button returns to home.
// ======================================================================

function route() {
  if (location.hash === "#study" && startStudy()) {
    showScreen("study");
  } else {
    showScreen("home");
    renderHome();
  }
}

function showScreen(name) {
  const study = name === "study";
  $("home-screen").hidden = study;
  $("study-screen").hidden = !study;
  $("go-home").hidden = !study;
  $("counter").hidden = !study;
}

function goHome() {
  if (state.openedStudyFromHome) {
    history.back(); // removes #study from history too
  } else {
    location.hash = "";
  }
}

// ======================================================================
// Home screen: progress summary and what is being studied
// ======================================================================

function renderHome() {
  const progress = storage.getProgress();
  const seen = storage.getSeen();

  // One row per script: seen and known counts, with a bar for "known".
  $("progress-list").replaceChildren(
    ...["hiragana", "katakana"].map((script) => {
      const ids = state.cards.filter((c) => c.script === script).map((c) => c.id);
      const nSeen = ids.filter((id) => seen.has(id)).length;
      const nKnown = ids.filter((id) => (progress[id] ?? 0) >= 1).length;

      const row = document.createElement("div");
      row.className = "progress-row";
      row.innerHTML = `
        <div class="progress-head">
          <strong></strong>
          <span><span class="seen"></span> seen · <span class="known"></span> known</span>
        </div>
        <progress></progress>`;
      row.querySelector("strong").textContent = SCRIPT_NAMES[script];
      row.querySelector(".seen").textContent = `${nSeen} / ${ids.length}`;
      row.querySelector(".known").textContent = nKnown;
      const bar = row.querySelector("progress");
      bar.max = ids.length;
      bar.value = nKnown;
      bar.setAttribute("aria-label", `${SCRIPT_NAMES[script]}: ${nKnown} of ${ids.length} known`);
      return row;
    })
  );

  const count = makeDeck().length;
  $("deck-summary").textContent = `${describeFilters()} · ${count} card${count === 1 ? "" : "s"}`;
  $("start").disabled = count === 0;
  if (count === 0 && state.filters.reviewOnly) {
    $("deck-summary").textContent += ". No cards are marked “Still learning” yet.";
  }
}

// e.g. "Hiragana + Katakana · Basic, Voiced · あ か rows · Shuffled · Review only"
function describeFilters() {
  const f = state.filters;
  const parts = [
    f.scripts.map((s) => SCRIPT_NAMES[s]).join(" + "),
    f.stages.map((s) => STAGE_NAMES[s]).join(", "),
  ];
  if (f.rows.length > 0) {
    const labels = availableRows(state.cards, f)
      .filter((r) => f.rows.includes(r.row))
      .map((r) => r.label);
    parts.push(`${labels.join(" ")} row${labels.length === 1 ? "" : "s"}`);
  }
  parts.push(f.order === "shuffle" ? "Shuffled" : "Chart order");
  if (f.reviewOnly) parts.push("Review only");
  return parts.join(" · ");
}

// ======================================================================
// Settings
// ======================================================================

const form = () => $("settings").querySelector("form");

function openSettings() {
  const f = state.filters;
  for (const box of form().querySelectorAll('[name="script"]')) box.checked = f.scripts.includes(box.value);
  for (const box of form().querySelectorAll('[name="stage"]')) box.checked = f.stages.includes(Number(box.value));
  for (const radio of form().querySelectorAll('[name="order"]')) radio.checked = radio.value === f.order;
  $("review-only").checked = f.reviewOnly;
  renderRowChoices();
  updateMatchCount();
  $("settings").showModal();
}

// Row chips depend on which scripts and stages are on.
function renderRowChoices() {
  const rows = availableRows(state.cards, state.filters);
  // Forget selected rows that are no longer available
  state.filters.rows = state.filters.rows.filter((r) => rows.some((x) => x.row === r));

  $("row-choices").replaceChildren(
    ...rows.map(({ row, label }) => {
      const chip = document.createElement("label");
      chip.className = "chip row-chip";
      chip.innerHTML = `<input type="checkbox" name="row"><span lang="ja"></span>`;
      const box = chip.querySelector("input");
      box.value = row;
      box.checked = state.filters.rows.includes(row);
      box.setAttribute("aria-label", `${label} row (${row})`);
      chip.querySelector("span").textContent = label;
      return chip;
    })
  );
}

function updateMatchCount() {
  const n = makeDeck().length;
  $("match-count").textContent =
    n === 0 ? "No cards match these settings." : `${n} card${n === 1 ? "" : "s"} match these settings.`;
  $("match-count").classList.toggle("warn", n === 0);
}

// Read every control back into state.filters and save.
function onSettingsChange(event) {
  const target = event.target;
  const checkedValues = (name) =>
    [...form().querySelectorAll(`[name="${name}"]:checked`)].map((el) => el.value);

  // Keep at least one script and one stage switched on.
  if ((target.name === "script" || target.name === "stage") && checkedValues(target.name).length === 0) {
    target.checked = true;
  }

  state.filters = {
    scripts: checkedValues("script"),
    stages: checkedValues("stage").map(Number),
    rows: checkedValues("row"),
    order: checkedValues("order")[0] ?? "chart",
    reviewOnly: $("review-only").checked,
  };

  if (target.name === "script" || target.name === "stage") renderRowChoices();
  storage.save("filters", state.filters);
  updateMatchCount();
}

function clearRows() {
  state.filters.rows = [];
  storage.save("filters", state.filters);
  renderRowChoices();
  updateMatchCount();
}

function resetProgress() {
  const ok = window.confirm("Reset all progress? Every card goes back to unseen. This can't be undone.");
  if (!ok) return;
  storage.resetProgress();
  updateMatchCount();
  renderHome();
  announce("Progress reset.");
}

// Saved filters from an older version may be missing fields; fill them in and
// make sure at least one script and stage is on.
function loadFilters() {
  const saved = { ...DEFAULT_FILTERS, ...storage.load("filters", {}) };
  if (!saved.scripts?.length) saved.scripts = [...DEFAULT_FILTERS.scripts];
  if (!saved.stages?.length) saved.stages = [...DEFAULT_FILTERS.stages];
  return saved;
}

// ======================================================================
// Study screen
// ======================================================================

// Build the deck and show the first card. Returns false if no cards match.
function startStudy() {
  state.deck = makeDeck();
  if (state.deck.length === 0) return false;
  state.index = 0;
  showCard();
  return true;
}

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
  if (state.flipped) storage.markSeen(card.id);
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
    if (e.key === "?") {
      toggleHelp();
      return;
    }

    // The study shortcuts only apply on the study screen with no dialog open.
    if ($("study-screen").hidden || $("settings").open) return;

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
      case "1":
        rate(false);
        break;
      case "2":
        rate(true);
        break;
    }
  });

  // Space on a focused button would also "click" it on key release; block that
  // on the study screen so Space always means "flip".
  document.addEventListener("keyup", (e) => {
    if (e.key === " " && !$("study-screen").hidden && e.target.closest?.("#study-screen button")) {
      e.preventDefault();
    }
  });
}

// ======================================================================
// Startup
// ======================================================================

async function start() {
  applyTheme(storage.load("theme", "system"));

  $("theme-toggle").addEventListener("click", toggleTheme);
  $("help-open").addEventListener("click", toggleHelp);

  try {
    state.cards = await loadCards();
  } catch (err) {
    const msg = $("load-error");
    msg.textContent =
      "Could not load the cards. Open the app through a local server " +
      "(for example: python -m http.server) rather than as a file.";
    msg.hidden = false;
    $("home-screen").hidden = true;
    console.error(err);
    return;
  }
  state.filters = loadFilters();

  // Home
  $("start").addEventListener("click", () => {
    state.openedStudyFromHome = true;
    location.hash = "#study";
  });
  $("open-settings").addEventListener("click", openSettings);
  $("go-home").addEventListener("click", goHome);

  // Settings
  form().addEventListener("change", onSettingsChange);
  $("all-rows").addEventListener("click", clearRows);
  $("reset-progress").addEventListener("click", resetProgress);
  $("settings").addEventListener("close", renderHome);

  // Study
  setUpCardGestures();
  setUpKeyboard();
  $("flip").addEventListener("click", flip);
  $("prev").addEventListener("click", () => go(-1));
  $("next").addEventListener("click", () => go(1));
  $("rate-learning").addEventListener("click", () => rate(false));
  $("rate-known").addEventListener("click", () => rate(true));

  window.addEventListener("hashchange", () => {
    if (location.hash !== "#study") state.openedStudyFromHome = false;
    route();
  });
  route();
}

start();
