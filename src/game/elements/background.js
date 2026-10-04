// The band is the game canvas's CSS background, never drawn into the canvas. See the invariant
// in ARCHITECTURE.md.
//
// Stars go straight to the 2D context. Every fill colour is a string built here once, stars are
// sorted by tint so a layer changes fillStyle at most once per tint, and nothing in draw()
// allocates.

const TAU = Math.PI * 2;
// Canvas area per star in the field this replaced: 500 stars on a 1440x800 canvas.
const AREA_PER_STAR = (1440 * 800) / 500;

const FILL = [2, 4, 12];
// Blue-white to warm. Each one, at a bright star's peak opacity over FILL, stays dimmer than
// the asteroid outline.
export const STAR_TINTS = [
  [200, 220, 255],
  [175, 228, 255],
  [230, 235, 255],
  [255, 238, 215],
];
const GLOW = [
  [30, 80, 160],
  [20, 120, 140],
  [80, 50, 150],
  [40, 60, 130],
];
const DUST = [0, 0, 4];
const SCATTER = [200, 215, 255];

// For the harness to check against the ship and the asteroids.
export const PALETTE = [FILL, ...STAR_TINTS, ...GLOW, DUST, SCATTER];

const rgb = ([r, g, b]) => `rgb(${r},${g},${b})`;
const rgba = ([r, g, b], a) => `rgba(${r},${g},${b},${a})`;
const TINT_STYLES = STAR_TINTS.map(rgb);

// Speeds in px per frame, sizes in px, brightness as peak opacity.
const LAYERS = [
  {
    name: "near",
    share: 0.15,
    minimum: 0,
    speed: 0.08,
    size: [1.5, 2.2],
    brightness: [0.3, 0.5],
    twinkleShare: 0.2,
    glint: false,
  },
  {
    name: "bright",
    share: 0.03,
    minimum: 8,
    speed: 0.13,
    size: [2, 3],
    brightness: [0.5, 0.7],
    twinkleShare: 0.7,
    glint: true,
  },
];

// A glint's arms reach this many star sizes out from the centre, at this share of its opacity.
const GLINT_REACH = 4;
const GLINT_ALPHA = 0.35;
// A twinkle never falls below this share of the star's peak brightness.
const TWINKLE_FLOOR = 2 / 3;
// Twinkle periods in frames: 2 to 5 seconds at 60fps.
const TWINKLE_PERIOD = [120, 300];

let bandPaints = 0;
let shownBand = null;
let shownURL = null;

export const bandPaintCount = () => bandPaints;

const between = (random, [low, high]) => low + random() * (high - low);

const wrap = (value, size) => ((value % size) + size) % size;

const starCount = (width, height, share) =>
  Math.round(((width * height) / AREA_PER_STAR) * share);

export default class Background {
  constructor(p5, { random = Math.random } = {}) {
    this.p5 = p5;
    this.random = random;
    this.frame = 0;

    const angle = random() * TAU;
    this.direction = { x: Math.cos(angle), y: Math.sin(angle) };
    this.band = this.paintBand();
    this.layers = LAYERS.map((spec) => new StarLayer(p5, spec, random));
  }

  gauss() {
    const u = 1 - this.random();
    const v = this.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
  }

  pick(list) {
    return list[Math.floor(this.random() * list.length)];
  }

  // A plain canvas rather than p5.createGraphics, which adds a DOM element that a rebuild on
  // resize would have to remove.
  paintBand() {
    const { width, height } = this.p5;
    const density = this.p5.pixelDensity();
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(width * density);
    canvas.height = Math.ceil(height * density);
    const ctx = canvas.getContext("2d");
    ctx.scale(density, density);

    ctx.fillStyle = rgb(FILL);
    ctx.fillRect(0, 0, width, height);

    // The axis runs from one top corner to the opposite bottom corner.
    const fromLeft = this.random() < 0.5;
    const startX = fromLeft ? 0 : width;
    const length = Math.hypot(width, height);
    const ux = (fromLeft ? width : -width) / length;
    const uy = height / length;
    const spread = Math.min(width, height) * 0.18;
    const offAxis = (deviation) => {
      const along = this.random() * length;
      const across = this.gauss() * spread * deviation;
      return { x: startX + ux * along - uy * across, y: uy * along + ux * across };
    };

    ctx.filter = "blur(40px)";
    for (let i = 0; i < 14; i++) {
      const { x, y } = offAxis(0.4);
      paintBlob(ctx, x, y, spread * between(this.random, [0.8, 1.8]), this.pick(GLOW), 0.15);
    }

    ctx.filter = "blur(18px)";
    for (let i = 0; i < 10; i++) {
      const { x, y } = offAxis(0.25);
      paintBlob(ctx, x, y, spread * between(this.random, [0.25, 0.55]), DUST, 0.6);
    }

    ctx.filter = "none";
    const dense = starCount(width, height, 6);
    for (let i = 0; i < dense; i++) {
      const { x, y } = offAxis(0.5);
      const size = this.random() < 0.9 ? 1 : 1.6;
      ctx.fillStyle = rgba(this.pick(STAR_TINTS), between(this.random, [0.08, 0.38]));
      ctx.fillRect(x, y, size, size);
    }

    const scattered = starCount(width, height, 0.6);
    for (let i = 0; i < scattered; i++) {
      ctx.fillStyle = rgba(SCATTER, between(this.random, [0.1, 0.3]));
      ctx.fillRect(this.random() * width, this.random() * height, 1, 1);
    }

    bandPaints++;
    this.show(canvas);
    return { canvas, fromLeft };
  }

