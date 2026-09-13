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

// `clearance` is extra room in pixels around the asteroid. A death asks about contact and passes
// nothing. The ghost asks whether it is safe to become solid and passes more.
export function shipVsAsteroids(ship, asteroids, clearance = 0) {
  return asteroids.find((asteroid) => touches(ship, asteroid, clearance)) ?? null;
}

function touches(ship, asteroid, clearance) {
  const reach = collisionReach(asteroid, clearance);

  // Broad phase. Most pairs are misses and stop here, before a single vertex is transformed.
  const dx = ship.position.x - asteroid.position.x;
  const dy = ship.position.y - asteroid.position.y;
  if (Math.hypot(dx, dy) > HULL_REACH + reach) return false;

  const rock = ngonVertices(
    asteroid.position.x,
    asteroid.position.y,
    reach,
    asteroid.sides,
    asteroid.rotation.angle,
    rockScratch
  );

  // The hull is concave, so SAT reads it as the two triangles the notch forces it into.
  for (let i = 0; i < HULL_TRIANGLES.length; i++) {
    const triangle = transformInto(
      HULL_TRIANGLES[i],
      ship.position.x,
      ship.position.y,
      ship.angleOfShip,
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
