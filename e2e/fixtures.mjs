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
  "setShipVelocity",
  "showHitboxes",
  "putAsteroidsOnShip",
  "putAsteroidInFrontOfShip",
  "putAsteroidAt",
  "explodeAllAsteroids",
  "soundCueKeys",
  "playingCues",
  "playCue",
  "cueVariation",
  "lastCuePlay",
  "cuePlayCounts",
  "pinSoundRandom",
  "volumeStep",
  "setVolume",
  "outputLevel",
  "corruptVolumeStorage",
  "pauseGame",
  "resumeGame",
  "autoPause",
  "fieldState",
  "seedVolume",
  "background",
  "seedBackground",
  "placeStar",
  "putShipAt",
  "pointer",
  "pointerLeave",
  "fullscreenState",
  "setPointerLocked",
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

    // A real window event, the kind the browser sends when the player switches away or back.
    api.dispatchWindowEvent = (type) =>
      page.evaluate((name) => window.dispatchEvent(new Event(name)), type);

    // Waits rather than steps. See "The exceptions to never wait" in README.md.
    api.resize = async (width, height) => {
      const { bandPaints } = await api.background();
      await page.setViewportSize({ width, height });
      await page.waitForFunction(
        (before) => window.__asteroides.background().bandPaints > before,
        bandPaints
      );
    };

    let mouse = { x: 0, y: 0 };

    // Canvas coordinates to page coordinates, past the canvas border. Moves without stepping,
    // like a key held down: the next step() reads where the pointer is.
    api.pointAt = async (x, y) => {
      const origin = await page.evaluate(() => {
        const canvas = document.querySelector("canvas");
        const rect = canvas.getBoundingClientRect();
        return {
          x: rect.left + canvas.clientLeft,
          y: rect.top + canvas.clientTop,
        };
      });
      mouse = { x: origin.x + x, y: origin.y + y };
      await page.mouse.move(mouse.x, mouse.y);
    };

    // A relative move in page pixels from wherever the mouse stands. Playwright's mouse starts
    // at the page origin. Under a pointer lock the game reads only the movement.
    // Chromium reports no movement on the first mousemove a page gets, so that one goes to the
    // spot the mouse already stands on.
    let mouseHasMoved = false;
    api.moveMouseBy = async (dx, dy) => {
      if (!mouseHasMoved) await page.mouse.move(mouse.x, mouse.y);
      mouseHasMoved = true;
      mouse = { x: mouse.x + dx, y: mouse.y + dy };
      await page.mouse.move(mouse.x, mouse.y);
    };

    // See "The exceptions to never wait" in README.md.
    api.waitForFullscreen = async (on) => {
      await page.waitForFunction(
        (wanted) => Boolean(document.fullscreenElement) === wanted,
        on
      );
      await api.step();
    };

    // A real click on the button, then one frame for the game to read anything that reached it.
    api.clickFullscreenButton = async () => {
      await page.getByRole("button", { name: "Fullscreen" }).click();
      await api.step();
    };

    api.mouseDown = (button = "left") => page.mouse.down({ button });
    api.mouseUp = (button = "left") => page.mouse.up({ button });

    // A real click wherever the pointer stands, then one frame for the game to read it.
    api.click = async ({ button = "left" } = {}) => {
      await page.mouse.down({ button });
      await page.mouse.up({ button });
      await api.step();
    };

    // Whether the canvas cancels the event that would open the browser's context menu.
    api.contextMenuSuppressed = () =>
      page.evaluate(() => {
        const event = new MouseEvent("contextmenu", {
          bubbles: true,
          cancelable: true,
        });
        document.querySelector("canvas").dispatchEvent(event);
        return event.defaultPrevented;
      });

    // A real mouseleave on the document, the event the browser sends when the pointer leaves the
    // window.
    api.dispatchPointerLeave = () =>
      page.evaluate(() =>
        document.documentElement.dispatchEvent(new MouseEvent("mouseleave"))
      );

    api.cursor = () =>
      page.evaluate(() => getComputedStyle(document.querySelector("canvas")).cursor);

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
