import {
  HULL_TRIANGLES,
  HULL_REACH,
  ngonVertices,
  transformInto,
  convexOverlap,
} from "./geometry.js";

// An asteroid is stroked on its edge, so its pixels reach half a stroke beyond its geometry and
// collision follows the pixels. For a regular polygon an outward offset of d is exact at
// radius + d / cos(PI / sides): every edge moves out by d and every vertex by a little more,
// which is also what a mitred corner draws.
//
// The hull is not offset to cover its own 2px stroke. Pushing a reflex vertex outward closes the
// notch and makes the two triangles overlap each other, so the ship under reaches by 1px on
// purpose. See docs/adr/0003-collision-follows-the-drawn-shape.md.
export function collisionReach(asteroid, clearance = 0) {
  const offset = asteroid.strokeWeight / 2 + clearance;
  return asteroid.radius + offset / Math.cos(Math.PI / asteroid.sides);
}

// Reused every frame for every pair. Nothing here allocates once the game is running.
const rockScratch = [];
const triangleScratch = [
  [[0, 0], [0, 0], [0, 0]],
  [[0, 0], [0, 0], [0, 0]],
];

// Enough to keep a 50px per frame closing speed from skipping the smallest asteroid, and low
// enough that a pair costs a bounded amount even in the worst frame.
const MAX_SUBSTEPS = 8;

const lerp = (from, to, t) => from + (to - from) * t;

function substepsFor(ship, asteroid) {
  // A wrap teleports an entity to the far edge, so the straight line between its two positions
  // this frame is not a path anything travelled. Test the end state only.
  if (ship.wrapped || asteroid.wrapped) return 1;

  const dx =
    ship.position.x - ship.prevPosition.x -
    (asteroid.position.x - asteroid.prevPosition.x);
  const dy =
    ship.position.y - ship.prevPosition.y -
    (asteroid.position.y - asteroid.prevPosition.y);

  const travelled = Math.hypot(dx, dy);
  const smallest = Math.min(HULL_REACH, asteroid.radius);

  return Math.min(MAX_SUBSTEPS, Math.max(1, Math.ceil(travelled / (smallest * 0.5))));
}

// `clearance` is extra room in pixels around the asteroid. A death asks about contact and passes
// nothing. The ghost asks whether it is safe to become solid and passes more.
export function shipVsAsteroids(ship, asteroids, clearance = 0) {
  return asteroids.find((asteroid) => touches(ship, asteroid, clearance)) ?? null;
}

function touches(ship, asteroid, clearance) {
  const steps = substepsFor(ship, asteroid);

  for (let i = 1; i <= steps; i++) {
    if (touchesAt(ship, asteroid, clearance, i / steps)) return true;
  }

  return false;
}

// Both the position and the rotation interpolate. The ship turns PI/40 per frame, which is 4.5
// degrees, too much to hold still across a frame it also crossed 50px of canvas in.
function touchesAt(ship, asteroid, clearance, t) {
  const reach = collisionReach(asteroid, clearance);

  const shipX = lerp(ship.prevPosition.x, ship.position.x, t);
  const shipY = lerp(ship.prevPosition.y, ship.position.y, t);
  const rockX = lerp(asteroid.prevPosition.x, asteroid.position.x, t);
  const rockY = lerp(asteroid.prevPosition.y, asteroid.position.y, t);

  if (Math.hypot(shipX - rockX, shipY - rockY) > HULL_REACH + reach) return false;

  const rock = ngonVertices(
    rockX,
    rockY,
    reach,
    asteroid.sides,
    lerp(asteroid.prevAngle, asteroid.rotation.angle, t),
    rockScratch
  );

  const shipAngle = lerp(ship.prevAngle, ship.angleOfShip, t);

  for (let i = 0; i < HULL_TRIANGLES.length; i++) {
    const triangle = transformInto(
      HULL_TRIANGLES[i],
      shipX,
      shipY,
      shipAngle,
      triangleScratch[i]
    );

    if (convexOverlap(triangle, rock)) return true;
  }

  return false;
}

export function shotsVsAsteroids(shots, asteroids) {
  const hits = [];

  for (const asteroid of asteroids) {
    for (const shot of shots) {
      if (
        Math.hypot(
          shot.position.x - asteroid.position.x,
          shot.position.y - asteroid.position.y
        ) < asteroid.radius
      ) {
        hits.push({ shot, asteroid });
      }
    }
  }

  return hits;
}
