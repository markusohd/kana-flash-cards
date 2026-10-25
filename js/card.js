// Drawing a card on screen and flipping it.
// Two kinds of card share the same flip card:
//   "kana"  – a character with its sounds-like hints, sample word and sentence
//   "vocab" – a travel word or phrase (Japanese or English on the front)

const $ = (id) => document.getElementById(id);

// Fill the card with one entry. `type` is "kana" or "vocab";
// `front` ("ja" or "en") chooses what a vocab card shows first.
export function renderCard(card, { type, front = "ja", label = "" }) {
  const isKana = type === "kana";
  $("front-char").hidden = !isKana;
  $("vocab-front").hidden = isKana;
  $("back-kana").hidden = !isKana;
  $("back-vocab").hidden = isKana;

  if (isKana) renderKana(card);
  else renderVocab(card, front, label);

  // Show the card's front again. "instant" stops it spinning back.
  setFlipped(false, { instant: true });
}

function renderKana(card) {
  // Front
  $("front-label").textContent = card.script === "katakana" ? "Katakana" : "Hiragana";
  $("front-char").textContent = card.char;
  $("front-char").classList.toggle("two", card.char.length > 1);

  // Back: reading
  $("back-char").textContent = card.char;
  $("back-romaji").textContent = card.romaji;

  // Back: Filipino / English words with a similar sound
  $("sounds-list").replaceChildren(...soundsLikeRows(card.soundsLike));

  // Back: sample word, with the target character highlighted
  $("word-kana").replaceChildren(...highlight(card.word.kana, card.char));
  $("word-kana").style.setProperty("--chars", card.word.kana.length); // for font sizing
  $("word-kanji").textContent = card.word.kanji ?? "";
  $("word-kanji").hidden = !card.word.kanji;
  $("word-romaji").textContent = card.word.romaji;
  $("word-en").textContent = card.word.en;

  // Back: a full sentence, with the sample word highlighted
  $("sentence-kana").replaceChildren(...highlightIgnoringSpaces(card.sentence.kana, card.word.kana));
  $("sentence-kanji").textContent = card.sentence.kanji;
  $("sentence-romaji").textContent = card.sentence.romaji;
  $("sentence-en").textContent = card.sentence.en;

  // "How it's built": each word with its meaning, the pattern, and a swap example
  $("parts-list").replaceChildren(
    ...card.sentence.parts.flatMap(([kana, meaning]) => {
      const dt = document.createElement("dt");
      dt.lang = "ja";
      dt.textContent = kana;
      const dd = document.createElement("dd");
      dd.textContent = meaning;
      return [dt, dd];
    })
  );
  $("pattern-ja").textContent = card.sentence.pattern;
  $("pattern-en").textContent = card.sentence.patternEn;
  $("swap-kana").textContent = card.sentence.swap.kana;
  $("swap-en").textContent = card.sentence.swap.en;

  // Back: pronunciation tip (only some cards have one)
  $("tip").textContent = card.tip ?? "";
  $("tip").hidden = !card.tip;
}

function renderVocab(card, front, label) {
  const isPhrase = card.id.startsWith("p-");

  // Front: the Japanese (kana) or the English, depending on the setting
  const main = $("vocab-front");
  main.textContent = front === "en" ? card.en : card.kana;
  main.lang = front === "en" ? "en" : "ja";
  main.classList.toggle("phrase", isPhrase);
  main.classList.toggle("english", front === "en");
  $("front-label").textContent = front === "en" ? `${label} · Say it in Japanese` : label;

  // Back: everything
  $("vb-category").textContent = card.category;
  $("vb-kana").textContent = card.kana;
  $("vb-kana").classList.toggle("phrase", isPhrase);
  $("vb-kanji").textContent = card.kanji ?? "";
  $("vb-kanji").hidden = !card.kanji;
  $("vb-romaji").textContent = card.romaji;
  $("vb-en").textContent = card.en;
  $("vb-note").textContent = card.note ?? "";
  $("vb-note").hidden = !card.note;
}

// Build the "Sounds like" rows as <dt>label</dt><dd>content</dd> pairs, e.g.
//   Filipino   kain (to eat)      with "ka" highlighted
//   English    car                with "ca" highlighted
//   Built from ひ (hi) + や (ya), said as one beat     (combinations only)
function soundsLikeRows(sounds) {
  const rows = [];
  const addRow = (label, lang, children) => {
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    if (lang) dd.lang = lang;
    dd.append(...children);
    rows.push(dt, dd);
  };

  if (sounds.fil) {
    const meaning = document.createElement("span");
    meaning.className = "meaning";
    meaning.lang = "en";
    meaning.textContent = ` (${sounds.fil.en})`;
    addRow("Filipino", "fil", [...highlight(sounds.fil.word, sounds.fil.part), meaning]);
  }
  if (sounds.en) {
    addRow("English", "en", highlight(sounds.en.word, sounds.en.part));
  }
  if (sounds.blend) {
    addRow("Built from", null, [`${sounds.blend}, said as one beat`]);
  }
  return rows;
}

// Split the word into [before, <mark>char</mark>, after].
// For very rare kana the sample word uses the other script (ヲ card -> を in みずをのむ),
// so look for that version too.
function highlight(word, char) {
  let target = char;
  let i = word.indexOf(target);
  if (i === -1) {
    target = otherScript(char);
    i = word.indexOf(target);
  }
  if (i === -1) return [word];
  return [word.slice(0, i), mark(target), word.slice(i + target.length)];
}

// Like highlight(), but the sentence has spaces between words and the target
// may not (みずをのむ inside "みずを のむ"), so spaces are skipped while matching.
function highlightIgnoringSpaces(sentence, target) {
  // Remember where each non-space character sits in the original sentence.
  const positions = [];
  let compact = "";
  for (let i = 0; i < sentence.length; i++) {
    if (sentence[i] !== " ") {
      positions.push(i);
      compact += sentence[i];
    }
  }
  const wanted = target.replaceAll(" ", "");
  const start = compact.indexOf(wanted);
  if (start === -1) return [sentence];

  const from = positions[start];
  const to = positions[start + wanted.length - 1] + 1;
  return [sentence.slice(0, from), mark(sentence.slice(from, to)), sentence.slice(to)];
}

function mark(text) {
  const el = document.createElement("mark");
  el.textContent = text;
  return el;
}

// Swap hiragana <-> katakana. They sit 0x60 apart in Unicode (あ U+3042, ア U+30A2).
function otherScript(text) {
  return [...text]
    .map((ch) => {
      const code = ch.codePointAt(0);
      if (code >= 0x3041 && code <= 0x3096) return String.fromCodePoint(code + 0x60);
      if (code >= 0x30a1 && code <= 0x30f6) return String.fromCodePoint(code - 0x60);
      return ch;
    })
    .join("");
}

// Turn the card to its back (true) or front (false).
export function setFlipped(flipped, { instant = false } = {}) {
  const cardEl = $("card");

  if (instant) {
    cardEl.classList.add("no-anim");
  }
  cardEl.classList.toggle("flipped", flipped);

  // `inert` hides the face that is turned away from keyboards and screen readers.
  $("face-front").inert = flipped;
  $("face-back").inert = !flipped;
  $("rating").inert = !flipped;
  $("flip").textContent = flipped ? "Flip back" : "Flip";

  if (instant) {
    // Re-enable the animation after the browser has drawn the change.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => cardEl.classList.remove("no-anim"))
    );
  }
}
