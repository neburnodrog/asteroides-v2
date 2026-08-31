import { test, expect } from "@playwright/test";

// The harness must not exist for a player. This spec uses the raw page rather than the
// asteroides fixture, because the fixture is the thing that asks for it.

test("the harness is absent without the query string", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.frameCount !== undefined || true));

  // Give the sketch time to finish setup, which is where the harness would attach.
  await page.waitForTimeout(1000);

  expect(await page.evaluate(() => window.__asteroides)).toBeUndefined();
});

test("the harness is present when asked for", async ({ page }) => {
  await page.goto("/?e2e=1");
  await page.waitForFunction(() => Boolean(window.__asteroides));

  expect(await page.evaluate(() => typeof window.__asteroides.snapshot)).toBe(
    "function"
  );
});
