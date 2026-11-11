// App startup and controls.
//
// Screens (chosen by the URL hash, so the phone's back button works):
//   (no hash)        landing page: choose Kana, Travel words or Travel phrases
//   #kana            a section's home: progress, Start, Settings
//   #kana/study      flash cards for that section
// The same goes for #words and #phrases.
//   #writing/practice[/<kana id>]  writing practice (optionally starting on one character)
//   #writing/quiz                   writing quiz

import { loadCards, buildDeck, availableRows, DEFAULT_FILTERS, DEFAULT_VOCAB_FILTERS } from "./deck.js";
import { renderCard, setFlipped } from "./card.js";
import * as storage from "./storage.js";
import { initWriting, startWriting } from "./writing.js";

const $ = (id) => document.getElementById(id);

// The four sections of the app.
const SECTIONS = {
  kana: {
    title: "Kana",
    jp: "かな",
    tileChar: "あ",
    description: "Hiragana and katakana: 208 cards with sounds-like hints, words and sentences.",
    file: "data/kana.json",
    type: "kana",
    filtersKey: "filters", // localStorage key for this section's settings
    defaults: DEFAULT_FILTERS,
    cardLabel: "",
  },
  words: {
    title: "Travel words",
    jp: "たんご",
    tileChar: "駅",
    description: "50 words for getting around, hotels, food, shopping and emergencies.",
    file: "data/words.json",
    type: "vocab",
    filtersKey: "filters-words",
    defaults: DEFAULT_VOCAB_FILTERS,
    cardLabel: "Travel word",
  },
  phrases: {
    title: "Travel phrases",
    jp: "フレーズ",
    tileChar: "話",
    description: "50 polite sentences for your trip, with a few Osaka touches.",
    file: "data/phrases.json",
    type: "vocab",
    filtersKey: "filters-phrases",
    defaults: DEFAULT_VOCAB_FILTERS,
    cardLabel: "Travel phrase",
  },
  writing: {
    title: "Writing",
    jp: "書く",
    tileChar: "書",
    description: "Write hiragana and katakana with your finger: stroke order, checking and a quiz.",
    file: null, // built at startup from kana.json + extra-kana.json
    type: "writing",
    filtersKey: "writing-filters",
    defaults: DEFAULT_FILTERS,
    cardLabel: "",
  },
};

// Writing: a character counts as "can write" from this progress box up.
const CAN_WRITE_BOX = 3;

const SCRIPT_NAMES = { hiragana: "Hiragana", katakana: "Katakana" };
const STAGE_NAMES = { 1: "Basic", 2: "Voiced", 3: "Combinations", 4: "Extended katakana" };

// Sections that use the script / stage / row settings.
const usesKanaFilters = () => ["kana", "writing"].includes(section().type);

const state = {
  data: {}, // section id -> list of cards
  sectionId: null, // current section ("kana", "words", "phrases")
  filters: null, // current section's settings
  deck: [], // cards currently being studied
  index: 0, // position in the deck
  flipped: false,
  trail: [], // hashes of screens we came from, so ‹ can use history.back()
};

const section = () => SECTIONS[state.sectionId];
const sectionCards = () => state.data[state.sectionId];
const currentCard = () => state.deck[state.index];
const makeDeck = () => buildDeck(sectionCards(), state.filters, storage.getProgress());
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

// ---------- Screen reader announcements ----------

function announce(message) {
  $("announcer").textContent = message;
}

// ======================================================================
// Screens and navigation
// ======================================================================

