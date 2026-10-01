// The one volume every cue plays under, as a step from 0 (silent) to 10 (full). Like
// highScores.js it imports nothing, never sees p5, and handles every storage failure itself, so
// a blocked or hand edited store costs the player their setting and nothing else.
//
// Constructed once in index.js, so it outlives every Game.

export const STORAGE_KEY = "asteroides.volume";
export const STORAGE_VERSION = 1;
export const MAX_STEP = 10;
const DEFAULT_STEP = 8;

function isStep(value) {
  return Number.isInteger(value) && value >= 0 && value <= MAX_STEP;
}

export default class Volume {
  // `onChange` receives the new output level whenever the step moves.
  constructor({ onChange = () => {} } = {}) {
    this.onChange = onChange;
    this.current = this.read();
  }

  get() {
    return this.current;
  }

  // Returns whether the step changed, so a press at either end can do nothing at all.
  set(step) {
    const next = Math.min(MAX_STEP, Math.max(0, Math.round(step)));
    if (next === this.current) return false;

    this.current = next;
    this.write();
    this.onChange(this.level());
    return true;
  }

  step(delta) {
    return this.set(this.current + delta);
  }

  // Squared so each step sounds like the same rise in loudness.
  level() {
    return (this.current / MAX_STEP) ** 2;
  }

  read() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return DEFAULT_STEP;

      const stored = JSON.parse(raw);
      if (!stored || stored.version !== STORAGE_VERSION) return DEFAULT_STEP;

      return isStep(stored.step) ? stored.step : DEFAULT_STEP;
    } catch (error) {
      return DEFAULT_STEP;
    }
  }

  write() {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ version: STORAGE_VERSION, step: this.current })
      );
    } catch (error) {
      // Not latching, as in highScores.js: the step holds for the page and the next change tries
      // to write again.
    }
  }
}
