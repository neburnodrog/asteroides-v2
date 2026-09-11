import { test, expect } from "./fixtures.mjs";

// Covers ADR-0001: a death keeps the field and the ship comes back into a clearing.

const CLEARING_RADIUS = 300;
const LOOK_AHEAD = 90;

const centreOf = ({ width, height }) => ({ x: width / 2, y: height / 2 });

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// Moves every asteroid onto one point, so the whole field is somewhere the search must avoid.
const pileAsteroidsAt = async (a, { x, y }) => {
  const { asteroids } = await a.snapshot();
  for (let index = 0; index < asteroids; index++) {
    await a.putAsteroidAt({ index, x, y });
  }
};

test.describe("the field survives a death", () => {
  test("the asteroids the player already broke stay broken", async ({
    asteroides: a,
  }) => {
    await a.startRun();
    await a.putAsteroidInFrontOfShip({ size: "X" });
    await a.press("Space");
    await a.step(30);

    // One X shot into two M, alongside the X that was parked out of the way.
    expect(await a.snapshot()).toMatchObject({ asteroidSizes: "MMX" });

    await a.killShipAndRebuild();

    expect(await a.snapshot()).toMatchObject({
      state: "playing",
      asteroids: 3,
      asteroidSizes: "MMX",
    });
  });

  test("a death does not restart the level", async ({ asteroides: a }) => {
    await a.startRun();
    await a.setRun({ level: 5 });
    await a.requestRebuild("playing");
    await a.step();
    expect(await a.snapshot()).toMatchObject({ level: 5, asteroids: 10 });

    await a.putAsteroidInFrontOfShip({ size: "X" });
    await a.press("Space");
    await a.step(30);
    expect((await a.snapshot()).asteroids).toBe(11);

    await a.killShipAndRebuild();

    // Eleven, not the ten a fresh level 5 would build.
    expect(await a.snapshot()).toMatchObject({
      state: "playing",
      level: 5,
      asteroids: 11,
    });
  });

  test("a cleared level still starts a fresh set of X asteroids", async ({
    asteroides: a,
  }) => {
    await a.startRun();
    await a.clearField();
    await a.step();
    expect(await a.snapshot()).toMatchObject({ state: "levelComplete" });

    await a.press("Space");

    expect(await a.snapshot()).toMatchObject({
      state: "playing",
      level: 2,
      asteroids: 4,
      asteroidSizes: "XXXX",
    });
  });
});

test.describe("where the ship comes back", () => {
  test("not into the field parked on the centre", async ({ asteroides: a }) => {
    await a.startRun();
    await a.setMinimumDeathFrames(40);
    const centre = centreOf((await a.snapshot()).canvas);

    await a.parkAsteroids();
    await pileAsteroidsAt(a, centre);
    await a.step();
    expect(await a.snapshot()).toMatchObject({ state: "dying" });

    await a.step(39);

    const { state, spawnPoint } = await a.snapshot();
    expect(state).toBe("playing");
    expect(distance(spawnPoint, centre)).toBeGreaterThan(CLEARING_RADIUS);

    // And the clearing holds: the ship is still flying a second later.
    await a.step(60);
    expect(await a.snapshot()).toMatchObject({
      state: "playing",
      shipExploded: false,
      lives: 2,
    });
  });

  test("a field parked in one corner rebuilds after exactly three seconds, away from that corner", async ({
    asteroides: a,
  }) => {
    await a.startRun();
    await a.putAsteroidsOnShip(1);
    await a.step();

    const corner = { x: 0, y: 0 };
    await pileAsteroidsAt(a, corner);

    await a.step(178);
    expect(await a.snapshot()).toMatchObject({ state: "dying" });

    await a.step();

    const { state, deathFrames, spawnPoint } = await a.snapshot();
    expect(state).toBe("playing");
    expect(deathFrames).toBe(180);
    expect(distance(spawnPoint, corner)).toBeGreaterThan(CLEARING_RADIUS);
  });

  test("the spawn point is locked and shown before the ship arrives", async ({
    asteroides: a,
  }) => {
    await a.startRun();
    await a.setMinimumDeathFrames(40);
    await a.putAsteroidsOnShip(1);

    // The search starts 30 frames before the minimum runs out.
    await a.step(10);
    const locked = await a.snapshot();
    expect(locked.state).toBe("dying");
    expect(locked.spawnPoint).not.toBeNull();

    await a.step(29);
    const blinking = await a.snapshot();
    expect(blinking.state).toBe("dying");
    expect(blinking.spawnPoint).toEqual(locked.spawnPoint);

    await a.step();

    expect(await a.snapshot()).toMatchObject({
      state: "playing",
      shipExploded: false,
      shipAtSpawnPoint: true,
    });
  });

  test("a key held through the death is not acted on", async ({
    asteroides: a,
  }) => {
    await a.startRun();
    await a.setMinimumDeathFrames(40);
    await a.putAsteroidsOnShip(1);
    await a.step();

    await a.hold("w", 38);

    expect(await a.snapshot()).toMatchObject({
      state: "dying",
      shipMoving: false,
    });

    await a.step();

    expect(await a.snapshot()).toMatchObject({
      state: "playing",
      shipMoving: false,
      shipAtSpawnPoint: true,
    });
  });
});

