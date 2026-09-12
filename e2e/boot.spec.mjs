import { test, expect } from "@playwright/test";

// p5 defers _start, and therefore preload, to the window load event whenever the document is not
// already complete. p5.sound's init hook has by then incremented the preload counter and started
// loading its audio worklet, so a worklet that resolves before the load event drives the counter to
// zero and p5 runs setup with nothing loaded. setup called textFont on a font that was never loaded
// and p5 threw "null font passed to textFont", which reached a player as a dev server error overlay
// on the first open.
//
// The fix is constructing the sketch once the document is complete, so _start runs inside the
// constructor. This spec holds the load event open with a slow image, which is what makes the
// worklet win the race every time instead of once in a while on a fast machine. It uses the raw
// page rather than the asteroides fixture because the fixture navigates for you.

const holdTheLoadEventOpen = async (page, url) => {
  await page.route("**/slow-image.png", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 4000));
    await route.fulfill({ status: 404, body: "" });
  });

  await page.route(url, async (route) => {
    const response = await route.fetch();
    const html = (await response.text()).replace(
      "</body>",
      '<img src="/slow-image.png"></body>'
    );
    await route.fulfill({ response, body: html });
  });
};

test("the sketch preloads before it sets up, even when the load event is slow", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));

  await holdTheLoadEventOpen(page, "http://localhost:8080/?e2e=1");
  await page.goto("/?e2e=1", { waitUntil: "commit" });
  await page.waitForFunction(() => Boolean(window.__asteroides), {
    timeout: 15000,
  });

  expect(errors, `page errors: ${errors.join(" | ")}`).toEqual([]);

  // A setup that ran before preload leaves p5's default 100x100 canvas, because createCanvas is
  // reached with no assets and the game never sizes it.
  const width = await page.evaluate(
    () => document.querySelector("canvas").width
  );
  expect(width).toBeGreaterThan(100);

  expect(await page.evaluate(() => window.__asteroides.snapshot())).toMatchObject(
    { state: "menu", asteroids: 2 }
  );
});
