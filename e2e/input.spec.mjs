import { test, expect } from "./fixtures.mjs";

// Covers "All keyboard input flows through Input", and the consume-on-read rule that stops one
// Space press satisfying both confirm and shoot.

test.describe("input", () => {
  test("one Space press confirms the menu without also firing", async ({
    asteroides: a,
  }) => {
    await a.press("Space");
    expect(await a.snapshot()).toMatchObject({ state: "playing", shots: 0 });

    // The press is spent. The next frame must not find it again.
    await a.step();
    expect((await a.snapshot()).shots).toBe(0);
  });

  test("Enter starts the run as well as Space", async ({ asteroides: a }) => {
    await a.press("Enter");
    expect((await a.snapshot()).state).toBe("playing");
  });

  test("a held thrust key accelerates the ship, releasing it stops the thrust", async ({
    asteroides: a,
  }) => {
    await a.startRun();
    await a.parkAsteroids();
    expect((await a.snapshot()).shipMoving).toBe(false);

    await a.hold("w", 10);

    expect((await a.snapshot()).shipMoving).toBe(true);
  });

  test("a shot destroys the asteroid it hits and scores its size", async ({
    asteroides: a,
  }) => {
    await a.startRun();
    await a.putAsteroidInFrontOfShip({ size: "X" });

    await a.press("Space");
    expect((await a.snapshot()).shots).toBe(1);

    await a.step(30);

    // 20 points for an X, which splits into two M. The parked asteroid is untouched.
    expect(await a.snapshot()).toMatchObject({
      score: 20,
      asteroidSizes: "MMX",
    });
  });
});
