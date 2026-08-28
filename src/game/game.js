/** STATES */
import GameOverScreen from "./state/gameOverScreen";
import { StartMenuScreen, LevelUpScreen } from "./state/startMenuScreen";
import GameState from "./gameState";
import { shipVsAsteroids, shotsVsAsteroids } from "./collisions";

/** GAME ELEMENTS */
import Ship from "./elements/ship";
import Score from "./elements/score";
import Asteroids from "./elements/asteroids";
import Life from "./elements/life";

const ASTEROID_HITS = {
  X: { points: 20, sound: "asteroidBreakL" },
  M: { points: 50, sound: "asteroidBreakM" },
  S: { points: 75, sound: "asteroidBreakS" },
};

export default class Game {
  constructor(p5, soundManager, input, started, level) {
    this.p5 = p5;
    this.soundManager = soundManager;
    this.input = input;

    this.state = new GameState({ started });
    this.level = level;
    this.score;

    // VIEWS
    this.gameOverScreen;
    this.startMenuScreen;
    this.levelUpScreen;

    /* GAME ELEMENTS */
    this.lifes;
    this.ship;
    this.asteroids = [];
  }

  setup(shipImage, heartImage, score, lifes) {
    /** INITIALIZING STATE COMPONENTS */
    this.gameOverScreen = new GameOverScreen(this.p5, this);
    this.startMenuScreen = new StartMenuScreen(this.p5, this);
    this.levelUpScreen = new LevelUpScreen(this.p5, this);
    this.score = score || new Score(this.p5);

    /* INITIALIZING GAME ELEMENTS */
    this.ship = new Ship(this.p5, this, shipImage);
    this.lifes =
      lifes || new Array(3).fill().map(() => new Life(this.p5, heartImage));
    this.asteroids = new Asteroids(this.p5, this.level);
  }

  checkForHits() {
    const hits = shotsVsAsteroids(this.ship.shots, this.asteroids.array);

    for (const { shot, asteroid } of hits) {
      asteroid.exploded = true;
      shot.hit = true;

      const rule = ASTEROID_HITS[asteroid.size];
      if (rule) {
        this.soundManager.play(rule.sound);
        this.score.value += rule.points;
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
      this.level++;

      if (this.soundManager) {
        this.soundManager.play("levelUp");
      }
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

    const wasFinalDeath = this.lifes.length === 0;
    if (!wasFinalDeath) this.lifes.pop();

    this.state.shipDied({
      wasFinalDeath,
      level: this.level,
      score: this.score,
      lifes: this.lifes,
    });

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
    this.checkIfLevelCompleted();

    // RENDER ELEMENTS
    this.asteroids.draw();
    this.ship.draw();
    this.lifes.forEach((life, i) => life.draw(i + 1));
    this.score.draw();
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