test.describe("the clearing search", () => {
  // Everything piled in one corner leaves the rest of the canvas to choose from, so the point
  // the search picks with a still field is the one these tests then threaten.
  // Aims one asteroid at a point so its disc crosses the edge of the circle on a chosen frame.
  // The asteroid travels the distance to the point less the two radii in `entersOnFrame` frames,
  // which is what puts the arrival either side of the look ahead rather than near it.
  const aimToEnterCircleOn = async (a, { index, from, target, radius, entersOnFrame }) => {
    const gap = distance(from, target);
    const travelled = gap - CLEARING_RADIUS - radius;
    const speed = travelled / entersOnFrame;
    await a.aimAsteroidAt({
      index,
      x: target.x,
      y: target.y,
      arrivalFrames: gap / speed,
    });
  };

  test("an asteroid entering the circle inside the look ahead disqualifies the point", async ({
    asteroides: a,
  }) => {
    await a.startRun();
    await a.parkAsteroids();
    const corner = { x: 0, y: 0 };
    const { radius } = await a.putAsteroidAt({ index: 0, ...corner });
    await a.putAsteroidAt({ index: 1, ...corner });

    const quietest = await a.findClearing();
    expect(quietest.timeToThreat).toBe(LOOK_AHEAD);

    await aimToEnterCircleOn(a, {
      index: 0,
      from: corner,
      target: quietest,
      radius,
      entersOnFrame: LOOK_AHEAD - 5,
    });

    const chosen = await a.findClearing();
    expect(chosen).not.toBeNull();
    expect({ x: chosen.x, y: chosen.y }).not.toEqual({
      x: quietest.x,
      y: quietest.y,
    });
  });

  test("an asteroid entering the circle after the look ahead does not", async ({
    asteroides: a,
  }) => {
    await a.startRun();
    await a.parkAsteroids();
    const corner = { x: 0, y: 0 };
    const { radius } = await a.putAsteroidAt({ index: 0, ...corner });
    await a.putAsteroidAt({ index: 1, ...corner });

    const quietest = await a.findClearing();

    // Five frames the other side of the same boundary, on the same course.
    await aimToEnterCircleOn(a, {
      index: 0,
      from: corner,
      target: quietest,
      radius,
      entersOnFrame: LOOK_AHEAD + 5,
    });

    expect(await a.findClearing()).toMatchObject({
      x: quietest.x,
      y: quietest.y,
      timeToThreat: LOOK_AHEAD,
    });
  });

  test("an asteroid that reaches the point by wrapping counts as a threat", async ({
    asteroides: a,
  }) => {
    await a.startRun();
    const { canvas } = await a.snapshot();
    await a.parkAsteroids();

    // One asteroid stashed well off the canvas, so a single asteroid drives the search.
    await a.putAsteroidAt({ index: 1, x: canvas.width * 4, y: canvas.height * 4 });
    await a.putAsteroidAt({
      index: 0,
      x: canvas.width / 2,
      y: canvas.height - 5,
    });

    const quietest = await a.findClearing();
    expect(quietest.timeToThreat).toBe(LOOK_AHEAD);

    // Straight down and off the bottom edge. It moves away from every candidate, so the only
    // way it threatens one is by wrapping back in at the top.
    await a.aimAsteroidAt({
      index: 0,
      x: canvas.width / 2,
      y: canvas.height * 3,
      arrivalFrames: 200,
    });

    const chosen = await a.findClearing();
    expect(chosen).not.toBeNull();
    expect({ x: chosen.x, y: chosen.y }).not.toEqual({
      x: quietest.x,
      y: quietest.y,
    });
  });

  test("a field with no clear point waits instead of hanging", async ({
    asteroides: a,
  }) => {
    await a.startRun();
    await a.setRun({ level: 3 });
    await a.requestRebuild("playing");
    await a.step();
    await a.setMinimumDeathFrames(40);

    const { canvas } = await a.snapshot();
    await a.putAsteroidsOnShip(1);
    await a.step();
    expect(await a.snapshot()).toMatchObject({ state: "dying" });

    // Six asteroids spread so that every candidate point is inside one of them.
    const columns = [1 / 6, 1 / 2, 5 / 6];
    const rows = [1 / 4, 3 / 4];
    let index = 0;
    for (const row of rows) {
      for (const column of columns) {
        await a.putAsteroidAt({
          index: index++,
          x: canvas.width * column,
          y: canvas.height * row,
        });
      }
    }
    expect(await a.findClearing()).toBeNull();

    // Well past the minimum, and the ship is still waiting rather than coming back into one.
    await a.step(59);
    expect(await a.snapshot()).toMatchObject({
      state: "dying",
      spawnPoint: null,
    });

    // Let the field drift into a cluster and the far side of the canvas opens up.
    for (let i = 0; i < 6; i++) {
      await a.aimAsteroidAt({ index: i, x: 0, y: 0, arrivalFrames: 600 });
    }
    await a.step(200);

    expect(await a.snapshot()).toMatchObject({ state: "playing" });
  });
});
