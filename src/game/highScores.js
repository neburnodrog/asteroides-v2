// The ten best runs on this browser, best first. The only module in src/ that touches
// localStorage, so every storage failure is handled in one place. Imports nothing and never sees
// p5, like run.js and collisions.js, so it can be reasoned about without a canvas.
//
// Constructed once in index.js next to Run, Input and SoundManager, so it outlives every Game.

export const STORAGE_KEY = "asteroides.highScores";
// A stored table carrying any other version is discarded. Bump this when the shape of an entry
// changes, so an old value is a decision rather than a corruption.
const STORAGE_VERSION = 1;
const MAX_ENTRIES = 10;

function isCount(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isEntry(entry) {
  if (!entry || typeof entry !== "object") return false;
  return isCount(entry.score) && isCount(entry.level);
}

// Anything that is not a pair of finite non-negative numbers is dropped, so a hand edited value
// cannot reach a screen's draw call.
function sanitise(entries) {
  if (!Array.isArray(entries)) return [];

  return entries
    .filter(isEntry)
    .map(({ score, level }) => ({ score, level }))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_ENTRIES);
}

function qualifies(score, table) {
  if (!Number.isFinite(score) || score <= 0) return false;
  if (table.length < MAX_ENTRIES) return true;
  return score > table[table.length - 1].score;
}

export default class HighScores {
  constructor() {
    this.table = this.read();
  }

  entries() {
    return this.table.map((entry) => ({ ...entry }));
  }

  // Inserts when the score qualifies, keeps the table to the ten best and writes it. Returns the
  // 1 based rank, or null when the score does not qualify. Mirrors Run.loseLife: the caller gets
  // the verdict rather than the numbers to decide for itself.
  record(score, level) {
    if (!qualifies(score, this.table)) return null;

    // A tie ranks below the run that got there first, so the place is the first entry this score
    // beats outright.
    const beaten = this.table.findIndex((entry) => score > entry.score);
    const place = beaten === -1 ? this.table.length : beaten;

    this.table.splice(place, 0, { score, level });
    this.table.length = Math.min(this.table.length, MAX_ENTRIES);

    this.write();
    return place + 1;
  }

  clear() {
    this.table = [];
    this.write();
  }

  read() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];

      const stored = JSON.parse(raw);
      if (!stored || stored.version !== STORAGE_VERSION) return [];

      return sanitise(stored.entries);
    } catch (error) {
      // A blocked origin throws on read and a hand edited value throws on parse. Either way the
      // player starts with an empty table rather than a game that will not boot.
      return [];
    }
  }

  write() {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ version: STORAGE_VERSION, entries: this.table })
      );
    } catch (error) {
      // A private window throws on write. The in memory table still holds the new entry, so the
      // menu fills in for the rest of the page, and the next write is attempted normally rather
      // than being disabled after one failure.
    }
  }
}
