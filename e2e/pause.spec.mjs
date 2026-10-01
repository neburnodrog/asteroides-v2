import { test, expect } from "./fixtures.mjs";

// Covers the pause in CONTEXT.md. `fieldState()` reports floats, but a spec only ever compares two
// readings of it, never a coordinate.

test.describe("pausing", () => {
  test("Escape and P each pause play and each resume it", async ({
    asteroides: a,
  }) => {
    await a.startRun();

    for (const key of ["Escape", "p"]) {
      await a.press(key);
      expect((await a.snapshot()).state).toBe("paused");
      await a.press(key);
      expect((await a.snapshot()).state).toBe("playing");
    }
  });

  test("a paused field holds still", async ({ asteroides: a }) => {
    await a.startRun();
    await a.setShipVelocity({ x: 3, y: 2 });
    await a.step();

    await a.pauseGame();
    const before = await a.fieldState();
    await a.step(60);

    expect(await a.fieldState()).toEqual(before);
  });

  test("a pause during the absence counts no frame of it", async ({
    asteroides: a,
  }) => {
    await a.startRun();
    await a.parkAsteroids();
    await a.killShip();
    await a.step(5);

    await a.pauseGame();
    const before = await a.snapshot();
    const held = await a.fieldState();
    await a.step(200);

    expect(await a.snapshot()).toMatchObject({
      state: "paused",
      deathFrames: before.deathFrames,
    });
    expect(await a.fieldState()).toEqual(held);

    await a.resumeGame();
    expect(await a.snapshot()).toMatchObject({
      state: "dying",
      deathFrames: before.deathFrames,
    });
  });

  test("a paused ghost resumes as a ghost with the same frames left", async ({
    asteroides: a,
  }) => {
    await a.startRun();
    await a.enterGhost();
    await a.step(30);

    await a.pauseGame();
    const before = await a.snapshot();
    await a.step(300);

    await a.resumeGame();
    expect(await a.snapshot()).toMatchObject({
      state: "ghost",
      ghostFrames: before.ghostFrames,
      ghostLength: before.ghostLength,
    });
  });

  test("debris and traces hold still while paused", async ({
    asteroides: a,
  }) => {
    await a.startRun();
    await a.keepAsteroids(1);
    await a.parkAsteroids();

    await a.page.keyboard.down("w");
    await a.step(3);
    await a.explodeAllAsteroids();
    await a.step();

    await a.pauseGame();
    const before = await a.fieldState();
    expect(before.debris.length).toBeGreaterThan(0);
    expect(before.traces.length).toBeGreaterThan(0);

    await a.step(60);
    expect(await a.fieldState()).toEqual(before);

    await a.page.keyboard.up("w");
  });

  test("pause does nothing on the menu, the level-up and the game over screens", async ({
    asteroides: a,
  }) => {
    const tryEveryWay = async (state) => {
      await a.press("Escape");
      await a.press("p");
      await a.pauseGame();
      await a.autoPause();
      await a.step();
      expect((await a.snapshot()).state).toBe(state);
    };

    await tryEveryWay("menu");

    await a.startRun();
    await a.clearField();
    await a.step();
    await tryEveryWay("levelComplete");

    await a.press("Space");
    await a.step();
    await a.setRun({ lives: 1 });
    await a.putAsteroidsOnShip(1);
    await a.step();
    await tryEveryWay("gameOver");
  });

  test("thrust held into a pause stops, and comes back only if still held", async ({
    asteroides: a,
  }) => {
    await a.startRun();
    await a.parkAsteroids();

    await a.page.keyboard.down("w");
    await a.step();
    expect(await a.playingCues()).toContain("shipThrust");

    await a.press("p");
    expect(await a.playingCues()).not.toContain("shipThrust");
    await a.step(10);
    expect(await a.playingCues()).not.toContain("shipThrust");

    await a.press("p");
    await a.step();
    expect(await a.playingCues()).toContain("shipThrust");

    await a.press("p");
    await a.page.keyboard.up("w");
    await a.press("p");
    await a.step();
    expect(await a.playingCues()).not.toContain("shipThrust");
  });

  test("nothing sounds under a pause, and a ringing break does not come back", async ({
    asteroides: a,
  }) => {
    await a.startRun();
    await a.parkAsteroids();
    await a.playCue("shipExplosion");
    await a.playCue("asteroidBreakM");
    await a.playCue("levelUp");
    expect((await a.playingCues()).length).toBeGreaterThan(0);

    await a.press("p");
    expect(await a.playingCues()).toEqual([]);

    await a.press("p");
    await a.step();
    expect(await a.playingCues()).toEqual([]);
  });

  test("confirm resumes without firing a shot", async ({ asteroides: a }) => {
    await a.startRun();
    await a.parkAsteroids();

    await a.press("Escape");
    await a.press("Space");
    expect((await a.snapshot()).state).toBe("playing");

    await a.step(3);
    expect((await a.snapshot()).shots).toBe(0);
  });

  test("the auto-pause path pauses play and focus coming back leaves it paused", async ({
    asteroides: a,
  }) => {
    await a.startRun();

    await a.autoPause();
    expect((await a.snapshot()).state).toBe("paused");

    await a.dispatchWindowEvent("focus");
    await a.step(30);
    expect((await a.snapshot()).state).toBe("paused");
  });

  test("a real blur does not pause while the harness is attached", async ({
    asteroides: a,
  }) => {
    await a.startRun();

    await a.dispatchWindowEvent("blur");
    await a.step();

    expect((await a.snapshot()).state).toBe("playing");
  });

  test("the volume on the pause screen applies and survives a reload", async ({
    asteroides: a,
  }) => {
    await a.startRun();
    await a.parkAsteroids();
    await a.pauseGame();

    await a.press("ArrowLeft");
    await a.press("a");
    expect(await a.volumeStep()).toBe(6);
    expect(await a.outputLevel()).toBeCloseTo(0.36, 10);
    expect((await a.cuePlayCounts()).shoot).toBe(2);
    expect((await a.snapshot()).state).toBe("paused");

    await a.reload();
    expect(await a.volumeStep()).toBe(6);
  });
});
