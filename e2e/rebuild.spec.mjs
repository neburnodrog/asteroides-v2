import { test, expect } from "./fixtures.mjs";

const centreOf = ({ width, height }) => ({ x: width / 2, y: height / 2 });

// Covers ADR-0001, a death keeps the field, and the return point of ADR-0002.

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

test.describe("the absence", () => {
  // Driven by a real collision rather than the harness's killShip, because the frame a
  // collision lands on is itself the first frame with no ship on the canvas. A verb called
  // between frames does not consume it, so it cannot measure the real length.
  test("runs 120 frames from the collision, with no ship on the canvas", async ({
    asteroides: a,
  }) => {
    await a.startRun();
    await a.putAsteroidsOnShip(1);

    await a.step();
    expect(await a.snapshot()).toMatchObject({
      state: "dying",
      deathFrames: 0,
      shipExploded: true,
    });

    await a.step(119);
    expect(await a.snapshot()).toMatchObject({
      state: "dying",
      deathFrames: 119,
      shipExploded: true,
    });

    await a.step();
    expect(await a.snapshot()).toMatchObject({
      state: "ghost",
      deathFrames: 120,
      shipExploded: false,
    });
  });

  test("a key held through it is not acted on", async ({ asteroides: a }) => {
    await a.startRun();
    await a.setAbsenceFrames(40);
    await a.parkAsteroids();
    await a.killShip();

    await a.hold("w", 39);
    expect(await a.snapshot()).toMatchObject({
      state: "dying",
      shipMoving: false,
    });

    await a.step();
    expect(await a.snapshot()).toMatchObject({
      state: "ghost",
      shipMoving: false,
      shipAtReturnPoint: true,
    });
  });
});

test.describe("where the ship comes back", () => {
  test("at the point it died, at rest, on the heading it died with", async ({
    asteroides: a,
  }) => {
    await a.startRun();

    // Turn, then fly away from the centre, so neither the point nor the heading is the one the
    // ship was built with.
    await a.hold("ArrowRight", 10);
    await a.hold("w", 40);

    const flying = await a.snapshot();
    expect(flying.shipHeading).not.toBe(0);

    const back = await a.enterGhost();
    expect(back).toMatchObject({
      shipExploded: false,
      shipAtReturnPoint: true,
      shipMoving: false,
    });
    expect(back.returnPoint).not.toEqual(centreOf(back.canvas));
    expect(back.shipHeading).toBe(flying.shipHeading);
  });

  test("a second death during a ghost returns it to the same place again", async ({
    asteroides: a,
  }) => {
    await a.startRun();
    const { returnPoint, ghostWindow } = await a.enterGhost();

    // An asteroid parked on the return point survives the grace and kills the ghost.
    await a.putAsteroidsOnShip(1);
    await a.step(ghostWindow);

    const { ghostLength } = await a.snapshot();
    await a.step(ghostLength - ghostWindow);
    expect(await a.snapshot()).toMatchObject({ state: "dying", lives: 1 });

    await a.step(20);
    expect(await a.snapshot()).toMatchObject({
      state: "ghost",
      returnPoint,
      shipAtReturnPoint: true,
    });
  });
});

