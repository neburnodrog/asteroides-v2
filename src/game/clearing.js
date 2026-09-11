// Where the ship comes back after a death. Imports nothing, holds no state, never touches p5,
// so the geometry can be reasoned about without a canvas. Same tier as collisions.js.
//
// Asteroids fly in straight lines at constant speed and wrap at the edges, so "will anything
// reach this point in the next N frames" is an exact prediction rather than a guess.

const GRID_SPACING = 100;

// Candidate points at the centre of each cell, so no point on the canvas is further than half a
// cell from one. Rounding the cell count up keeps the spacing at or under GRID_SPACING and means
// a grid exists at any canvas size, down to a single centre point.
function gridPoints(width, height) {
  const columns = Math.max(1, Math.ceil(width / GRID_SPACING));
  const rows = Math.max(1, Math.ceil(height / GRID_SPACING));
  const cellWidth = width / columns;
  const cellHeight = height / rows;

  const points = [];
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      points.push({
        x: (column + 0.5) * cellWidth,
        y: (row + 0.5) * cellHeight,
      });
    }
  }
  return points;
}

// The same arithmetic Asteroid.calcPosition applies when it draws, run forward without moving
// the asteroid. Index 0 is where the asteroid is now.
function predictPath(asteroid, width, height, lookAhead) {
  const { radius } = asteroid;
  let { x, y } = asteroid.position;

  const path = [{ x, y }];
  for (let frame = 1; frame < lookAhead; frame++) {
    x += asteroid.velocity.x;
    y += asteroid.velocity.y;

    if (x > width + radius) x = 0 - radius;
    if (x < 0 - radius) x = width + radius;
    if (y > height + radius) y = 0 - radius;
    if (y < 0 - radius) y = height + radius;

    path.push({ x, y });
  }
  return path;
}

// The first frame any asteroid's disc overlaps the circle, or lookAhead when none does.
// Overlapping, not contained: an asteroid poking into the circle occupies it.
function firstThreatFrame(candidate, paths, radius, lookAhead) {
  for (let frame = 0; frame < lookAhead; frame++) {
    for (const path of paths) {
      const { x, y } = path.points[frame];
      if (Math.hypot(candidate.x - x, candidate.y - y) < radius + path.radius) {
        return frame;
      }
    }
  }
  return lookAhead;
}

// Returns the candidate with the longest time to the first threat, or null when every candidate
// is occupied right now. The caller treats null as "not yet" and asks again next frame; the
// field is always drifting, so this terminates.
export function findClearing({ asteroids, width, height, radius, lookAhead }) {
  const paths = asteroids.map((asteroid) => ({
    radius: asteroid.radius,
    points: predictPath(asteroid, width, height, lookAhead),
  }));

  const centreX = width / 2;
  const centreY = height / 2;
  const candidates = gridPoints(width, height).sort(
    (a, b) =>
      Math.hypot(a.x - centreX, a.y - centreY) -
      Math.hypot(b.x - centreX, b.y - centreY)
  );

  // Walking the candidates centre outwards makes both tie-breaks free: a later candidate only
  // wins by being strictly better, so equal scores keep the one nearest the centre, and the
  // first candidate to survive the whole look ahead is already the nearest such point.
  let best = null;
  for (const candidate of candidates) {
    const timeToThreat = firstThreatFrame(candidate, paths, radius, lookAhead);
    if (timeToThreat === 0) continue;

    if (best === null || timeToThreat > best.timeToThreat) {
      best = { x: candidate.x, y: candidate.y, timeToThreat };
    }
    if (timeToThreat === lookAhead) break;
  }

  return best;
}
