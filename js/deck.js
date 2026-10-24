// Loading card data and building the deck the learner studies.
// Filtering and ordering live here, separate from how cards are drawn.

// Default view: Stage 1 hiragana, in chart order.
export const DEFAULT_FILTERS = {
  scripts: ["hiragana"],
  stages: [1],
  rows: [], // empty = all rows
  order: "chart", // "chart" or "shuffle"
  reviewOnly: false, // only cards last rated "Still learning"
};

export async function loadCards() {
  const response = await fetch("data/kana.json");
  if (!response.ok) {
    throw new Error(`Could not load card data (HTTP ${response.status})`);
  }
  return response.json();
}

// Return the cards that match the filters, in the chosen order.
// `progress` maps card id -> Leitner box (0 to 4); unrated cards are missing.
export function buildDeck(cards, filters, progress = {}) {
  const deck = cards.filter(
    (card) =>
      filters.scripts.includes(card.script) &&
      filters.stages.includes(card.stage) &&
      (filters.rows.length === 0 || filters.rows.includes(card.row)) &&
      (!filters.reviewOnly || progress[card.id] === 0)
  );
  return filters.order === "shuffle" ? weightedShuffle(deck, progress) : deck;
}

// The rows available for the chosen scripts and stages, in chart order,
// each with a label character (あ for the "a" row, きゃ for "kya", ...).
export function availableRows(cards, filters) {
  const rows = new Map();
  for (const card of cards) {
    if (!filters.scripts.includes(card.script) || !filters.stages.includes(card.stage)) continue;
    // The first card of each row gives its label; prefer hiragana when both scripts are on.
    const existing = rows.get(card.row);
    if (!existing || (existing.script !== "hiragana" && card.script === "hiragana")) {
      rows.set(card.row, { row: card.row, label: card.char, script: card.script });
    }
  }
  return [...rows.values()];
}

// Shuffle so cards in lower boxes (not known yet) tend to come first and
// therefore show up more often in a session. Unrated cards count as box 0.
//
// How it works: each card gets a random score, raised to 1/weight. Cards with a
// bigger weight get scores closer to 1, so they sort earlier more often.
// Weight: box 0 -> 5, box 1 -> 4, ... box 4 -> 1.
function weightedShuffle(list, progress) {
  return list
    .map((card) => {
      const weight = 5 - (progress[card.id] ?? 0);
      return { card, score: Math.random() ** (1 / weight) };
    })
    .sort((a, b) => b.score - a.score)
    .map((item) => item.card);
}
