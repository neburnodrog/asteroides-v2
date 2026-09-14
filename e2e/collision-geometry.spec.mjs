import { test, expect } from "./fixtures.mjs";

// A big asteroid with a fixed radius and a fixed side count, so the arithmetic in these specs
// does not depend on what the RNG chose. Seven sides puts a flat edge toward the ship at angle
// 0 and a corner toward it at angle PI / 7.
const ROCK = { size: "X", radius: 90, sides: 7 };
const FLAT_TO_SHIP = 0;
const CORNER_TO_SHIP = Math.PI / 7;

test.describe("the asteroid's real edge", () => {
  // Radius 90, seven sides, stroked at 8. The corner reaches 94.4px from the centre and the flat
  // edge only 85.1px, so at one distance the corner is 4.4px inside the nose and the flat is
  // 4.9px clear of it. A circle cannot tell these two apart.
  test("a corner kills where a flat edge at the same distance does not", async ({
    asteroides: a,
  }) => {
    await a.startRun();

    await a.putAsteroidInFrontOfShip({ ...ROCK, angle: FLAT_TO_SHIP, gapFromNose: 0 });
    await a.step();
    expect(await a.snapshot()).toMatchObject({ state: "playing", lives: 3 });

    await a.putAsteroidInFrontOfShip({ ...ROCK, angle: CORNER_TO_SHIP, gapFromNose: 0 });
    await a.step();
    expect(await a.snapshot()).toMatchObject({ state: "dying", lives: 2 });
  });
});

test.describe("the frame the collision test reads", () => {
  // With movement inside draw(), checkIfCollisions ran before the entities moved and judged the
  // previous frame's positions. At the ship's terminal speed that is 5.88px of error. Here the
  // ship starts 5.6px clear of the asteroid's nearest corner and travels 19.6px in one frame, so
  // a test that reads the frame it is about to draw kills on that frame and a stale one does not.
  test("a ship that crosses into an asteroid dies on that frame", async ({
    asteroides: a,
  }) => {
    await a.startRun();
    await a.putAsteroidInFrontOfShip({
      ...ROCK,
      angle: CORNER_TO_SHIP,
      gapFromNose: 10,
    });
    await a.setShipVelocity({ x: 20, y: 0 });

    await a.step();

    expect(await a.snapshot()).toMatchObject({ state: "dying", lives: 2 });
  });
});

// A small asteroid with a fixed radius and a fixed side count. Seven sides and an angle of
// PI / 2 put one vertex straight down the screen, toward a shot flying along the line below it.
const SMALL = { size: "S", radius: 20, sides: 7 };
const VERTEX_DOWN = Math.PI / 2;

// Stroked at 4 and measured with the shot's own 4px reach, radius 20 reaches
// 20 + 6 / cos(PI / 7) = 26.66px at a corner.
const SMALL_REACH = 20 + 6 / Math.cos(Math.PI / 7);

// How far past that corner the shot's line runs. A 7-gon's vertex is 128.6 degrees wide, so at
// this depth the asteroid is 11px across: wider than the 6.96px between the frame's samples,
// and far narrower than the 20.88px step a single end-of-frame reading takes.
const GRAZE_DEPTH = 2.66;

const SHOT_SPEED = 15;

// (5 + 1) * 0.98. Thrust is only added while the ship is under 5, then 2% resistance holds it
// there, so this is the fastest the ship ever flies.
const TERMINAL_SPEED = 5.88;

// setShipVelocity is read at the top of the frame, before that frame's resistance, so a ship
// that must be flying at exactly `speed` when it fires starts the frame a little above it.
const velocityFor = (speed) => speed / 0.98;

test.describe("the frame the shot test reads", () => {
  // The defect, at a speed the game can actually produce. The ship flies at its terminal speed,
  // so the shot steps 20.88px per frame, and the asteroid sits 24px off the shot's line, inside
  // the 21.63 to 26.66px band where the chord is shorter than one frame's travel. Its centre is
  // the midpoint of the third step, so no end-of-frame position is ever inside it.
  test("a grazing shot at a reachable speed breaks the asteroid", async ({
    asteroides: a,
  }) => {
    await a.startRun();
    await a.parkAsteroids();
    await a.setShipVelocity({ x: 0, y: velocityFor(TERMINAL_SPEED) });

    const { canvas } = await a.snapshot();
    await a.press("Space");

    // The shot is created at the ship's position during the frame the press was read, and the
    // ship has moved one frame's worth down the screen by then. It flies along +x from there.
    const shot = { x: canvas.width / 2, y: canvas.height / 2 + TERMINAL_SPEED };
    const perFrame = SHOT_SPEED + TERMINAL_SPEED;

    await a.putAsteroidAt({
      ...SMALL,
      angle: VERTEX_DOWN,
      x: shot.x + perFrame * 2.5,
      y: shot.y - (SMALL_REACH - GRAZE_DEPTH),
    });

    await a.step(3);

    expect(await a.snapshot()).toMatchObject({ score: 75, asteroids: 1 });
  });

  // A guard rather than a defect: no ship reaches this speed, so a shot cannot clear a whole
  // asteroid in one frame in play. It fails only if the sampling is absent altogether.
  test("a shot that crosses the whole asteroid in one frame breaks it", async ({
    asteroides: a,
  }) => {
    const exaggerated = 85;

    await a.startRun();
    await a.parkAsteroids();
    await a.setShipVelocity({ x: 0, y: velocityFor(exaggerated) });

    const { canvas } = await a.snapshot();
    await a.press("Space");

    const shot = { x: canvas.width / 2, y: canvas.height / 2 + exaggerated };
    const perFrame = SHOT_SPEED + exaggerated;

    // Dead centre, so the shot crosses the asteroid's full 53.3px span inside a 100px step.
    await a.putAsteroidAt({ ...SMALL, x: shot.x + perFrame * 2.5, y: shot.y });

    await a.step(3);

    expect(await a.snapshot()).toMatchObject({ score: 75, asteroids: 1 });
  });

  // A wrap is a teleport, not a path. The line between the asteroid's two positions this frame
  // sweeps the whole canvas and passes straight through the shot, and neither end of it is
  // anywhere near one, so the pair is tested at its end state only.
  test("a shot near an asteroid that wrapped this frame does not score", async ({
    asteroides: a,
  }) => {
    await a.startRun();
    await a.parkAsteroids();

    const { canvas } = await a.snapshot();
    await a.press("Space");

    await a.putAsteroidAt({
      ...SMALL,
      x: canvas.width + SMALL.radius + 5,
      y: canvas.height / 2,
    });

    await a.step();

    expect(await a.snapshot()).toMatchObject({ score: 0, asteroids: 2 });
  });
});
