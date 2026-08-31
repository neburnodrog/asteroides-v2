const STARTING_LIVES = 3;

// Score, lives and level span a whole run, so they outlive every Game. Constructed once in
// index.js next to Input and SoundManager, and handed to each fresh Game.
export default class Run {
  constructor() {
    this.reset();
  }

  reset() {
    this.score = 0;
    this.lives = STARTING_LIVES;
    this.level = 1;
  }

  addPoints(points) {
    this.score += points;
  }

  // Spending a life and asking whether it was the last are one call, so no caller can read the
  // count and decide for itself. Returns true when the run is over.
  loseLife() {
    this.lives -= 1;
    return this.lives === 0;
  }

  nextLevel() {
    this.level += 1;
  }
}
