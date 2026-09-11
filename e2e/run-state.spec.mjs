import { test, expect } from "./fixtures.mjs";

// Covers the ARCHITECTURE invariants "Run state lives outside Game", "A menu rebuild ends the
// run", and "State resets reconstruct, they do not mutate".

test.describe("run state across rebuilds", () => {
  test("a fresh page starts at the menu with a clean run", async ({
    asteroides: a,
  }) => {
    expect(await a.snapshot()).toMatchObject({
      state: "menu",
      score: 0,
      lives: 3,
      level: 1,
      asteroids: 2,
    });
  });

  test("a level up keeps the score and doubles into the next wave", async ({
    asteroides: a,
  }) => {
    await a.startRun();
    await a.setRun({ score: 120 });
    await a.clearField();
    await a.step();

    // The level number advances at clear time, so the screen already names the wave that
    // follows it.
    expect(await a.snapshot()).toMatchObject({
      state: "levelComplete",
      score: 120,
      level: 2,
    });

    await a.press("Space");

    expect(await a.snapshot()).toMatchObject({
      state: "playing",
      score: 120,
      level: 2,
      asteroids: 4,
    });
  });

  test("score and level survive a death", async ({ asteroides: a }) => {
    await a.startRun();
    await a.setRun({ score: 250, level: 3 });
    await a.killShipAndRebuild();

    expect(await a.snapshot()).toMatchObject({
      state: "playing",
      score: 250,
      level: 3,
      lives: 2,
    });
  });

  test("restarting from game over resets the run", async ({ asteroides: a }) => {
    await a.startRun();
    await a.setRun({ score: 900, lives: 1, level: 4 });
    await a.putAsteroidsOnShip(1);
    await a.step();

    expect(await a.snapshot()).toMatchObject({ state: "gameOver", lives: 0 });

    await a.press("Space");

    expect(await a.snapshot()).toMatchObject({
      state: "menu",
      score: 0,
      lives: 3,
      level: 1,
      asteroids: 2,
    });
  });
});
