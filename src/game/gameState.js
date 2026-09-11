// Three seconds at 60fps. Counted in frames, not wall time, so a death is exactly reproducible
// under a stepped test and the engine holds no timer.
const MINIMUM_DEATH_FRAMES = 180;
// The tail of the death, during which the ship's outline blinks at the point it will appear.
const BLINK_FRAMES = 30;

export default class GameState {
  constructor({ current = "menu", minimumDeathFrames = MINIMUM_DEATH_FRAMES } = {}) {
    this.current = current;
    // The state a fresh Game should start in, or null while no rebuild is due. index.js polls
    // this after every frame. A death never sets it: the field survives a death, so the Game
    // survives it too. Score, lives and level are not carried here either: Run owns them and
    // outlives the rebuild.
    this.nextState = null;
    this.minimumDeathFrames = minimumDeathFrames;
    this.deathFrames = 0;
    this.spawnPoint = null;
    this.blinkFramesLeft = 0;
  }

  startPlaying() {
    if (this.current === "menu") this.current = "playing";
  }

  shipDied({ wasFinalDeath }) {
    if (this.current !== "playing") return;

    if (wasFinalDeath) {
      this.current = "gameOver";
      return;
    }

    this.current = "dying";
    this.deathFrames = 0;
    this.spawnPoint = null;
    this.blinkFramesLeft = 0;
  }

  // One frame of the death. `findClearing` is asked for a point only on the frames a search is
  // due, and answers null while the field has no clear point. Searching from BLINK_FRAMES
  // before the minimum is what lets a quiet field rebuild after exactly the minimum: the search
  // succeeds, the outline blinks, and the ship is back as the minimum runs out.
  //
  // Returns true on the frame the ship comes back, when spawnPoint is where to rebuild it.
  advanceDeath(findClearing) {
    if (this.current !== "dying") return false;

    this.deathFrames += 1;

    if (this.spawnPoint === null) {
      if (this.deathFrames < this.minimumDeathFrames - BLINK_FRAMES) return false;

      const clearing = findClearing();
      if (!clearing) return false;

      this.spawnPoint = clearing;
      this.blinkFramesLeft = BLINK_FRAMES;
      return false;
    }

    this.blinkFramesLeft -= 1;
    if (this.blinkFramesLeft > 0) return false;

    this.current = "playing";
    return true;
  }

  levelCleared() {
    if (this.current === "playing") this.current = "levelComplete";
  }

  acknowledgeLevelUp() {
    if (this.current !== "levelComplete") return;
    this.nextState = "playing";
  }

  acknowledgeGameOver() {
    if (this.current !== "gameOver") return;
    this.nextState = "menu";
  }

  isPlaying() {
    return this.current === "playing";
  }

  isDying() {
    return this.current === "dying";
  }
}
