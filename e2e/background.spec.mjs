import { test, expect } from "./fixtures.mjs";

// Covers the Background, Band, Star layer, Glint and Twinkle in CONTEXT.md. `background()` reports
// floats, and a spec compares two readings of it or a relationship between them, never a
// coordinate the RNG chose.

const wrappedDelta = (before, after, size) => {
  const d = (((after - before) % size) + size) % size;
  return d > size / 2 ? d - size : d;
};

const ASTEROID_OUTLINE = [0xf2, 0x9f, 0x38];

// WCAG relative luminance of an sRGB colour, each channel 0 to 255.
const luminance = (rgb) => {
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

// Hue in degrees, or null below a chroma of 0.2. The warm star tint sits at the asteroid's hue
// but reads as white, and the brief asks only that no colour comes near orange.
const hue = ([r, g, b]) => {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if ((max - min) / 255 < 0.2) return null;
  const c = max - min;
  let h;
  if (max === r) h = ((g - b) / c) % 6;
  else if (max === g) h = (b - r) / c + 2;
  else h = (r - g) / c + 4;
  return (h * 60 + 360) % 360;
};

// The ship's fill sits at 302 degrees, its stroke at 337 and the shots at 304. The asteroid
// outline sits at 33.
const MAGENTA = [285, 350];
const ORANGE = [15, 50];
const inRange = (h, [from, to]) => h !== null && h >= from && h <= to;

test.describe("the background", () => {
  test("draws the band and two star layers, the bright one sparser", async ({
    asteroides: a,
  }) => {
    const reading = await a.background();

    expect(reading.bandPaints).toBeGreaterThan(0);
    expect(reading.layers.map((l) => l.name)).toEqual(["near", "bright"]);
    const [near, bright] = reading.layers;
    expect(bright.stars.length).toBeGreaterThanOrEqual(8);
    expect(near.stars.length).toBeGreaterThan(bright.stars.length);
    expect(bright.speed).toBeGreaterThan(near.speed);
  });

  for (const where of ["start menu", "play"]) {
    test(`in ${where}, N frames move each layer N times its speed, one way`, async ({
      asteroides: a,
    }) => {
      if (where === "play") await a.startRun();
      const frames = 40;
      const before = await a.background();
      await a.step(frames);
      const after = await a.background();
      const { width, height } = before.canvas;

      before.layers.forEach((layer, i) => {
        layer.stars.forEach((star, j) => {
          const moved = after.layers[i].stars[j];
          expect(wrappedDelta(star.x, moved.x, width)).toBeCloseTo(
            frames * layer.speed * before.direction.x,
            6
          );
          expect(wrappedDelta(star.y, moved.y, height)).toBeCloseTo(
            frames * layer.speed * before.direction.y,
            6
          );
        });
      });
    });
  }

  test("a star leaving an edge comes back in at the opposite one", async ({
    asteroides: a,
  }) => {
    const { direction, canvas } = await a.background();
    // Lead with the axis the drift favours, so the star crosses that edge.
    const alongX = Math.abs(direction.x) >= Math.abs(direction.y);
    const edge = (d, size) => (d > 0 ? size - 0.5 : 0.5);
    const placed = alongX
      ? { x: edge(direction.x, canvas.width), y: canvas.height / 2 }
      : { x: canvas.width / 2, y: edge(direction.y, canvas.height) };

    await a.placeStar({ layer: 1, index: 0, ...placed });
    await a.step(10);
    const star = (await a.background()).layers[1].stars[0];

    if (alongX) {
      expect(star.x).toBeGreaterThanOrEqual(0);
      expect(star.x).toBeLessThan(canvas.width);
      expect(Math.abs(star.x - placed.x)).toBeGreaterThan(canvas.width / 2);
    } else {
      expect(star.y).toBeGreaterThanOrEqual(0);
      expect(star.y).toBeLessThan(canvas.height);
      expect(Math.abs(star.y - placed.y)).toBeGreaterThan(canvas.height / 2);
    }
  });

  test("holds still while paused and carries on from there after", async ({
    asteroides: a,
  }) => {
    await a.startRun();
    await a.step(5);
    await a.pauseGame();

    const held = await a.background();
    await a.step(120);
    expect(await a.background()).toEqual(held);

    await a.resumeGame();
    await a.step(10);
    const resumed = await a.background();
    const [layer] = held.layers;
    expect(
      wrappedDelta(layer.stars[0].x, resumed.layers[0].stars[0].x, held.canvas.width)
    ).toBeCloseTo(10 * layer.speed * held.direction.x, 6);
  });

  test("some stars twinkle, not all, and none drops below two thirds", async ({
    asteroides: a,
  }) => {
    const readings = [];
    for (let i = 0; i < 30; i++) {
      readings.push(await a.background());
      await a.step(10);
    }

    const stars = readings[0].layers.flatMap((layer, i) =>
      layer.stars.map((_, j) => readings.map((r) => r.layers[i].stars[j]))
    );
    const changed = stars.filter((history) =>
      history.some((s) => Math.abs(s.alpha - history[0].alpha) > 1e-9)
    );

    expect(changed.length).toBeGreaterThan(0);
    expect(changed.length).toBeLessThan(stars.length);
    for (const history of stars) {
      for (const s of history) {
        expect(s.alpha).toBeGreaterThanOrEqual((s.brightness * 2) / 3 - 1e-9);
        expect(s.alpha).toBeLessThanOrEqual(s.brightness + 1e-9);
      }
    }
  });

  test("the band is painted once, and again only on a resize", async ({
    asteroides: a,
  }) => {
    const { bandPaints } = await a.background();
    await a.startRun();
    await a.step(60);
    expect((await a.background()).bandPaints).toBe(bandPaints);

    await a.resize(900, 600);
    expect((await a.background()).bandPaints).toBe(bandPaints + 1);
  });

  test("a resize rebuilds the background to the new canvas, counts scaled to its area", async ({
    asteroides: a,
  }) => {
    await a.resize(1600, 1000);
    const large = await a.background();

    await a.resize(800, 500);
    const small = await a.background();

    expect(small.canvas.width).toBeLessThan(large.canvas.width);
    const areaRatio =
      (small.canvas.width * small.canvas.height) /
      (large.canvas.width * large.canvas.height);
    const countRatio = small.layers[0].stars.length / large.layers[0].stars.length;
    expect(countRatio).toBeCloseTo(areaRatio, 1);

    for (const layer of small.layers) {
      for (const star of layer.stars) {
        expect(star.x).toBeLessThan(small.canvas.width);
        expect(star.y).toBeLessThan(small.canvas.height);
      }
    }
  });

  test("a rebuild of the game leaves the background alone", async ({ asteroides: a }) => {
    await a.startRun();
    const before = await a.background();
    await a.requestRebuild("menu");
    await a.step();
    const after = await a.background();

    expect(after.bandPaints).toBe(before.bandPaints);
    expect(after.direction).toEqual(before.direction);
    expect(after.frame).toBe(before.frame + 1);
  });

  test("the same seed builds the same background", async ({ asteroides: a }) => {
    await a.seedBackground(7);
    const first = await a.background();
    await a.seedBackground(7);
    const second = await a.background();
    await a.seedBackground(8);
    const other = await a.background();

    const layout = ({ direction, band, layers }) => ({ direction, band, layers });
    expect(layout(second)).toEqual(layout(first));
    expect(layout(other)).not.toEqual(layout(first));
  });

  test("no star outshines an asteroid and no colour reads as ship or asteroid", async ({
    asteroides: a,
  }) => {
    const { layers, palette } = await a.background();
    const outline = luminance(ASTEROID_OUTLINE);

    for (const layer of layers) {
      for (const star of layer.stars) {
        // Over a near-black fill, a star at opacity a shows as roughly its tint scaled by a.
        const shown = star.tint.map((c) => c * star.brightness);
        expect(luminance(shown)).toBeLessThan(outline);
      }
    }

    for (const colour of palette) {
      const h = hue(colour);
      expect(inRange(h, MAGENTA), `${colour} reads as magenta`).toBe(false);
      expect(inRange(h, ORANGE), `${colour} reads as orange`).toBe(false);
    }
  });
});
