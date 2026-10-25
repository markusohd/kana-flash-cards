// localStorage helpers.
// Every read and write is wrapped in try/catch so the app still works when
// storage is blocked (private browsing, strict settings, etc.).

const PREFIX = "kana:";

// Read a saved value, or return `fallback` if nothing is saved or storage fails.
export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

// Save a value (any JSON-friendly data). Fails silently if storage is blocked.
export function save(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Storage unavailable: progress just won't be remembered this time.
  }
}

// ---------- Progress (Leitner boxes 0 to 4, stored per card id) ----------

const MAX_BOX = 4;

export function getProgress() {
  return load("progress", {});
}

// known = true for "I know it" (move up one box), false for "Still learning" (box 0).
export function rateCard(id, known) {
  const progress = getProgress();
  const current = progress[id] ?? 0;
  progress[id] = known ? Math.min(current + 1, MAX_BOX) : 0;
  save("progress", progress);
  markSeen(id);
  return progress[id];
}

// ---------- Cards seen (flipped at least once), stored as a list of ids ----------

export function getSeen() {
  return new Set(load("seen", []));
}

export function markSeen(id) {
  const seen = getSeen();
  if (!seen.has(id)) {
    seen.add(id);
    save("seen", [...seen]);
  }
}

export function resetProgress() {
  save("progress", {});
  save("seen", []);
}
