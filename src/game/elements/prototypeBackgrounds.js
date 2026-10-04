// PROTOTYPE, throwaway. Candidate backgrounds for #9, switchable with ?bg=<key>, the bottom
// bar, or the [ and ] keys. Lives on the prototype/backgrounds branch only.
import Background from "./background.js";

const TAU = Math.PI * 2;
// Today's 500 stars on a 1440x800 canvas.
const AREA_PER_STAR = (1440 * 800) / 500;

const gauss = () => {
  const u = 1 - Math.random();
  const v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
};

const pick = (list) => list[Math.floor(Math.random() * list.length)];

const wrap = (value, size) => ((value % size) + size) % size;

const STAR_TINTS = [
  [200, 220, 255],
  [175, 228, 255],
  [230, 235, 255],
  [255, 240, 220],
];

const starCount = (p5, factor = 1) =>
  Math.round(((p5.width * p5.height) / AREA_PER_STAR) * factor);

function makeStar(p5, { size, brightness, twinkleShare }) {
  return {
    x: Math.random() * p5.width,
    y: Math.random() * p5.height,
    size: size[0] + Math.random() * (size[1] - size[0]),
    brightness: brightness[0] + Math.random() * (brightness[1] - brightness[0]),
    tint: pick(STAR_TINTS),
    twinkles: Math.random() < twinkleShare,
    // Frames.
    period: 120 + Math.random() * 180,
    phase: Math.random() * TAU,
  };
}

function starAlpha(star, t) {
  if (!star.twinkles) return star.brightness;
  return star.brightness * (0.65 + 0.35 * Math.sin((TAU * t) / star.period + star.phase));
}

function drawStars(p5, stars, t, offsetX = 0, offsetY = 0) {
  for (const star of stars) {
    const [r, g, b] = star.tint;
    p5.stroke(r, g, b, 255 * starAlpha(star, t));
    p5.strokeWeight(star.size);
    p5.point(wrap(star.x + offsetX, p5.width), wrap(star.y + offsetY, p5.height));
  }
}

function paintBlob(ctx, x, y, radius, [r, g, b], alpha) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, `rgba(${r},${g},${b},${alpha})`);
  gradient.addColorStop(0.5, `rgba(${r},${g},${b},${alpha * 0.4})`);
  gradient.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

const NEBULA_HUES = [
  [30, 80, 160],
  [20, 120, 140],
  [80, 50, 150],
  [40, 60, 130],
];

class CurrentSky {
  constructor(p5) {
    this.inner = new Background(p5);
  }

  step() {}

  draw() {
    this.inner.draw();
  }
}

// The brief as written: three drifting layers, twinkle, a static cool nebula.
class LayeredNebula {
  constructor(p5, speedScale = 1) {
    this.p5 = p5;
    this.t = 0;
    const angle = Math.random() * TAU;
    this.direction = { x: Math.cos(angle), y: Math.sin(angle) };
    this.layers = [
      { speed: 0.05 * speedScale, stars: this.stars(0.6, [1, 1.6], [0.25, 0.45]) },
      { speed: 0.1 * speedScale, stars: this.stars(0.28, [1.6, 2.4], [0.4, 0.6]) },
      { speed: 0.15 * speedScale, stars: this.stars(0.12, [2.4, 3.2], [0.55, 0.75]) },
    ];
    this.offsets = this.layers.map(() => ({ x: 0, y: 0 }));
    this.nebula = this.paintNebula();
  }

  stars(share, size, brightness) {
    return Array.from({ length: starCount(this.p5, share) }, () =>
      makeStar(this.p5, { size, brightness, twinkleShare: 0.2 }),
    );
  }

  paintNebula() {
    const { p5 } = this;
    const buffer = p5.createGraphics(p5.width, p5.height);
    const ctx = buffer.drawingContext;
    ctx.fillStyle = "rgb(1,5,15)";
    ctx.fillRect(0, 0, p5.width, p5.height);
    ctx.filter = "blur(30px)";
    const reach = Math.max(p5.width, p5.height);
    for (let i = 0; i < 9; i++) {
      paintBlob(
        ctx,
        Math.random() * p5.width,
        Math.random() * p5.height,
        reach * (0.15 + Math.random() * 0.25),
        pick(NEBULA_HUES),
        0.12 + Math.random() * 0.1,
      );
    }
    return buffer;
  }

  step() {
    this.t++;
    this.layers.forEach((layer, i) => {
      this.offsets[i].x += this.direction.x * layer.speed;
      this.offsets[i].y += this.direction.y * layer.speed;
    });
  }

  draw() {
    const { p5 } = this;
    p5.push();
    p5.imageMode(p5.CORNER);
    p5.image(this.nebula, 0, 0);
    this.layers.forEach((layer, i) =>
      drawStars(p5, layer.stars, this.t, this.offsets[i].x, this.offsets[i].y),
    );
    p5.pop();
  }
}

// A diagonal band of dense faint stars with dark dust lanes, and a few bright foreground stars
// that carry diffraction spikes and drift over it.
class MilkyWay {
  constructor(p5) {
    this.p5 = p5;
    this.t = 0;
    this.offset = 0;
    this.band = this.paintBand();
    this.bright = Array.from({ length: Math.max(8, starCount(p5, 0.03)) }, () =>
      makeStar(p5, { size: [2, 3], brightness: [0.5, 0.75], twinkleShare: 0.6 }),
    );
    this.near = Array.from({ length: starCount(p5, 0.15) }, () =>
      makeStar(p5, { size: [1.5, 2.2], brightness: [0.3, 0.5], twinkleShare: 0.2 }),
    );
  }

