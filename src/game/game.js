/** STATES */
import GameOverScreen from "./state/gameOverScreen";
import { StartMenuScreen, LevelUpScreen } from "./state/startMenuScreen";
import GameState from "./gameState";
import { shipVsAsteroids, shotsVsAsteroids } from "./collisions";
import { findClearing } from "./clearing";

/** GAME ELEMENTS */
import Ship from "./elements/ship";
import Scoreboard from "./elements/scoreboard";
import Asteroids from "./elements/asteroids";

// The clearing the ship comes back into: nothing inside this radius, and nothing due to enter
// it within this many frames. The look ahead covers the 30 blinking frames plus one second of
// play, which is player reaction time rather than ship acceleration.
const CLEARING_RADIUS = 300;
const CLEARING_LOOK_AHEAD = 90;

const ASTEROID_HITS = {
  X: { points: 20, sound: "asteroidBreakL" },
  M: { points: 50, sound: "asteroidBreakM" },
  S: { points: 75, sound: "asteroidBreakS" },
};

export default class Game {
  constructor(p5, soundManager, input, run, current, images) {
    this.p5 = p5;
    this.soundManager = soundManager;
    this.input = input;
    this.run = run;

    this.state = new GameState({ current });

    /** VIEWS */
    this.gameOverScreen = new GameOverScreen(p5, this);
    this.startMenuScreen = new StartMenuScreen(p5, this);
    this.levelUpScreen = new LevelUpScreen(p5, this);
    this.scoreboard = new Scoreboard(p5, images.heart);

    /** GAME ELEMENTS */
    this.ship = new Ship(p5, this, images.ship);
    this.asteroids = new Asteroids(p5, run.level);
  }

  checkForHits() {
    const hits = shotsVsAsteroids(this.ship.shots, this.asteroids.array);

    for (const { shot, asteroid } of hits) {
      asteroid.exploded = true;
      shot.hit = true;

      const rule = ASTEROID_HITS[asteroid.size];
      if (rule) {
        this.soundManager.play(rule.sound);
        this.run.addPoints(rule.points);
      }
    }
  }

  checkIfExplodedAsteroids() {
    let explodedAsteroids = this.asteroids.array.filter(
      (asteroid) => asteroid.exploded
    );
    this.asteroids.handleExplodedAsteroids(explodedAsteroids);
    this.asteroids.cleanExplodedAsteroids();
  }

  checkIfLevelCompleted() {
    if (!this.state.isPlaying()) return;
    if (this.asteroids.array.length === 0) {
      this.state.levelCleared();
      this.run.nextLevel();

      if (this.soundManager) {
        this.soundManager.play("levelUp");
      }
    }
  }

  findClearing() {
    return findClearing({
      asteroids: this.asteroids.array,
      width: this.p5.width,
      height: this.p5.height,
      radius: CLEARING_RADIUS,
      lookAhead: CLEARING_LOOK_AHEAD,
    });
  }

  // A death keeps the field, so it rebuilds the ship in place rather than the Game. The search
  // runs once per frame from the moment the state asks for it until it returns a point.
  advanceDeath() {
    if (this.state.advanceDeath(() => this.findClearing())) {
      this.ship.rebuildAt(this.state.spawnPoint);
    }
  }

  checkIfCollisions() {
    if (!this.state.isPlaying()) return;

    const hit = shipVsAsteroids(this.ship, this.asteroids.array);
    if (!hit) return;

    this.ship.handleExplosion();

    if (this.soundManager) {
      this.soundManager.play("shipExplosion");
    }

    const wasFinalDeath = this.run.loseLife();
    this.state.shipDied({ wasFinalDeath });

    if (wasFinalDeath && this.soundManager) {
      this.soundManager.play("gameOver");
    }
  }

  // DRAW
  playGame() {
    this.p5.frameRate(60);
    // CHECK STATES
    this.checkIfCollisions();
    this.checkForHits();
    this.checkIfExplodedAsteroids();
    this.advanceDeath();
    this.checkIfLevelCompleted();

    // RENDER ELEMENTS
    this.asteroids.draw();
    this.ship.draw();
    this.scoreboard.draw(this.run);
  }

  draw() {
    switch (this.state.current) {
      case "menu":
        this.startMenuScreen.draw();
        break;
      case "playing":
      case "dying":
        this.playGame();
        break;
      case "levelComplete":
        this.levelUpScreen.draw();
        break;
      case "gameOver":
        this.gameOverScreen.draw();
        break;
    }
  }
}
