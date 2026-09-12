import { test, expect } from "./fixtures.mjs";

// Regression cover for the two leaks fixed in 92be188, which were found by hand with an
// instrumented build and had nothing guarding them. Both grew unbounded inside the 60fps loop.

test.describe("cleanup", () => {
  test("a shot that misses is removed once it leaves the canvas", async ({
    asteroides: a,
  }) => {
    await a.startRun();
    await a.parkAsteroids();

    await a.press("Space");
    expect((await a.snapshot()).shots).toBe(1);

    // Shots do not wrap. A miss must be filtered, not fly forever.
    await a.step(200);

    expect((await a.snapshot()).shots).toBe(0);
  });

  test("asteroid debris fades out instead of accumulating", async ({
    asteroides: a,
  }) => {
    await a.startRun();
    await a.explodeAllAsteroids();
    await a.step();

    const peak = (await a.snapshot()).debris;
    expect(peak).toBeGreaterThan(0);

    await a.step(400);

    expect((await a.snapshot()).debris).toBe(0);
  });

  test("ship debris fades out after a death", async ({ asteroides: a }) => {
    await a.startRun();
    // Longer than the 200 frames below, so the debris is measured during the absence rather
    // than on a ship the ghost has already cleaned up after.
    await a.setAbsenceFrames(400);
    await a.putAsteroidsOnShip(1);
    await a.step();
    expect(await a.snapshot()).toMatchObject({ shipExploded: true });
    expect((await a.snapshot()).shipDebris).toBeGreaterThan(0);

    await a.step(200);

    expect(await a.snapshot()).toMatchObject({ state: "dying", shipDebris: 0 });
  });
});