  paintBand() {
    const { p5 } = this;
    const w = p5.width;
    const h = p5.height;
    const buffer = p5.createGraphics(w, h);
    const ctx = buffer.drawingContext;
    ctx.fillStyle = "rgb(2,4,12)";
    ctx.fillRect(0, 0, w, h);

    // The band runs corner to corner; points sit at a gaussian distance from its axis.
    const flip = Math.random() < 0.5;
    const ax = flip ? 0 : w;
    const bx = flip ? w : 0;
    const length = Math.hypot(w, h);
    const ux = (bx - ax) / length;
    const uy = h / length;
    const width = Math.min(w, h) * 0.18;
    const along = (s) => ({ x: ax + ux * s, y: uy * s });

    ctx.filter = "blur(40px)";
    for (let i = 0; i < 14; i++) {
      const c = along(Math.random() * length);
      const d = gauss() * width * 0.4;
      paintBlob(ctx, c.x - uy * d, c.y + ux * d, width * (0.8 + Math.random()), pick(NEBULA_HUES), 0.15);
    }
    ctx.filter = "blur(18px)";
    for (let i = 0; i < 10; i++) {
      const c = along(Math.random() * length);
      const d = gauss() * width * 0.25;
      paintBlob(ctx, c.x - uy * d, c.y + ux * d, width * (0.25 + Math.random() * 0.3), [0, 0, 4], 0.6);
    }

    ctx.filter = "none";
    const count = Math.round(starCount(p5, 6));
    for (let i = 0; i < count; i++) {
      const c = along(Math.random() * length);
      const d = gauss() * width * 0.5;
      const [r, g, b] = pick(STAR_TINTS);
      ctx.fillStyle = `rgba(${r},${g},${b},${0.08 + Math.random() * 0.3})`;
      const size = Math.random() < 0.9 ? 1 : 1.6;
      ctx.fillRect(c.x - uy * d, c.y + ux * d, size, size);
    }
    for (let i = 0; i < starCount(p5, 0.6); i++) {
      ctx.fillStyle = `rgba(200,215,255,${0.1 + Math.random() * 0.2})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 1, 1);
    }
    return buffer;
  }

  step() {
    this.t++;
    this.offset += 0.08;
  }

  draw() {
    const { p5 } = this;
    p5.push();
    p5.imageMode(p5.CORNER);
    p5.image(this.band, 0, 0);
    drawStars(p5, this.near, this.t, this.offset, this.offset * 0.3);
    for (const star of this.bright) {
      const x = wrap(star.x + this.offset * 1.6, p5.width);
      const y = wrap(star.y + this.offset * 0.5, p5.height);
      const alpha = 255 * starAlpha(star, this.t);
      const [r, g, b] = star.tint;
      p5.stroke(r, g, b, alpha * 0.35);
      p5.strokeWeight(1);
      const spike = star.size * 4;
      p5.line(x - spike, y, x + spike, y);
      p5.line(x, y - spike, x, y + spike);
      p5.stroke(r, g, b, alpha);
      p5.strokeWeight(star.size);
      p5.point(x, y);
    }
    p5.pop();
  }
}

const VARIANTS = [
  { key: "A", name: "Current", make: (p5) => new CurrentSky(p5) },
  { key: "B", name: "Layered nebula, brief speed 0.05-0.15 px/frame", make: (p5) => new LayeredNebula(p5) },
  { key: "B3", name: "Layered nebula, x3: 0.15-0.45 px/frame", make: (p5) => new LayeredNebula(p5, 3) },
  { key: "B6", name: "Layered nebula, x6: 0.3-0.9 px/frame", make: (p5) => new LayeredNebula(p5, 6) },
  { key: "C", name: "Milky Way band", make: (p5) => new MilkyWay(p5) },
];

function currentVariant() {
  const key = new URLSearchParams(window.location.search).get("bg");
  return VARIANTS.find((v) => v.key === key) ?? VARIANTS[1];
}

export function makePrototypeBackground(p5) {
  return currentVariant().make(p5);
}

export function attachPrototypeSwitcher(onChange) {
  const bar = document.createElement("div");
  bar.style.cssText =
    "position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:10;display:flex;" +
    "align-items:center;gap:12px;padding:8px 14px;border-radius:999px;background:#fff;color:#111;" +
    "font:13px/1 system-ui,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.5);user-select:none";
  const button = (text) => {
    const el = document.createElement("button");
    el.textContent = text;
    el.style.cssText = "border:0;background:#eee;border-radius:999px;width:28px;height:28px;cursor:pointer";
    return el;
  };
  const prev = button("‹");
  const next = button("›");
  const label = document.createElement("span");
  bar.append(prev, label, next);
  document.body.append(bar);

  const render = () => {
    const v = currentVariant();
    label.textContent = `PROTOTYPE bg ${v.key}: ${v.name}  ·  [ ]`;
  };
  const cycle = (delta) => {
    const i = VARIANTS.indexOf(currentVariant());
    const v = VARIANTS[(i + delta + VARIANTS.length) % VARIANTS.length];
    const url = new URL(window.location.href);
    url.searchParams.set("bg", v.key);
    window.history.replaceState(null, "", url);
    render();
    onChange();
  };
  // Blurred so a later Space press, which the game reads, cannot click the button again.
  prev.addEventListener("click", () => { prev.blur(); cycle(-1); });
  next.addEventListener("click", () => { next.blur(); cycle(1); });
  window.addEventListener("keydown", (e) => {
    if (e.key === "[") cycle(-1);
    if (e.key === "]") cycle(1);
  });
  render();
}
