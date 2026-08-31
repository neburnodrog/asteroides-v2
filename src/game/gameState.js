export default class GameState {
  constructor({ current = "menu", respawnDelayMs = 3000 } = {}) {
    this.current = current;
    // The state a fresh Game should start in, or null while no rebuild is due. index.js polls
    // this after every frame. Score, lives and level are not carried here: Run owns them and
    // outlives the rebuild.
    this.nextState = null;
    this.respawnDelayMs = respawnDelayMs;
    this._timer = null;
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
    this._timer = setTimeout(() => {
      this.nextState = "playing";
    }, this.respawnDelayMs);
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
