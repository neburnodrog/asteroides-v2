/** STATES */
import GameOverScreen from "./state/gameOverScreen";
import { StartMenuScreen, LevelUpScreen } from "./state/startMenuScreen";
import GameState from "./gameState";
import { shipVsAsteroids, shotsVsAsteroids } from "./collisions";

/** GAME ELEMENTS */
import Ship from "./elements/ship";
import Scoreboard from "./elements/scoreboard";
import Asteroids from "./elements/asteroids";

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
