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
  // previous frame's positions. At the ship's terminal speed that is 50px of error. Here the
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
