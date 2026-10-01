// A death is an absence then a ghost, both counted in frames rather than wall time, so a death
// is exactly reproducible under a stepped test and the engine holds no timer.
//
// Absence: two seconds with no ship on the canvas. Ghost: two seconds during which the ship is
// back at the point it died, flyable but neither killable nor able to shoot.
const ABSENCE_FRAMES = 120;
const GHOST_FRAMES = 120;
// Added once, in full, when an asteroid overlaps the ship on the frame the ghost would end. A
// ghost therefore runs GHOST_FRAMES or GHOST_FRAMES + GHOST_GRACE_FRAMES and nothing between.
const GHOST_GRACE_FRAMES = 60;

// The blink interval in frames at the start and the end of the ghost, and the opacity it fades
// in from. Both run off one curve, the fraction of the ghost already spent.
const BLINK_INTERVAL_START = 20;
const BLINK_INTERVAL_END = 4;
const GHOST_OPACITY_START = 0.25;

const PAUSABLE = ["playing", "dying", "ghost"];

export default class GameState {
  constructor({ current = "menu", absenceFrames = ABSENCE_FRAMES } = {}) {
    this.current = current;
    // The state a fresh Game should start in, or null while no rebuild is due. index.js polls
    // this after every frame. A death never sets it: the field survives a death, so the Game
    // survives it too. Score, lives and level are not carried here either: Run owns them and
    // outlives the rebuild.
    this.nextState = null;
    this.absenceFrames = absenceFrames;
    this.ghostWindow = GHOST_FRAMES;
    this.deathFrames = 0;
    this.returnPoint = null;
    this.ghostFrames = 0;
    this.ghostLength = 0;
    this.blinkPhase = 0;
    // Which of PAUSABLE a pause came from, or null while not paused. Nothing else is saved,
    // because nothing else changes while paused: the death counters only move in advanceDeath.
    this.pausedFrom = null;
  }

  pause() {
    if (!PAUSABLE.includes(this.current)) return;
    this.pausedFrom = this.current;
    this.current = "paused";
  }

  resume() {
    if (this.current !== "paused") return;
    this.current = this.pausedFrom;
    this.pausedFrom = null;
  }

  isPaused() {
    return this.current === "paused";
  }

  // A paused ghost is still drawn as the ghost it was.
  showsGhost() {
    return this.current === "ghost" || this.pausedFrom === "ghost";
  }

  startPlaying() {
    if (this.current === "menu") this.current = "playing";
  }

  // The return point is where the ship died, in canvas coordinates. Nothing revalidates it on a
  // resize, which is the accepted gap in ADR-0002.
  shipDied({ wasFinalDeath, returnPoint }) {
    if (this.current !== "playing" && this.current !== "ghost") return;

    if (wasFinalDeath) {
      this.current = "gameOver";
      return;
    }

    this.current = "dying";
    this.deathFrames = 0;
    this.returnPoint = returnPoint;
    this.ghostFrames = 0;
    this.ghostLength = 0;
    this.blinkPhase = 0;
  }

  // One frame of the death, covering both phases. `isShipOverlapping` is asked only on the one
  // frame the ghost would end, and decides whether the grace runs.
  //
  // Returns what the caller has to do about it: "return" to put the ship back at returnPoint,
  // "kill" to run an ordinary death because the grace ran out on an overlap, or null.
  advanceDeath(isShipOverlapping) {
    if (this.current === "dying") return this.advanceAbsence();
    if (this.current === "ghost") return this.advanceGhost(isShipOverlapping);
    return null;
  }

  advanceAbsence() {
    this.deathFrames += 1;
    if (this.deathFrames < this.absenceFrames) return null;

    this.current = "ghost";
    this.ghostFrames = 0;
    this.ghostLength = this.ghostWindow;
    this.blinkPhase = 0;
    return "return";
  }

  advanceGhost(isShipOverlapping) {
    // The blink stops advancing once the base window is spent, so an extension holds the last
    // state the player saw rather than blinking on through the grace.
    if (this.ghostFrames < this.ghostWindow) {
      this.blinkPhase += 1 / this.blinkInterval();
    }

    this.ghostFrames += 1;
    if (this.ghostFrames < this.ghostLength) return null;

    const overlapping = isShipOverlapping();

    if (overlapping && this.ghostLength === this.ghostWindow) {
      this.ghostLength += GHOST_GRACE_FRAMES;
      return null;
    }

    if (overlapping) return "kill";

    this.current = "playing";
    return null;
  }

  // 0 on the frame the ghost begins, approaching but never reaching 1. Both endpoints are
  // approached rather than met: the blink bottoms out at 4.1 frames and the fade at 0.99. That
  // is what leaves the fade below full opacity for the whole of a grace extension, which is the
  // requirement the endpoints give way to.
  ghostProgress() {
    if (!this.showsGhost()) return 1;
    return Math.min(this.ghostFrames, this.ghostWindow - 1) / this.ghostWindow;
  }

  blinkInterval() {
    const progress = this.ghostProgress();
    return (
      BLINK_INTERVAL_START +
      (BLINK_INTERVAL_END - BLINK_INTERVAL_START) * progress
    );
  }

  // The ghost's opacity as a fraction of full, or null on the frames the blink is dark. 1
  // whenever there is no ghost, so a caller renders the ship normally without asking twice.
  ghostAlpha() {
    if (!this.showsGhost()) return 1;
    if (Math.floor(this.blinkPhase) % 2 === 1) return null;
    return GHOST_OPACITY_START + (1 - GHOST_OPACITY_START) * this.ghostProgress();
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

  isGameOver() {
    return this.current === "gameOver";
  }

  isGhost() {
    return this.current === "ghost";
  }
}
