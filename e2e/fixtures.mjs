import { test as base, expect } from "@playwright/test";

// Every verb the harness exposes. Naming them here means a spec calls a.step() instead of
// writing page.evaluate, and a verb that gets renamed fails in one place.
const VERBS = [
  "freeze",
  "resume",
  "step",
  "setAbsenceFrames",
  "snapshot",
  "startRun",
  "setRun",
  "killShip",
  "requestRebuild",
  "readHighScores",
  "setHighScores",
  "clearHighScores",
  "breakStorage",
  "corruptStorage",
  "clearField",
  "keepAsteroids",
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

    // A real page load, because a persistence assertion is only worth anything across one. The
    // game comes back frozen at the menu, the way the fixture handed it over.
    api.reload = async () => {
      await page.goto("/?e2e=1");
      await page.waitForFunction(() => Boolean(window.__asteroides));
      await api.freeze();
    };

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

    // Kills the ship with nothing near it and steps out the absence, leaving the game in a ghost
    // on a clear return point. The absence is shortened so the suite does not spend two seconds
    // of frames on it; the ghost runs its real length, which is what the ghost specs measure.
    api.enterGhost = async (absenceFrames = 20) => {
      await api.setAbsenceFrames(absenceFrames);
      await api.parkAsteroids();
      await api.killShip();
      await api.step(absenceFrames);

      const arrived = await api.snapshot();
      expect(arrived).toMatchObject({ state: "ghost", ghostFrames: 0 });
      return arrived;
    };

    // The whole death, absence and ghost, leaving the ship mortal again.
    api.killShipAndRebuild = async (absenceFrames = 20) => {
      const { ghostWindow } = await api.enterGhost(absenceFrames);
      await api.step(ghostWindow);
    };

    await api.freeze();
    await use(api);

    expect(errors, `console errors: ${errors.join(" | ")}`).toEqual([]);
  },
});

export { expect };
