// Drawing a card on screen and flipping it.

const $ = (id) => document.getElementById(id);

// Fill the front and back of the card with one entry from kana.json.
export function renderCard(card) {
  const scriptName = card.script === "katakana" ? "Katakana" : "Hiragana";

  // Front
  $("front-script").textContent = scriptName;
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

  // Back: pronunciation tip (only some cards have one)
  $("tip").textContent = card.tip ?? "";
  $("tip").hidden = !card.tip;

  // Show the card's front again. "instant" stops it spinning back.
  setFlipped(false, { instant: true });
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
  const mark = document.createElement("mark");
  mark.textContent = target;
  return [word.slice(0, i), mark, word.slice(i + target.length)];
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
