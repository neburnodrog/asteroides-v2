import { test, expect } from "./fixtures.mjs";

// Covers ADR-0002: a death is an absence then a ghost, and the ghost is the whole of the
// protection. None of these arrangements is reachable by playing forward.

test.describe("the ghost", () => {
  test("expires with nothing overlapping and the ship is killable again", async ({
    asteroides: a,
  }) => {
    await a.startRun();
    const { ghostWindow } = await a.enterGhost();
    expect(ghostWindow).toBe(120);

    await a.step(ghostWindow - 1);
    expect(await a.snapshot()).toMatchObject({
      state: "ghost",
      ghostFrames: ghostWindow - 1,
      lives: 2,
    });

    await a.step();
    expect(await a.snapshot()).toMatchObject({ state: "playing", lives: 2 });

    await a.putAsteroidsOnShip(1);
    await a.step();
    expect(await a.snapshot()).toMatchObject({ state: "dying", lives: 1 });
  });

  test("flown into an asteroid mid window, the ship takes no damage", async ({
    asteroides: a,
  }) => {
    await a.startRun();
    const { ghostWindow } = await a.enterGhost();

    // Close enough that the ship is inside the disc well before the window runs out.
    await a.putAsteroidInFrontOfShip({ size: "X", distance: 200 });
    await a.hold("w", 60);

    expect(await a.snapshot()).toMatchObject({
      state: "ghost",
      lives: 2,
      shipExploded: false,
    });
    expect((await a.snapshot()).ghostFrames).toBeLessThan(ghostWindow);
  });

  test("expiring on an asteroid buys 60 more frames, and no more", async ({
    asteroides: a,
  }) => {
    await a.startRun();
    const { ghostWindow } = await a.enterGhost();

    await a.putAsteroidsOnShip(1);
    await a.step(ghostWindow);

    // Sixty frames, once. The whole point of the number is that it is fixed, so it is the
    // assertion here rather than an arrangement anything else reads.
    expect(await a.snapshot()).toMatchObject({
      state: "ghost",
      ghostFrames: ghostWindow,
      ghostLength: ghostWindow + 60,
      lives: 2,
    });

    await a.step(59);
    expect(await a.snapshot()).toMatchObject({ state: "ghost", lives: 2 });

    await a.step();
    expect(await a.snapshot()).toMatchObject({
      state: "dying",
      lives: 1,
      shipExploded: true,
    });
  });

  test("thrusting clear during the grace survives it", async ({
    asteroides: a,
  }) => {
    await a.startRun();
    const { ghostWindow } = await a.enterGhost();

    await a.putAsteroidsOnShip(1);
    await a.step(ghostWindow);

    const { ghostLength } = await a.snapshot();
    expect(ghostLength).toBeGreaterThan(ghostWindow);

    await a.hold("w", ghostLength - ghostWindow - 1);
    await a.step();

    expect(await a.snapshot()).toMatchObject({
      state: "playing",
      lives: 2,
      shipExploded: false,
    });
  });

  test("fire is read and thrown away, so nothing is buffered into the first mortal frame", async ({
    asteroides: a,
  }) => {
    await a.startRun();
    const { ghostWindow } = await a.enterGhost();

    await a.press("Space");
    await a.press("Space");
    expect(await a.snapshot()).toMatchObject({ state: "ghost", shots: 0 });

    await a.step(ghostWindow - 3);
    expect(await a.snapshot()).toMatchObject({
      state: "ghost",
      ghostFrames: ghostWindow - 1,
    });

    await a.step();
    expect(await a.snapshot()).toMatchObject({ state: "playing", shots: 0 });

    await a.step();
    expect((await a.snapshot()).shots).toBe(0);

    // And the ban was the only thing stopping it.
    await a.press("Space");
    expect((await a.snapshot()).shots).toBe(1);
  });
});

test.describe("a level cleared during a death", () => {
  test("an in-flight shot that empties the field defers the level up to the end of the ghost", async ({
    asteroides: a,
  }) => {
    await a.startRun();
    await a.setAbsenceFrames(60);

    // One S asteroid, which breaks into nothing, and a shot already on its way to it.
    await a.putAsteroidInFrontOfShip({ size: "S", distance: 200 });
    expect(await a.keepAsteroids(1)).toBe(1);
    await a.press("Space");
    expect((await a.snapshot()).shots).toBe(1);

    await a.killShip();
    await a.step(30);
    expect(await a.snapshot()).toMatchObject({
      state: "dying",
      asteroids: 0,
      level: 1,
    });

    await a.step(30);
    const { state, ghostWindow } = await a.snapshot();
    expect(state).toBe("ghost");

    await a.step(ghostWindow - 1);
    expect(await a.snapshot()).toMatchObject({ state: "ghost", level: 1 });

    await a.step();
    expect(await a.snapshot()).toMatchObject({
      state: "levelComplete",
      level: 2,
    });
  });
});
