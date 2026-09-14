import {
  HULL_TRIANGLES,
  HULL_REACH,
  ngonVertices,
  transformInto,
  convexOverlap,
  pointInPolygon,
  hullTriangleBuffer,
} from "./geometry.js";

// Room the ghost wants around the ship before it becomes solid, in pixels. The kill test asks
// about contact and passes nothing; this is the one caller that asks for more, because
// materialising with an asteroid edge against the nose is not a fair place to become mortal.
export const GHOST_CLEARANCE = 10;

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

// Its own buffer. The two tests never run at the same moment, but sharing one would make that a
// requirement rather than a coincidence.
const shotRockScratch = [];

// A shot is drawn as an 8px point, so its pixels reach 4px from its position. The ship is not
// given the same treatment, because its hull is concave and cannot be offset outward; a point
// can. Exported so the overlay draws the shape the shot test measures rather than a second
// opinion about it.
export const SHOT_REACH = 4;
const triangleScratch = hullTriangleBuffer();

// The fastest closing speed the game produces is a shot against a small asteroid head on:
// 20.88px plus 7.07px, under 28px against a 40px rock, which the formula below covers in 3
// samples. The cap is headroom for a future speed change, and it keeps a pair's cost bounded.
const MAX_SUBSTEPS = 8;

const lerp = (from, to, t) => from + (to - from) * t;

// How many places along the frame a pair is measured at. `mover` is the ship or a shot. A shot
// carries no `wrapped` flag because it is filtered out of the game at the canvas edge rather
// than wrapped, so it has no teleporting frame to suppress.
function substepsFor(mover, asteroid) {
  // A wrap teleports an entity to the far edge, so the straight line between its two positions
  // this frame is not a path anything travelled. Test the end state only.
  if (mover.wrapped || asteroid.wrapped) return 1;

  const dx =
    mover.position.x - mover.prevPosition.x -
    (asteroid.position.x - asteroid.prevPosition.x);
  const dy =
    mover.position.y - mover.prevPosition.y -
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
// degrees, too much to hold still at a sample taken part way through the frame.
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

  // Asteroid outer, because the reach is the asteroid's and is worked out once for all the shots
  // in flight.
  for (const asteroid of asteroids) {
    const reach = collisionReach(asteroid, SHOT_REACH);

    for (const shot of shots) {
      if (crosses(shot, asteroid, reach)) hits.push({ shot, asteroid });
    }
  }

  return hits;
}

function crosses(shot, asteroid, reach) {
  const steps = substepsFor(shot, asteroid);

  for (let i = 1; i <= steps; i++) {
    if (insideAt(shot, asteroid, reach, i / steps)) return true;
  }

  return false;
}

// A shot is a point, so the sampled test stays point in polygon rather than becoming SAT.
function insideAt(shot, asteroid, reach, t) {
  const shotX = lerp(shot.prevPosition.x, shot.position.x, t);
  const shotY = lerp(shot.prevPosition.y, shot.position.y, t);
  const rockX = lerp(asteroid.prevPosition.x, asteroid.position.x, t);
  const rockY = lerp(asteroid.prevPosition.y, asteroid.position.y, t);

  // The reach is the circumradius, so a point further out than that is outside the polygon too.
  if (Math.hypot(shotX - rockX, shotY - rockY) > reach) return false;

  const rock = ngonVertices(
    rockX,
    rockY,
    reach,
    asteroid.sides,
    lerp(asteroid.prevAngle, asteroid.rotation.angle, t),
    shotRockScratch
  );

  return pointInPolygon(shotX, shotY, rock);
}
