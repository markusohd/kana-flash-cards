// Loading card data and building the deck the learner studies.
// Filtering and ordering live here, separate from how cards are drawn.

// Default view: Stage 1 hiragana, in chart order.
export const DEFAULT_FILTERS = {
  scripts: ["hiragana"],
  stages: [1],
  rows: [], // empty = all rows
  order: "chart", // "chart" or "shuffle"
};

export async function loadCards() {
  const response = await fetch("data/kana.json");
  if (!response.ok) {
    throw new Error(`Could not load card data (HTTP ${response.status})`);
  }
  return response.json();
}

// Return the cards that match the filters, in the chosen order.
export function buildDeck(cards, filters = DEFAULT_FILTERS) {
  const deck = cards.filter(
    (card) =>
      filters.scripts.includes(card.script) &&
      filters.stages.includes(card.stage) &&
      (filters.rows.length === 0 || filters.rows.includes(card.row))
  );
  return filters.order === "shuffle" ? shuffle(deck) : deck;
}

// Fisher–Yates shuffle (returns a new array).
function shuffle(list) {
  const result = [...list];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
