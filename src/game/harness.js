// Test seam. Attached to window only when the bundle is built for development AND the page is
// loaded with ?e2e=1, so it exists in no deployed build. See ARCHITECTURE.md.
//
// The interface is arrangement verbs, never the game's fields. A spec says
// "put two asteroids on the ship", not "reach into asteroids.array and assign position", so
// moving a field inside Game does not rewrite the suite.
//
// There is one clock. Frames advance only through step(), and nothing in the engine reads wall
// time. Nothing in a spec should wait and hope.

import { STORAGE_KEY } from "./highScores.js";
import { NOSE_REACH } from "./geometry.js";
import { setHitboxes } from "./debugDraw.js";

export function attachHarness({ p5, run, highScores, getGame }) {
  const game = () => getGame();

  // Reported as a boolean rather than two floats, so a spec asserts the ship came back where it
  // died without naming a coordinate.
  const atReturnPoint = (g) => {
    const point = g.state.returnPoint;
    if (!point) return false;
    return g.ship.position.x === point.x && g.ship.position.y === point.y;
  };

  const harness = {
    /** TIME */
    freeze() {
      p5.noLoop();
      // noLoop only stops the next frame being scheduled. A frame already queued still fires, and
      // on a loaded machine it can arrive in the middle of a test and add a frame no step() asked
      // for, which shows up as a death ending one frame early. p5's own remove() cancels it the
      // same way.
      if (p5._requestAnimId) window.cancelAnimationFrame(p5._requestAnimId);
    },

    resume() {
      p5.loop();
    },

    step(frames = 1) {
      for (let i = 0; i < frames; i++) p5.redraw();
    },

    // How long the ship is off the canvas before the ghost begins. Shortening it keeps the real
    // code path under test instead of bypassing it, and leaves the ghost at its real length,
    // which is what the specs measure. A rebuild after a cleared level makes a new GameState, so
    // call this again after one.
    setAbsenceFrames(frames) {
      game().state.absenceFrames = frames;
    },

    /** READING */
    snapshot() {
      const g = game();
      return {
        state: g.state.current,
        nextState: g.state.nextState,
        deathFrames: g.state.deathFrames,
        ghostFrames: g.state.ghostFrames,
        ghostLength: g.state.ghostLength,
        ghostWindow: g.state.ghostWindow,
        returnPoint: g.state.returnPoint,
        shipAtReturnPoint: atReturnPoint(g),
        canvas: { width: p5.width, height: p5.height },
        score: run.score,
        lives: run.lives,
        level: run.level,
        highScores: highScores.entries(),
        // Where the run that just ended landed, or null. Only a game over sets it.
        rank: g.rank,
        asteroids: g.asteroids.array.length,
        asteroidSizes: g.asteroids.array.map((a) => a.size).sort().join(""),
        debris: g.asteroids.asteroidDebris.length,
        shots: g.ship.shots.length,
        shipExploded: g.ship.exploded,
        shipDebris: g.ship.shipDebris.length,
        shipMoving: g.ship.velocity.x !== 0 || g.ship.velocity.y !== 0,
        // The one float in here. A death keeps the heading, so a spec asserts this is the same
        // number either side of one rather than asserting any particular angle.
        shipHeading: g.ship.angleOfShip,
      };
    },

    /** ARRANGING THE RUN */
    startRun() {
      game().state.startPlaying();
    },

    setRun({ score, lives, level } = {}) {
      if (score !== undefined) run.score = score;
      if (lives !== undefined) run.lives = lives;
      if (level !== undefined) run.level = level;
    },

    // Kills the ship where it stands, the same path a collision takes. Specs about the ghost
    // need a death that does not leave an asteroid parked on the return point.
    killShip() {
      game().killShip();
    },

    // Asks index.js for a rebuild on the next frame, the same signal GameState sends.
    requestRebuild(state) {
      game().state.nextState = state;
    },

    /** ARRANGING THE HIGH SCORE TABLE */
    readHighScores() {
      return highScores.entries();
    },

    // Filled through record(), the same door a finished run uses, so no spec depends on a second
    // way of writing the table.
    setHighScores(entries) {
      highScores.clear();
      [...entries]
        .sort((a, b) => b.score - a.score)
        .forEach(({ score, level }) => highScores.record(score, level));

      return highScores.entries();
    },

    clearHighScores() {
      highScores.clear();
    },

    // What a private window does to every write for the rest of the page. Breaking the browser
    // API rather than the module keeps the module's real catch under test.
    breakStorage() {
      Storage.prototype.setItem = function () {
        throw new Error("storage is not available");
      };
    },

    // A hand edited value. The key comes from the module, so a spec names no storage detail.
    corruptStorage() {
      window.localStorage.setItem(STORAGE_KEY, "{ not json");
    },

    /** ARRANGING THE FIELD */
    clearField() {
      game().asteroids.array = [];
    },

    // Drops every asteroid past the first n, so a spec can arrange a field of exactly the size
    // it cares about without depending on what the level spawned.
    keepAsteroids(n) {
      const g = game();
      g.asteroids.array = g.asteroids.array.slice(0, n);
      return g.asteroids.array.length;
    },

    // Stops every asteroid and lines them along the bottom edge, clear of the ship at the
    // centre, so nothing drifts into a test that is still setting itself up.
    parkAsteroids() {
      const g = game();
      const list = g.asteroids.array;
      const gap = p5.width / (list.length + 1);

      list.forEach((asteroid, i) => {
        asteroid.velocity = { x: 0, y: 0 };
        asteroid.rotation.velocity = 0;
        asteroid.position = { x: gap * (i + 1), y: p5.height - 60 };
      });

      return list.length;
    },

    // Strokes the shapes collisions.js measures, so a death that looks wrong can be watched
    // rather than guessed at.
    showHitboxes(on = true) {
      setHitboxes(on);
    },

    // Sets the ship moving without pressing anything. Thrust reaches a given speed over dozens
    // of frames, and a spec that needs a known displacement in one frame cannot spend them.
    // Resistance still applies on the next step, so the ship travels velocity * 0.98.
    setShipVelocity({ x = 0, y = 0 } = {}) {
      game().ship.velocity = { x, y };
    },

    // Stacks n asteroids on the ship. Everything else is parked first, so the only overlap in
    // the frame is the one the test asked for.
    putAsteroidsOnShip(n = 1) {
      const g = game();
      harness.parkAsteroids();

      const stacked = g.asteroids.array.slice(0, n);
      stacked.forEach((asteroid) => {
        asteroid.position = { ...g.ship.position };
      });

      return stacked.length;
    },

    // Parks one asteroid in the ship's line of fire. The ship starts at angle 0, facing +x.
    // `gapFromNose` is the clear air between the ship's nose and the asteroid's circumcircle,
    // and is what a spec about contact should use; `distance` is from the ship's origin and is
    // what the shooting specs already use. Radius, sides and angle are settable because the
    // shape of the contact is the thing under test and the RNG picks all three.
    putAsteroidInFrontOfShip({
      size = "X",
      distance = 220,
      gapFromNose,
      radius,
      sides,
      angle,
    } = {}) {
      const g = game();
      harness.parkAsteroids();

      const target = g.asteroids.array[0];
      target.size = size;
      if (radius !== undefined) target.radius = radius;
      if (sides !== undefined) target.sides = sides;
      if (angle !== undefined) target.rotation.angle = angle;

      const along =
        gapFromNose === undefined
          ? distance
          : NOSE_REACH + target.radius + gapFromNose;

      target.position = { x: g.ship.position.x + along, y: g.ship.position.y };

      return { size: target.size, radius: target.radius, sides: target.sides };
    },

    // Places one asteroid at an exact point. The radius comes back because it is random, and a
    // spec that aims this asteroid at the ship needs it to work out when the shapes overlap.
    putAsteroidAt({ x, y, index = 0, radius, sides, angle }) {
      const asteroid = game().asteroids.array[index];
      asteroid.velocity = { x: 0, y: 0 };
      asteroid.position = { x, y };
      if (radius !== undefined) asteroid.radius = radius;
      if (sides !== undefined) asteroid.sides = sides;
      if (angle !== undefined) asteroid.rotation.angle = angle;
      return { x, y, radius: asteroid.radius };
    },

    /** SOUND */
    // The cue keys SoundManager holds. A cue the game plays but never loads is the defect this
    // reports on: play() no-ops on a missing key, so nothing throws and nothing sounds.
    soundCueKeys() {
      return Object.keys(game().soundManager.sounds);
    },

    // Which cues report themselves as sounding. A headless browser keeps the audio context
    // suspended, so this is the cue's own account of whether it was started and not yet
    // stopped, which is the part the game controls.
    playingCues() {
      const { sounds } = game().soundManager;
      return Object.keys(sounds).filter((key) => sounds[key].isPlaying?.());
    },

    playCue(key) {
      game().soundManager.play(key);
    },

    explodeAllAsteroids() {
      const g = game();
      g.asteroids.array.forEach((asteroid) => {
        asteroid.exploded = true;
      });
      return g.asteroids.array.length;
    },
  };

  window.__asteroides = harness;
  return harness;
}
