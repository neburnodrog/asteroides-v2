import { test, expect } from "./fixtures.mjs";

// Regression cover for the defect in #3: three cues were played by the game and never loaded,
// so SoundManager.play no-opped on them and nothing ever made a sound. Asserting the key set
// is what turns that class of bug from silence into a failing test.
//
// Audibility itself is not asserted. A headless browser holds the audio context suspended, so
// these specs check that a cue exists and that its start and stop are driven, not that a
// speaker moved.

const EVERY_CUE = [
  "shoot",
  "shipExplosion",
  "asteroidBreakS",
  "asteroidBreakM",
  "asteroidBreakL",
  "levelUp",
  "gameOver",
  "shipThrust",
];

test.describe("sound", () => {
  test("every cue the game plays is loaded", async ({ asteroides: a }) => {
    expect((await a.soundCueKeys()).sort()).toEqual([...EVERY_CUE].sort());
  });

  test("holding thrust starts the thrust loop and releasing it stops", async ({
    asteroides: a,
  }) => {
    await a.startRun();
    await a.parkAsteroids();

    await a.page.keyboard.down("w");
    await a.step();
    expect(await a.playingCues()).toContain("shipThrust");

    await a.page.keyboard.up("w");
    await a.step();
    expect(await a.playingCues()).not.toContain("shipThrust");
  });

  test("dying while thrust is held stops the thrust loop", async ({
    asteroides: a,
  }) => {
    await a.startRun();

    await a.page.keyboard.down("w");
    await a.step();
    expect(await a.playingCues()).toContain("shipThrust");

    // The key stays down across the death. Only the explosion may stop the loop.
    await a.putAsteroidsOnShip(1);
    await a.step();
    expect(await a.snapshot()).toMatchObject({ shipExploded: true });
    expect(await a.playingCues()).not.toContain("shipThrust");

    await a.page.keyboard.up("w");
  });

  test("a rebuild into the menu leaves no thrust loop running", async ({
    asteroides: a,
  }) => {
    await a.startRun();

    await a.page.keyboard.down("w");
    await a.step();
    expect(await a.playingCues()).toContain("shipThrust");
    await a.page.keyboard.up("w");

    // Tears the Game down and builds a new one around the same long-lived SoundManager, which
    // is the only thing that could keep a loop running across the boundary.
    await a.requestRebuild("menu");
    await a.step(2);
    expect(await a.snapshot()).toMatchObject({ state: "menu" });
    expect(await a.playingCues()).not.toContain("shipThrust");
  });

  test("clearing a level while thrust is held stops the thrust loop", async ({
    asteroides: a,
  }) => {
    await a.startRun();

    await a.page.keyboard.down("w");
    await a.step();
    expect(await a.playingCues()).toContain("shipThrust");

    // The level-up screen takes over the draw, so the ship stops being stepped and the key
    // release the player eventually makes is never read. Nothing after this frame can stop the
    // loop until the player confirms the screen.
    await a.clearField();
    await a.step(2);
    expect(await a.snapshot()).toMatchObject({ state: "levelComplete" });
    expect(await a.playingCues()).not.toContain("shipThrust");

    await a.page.keyboard.up("w");
  });

  test("the level-up cue survives being retriggered while it is still sounding", async ({
    asteroides: a,
  }) => {
    await a.startRun();

    await a.playCue("levelUp");
    expect(await a.playingCues()).toContain("levelUp");

    // Two levels cleared in quick succession. The second play restarts the one oscillator the
    // cue owns, so what this guards is that retriggering mid-cue neither throws nor kills it.
    // A throw would surface through the fixture's page-error check rather than here.
    await a.playCue("levelUp");
    expect(await a.playingCues()).toContain("levelUp");
  });
});
