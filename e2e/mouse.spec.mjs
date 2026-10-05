import { test, expect } from "./fixtures.mjs";

// Covers Steer and Strafe in CONTEXT.md and the click as a press of the Space binding. Headings
// are floats, so a spec compares them with the angle the game itself reads off the pointer, or
// with an earlier reading, never with a number it made up.

const TURN = Math.PI / 40;
const TAU = 2 * Math.PI;

const normalised = (angle) => ((angle % TAU) + TAU) % TAU;

// The angle from the ship to the pointer as the game sees both.
const bearingOf = async (a) => {
  const { ship } = await a.fieldState();
  const pointer = await a.pointer();
  return normalised(Math.atan2(pointer.y - ship.y, pointer.x - ship.x));
};

const heading = async (a) => (await a.snapshot()).shipHeading;

// Starts a run with nothing able to reach the ship, and returns where the ship stands.
const startQuietRun = async (a) => {
  await a.startRun();
  await a.parkAsteroids();
  return (await a.fieldState()).ship;
};

test.describe("steering", () => {
  test("turns toward the pointer at the turn rate, then snaps onto it and holds", async ({
    asteroides: a,
  }) => {
    const ship = await startQuietRun(a);
    // About 0.29 radians below the heading: three full steps, then less than one.
    await a.pointAt(ship.x + 100, ship.y + 30);
    const bearing = await bearingOf(a);
    expect(bearing).toBeGreaterThan(3 * TURN);
    expect(bearing).toBeLessThan(4 * TURN);

    await a.step(3);
    expect(await heading(a)).toBeCloseTo(3 * TURN, 10);

    await a.step();
    const settled = await heading(a);
    expect(settled).toBeCloseTo(bearing, 10);

    await a.step(10);
    expect(await heading(a)).toBe(settled);
  });

  test("takes the short way round, across zero", async ({ asteroides: a }) => {
    const ship = await startQuietRun(a);
    await a.pointAt(ship.x + 100, ship.y - 100);

    await a.step();
    expect(await heading(a)).toBeCloseTo(TAU - TURN, 10);

    // An eighth of a turn up, which is ten steps give or take where the ship's centre falls.
    await a.step(11);
    expect(await heading(a)).toBeCloseTo(await bearingOf(a), 10);
  });

  test("a pointer behind the ship is reached in at most 40 frames", async ({
    asteroides: a,
  }) => {
    const ship = await startQuietRun(a);
    await a.pointAt(ship.x - 200, ship.y);

    await a.step(40);
    expect(await heading(a)).toBeCloseTo(await bearingOf(a), 10);
  });

  test("steers along the straight line, not across the wrap", async ({
    asteroides: a,
  }) => {
    await startQuietRun(a);
    const { canvas } = await a.snapshot();
    await a.putShipAt({ x: canvas.width - 20, y: canvas.height / 2 });
    await a.pointAt(20, canvas.height / 2);

    await a.step(40);
    const bearing = await bearingOf(a);
    expect(bearing).toBeCloseTo(Math.PI, 1);
    expect(await heading(a)).toBeCloseTo(bearing, 10);
  });

  test("the arrows override steering until the pointer moves again", async ({
    asteroides: a,
  }) => {
    const ship = await startQuietRun(a);
    await a.pointAt(ship.x + 100, ship.y + 100);
    await a.step(10);
    expect(await heading(a)).toBeCloseTo(await bearingOf(a), 10);
    const steered = await heading(a);

    await a.hold("ArrowLeft", 5);
    const turned = await heading(a);
    expect(turned).toBeCloseTo(steered - 5 * TURN, 10);

    await a.step(10);
    expect(await heading(a)).toBe(turned);

    await a.pointAt(ship.x + 100, ship.y + 101);
    await a.step(10);
    expect(await heading(a)).toBeCloseTo(await bearingOf(a), 10);
  });

  test("a pointer moved before play began does not steer", async ({
    asteroides: a,
  }) => {
    const { canvas } = await a.snapshot();
    await a.pointAt(canvas.width / 2, canvas.height - 10);

    await a.press("Space");
    await a.parkAsteroids();
    await a.step(10);

    expect(await heading(a)).toBe(0);
  });

  test("the heading stays within [0, 2PI)", async ({ asteroides: a }) => {
    await startQuietRun(a);

    for (const key of ["ArrowLeft", "ArrowRight"]) {
      for (let i = 0; i < 6; i++) {
        await a.hold(key, 15);
        const h = await heading(a);
        expect(h).toBeGreaterThanOrEqual(0);
        expect(h).toBeLessThan(TAU);
      }
    }
  });
});