  // toBlob encodes off the main thread. Until it lands the canvas shows the page's own dark
  // background, and a band painted later wins over one whose encoding finishes later.
  show(band) {
    shownBand = band;
    const element = this.p5.canvas;
    band.toBlob((blob) => {
      if (shownBand !== band || !blob) return;
      if (shownURL) URL.revokeObjectURL(shownURL);
      shownURL = URL.createObjectURL(blob);
      element.style.backgroundImage = `url(${shownURL})`;
      element.style.backgroundSize = "100% 100%";
    });
  }

  step() {
    this.frame++;
    for (const layer of this.layers) layer.step(this.direction);
  }

  draw() {
    const { p5 } = this;
    const ctx = p5.drawingContext;

    p5.clear();
    ctx.save();
    for (const layer of this.layers) layer.draw(ctx, this.frame);
    ctx.restore();
  }
}

class StarLayer {
  constructor(p5, spec, random) {
    this.p5 = p5;
    this.name = spec.name;
    this.speed = spec.speed;
    this.glint = spec.glint;
    this.offset = { x: 0, y: 0 };

    const count = Math.max(spec.minimum, starCount(p5.width, p5.height, spec.share));

    this.stars = Array.from({ length: count }, () => {
      const tint = Math.floor(random() * STAR_TINTS.length);
      return {
        x: random() * p5.width,
        y: random() * p5.height,
        size: between(random, spec.size),
        brightness: between(random, spec.brightness),
        tint,
        style: TINT_STYLES[tint],
        twinkles: random() < spec.twinkleShare,
        period: between(random, TWINKLE_PERIOD),
        phase: random() * TAU,
      };
    }).sort((a, b) => a.tint - b.tint);
  }

  step(direction) {
    this.offset.x += direction.x * this.speed;
    this.offset.y += direction.y * this.speed;
  }

  // Moves a star so it draws at (x, y) on the current frame.
  place(index, x, y) {
    this.stars[index].x = x - this.offset.x;
    this.stars[index].y = y - this.offset.y;
  }

  xOf(star) {
    return wrap(star.x + this.offset.x, this.p5.width);
  }

  yOf(star) {
    return wrap(star.y + this.offset.y, this.p5.height);
  }

  alphaOf(star, frame) {
    if (!star.twinkles) return star.brightness;
    const pulse = 0.5 + 0.5 * Math.sin((TAU * frame) / star.period + star.phase);
    return star.brightness * (TWINKLE_FLOOR + (1 - TWINKLE_FLOOR) * pulse);
  }

  draw(ctx, frame) {
    let style = null;

    for (const star of this.stars) {
      if (star.style !== style) {
        style = star.style;
        ctx.fillStyle = style;
      }

      const x = this.xOf(star);
      const y = this.yOf(star);
      const alpha = this.alphaOf(star, frame);

      if (this.glint) {
        const reach = star.size * GLINT_REACH;
        ctx.globalAlpha = alpha * GLINT_ALPHA;
        ctx.fillRect(x - reach, y - 0.5, reach * 2, 1);
        ctx.fillRect(x - 0.5, y - reach, 1, reach * 2);
      }

      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(x, y, star.size / 2, 0, TAU);
      ctx.fill();
    }
  }
}

function paintBlob(ctx, x, y, radius, colour, alpha) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, rgba(colour, alpha));
  gradient.addColorStop(0.5, rgba(colour, alpha * 0.4));
  gradient.addColorStop(1, rgba(colour, 0));
  ctx.fillStyle = gradient;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}
