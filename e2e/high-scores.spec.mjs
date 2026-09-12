import { test, expect } from "./fixtures.mjs";

// Covers the ARCHITECTURE invariants "The high score table lives outside Game and outside Run"
// and "HighScores is the only module that touches localStorage".
//
// What a spec asserts here is what the player gets: what the table holds after a run ends, what
// rank came back, what survives a page load, and that the game keeps running when storage
// refuses. The storage key, the JSON shape, the sort and the validation are free to change.

// Ends a run on the next frame by spending the last life against an asteroid parked on the ship.
const endRun = async (a, { score, level = 1 }) => {
  await a.startRun();
  await a.setRun({ score, level, lives: 1 });
  await a.putAsteroidsOnShip(1);
  await a.step();
};

const table = (count, { top = 1000, step = 100 } = {}) =>
  Array.from({ length: count }, (_, i) => ({
    score: top - i * step,
    level: count - i,
  }));

test.describe("the high score table", () => {
  test("a fresh browser starts with an empty table", async ({
    asteroides: a,
  }) => {
    expect(await a.snapshot()).toMatchObject({
      state: "menu",
      highScores: [],
      rank: null,
    });
  });

  test("a finished run records the score and the level it reached", async ({
    asteroides: a,
  }) => {
    await endRun(a, { score: 1200, level: 4 });

    expect(await a.snapshot()).toMatchObject({
      state: "gameOver",
      rank: 1,
      highScores: [{ score: 1200, level: 4 }],
    });
  });

  test("a shot that lands on the frame the run ends scores nothing", async ({
    asteroides: a,
  }) => {
    await a.startRun();
    await a.setRun({ score: 300, lives: 1 });
    await a.parkAsteroids();

    // The shot is created during the ship's own draw, so it is in flight from the next frame.
    await a.press("Space");
    expect((await a.snapshot()).shots).toBe(1);

    // One asteroid does both jobs on the next frame: it overlaps the ship, and the shot that has
    // moved 15px off the ship's centre is still well inside its radius. The death comes first,
    // so the 20 points the X would have paid are never awarded.
    await a.putAsteroidsOnShip(1);
    await a.step();

    expect(await a.snapshot()).toMatchObject({
      state: "gameOver",
      score: 300,
      rank: 1,
      highScores: [{ score: 300, level: 1 }],
    });
  });

  test("a shot that lands during an ordinary death still scores", async ({
    asteroides: a,
  }) => {
    await a.startRun();
    await a.setAbsenceFrames(20);
    await a.parkAsteroids();

    await a.press("Space");
    expect((await a.snapshot()).shots).toBe(1);

    // Three lives, so this death is survivable and the run is still being played.
    await a.putAsteroidsOnShip(1);
    await a.step();

    expect(await a.snapshot()).toMatchObject({
      state: "dying",
      lives: 2,
      score: 20,
    });
  });

  test("the rank is measured against the table as it stood before the run", async ({
    asteroides: a,
  }) => {
    await a.setHighScores([
      { score: 900, level: 3 },
      { score: 500, level: 2 },
      { score: 100, level: 1 },
    ]);

    await endRun(a, { score: 700, level: 5 });

    expect(await a.snapshot()).toMatchObject({
      rank: 2,
      highScores: [
        { score: 900, level: 3 },
        { score: 700, level: 5 },
        { score: 500, level: 2 },
        { score: 100, level: 1 },
      ],
    });
  });

  test("a run that beats everything takes first place", async ({
    asteroides: a,
  }) => {
    await a.setHighScores(table(3));

    await endRun(a, { score: 5000, level: 9 });

    const { rank, highScores } = await a.snapshot();
    expect(rank).toBe(1);
    expect(highScores[0]).toMatchObject({ score: 5000, level: 9 });
  });

  test("a score that ties an existing entry ranks below it", async ({
    asteroides: a,
  }) => {
    await a.setHighScores([{ score: 500, level: 2 }]);

    await endRun(a, { score: 500, level: 7 });

    expect(await a.snapshot()).toMatchObject({
      rank: 2,
      highScores: [
        { score: 500, level: 2 },
        { score: 500, level: 7 },
      ],
    });
  });

  test("a score of zero never enters the table", async ({ asteroides: a }) => {
    await endRun(a, { score: 0 });

    expect(await a.snapshot()).toMatchObject({
      state: "gameOver",
      rank: null,
      highScores: [],
    });
  });

  test("an eleventh place run does not qualify and changes nothing", async ({
    asteroides: a,
  }) => {
    const before = await a.setHighScores(table(10));

    await endRun(a, { score: 50, level: 1 });

    expect(await a.snapshot()).toMatchObject({
      rank: null,
      highScores: before,
    });
  });

  test("the table never holds more than ten runs", async ({
    asteroides: a,
  }) => {
    await a.setHighScores(table(10));

    await endRun(a, { score: 5000, level: 9 });

    const { rank, highScores } = await a.snapshot();
    expect(rank).toBe(1);
    expect(highScores).toHaveLength(10);
    // The run that was tenth is the one that fell off.
    expect(highScores.at(-1)).toMatchObject({ score: 200 });
  });

  test("a death and a cleared level leave the table alone", async ({
    asteroides: a,
  }) => {
    await a.setHighScores([{ score: 900, level: 3 }]);

    await a.startRun();
    await a.setRun({ score: 400 });
    await a.killShipAndRebuild();

    expect(await a.snapshot()).toMatchObject({
      state: "playing",
      lives: 2,
      highScores: [{ score: 900, level: 3 }],
    });

    await a.clearField();
    await a.step();

    expect(await a.snapshot()).toMatchObject({
      state: "levelComplete",
      highScores: [{ score: 900, level: 3 }],
    });
  });

  test("restarting from game over resets the run and not the table", async ({
    asteroides: a,
  }) => {
    await endRun(a, { score: 1200, level: 4 });
    await a.press("Space");

    expect(await a.snapshot()).toMatchObject({
      state: "menu",
      score: 0,
      lives: 3,
      level: 1,
      rank: null,
      highScores: [{ score: 1200, level: 4 }],
    });
  });

  test("the table survives a page load", async ({ asteroides: a }) => {
    await endRun(a, { score: 1200, level: 4 });
    await a.reload();

    expect(await a.snapshot()).toMatchObject({
      state: "menu",
      highScores: [{ score: 1200, level: 4 }],
    });
  });

  test("a browser that refuses to store still plays and still shows the table", async ({
    asteroides: a,
  }) => {
    await a.breakStorage();

    await endRun(a, { score: 1200, level: 4 });

    expect(await a.snapshot()).toMatchObject({
      state: "gameOver",
      rank: 1,
      highScores: [{ score: 1200, level: 4 }],
    });

    // The run after it plays normally, and the table is still there to be read.
    await a.press("Space");
    await a.press("Space");

    expect(await a.snapshot()).toMatchObject({
      state: "playing",
      highScores: [{ score: 1200, level: 4 }],
    });
  });

  test("a corrupted stored value costs the history and nothing else", async ({
    asteroides: a,
  }) => {
    await a.corruptStorage();
    await a.reload();

    expect(await a.snapshot()).toMatchObject({
      state: "menu",
      highScores: [],
    });

    await a.startRun();
    await a.step();

    expect(await a.snapshot()).toMatchObject({ state: "playing" });
  });
});
