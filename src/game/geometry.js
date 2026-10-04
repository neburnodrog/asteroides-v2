// Shape maths. No p5, no game state, no imports. Both the render and the collision test take
// their vertices from here, so a shape cannot be drawn one way and collided another.
//
// Vertices are [x, y] pairs. Every function that produces vertices writes into a caller owned
// array and returns it, because these run for every entity on every frame.

const TAU = 2 * Math.PI;

// Into [0, TAU). The second test catches a tiny negative angle, whose sum with TAU rounds to TAU.
export function normaliseAngle(angle) {
  const wrapped = ((angle % TAU) + TAU) % TAU;
  return wrapped >= TAU ? 0 : wrapped;
}

// The signed turn from one heading to another the short way, in (-PI, PI]. Exactly behind
// turns positive, which on a y-down canvas is clockwise.
export function shortestTurn(from, to) {
  const turn = normaliseAngle(to - from);
  return turn > Math.PI ? turn - TAU : turn;
}

// The ship's hull in local coordinates, nose first. The ship faces +x and the origin is its
// position. An explicit vertex list rather than a regular polygon, because the notch in the
// tail is the silhouette.
export const HULL = [
  [30, 0],
  [-20, -15],
  [-11, 0],
  [-20, 15],
];

// A quad with one reflex vertex has exactly one interior diagonal, the one through that vertex.
// HULL[2] is the notch, so this split is forced rather than chosen. SAT cannot read a concave
// polygon, and these two halves are what it reads instead.
export const HULL_TRIANGLES = [
  [HULL[0], HULL[1], HULL[2]],
  [HULL[0], HULL[2], HULL[3]],
];

// A scratch buffer shaped for HULL_TRIANGLES, so neither caller hand-copies the triangle count.
export function hullTriangleBuffer() {
  return HULL_TRIANGLES.map((triangle) => triangle.map(() => [0, 0]));
}

// What the broad phase rejects on.
export const HULL_REACH = Math.max(...HULL.map(([x, y]) => Math.hypot(x, y)));

// How far forward the nose sits. The ship faces +x, so this is the nose vertex's x.
export const NOSE_REACH = HULL[0][0];

// A regular polygon in world coordinates, first vertex at `angle`. That matches what
// `Asteroid.draw` puts on screen: helpers.drawPolygon lays its first vertex at local angle 0
// inside a rotate(rotation.angle).
export function ngonVertices(x, y, radius, sides, angle, out) {
  const step = (Math.PI * 2) / sides;

  for (let i = 0; i < sides; i++) {
    const a = angle + step * i;
    const vertex = out[i] || (out[i] = [0, 0]);
    vertex[0] = x + Math.cos(a) * radius;
    vertex[1] = y + Math.sin(a) * radius;
  }

  out.length = sides;
  return out;
}

export function transformInto(local, x, y, angle, out) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  for (let i = 0; i < local.length; i++) {
    const [lx, ly] = local[i];
    const vertex = out[i] || (out[i] = [0, 0]);
    vertex[0] = x + lx * cos - ly * sin;
    vertex[1] = y + lx * sin + ly * cos;
  }

  out.length = local.length;
  return out;
}

// Separating axis test. Both polygons must be convex. An exact touch counts as an overlap,
// which is what "the shapes are in contact" means for a death.
export function convexOverlap(a, b) {
  return !separates(a, b) && !separates(b, a);
}

function separates(from, other) {
  for (let i = 0; i < from.length; i++) {
    const [x1, y1] = from[i];
    const [x2, y2] = from[(i + 1) % from.length];

    // The edge normal, left unnormalised: only the sign of the comparison matters.
    const nx = y1 - y2;
    const ny = x2 - x1;

    let minA = Infinity;
    let maxA = -Infinity;
    for (const [x, y] of from) {
      const projection = x * nx + y * ny;
      if (projection < minA) minA = projection;
      if (projection > maxA) maxA = projection;
    }

    let minB = Infinity;
    let maxB = -Infinity;
    for (const [x, y] of other) {
      const projection = x * nx + y * ny;
      if (projection < minB) minB = projection;
      if (projection > maxB) maxB = projection;
    }

    if (maxA < minB || maxB < minA) return true;
  }

  return false;
}

// Ray casting. Works on concave polygons too, which is why the shot test does not need the
// hull's triangle split.
export function pointInPolygon(px, py, verts) {
  let inside = false;

  for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
    const [xi, yi] = verts[i];
    const [xj, yj] = verts[j];
    const straddles = yi > py !== yj > py;

    if (straddles && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }

  return inside;
}
