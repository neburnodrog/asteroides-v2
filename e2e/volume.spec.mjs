import { test, expect } from "./fixtures.mjs";

// Covers the volume in CONTEXT.md as the start menu drives it. The output level is the one
// SoundManager last handed p5.sound, because a headless browser never resumes the audio context
// and so never moves the gain itself.

test.describe("the volume on the start menu", () => {
  test("a fresh browser starts at step 8", async ({ asteroides: a }) => {
    expect(await a.volumeStep()).toBe(8);
    expect(await a.outputLevel()).toBeCloseTo(0.64, 10);
  });

  test("right raises the step and left lowers it, on arrows and on A/D", async ({
    asteroides: a,
  }) => {
    await a.press("ArrowRight");
    expect(await a.volumeStep()).toBe(9);
    await a.press("d");
    expect(await a.volumeStep()).toBe(10);
    await a.press("ArrowLeft");
    expect(await a.volumeStep()).toBe(9);
    await a.press("a");
    expect(await a.volumeStep()).toBe(8);
  });

  test("the step clamps at 0 and at 10", async ({ asteroides: a }) => {
    for (let i = 0; i < 4; i++) await a.press("ArrowRight");
    expect(await a.volumeStep()).toBe(10);

    for (let i = 0; i < 14; i++) await a.press("ArrowLeft");
    expect(await a.volumeStep()).toBe(0);
  });

  test("the output level is the step squared", async ({ asteroides: a }) => {
    await a.setVolume(5);
    expect(await a.outputLevel()).toBeCloseTo(0.25, 10);

    await a.setVolume(10);
    expect(await a.outputLevel()).toBe(1);

    // p5.sound's one output gain carries every cue, synthesized ones included.
    await a.setVolume(0);
    expect(await a.outputLevel()).toBe(0);
  });

  test("each step change plays one unvaried shot, and a clamped press plays nothing", async ({
    asteroides: a,
  }) => {
    await a.press("ArrowRight");
    expect((await a.cuePlayCounts()).shoot).toBe(1);
    expect(await a.lastCuePlay("shoot")).toEqual({ rate: 1, level: 1 });

    await a.press("ArrowRight");
    expect((await a.cuePlayCounts()).shoot).toBe(2);

    await a.press("ArrowRight");
    expect(await a.volumeStep()).toBe(10);
    expect((await a.cuePlayCounts()).shoot).toBe(2);
  });

  test("volume presses do not start the run", async ({ asteroides: a }) => {
    await a.press("ArrowLeft");
    await a.press("ArrowRight");
    await a.press("a");
    await a.press("d");

    expect(await a.snapshot()).toMatchObject({ state: "menu", shots: 0 });
  });

  test("the chosen step survives a reload", async ({ asteroides: a }) => {
    await a.press("ArrowLeft");
    await a.press("ArrowLeft");
    expect(await a.volumeStep()).toBe(6);

    await a.reload();

    expect(await a.volumeStep()).toBe(6);
    expect(await a.outputLevel()).toBeCloseTo(0.36, 10);
  });

  test("corrupt stored data loads the default without throwing", async ({
    asteroides: a,
  }) => {
    await a.corruptVolumeStorage();
    await a.reload();

    expect(await a.volumeStep()).toBe(8);
  });

  test("a store that refuses writes keeps the step for the page", async ({
    asteroides: a,
  }) => {
    await a.breakStorage();
    await a.press("ArrowLeft");

    expect(await a.volumeStep()).toBe(7);
  });

  test("a volume press made during play does not move the volume on the next menu", async ({
    asteroides: a,
  }) => {
    await a.startRun();
    await a.parkAsteroids();
    await a.press("d");

    await a.requestRebuild("menu");
    await a.step(3);

    expect(await a.snapshot()).toMatchObject({ state: "menu" });
    expect(await a.volumeStep()).toBe(8);
  });
});
