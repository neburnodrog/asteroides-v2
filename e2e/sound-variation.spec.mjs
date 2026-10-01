import { test, expect } from "./fixtures.mjs";

// Covers the variation in CONTEXT.md. A headless browser cannot hear a cue, so these specs read
// the rate and level SoundManager handed the cue on its last play, which is the part the game
// decides.

const range = (rate, pitch) => ({
  minRate: rate * (1 - pitch),
  maxRate: rate * (1 + pitch),
  minLevel: 0.85,
  maxLevel: 1,
});

const EXPECTED = {
  shoot: range(1, 0.05),
  shipExplosion: range(1, 0.1),
  asteroidBreakL: range(0.85, 0.1),
  asteroidBreakM: range(1, 0.1),
  asteroidBreakS: range(1.15, 0.1),
  levelUp: range(1, 0.1),
  gameOver: range(1, 0.1),
  shipThrust: range(1, 0.05),
};

const expectWithin = (play, { minRate, maxRate, minLevel, maxLevel }) => {
  expect(play.rate).toBeGreaterThanOrEqual(minRate);
  expect(play.rate).toBeLessThanOrEqual(maxRate);
  expect(play.level).toBeGreaterThanOrEqual(minLevel);
  expect(play.level).toBeLessThanOrEqual(maxLevel);
};

test.describe("cue variation", () => {
  test("every cue varies within its configured range", async ({
    asteroides: a,
  }) => {
    const ranges = await a.cueVariation();

    expect(Object.keys(ranges).sort()).toEqual(Object.keys(EXPECTED).sort());
    for (const [cue, expected] of Object.entries(EXPECTED)) {
      for (const [bound, value] of Object.entries(expected)) {
        expect(ranges[cue][bound], `${cue} ${bound}`).toBeCloseTo(value, 10);
      }
    }
  });

  test("no X break plays higher than any S break", async ({
    asteroides: a,
  }) => {
    const { asteroidBreakL, asteroidBreakS } = await a.cueVariation();
    expect(asteroidBreakL.maxRate).toBeLessThan(asteroidBreakS.minRate);
  });

  test("two plays of the same cue differ, both within range", async ({
    asteroides: a,
  }) => {
    await a.playCue("shoot");
    const first = await a.lastCuePlay("shoot");
    await a.playCue("shoot");
    const second = await a.lastCuePlay("shoot");

    expectWithin(first, EXPECTED.shoot);
    expectWithin(second, EXPECTED.shoot);
    expect(second.rate).not.toBe(first.rate);
    expect(second.level).not.toBe(first.level);
  });

  test("a pinned random source makes the variation reproducible", async ({
    asteroides: a,
  }) => {
    await a.pinSoundRandom(0.25);

    await a.playCue("asteroidBreakS");
    const first = await a.lastCuePlay("asteroidBreakS");
    await a.playCue("asteroidBreakS");
    const second = await a.lastCuePlay("asteroidBreakS");

    expect(second).toEqual(first);
    expect(first.rate).toBeCloseTo(1.15 * 0.95, 10);
    expect(first.level).toBeCloseTo(0.8875, 10);
  });

  for (const [size, cue] of [
    ["X", "asteroidBreakL"],
    ["M", "asteroidBreakM"],
    ["S", "asteroidBreakS"],
  ]) {
    test(`breaking an ${size} plays that size's file`, async ({
      asteroides: a,
    }) => {
      await a.startRun();
      await a.putAsteroidInFrontOfShip({ size, gapFromNose: 40 });

      await a.press("Space");
      await a.step(20);

      const counts = await a.cuePlayCounts();
      expect(counts[cue]).toBe(1);
      for (const other of ["asteroidBreakL", "asteroidBreakM", "asteroidBreakS"]) {
        if (other !== cue) expect(counts[other] ?? 0).toBe(0);
      }
    });
  }

  test("holding thrust starts one tone and never retunes it", async ({
    asteroides: a,
  }) => {
    await a.startRun();
    await a.parkAsteroids();

    await a.page.keyboard.down("w");
    await a.step();
    const started = await a.lastCuePlay("shipThrust");
    expectWithin(started, EXPECTED.shipThrust);

    await a.step(60);
    await a.page.keyboard.up("w");

    expect((await a.cuePlayCounts()).shipThrust).toBe(1);
    expect(await a.lastCuePlay("shipThrust")).toEqual(started);
  });
});