test.describe("strafing", () => {
  // One frame from rest moves the ship by velocity * 0.98, so the displacements compare the
  // accelerations directly.
  const oneFrameOf = async (a, key) => {
    await a.setShipVelocity({ x: 0, y: 0 });
    const before = (await a.fieldState()).ship;
    await a.hold(key, 1);
    const after = (await a.fieldState()).ship;
    return { x: after.x - before.x, y: after.y - before.y };
  };

  test("A and D push the ship sideways at half the thrust, without turning it", async ({
    asteroides: a,
  }) => {
    await startQuietRun(a);

    const thrust = await oneFrameOf(a, "w");
    const right = await oneFrameOf(a, "d");
    const left = await oneFrameOf(a, "a");

    expect(thrust.x).toBeGreaterThan(0);
    expect(right.x).toBeCloseTo(0, 10);
    expect(right.y).toBeCloseTo(thrust.x / 2, 10);
    expect(left.x).toBeCloseTo(0, 10);
    expect(left.y).toBeCloseTo(-thrust.x / 2, 10);
    expect(await heading(a)).toBe(0);
  });

  test("strafing obeys the speed cap, sounds the thrust and leaves no trace", async ({
    asteroides: a,
  }) => {
    await startQuietRun(a);
    const { canvas } = await a.snapshot();

    await a.page.keyboard.down("d");
    await a.step(200);
    expect(await a.playingCues()).toContain("shipThrust");
    expect((await a.fieldState()).traces).toEqual([]);

    const before = (await a.fieldState()).ship;
    await a.step();
    const after = (await a.fieldState()).ship;
    await a.page.keyboard.up("d");

    const dy = Math.abs(after.y - before.y);
    expect(Math.min(dy, canvas.height - dy)).toBeLessThan(5.5);

    await a.step();
    expect(await a.playingCues()).not.toContain("shipThrust");
  });

  test("A and D no longer turn the ship, the arrows do", async ({
    asteroides: a,
  }) => {
    await startQuietRun(a);

    await a.hold("a", 10);
    await a.hold("d", 10);
    expect(await heading(a)).toBe(0);

    await a.hold("ArrowRight", 10);
    expect(await heading(a)).toBeCloseTo(10 * TURN, 10);
  });
});

test.describe("clicking", () => {
  test("one click fires one shot, and holding the button fires no more", async ({
    asteroides: a,
  }) => {
    await startQuietRun(a);

    await a.mouseDown();
    await a.step(20);
    await a.mouseUp();
    await a.step();

    expect((await a.cuePlayCounts()).shoot).toBe(1);
  });

  test("a click confirms every screen and never also fires", async ({
    asteroides: a,
  }) => {
    await a.click();
    expect((await a.snapshot()).state).toBe("playing");
    await a.parkAsteroids();
    await a.step(3);

    await a.pauseGame();
    await a.click();
    expect((await a.snapshot()).state).toBe("playing");
    await a.step(3);
    expect((await a.cuePlayCounts()).shoot).toBeUndefined();

    await a.clearField();
    await a.step();
    expect((await a.snapshot()).state).toBe("levelComplete");
    await a.click();
    await a.step();
    expect((await a.snapshot()).state).toBe("playing");

    await a.setRun({ lives: 1 });
    await a.putAsteroidsOnShip(1);
    await a.step();
    expect((await a.snapshot()).state).toBe("gameOver");
    await a.click();
    await a.step();
    expect((await a.snapshot()).state).toBe("menu");
    expect((await a.cuePlayCounts()).shoot).toBeUndefined();
  });

  test("a ghost's click fires nothing, then or later", async ({
    asteroides: a,
  }) => {
    await startQuietRun(a);
    const { ghostWindow } = await a.enterGhost();

    await a.click();
    await a.step(ghostWindow);
    expect((await a.snapshot()).state).toBe("playing");
    await a.step(3);

    expect((await a.cuePlayCounts()).shoot).toBeUndefined();
  });

  test("a right click fires nothing and opens no context menu", async ({
    asteroides: a,
  }) => {
    await startQuietRun(a);

    await a.click({ button: "right" });
    await a.step(3);

    expect((await a.cuePlayCounts()).shoot).toBeUndefined();
    expect(await a.contextMenuSuppressed()).toBe(true);
  });
});

test.describe("the pointer leaving the window", () => {
  test("pauses play while steering is in control", async ({
    asteroides: a,
  }) => {
    const ship = await startQuietRun(a);
    await a.pointAt(ship.x + 50, ship.y);
    await a.step();

    await a.pointerLeave();
    expect((await a.snapshot()).state).toBe("paused");
  });

  test("does nothing while the arrows are in control", async ({
    asteroides: a,
  }) => {
    const ship = await startQuietRun(a);
    await a.pointAt(ship.x + 50, ship.y);
    await a.hold("ArrowLeft", 2);

    await a.pointerLeave();
    await a.step();
    expect((await a.snapshot()).state).toBe("playing");
  });

  test("a real leave does not pause while the harness is attached", async ({
    asteroides: a,
  }) => {
    const ship = await startQuietRun(a);
    await a.pointAt(ship.x + 50, ship.y);

    await a.dispatchPointerLeave();
    await a.step();

    expect((await a.snapshot()).state).toBe("playing");
  });
});

test.describe("the cursor", () => {
  test("is a crosshair during play and the default on every screen", async ({
    asteroides: a,
  }) => {
    await a.step();
    expect(await a.cursor()).toBe("default");

    await startQuietRun(a);
    await a.step();
    expect(await a.cursor()).toBe("crosshair");

    await a.pauseGame();
    await a.step();
    expect(await a.cursor()).toBe("default");

    await a.resumeGame();
    await a.setAbsenceFrames(5);
    await a.killShip();
    await a.step();
    expect(await a.cursor()).toBe("crosshair");

    await a.clearField();
    const { ghostWindow } = await a.snapshot();
    await a.step(5 + ghostWindow + 2);
    expect((await a.snapshot()).state).toBe("levelComplete");
    expect(await a.cursor()).toBe("default");
  });
});
