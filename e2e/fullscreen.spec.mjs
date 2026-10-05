import { test, expect } from "./fixtures.mjs";

// Covers fullscreen and the pointer lock it brings to play. How a spec reaches a lock headless
// Chromium refuses is under "The mouse" in README.md.

const TAU = 2 * Math.PI;

test.describe("fullscreen", () => {
  test("F enters and leaves it on a screen and during play, and changes nothing else", async ({
    asteroides: a,
  }) => {
    await a.press("f");
    await a.waitForFullscreen(true);
    expect((await a.snapshot()).state).toBe("menu");

    await a.press("f");
    await a.waitForFullscreen(false);

    await a.startRun();
    await a.parkAsteroids();
    await a.press("f");
    await a.waitForFullscreen(true);
    expect((await a.snapshot()).state).toBe("playing");
  });

  test("the corner button toggles it, and its click neither confirms nor fires", async ({
    asteroides: a,
  }) => {
    await a.clickFullscreenButton();
    await a.waitForFullscreen(true);
    expect((await a.snapshot()).state).toBe("menu");

    await a.startRun();
    await a.parkAsteroids();
    await a.clickFullscreenButton();
    await a.waitForFullscreen(false);
    await a.step(3);
    expect((await a.cuePlayCounts()).shoot).toBeUndefined();
  });
});

test.describe("pointer lock", () => {
  test("is asked for only during play in fullscreen", async ({
    asteroides: a,
  }) => {
    const wantsLock = async () => (await a.fullscreenState()).wantsLock;

    await a.startRun();
    await a.parkAsteroids();
    await a.step();
    expect(await wantsLock()).toBe(false);

    await a.press("f");
    await a.waitForFullscreen(true);
    expect(await wantsLock()).toBe(true);

    await a.pauseGame();
    await a.step();
    expect(await wantsLock()).toBe(false);

    await a.resumeGame();
    await a.step();
    expect(await wantsLock()).toBe(true);

    const absenceFrames = 5;
    await a.setAbsenceFrames(absenceFrames);
    await a.killShip();
    await a.step();
    expect(await wantsLock()).toBe(true);

    // The rest of the absence, the whole ghost, then the frame that finds the field empty.
    await a.clearField();
    const { ghostWindow } = await a.snapshot();
    await a.step(absenceFrames + ghostWindow + 2);
    expect((await a.snapshot()).state).toBe("levelComplete");
    expect(await wantsLock()).toBe(false);
  });

  test("locked, the mouse moves a pointer inside the canvas and the ship steers at it", async ({
    asteroides: a,
  }) => {
    await a.startRun();
    await a.parkAsteroids();
    const { ship } = await a.fieldState();
    await a.pointAt(10, 10);
    await a.setPointerLocked(true);
    const start = await a.pointer();

    await a.moveMouseBy(0, 80);
    const moved = await a.pointer();
    expect(moved.x).toBe(start.x);
    expect(moved.y).toBe(start.y + 80);
    expect(moved.steering).toBe(true);

    await a.step(40);
    const bearing = Math.atan2(moved.y - ship.y, moved.x - ship.x);
    expect((await a.snapshot()).shipHeading).toBeCloseTo((bearing + TAU) % TAU, 10);
  });

  test("a locked pointer starts on the canvas centre and stops at its edges", async ({
    asteroides: a,
  }) => {
    await a.startRun();
    const { canvas } = await a.snapshot();
    await a.setPointerLocked(true);

    expect(await a.pointer()).toMatchObject({
      x: canvas.width / 2,
      y: canvas.height / 2,
    });

    await a.moveMouseBy(canvas.width, canvas.height);
    expect(await a.pointer()).toMatchObject({
      x: canvas.width,
      y: canvas.height,
    });
  });

  test("a refused lock is asked for again a second later", async ({
    asteroides: a,
  }) => {
    const requests = async () => (await a.fullscreenState()).lockRequests;

    await a.startRun();
    await a.parkAsteroids();
    await a.press("f");
    await a.waitForFullscreen(true);
    expect(await requests()).toBe(1);

    await a.step(30);
    expect(await requests()).toBe(1);

    await a.step(60);
    expect(await requests()).toBe(2);
  });

  test("the game over screen and the menu release it", async ({
    asteroides: a,
  }) => {
    const wantsLock = async () => (await a.fullscreenState()).wantsLock;

    await a.startRun();
    await a.press("f");
    await a.waitForFullscreen(true);
    expect(await wantsLock()).toBe(true);

    await a.setRun({ lives: 1 });
    await a.putAsteroidsOnShip(1);
    await a.step();
    expect((await a.snapshot()).state).toBe("gameOver");
    expect(await wantsLock()).toBe(false);

    await a.press("Space");
    await a.step();
    expect((await a.snapshot()).state).toBe("menu");
    expect(await wantsLock()).toBe(false);
  });

  test("losing the lock does not pause while the harness is attached", async ({
    asteroides: a,
  }) => {
    await a.startRun();
    await a.setPointerLocked(true);
    await a.setPointerLocked(false);
    await a.step();

    expect((await a.snapshot()).state).toBe("playing");
  });
});
