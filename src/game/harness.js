// Test seam. Attached to window only when the bundle is built for development AND the page is
// loaded with ?e2e=1, so it exists in no deployed build. See ARCHITECTURE.md.
//
// The interface is arrangement verbs, never the game's fields. A spec says
// "put two asteroids on the ship", not "reach into asteroids.array and assign position", so
// moving a field inside Game does not rewrite the suite.
//
// Two clocks matter here. Frames advance only through step(), and wall time only through the
// respawn timer, which setRespawnDelay shortens. Nothing in a spec should wait and hope.

export function attachHarness({ p5, run, getGame }) {
  const game = () => getGame();

  const harness = {
    /** TIME */
    freeze() {
      p5.noLoop();
    },

    resume() {
      p5.loop();
    },

    step(frames = 1) {
      for (let i = 0; i < frames; i++) p5.redraw();
    },

    // The respawn timer is real wall time. Shortening it keeps the timer path under test
    // instead of bypassing it. A rebuild makes a new GameState, so call this again after one.
    setRespawnDelay(ms) {
      game().state.respawnDelayMs = ms;
    },

    /** READING */
    snapshot() {
      const g = game();
      return {
        state: g.state.current,
        nextState: g.state.nextState,
        score: run.score,
        lives: run.lives,
        level: run.level,
        asteroids: g.asteroids.array.length,
        asteroidSizes: g.asteroids.array.map((a) => a.size).sort().join(""),
        debris: g.asteroids.asteroidDebris.length,
        shots: g.ship.shots.length,
        shipExploded: g.ship.exploded,
        shipMoving: g.ship.velocity.x !== 0 || g.ship.velocity.y !== 0,
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

    // Asks index.js for a rebuild on the next frame, the same signal GameState sends.
    requestRebuild(state) {
      game().state.nextState = state;
    },

    /** ARRANGING THE WAVE */
    clearWave() {
      game().asteroids.array = [];
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
    putAsteroidInFrontOfShip({ size = "X", distance = 220 } = {}) {
      const g = game();
      harness.parkAsteroids();

      const target = g.asteroids.array[0];
      target.size = size;
      target.position = { x: g.ship.position.x + distance, y: g.ship.position.y };

      return { size: target.size, radius: target.radius };
    },

    // Places one asteroid at an exact point. Used for the corner case where a dead ship
    // still has a hitbox.
    putAsteroidAt({ x, y, index = 0 }) {
      const asteroid = game().asteroids.array[index];
      asteroid.velocity = { x: 0, y: 0 };
      asteroid.position = { x, y };
      return { x, y };
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