// "#kana/study" -> { sectionId: "kana", screen: "study" }
// "#writing/practice/h-ka" -> { sectionId: "writing", screen: "practice", startId: "h-ka" }
function parseHash() {
  const [id, sub, startId] = location.hash.replace(/^#/, "").split("/");
  if (!SECTIONS[id]) return { sectionId: null, screen: "landing" };
  const screens = SECTIONS[id].type === "writing" ? ["practice", "quiz"] : ["study"];
  return { sectionId: id, screen: screens.includes(sub) ? sub : "home", startId };
}

function route() {
  const { sectionId, screen, startId } = parseHash();

  // Back on a screen we came from (‹ or the phone's back button): drop it from the trail.
  if (state.trail.at(-1) === location.hash) state.trail.pop();

  if (screen === "landing") {
    showScreen("landing");
    renderLanding();
  } else {
    selectSection(sectionId);
    if (screen === "study" && startStudy()) {
      showScreen("study");
    } else if ((screen === "practice" || screen === "quiz") && startWritingScreen(screen, startId)) {
      showScreen("writing");
    } else {
      showScreen("home");
      renderHome();
    }
  }
}

// Move forward to another screen (adds a browser history entry).
function navigate(hash) {
  state.trail.push(location.hash);
  location.hash = hash;
}

// The ‹ button: one level up (study -> section home -> landing).
// If we got here from that parent screen, step back in history (so the phone's
// back button stays in step); otherwise replace this screen with the parent.
function goBack() {
  const { sectionId, screen } = parseHash();
  const parent = screen === "home" ? "" : `#${sectionId}`; // "" = landing page
  if (state.trail.at(-1) === parent) {
    history.back();
  } else {
    state.trail = [];
    location.replace(parent || "#");
  }
}

function showScreen(name) {
  $("landing-screen").hidden = name !== "landing";
  $("home-screen").hidden = name !== "home";
  $("study-screen").hidden = name !== "study";
  $("writing-screen").hidden = name !== "writing";
  $("go-back").hidden = name === "landing";
  $("counter").hidden = name !== "study" && name !== "writing";
  if (name !== "landing") {
    $("go-back").setAttribute("aria-label", name === "home" ? "Back to start" : `Back to ${section().title}`);
  }

  // Header title: the app on the landing page, otherwise the section name.
  const title = $("page-title");
  title.replaceChildren();
  const jp = document.createElement("span");
  jp.lang = "ja";
  if (name === "landing") {
    title.append("Learn Japanese ");
    jp.textContent = "にほんご";
  } else {
    title.append(`${section().title} `);
    jp.textContent = section().jp;
  }
  title.append(jp);
}

function selectSection(id) {
  if (state.sectionId === id) return;
  state.sectionId = id;
  state.filters = loadFilters(id);
}

// ======================================================================
// Landing page
// ======================================================================

function renderLanding() {
  const progress = storage.getProgress();
  $("tiles").replaceChildren(
    ...Object.entries(SECTIONS).map(([id, s]) => {
      const cards = state.data[id];
      const writing = s.type === "writing";
      const known = cards.filter((c) => (progress[c.id] ?? 0) >= (writing ? CAN_WRITE_BOX : 1)).length;

      const tile = document.createElement("a");
      tile.className = "tile";
      tile.href = `#${id}`;
      tile.innerHTML = `
        <span class="tile-char" lang="ja" aria-hidden="true"></span>
        <span class="tile-text">
          <strong></strong>
          <span class="tile-desc"></span>
          <span class="tile-progress"></span>
        </span>`;
      tile.querySelector(".tile-char").textContent = s.tileChar;
      tile.querySelector("strong").textContent = s.title;
      tile.querySelector(".tile-desc").textContent = s.description;
      tile.querySelector(".tile-progress").textContent = `${known} / ${cards.length} ${writing ? "can write" : "known"}`;
      tile.addEventListener("click", (e) => {
        e.preventDefault();
        navigate(`#${id}`);
      });
      return tile;
    })
  );
}

// ======================================================================
// Section home: progress summary and what is being studied
// ======================================================================

function renderHome() {
  const progress = storage.getProgress();
  const seen = storage.getSeen();

  // Kana and writing: one progress row per script. Words / phrases: one row.
  const writing = section().type === "writing";
  const groups =
    usesKanaFilters()
      ? ["hiragana", "katakana"].map((script) => ({
          name: SCRIPT_NAMES[script],
          cards: sectionCards().filter((c) => c.script === script),
        }))
      : [{ name: section().title, cards: sectionCards() }];

  $("progress-list").replaceChildren(
    ...groups.map(({ name, cards }) => {
      const nSeen = cards.filter((c) => seen.has(c.id)).length;
      const nKnown = cards.filter((c) => (progress[c.id] ?? 0) >= (writing ? CAN_WRITE_BOX : 1)).length;

      const row = document.createElement("div");
      row.className = "progress-row";
      row.innerHTML = `
        <div class="progress-head">
          <strong></strong>
          <span><span class="seen"></span> <span class="seen-word">seen</span> · <span class="known"></span> <span class="known-word">known</span></span>
        </div>
        <progress></progress>`;
      row.querySelector("strong").textContent = name;
      row.querySelector(".seen").textContent = `${nSeen} / ${cards.length}`;
      row.querySelector(".known").textContent = nKnown;
      if (writing) {
        row.querySelector(".seen-word").textContent = "practised";
        row.querySelector(".known-word").textContent = "can write";
      }
      const bar = row.querySelector("progress");
      bar.max = cards.length;
      bar.value = nKnown;
      bar.setAttribute("aria-label", `${name}: ${nKnown} of ${cards.length} ${writing ? "can write" : "known"}`);
      return row;
    })
  );

  const count = makeDeck().length;
  $("deck-summary").textContent = `${describeFilters()} · ${plural(count, writing ? "character" : "card")}`;
  $("start").disabled = count === 0;
  $("start").textContent = writing ? "Start practice" : "Start";
  $("start-quiz").hidden = !writing;
  $("start-quiz").disabled = count === 0;
  $("writing-panel").hidden = !writing;
  if (writing) renderWritingChart(progress, seen);
  if (count === 0 && state.filters.reviewOnly) {
    $("deck-summary").textContent += ". No cards are marked “Still learning” yet.";
  }
}

// e.g. "Hiragana + Katakana · Basic, Voiced · あ か rows · Shuffled · Review only"
//   or "Japanese first · List order · Review only"
function describeFilters() {
  const f = state.filters;
  const parts = [];
  if (usesKanaFilters()) {
    parts.push(f.scripts.map((s) => SCRIPT_NAMES[s]).join(" + "));
    parts.push(f.stages.map((s) => STAGE_NAMES[s]).join(", "));
    if (f.rows.length > 0) {
      const labels = availableRows(sectionCards(), f)
        .filter((r) => f.rows.includes(r.row))
        .map((r) => r.label);
      parts.push(`${labels.join(" ")} row${labels.length === 1 ? "" : "s"}`);
    }
    parts.push(f.order === "shuffle" ? "Shuffled" : "Chart order");
  } else {
    parts.push(f.front === "en" ? "English first" : "Japanese first");
    parts.push(f.order === "shuffle" ? "Shuffled" : "List order");
  }
  if (f.reviewOnly) parts.push("Review only");
  return parts.join(" · ");
}

// ======================================================================
// Settings (for the current section)
// ======================================================================

const form = () => $("settings").querySelector("form");

function openSettings() {
  const f = state.filters;
  const type = section().type;

  // Show only the settings this section has.
  for (const el of form().querySelectorAll("[data-for]")) {
    el.hidden = !el.dataset.for.split(" ").includes(type);
  }
  $("settings-title").textContent = `${section().title} settings`;
  $("order-label").textContent = usesKanaFilters() ? "Chart order" : "List order";

  if (usesKanaFilters()) {
    for (const box of form().querySelectorAll('[name="script"]')) box.checked = f.scripts.includes(box.value);
    for (const box of form().querySelectorAll('[name="stage"]')) box.checked = f.stages.includes(Number(box.value));
    renderRowChoices();
    updateStage4Choice();
  } else {
    for (const radio of form().querySelectorAll('[name="front"]')) radio.checked = radio.value === f.front;
  }
  for (const radio of form().querySelectorAll('[name="order"]')) radio.checked = radio.value === f.order;
  $("review-only").checked = f.reviewOnly;
  updateMatchCount();
  $("settings").showModal();
}

// Writing: the "Extended katakana" stage only makes sense with katakana on.
function updateStage4Choice() {
  const chip = form().querySelector('[name="stage"][value="4"]').closest("label");
  chip.hidden = section().type !== "writing" || !state.filters.scripts.includes("katakana");
}

// Row chips depend on which scripts and stages are on (kana only).
function renderRowChoices() {
  const rows = availableRows(sectionCards(), state.filters);
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
    n === 0 ? "No cards match these settings." : `${plural(n, "card")} match these settings.`;
  $("match-count").classList.toggle("warn", n === 0);
}

// Read every control back into state.filters and save.
function onSettingsChange(event) {
  const target = event.target;
  const checkedValues = (name) =>
    [...form().querySelectorAll(`[name="${name}"]:checked`)].map((el) => el.value);

  const common = {
    order: checkedValues("order")[0] ?? "chart",
    reviewOnly: $("review-only").checked,
  };

  if (usesKanaFilters()) {
    // Keep at least one script and one stage switched on.
    if ((target.name === "script" || target.name === "stage") && checkedValues(target.name).length === 0) {
      target.checked = true;
    }
    let stages = checkedValues("stage").map(Number);
    // Extended katakana (stage 4, writing only) switches off with katakana.
    if (section().type !== "writing" || !checkedValues("script").includes("katakana")) {
      stages = stages.filter((s) => s !== 4);
      form().querySelector('[name="stage"][value="4"]').checked = false;
      if (stages.length === 0) {
        stages = [1];
        form().querySelector('[name="stage"][value="1"]').checked = true;
      }
    }
    state.filters = {
      scripts: checkedValues("script"),
      stages,
      rows: checkedValues("row"),
      ...common,
    };
    if (target.name === "script" || target.name === "stage") {
      renderRowChoices();
      updateStage4Choice();
    }
  } else {
    state.filters = { front: checkedValues("front")[0] ?? "ja", ...common };
  }

  storage.save(section().filtersKey, state.filters);
  updateMatchCount();
}

function clearRows() {
  state.filters.rows = [];
  storage.save(section().filtersKey, state.filters);
  renderRowChoices();
  updateMatchCount();
}

function resetProgress() {
  const ok = window.confirm(
    `Reset progress for ${section().title}? Every card in this section goes back to unseen. This can't be undone.`
  );
  if (!ok) return;
  storage.resetProgress(sectionCards().map((c) => c.id));
  updateMatchCount();
  renderHome();
  announce("Progress reset.");
}

// Saved settings from an older version may be missing fields; fill them in.
function loadFilters(id) {
  const { defaults, filtersKey, type } = SECTIONS[id];
  const saved = { ...defaults, ...storage.load(filtersKey, {}) };
  if (type === "kana" || type === "writing") {
    if (!saved.scripts?.length) saved.scripts = [...defaults.scripts];
    if (!saved.stages?.length) saved.stages = [...defaults.stages];
  }
  return saved;
}

// ======================================================================
// Writing: character chart on the section home, and the writing screen
// ======================================================================

// Every character in the current settings, coloured by progress. Tap to practise it.
function renderWritingChart(progress, seen) {
  const level = (card) => {
    if (!seen.has(card.id) && progress[card.id] === undefined) return "not-started";
    return (progress[card.id] ?? 0) >= CAN_WRITE_BOX ? "can-write" : "learning";
  };
  const LEVEL_NAMES = { "not-started": "not started", learning: "learning", "can-write": "can write" };
  const cards = buildDeck(sectionCards(), { ...state.filters, order: "chart", reviewOnly: false });
  $("writing-chart").replaceChildren(
    ...cards.map((card) => {
      const button = document.createElement("button");
      button.type = "button";
      button.lang = "ja";
      button.className = `chart-char ${level(card)}`;
      button.textContent = card.char;
      button.setAttribute("aria-label", `${card.char} (${card.romaji}), ${LEVEL_NAMES[level(card)]}`);
      button.addEventListener("click", () => navigate(`#writing/practice/${card.id.replace(/^wr:/, "")}`));
      return button;
    })
  );
}

// Start practice or quiz. Returns false if no characters match the settings.
function startWritingScreen(mode, startId) {
  const progress = storage.getProgress();
  let deck =
    mode === "quiz"
      ? buildDeck(sectionCards(), { ...state.filters, order: "shuffle" }, progress) // weak ones more often
      : makeDeck();
  let index = 0;
  if (mode === "practice" && startId) {
    index = deck.findIndex((c) => c.id === `wr:${startId}`);
    if (index === -1) {
      // Not in the current settings (e.g. an old link): practise just that character.
      const card = sectionCards().find((c) => c.id === `wr:${startId}`);
      deck = card ? [card] : deck;
      index = 0;
    }
  }
  if (deck.length === 0) return false;
  startWriting(mode, deck, index);
  return true;
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
  renderCard(currentCard(), {
    type: section().type,
    front: state.filters.front,
    label: section().cardLabel,
  });
  state.flipped = false;
  $("counter").textContent = `${state.index + 1} / ${state.deck.length}`;
}

function flip() {
  state.flipped = !state.flipped;
  setFlipped(state.flipped);
  const card = currentCard();
  if (state.flipped) storage.markSeen(card.id);

  let backText;
  if (section().type === "kana") {
    backText = `${card.romaji}. Example: ${card.word.romaji}, ${card.word.en}.`;
  } else {
    backText = `${card.romaji}. ${card.en}`;
  }
  announce(state.flipped ? `Back of card: ${backText}` : "Front of card.");
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
    // Buttons and the "How it's built" section have their own tap actions.
    if (e.target.closest("button, details")) return;
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
    const ids = Object.keys(SECTIONS).filter((id) => SECTIONS[id].file);
    const [lists, extra, strokes] = await Promise.all([
      Promise.all(ids.map((id) => loadCards(SECTIONS[id].file))),
      loadCards("data/extra-kana.json"),
      loadCards("data/strokes.json"),
    ]);
    ids.forEach((id, i) => (state.data[id] = lists[i]));
    // Writing uses every kana plus the extended katakana, with its own progress ids.
    state.data.writing = [...state.data.kana, ...extra].map((c) => ({ ...c, id: `wr:${c.id}` }));
    initWriting({ strokes, announce });
  } catch (err) {
    const msg = $("load-error");
    msg.textContent =
      "Could not load the cards. Open the app through a local server " +
      "(for example: python -m http.server) rather than as a file.";
    msg.hidden = false;
    console.error(err);
    return;
  }

  // Header and section home
  $("go-back").addEventListener("click", goBack);
  $("start").addEventListener("click", () =>
    navigate(`#${state.sectionId}/${section().type === "writing" ? "practice" : "study"}`)
  );
  $("start-quiz").addEventListener("click", () => navigate(`#${state.sectionId}/quiz`));
  $("open-settings").addEventListener("click", openSettings);

  // Settings
  form().addEventListener("change", onSettingsChange);
  $("all-rows").addEventListener("click", clearRows);
  $("reset-progress").addEventListener("click", resetProgress);
  $("settings").addEventListener("close", renderHome);

  // Study
  // Remember whether "How it's built" is left open, for every card.
  $("built").open = storage.load("builtOpen", false);
  $("built").addEventListener("toggle", () => storage.save("builtOpen", $("built").open));
  setUpCardGestures();
  setUpKeyboard();
  $("flip").addEventListener("click", flip);
  $("prev").addEventListener("click", () => go(-1));
  $("next").addEventListener("click", () => go(1));
  $("rate-learning").addEventListener("click", () => rate(false));
  $("rate-known").addEventListener("click", () => rate(true));

  window.addEventListener("hashchange", route);
  route();
  registerServiceWorker();
}

// Offline support: sw.js keeps a copy of the app on the device.
// Browsers only allow this on https:// sites and on localhost.
function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("sw.js").catch((err) => {
    console.warn("Offline support unavailable:", err);
  });
}

start();
