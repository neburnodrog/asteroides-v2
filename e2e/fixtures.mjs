import { test as base, expect } from "@playwright/test";

// Every verb the harness exposes. Naming them here means a spec calls a.step() instead of
// writing page.evaluate, and a verb that gets renamed fails in one place.
const VERBS = [
  "freeze",
  "resume",
  "step",
  "setMinimumDeathFrames",
  "snapshot",
  "startRun",
  "setRun",
  "requestRebuild",
  "clearField",
  "aimAsteroidAt",
  "findClearing",
  "parkAsteroids",
  "putAsteroidsOnShip",
  "putAsteroidInFrontOfShip",
  "putAsteroidAt",
  "explodeAllAsteroids",
];

export const test = base.extend({
  // A frozen game on a fresh page, sitting at the start menu. One page per test, so no test
  // inherits a world that another test arranged.
  asteroides: async ({ page }, use) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });

    await page.goto("/?e2e=1");
    await page.waitForFunction(() => Boolean(window.__asteroides));

    const api = { page, errors };

    for (const verb of VERBS) {
      api[verb] = (...args) =>
        page.evaluate(
          ([name, callArgs]) => window.__asteroides[name](...callArgs),
          [verb, args]
        );
    }

    // A real key event, then exactly one frame for the game to read it. p5 reads the keyboard
    // during draw, so a press with no frame after it is a press nothing ever sees.
    api.press = async (key, frames = 1) => {
      await page.keyboard.press(key);
      await api.step(frames);
    };

    api.hold = async (key, frames) => {
      await page.keyboard.down(key);
      await api.step(frames);
      await page.keyboard.up(key);
    };

    // Kills the ship and steps out the death, shortened so the suite does not spend three
    // seconds of frames per death. The real code path still runs: the search still has to find
    // a clearing, and putAsteroidsOnShip parks the rest of the field out of the way so it does.
    // The death ends on the frame the counter reaches its minimum, the death frame included.
    api.killShipAndRebuild = async (minimumDeathFrames = 40) => {
      await api.setMinimumDeathFrames(minimumDeathFrames);
      await api.putAsteroidsOnShip(1);
      await api.step(minimumDeathFrames);
    };

    await api.freeze();
    await use(api);

    expect(errors, `console errors: ${errors.join(" | ")}`).toEqual([]);
  },
});

export { expect };
