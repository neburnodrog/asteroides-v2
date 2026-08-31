import { test, expect } from "./fixtures.mjs";

// Covers "shipVsAsteroids returns at most one asteroid", "Collision detection is suppressed
// during dying", and "Lives include the ship in play".

test.describe("deaths", () => {
  test("two asteroids on the ship in one frame cost exactly one life", async ({
    asteroides: a,
  }) => {
    await a.startRun();
    expect(await a.putAsteroidsOnShip(2)).toBe(2);

    await a.step();

    expect(await a.snapshot()).toMatchObject({
      state: "dying",
      lives: 2,
      shipExploded: true,
    });
  });

  test("no further life is lost while dying", async ({ asteroides: a }) => {
    await a.startRun();
    await a.putAsteroidsOnShip(1);
    await a.step();
    expect(await a.snapshot()).toMatchObject({ state: "dying", lives: 2 });

    // The asteroid is still sitting on the wreck.
    await a.step(20);

    expect(await a.snapshot()).toMatchObject({ state: "dying", lives: 2 });
  });

  test("the third death ends the run and a fourth is impossible", async ({
    asteroides: a,
  }) => {
    await a.startRun();

    await a.killShipAndRespawn();
    expect((await a.snapshot()).lives).toBe(2);

    await a.killShipAndRespawn();
    expect((await a.snapshot()).lives).toBe(1);

    await a.putAsteroidsOnShip(1);
    await a.step();
    expect(await a.snapshot()).toMatchObject({ state: "gameOver", lives: 0 });

    await a.putAsteroidsOnShip(1);
    await a.step(20);

    expect(await a.snapshot()).toMatchObject({ state: "gameOver", lives: 0 });
  });
});

test.describe("the dying guard", () => {
  // handleExplosion sets the ship position to { x: null, y: null }, which collapses its hitbox
  // to the top left corner rather than removing it. An asteroid drifting through that corner is
  // the case Game.checkIfCollisions guards against by early-returning when not playing.
  test("an asteroid in the corner cannot kill a ship that is already dead", async ({
    asteroides: a,
  }) => {
    await a.startRun();
    await a.putAsteroidsOnShip(1);
    await a.step();
    expect(await a.snapshot()).toMatchObject({ state: "dying", lives: 2 });

    await a.putAsteroidAt({ x: 0, y: 0 });
    await a.step(5);

    expect(await a.snapshot()).toMatchObject({ state: "dying", lives: 2 });
  });
});
