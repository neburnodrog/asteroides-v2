/** STATES */
import GameOverScreen from "./state/gameOverScreen";
import { StartMenuScreen, LevelUpScreen } from "./state/startMenuScreen";
import PauseScreen from "./state/pauseScreen";
import GameState from "./gameState";
import { shipVsAsteroids, shotsVsAsteroids, GHOST_CLEARANCE } from "./collisions";
import { drawHitboxes } from "./debugDraw";

/** GAME ELEMENTS */
import Ship from "./elements/ship";
import Scoreboard from "./elements/scoreboard";
import Asteroids from "./elements/asteroids";

const PLAY_STATES = ["playing", "dying", "ghost"];

const ASTEROID_HITS = {
  X: { points: 20, sound: "asteroidBreakL" },
  M: { points: 50, sound: "asteroidBreakM" },
  S: { points: 75, sound: "asteroidBreakS" },
};

export default class Game {
  constructor(p5, { soundManager, input, run, highScores, volume }, current, images) {
    this.p5 = p5;
    this.soundManager = soundManager;
    this.input = input;
    this.run = run;
    this.highScores = highScores;
    this.volume = volume;

    input.flush();

    this.state = new GameState({ current });
    // Where the run that ended on this Game landed in the high score table, or null. A death is
    // not a rebuild, so this survives until the player confirms the game over screen.
    this.rank = null;

    /** VIEWS */
    this.gameOverScreen = new GameOverScreen(p5, this);
    this.startMenuScreen = new StartMenuScreen(p5, this);
    this.levelUpScreen = new LevelUpScreen(p5, this);
    this.pauseScreen = new PauseScreen(p5, this);
    this.scoreboard = new Scoreboard(p5, images.heart);

    /** GAME ELEMENTS */
    this.ship = new Ship(p5, this);
    this.asteroids = new Asteroids(p5, run.level);
  }

  // The SoundManager outlives every Game built around it, so anything still sounding when one
  // is discarded would carry into the next.
  teardown() {
    this.ship.stopThrust();
  }

  // Hits keep counting through an ordinary death, absence and ghost alike, because the run is
  // still being played. A run that has just ended takes nothing more: the last life is spent on
  // the frame this returns early, so a shot still in the air cannot add to the score the game
  // over screen shows and the table has already recorded.
  checkForHits() {
    if (this.state.isGameOver()) return;

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

  shipIsOverlapping() {
    return shipVsAsteroids(this.ship, this.asteroids.array) !== null;
  }

  // What the ghost asks: not "is it touching" but "is it safe to become solid here".
  shipIsCrowded() {
    return (
      shipVsAsteroids(this.ship, this.asteroids.array, GHOST_CLEARANCE) !== null
    );
  }

  // A death keeps the field, so it rebuilds the ship in place rather than the Game. The ship
  // comes back where it died, so the point has to be read before handleExplosion nulls it.
  killShip() {
    const returnPoint = { ...this.ship.position };

    this.ship.handleExplosion();

    if (this.soundManager) {
      this.soundManager.play("shipExplosion");
    }

    const wasFinalDeath = this.run.loseLife();

    // The score is final the moment the last life is spent, because checkForHits stops awarding
    // once the state is gameOver. The rank is therefore measured against the table as it stood
    // before the run, and written once per run.
    if (wasFinalDeath) {
      this.rank = this.highScores.record(this.run.score, this.run.level);
    }

    this.state.shipDied({ wasFinalDeath, returnPoint });

    if (wasFinalDeath && this.soundManager) {
      this.soundManager.play("gameOver");
    }
  }

  advanceDeath() {
    const action = this.state.advanceDeath(() => this.shipIsCrowded());

    if (action === "return") this.ship.rebuildAt(this.state.returnPoint);
    // The grace ran its full length and an asteroid is still crowding the ship. That is an
    // ordinary death: it costs a life and starts another absence at the same point.
    if (action === "kill") this.killShip();
  }

  checkIfCollisions() {
    if (!this.state.isPlaying()) return;
    if (!this.shipIsOverlapping()) return;

    this.killShip();
  }

  // Play begins with the keys in charge of the turn, so a pointer that moved on the menu does not
  // swing the ship before the player has touched the mouse in play.
  startPlaying() {
    this.state.startPlaying();
    this.input.flush();
  }

  // Entered by a key, by the window losing focus or by the pointer leaving it. Nothing sounds
  // under a pause, and a break still ringing is not resumed: only the thrust loop comes back, on
  // the next step, if a thrust or strafe key is down.
  pause() {
    this.state.pause();
    if (!this.state.isPaused()) return;

    this.ship.stopThrust();
    this.soundManager.stopAll();
    this.input.flush();
  }

  resume() {
    if (!this.state.isPaused()) return;

    this.state.resume();
    this.input.flush();
  }

  // DRAW
  playGame() {
    this.p5.frameRate(60);

    // MOVE
    // Everything moves before anything measures, so every test below reads the frame that is
    // about to be drawn. With the movement inside draw() the checks judged the previous frame,
    // which is 5.88px of error at the ship's terminal speed and 20.88px for a shot.
    this.asteroids.step();
    this.ship.step();

    // CHECK STATES
    // advanceDeath still leads the checks so the absence and the ghost start and end on a frame
    // boundary. Were it to run after checkIfCollisions, the frame a death begins would already
    // be counted as a frame of the absence, and the frame a ghost ends would still have its
    // collision check skipped, making the ship immune for one frame longer than it is drawn as
    // a ghost.
    this.advanceDeath();
    this.checkIfCollisions();
    this.checkForHits();
    this.checkIfExplodedAsteroids();
    this.checkIfLevelCompleted();

    // RENDER ELEMENTS
    this.asteroids.draw();
    this.ship.draw();
    this.scoreboard.draw(this.run);

    // Off in every build. The harness is the only thing that turns it on, and the harness
    // exists only in a development build loaded with ?e2e=1.
    drawHitboxes(this.p5, this.ship, this.asteroids.array);
  }

  // Written only on a change, so a frame does not touch the canvas style.
  updateCursor() {
    const { p5 } = this;
    const cursor = PLAY_STATES.includes(this.state.current) ? p5.CROSS : p5.ARROW;
    if (cursor === this.cursor) return;
    p5.cursor(cursor);
    this.cursor = cursor;
  }

  draw() {
    // Read on every screen, legal or not, so a press made on the menu cannot pause the first
    // frame of play.
    if (this.input.wasPressed("pause")) {
      if (this.state.isPaused()) this.resume();
      else this.pause();
    }

    switch (this.state.current) {
      case "menu":
        this.startMenuScreen.draw();
        break;
      case "playing":
      case "dying":
      case "ghost":
        this.playGame();
        break;
      case "paused":
        this.pauseScreen.draw();
        break;
      case "levelComplete":
        // The screen takes the draw away from playGame, so the ship is no longer stepped and
        // the key release that would end thrust is never read. Without this the loop sounds
        // under the level-up screen until the player confirms it and the Game is rebuilt.
        this.ship.stopThrust();
        this.levelUpScreen.draw();
        break;
      case "gameOver":
        this.gameOverScreen.draw();
        break;
    }

    this.updateCursor();
  }
}
