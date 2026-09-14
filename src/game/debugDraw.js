import {
  HULL_TRIANGLES,
  ngonVertices,
  transformInto,
  hullTriangleBuffer,
} from "./geometry.js";
import { collisionReach, SHOT_REACH } from "./collisions.js";

// Draws what collisions.js actually tests, by asking it for the same numbers. A second opinion
// about where the hitboxes are would be worth nothing.
const rockScratch = [];
const shotRockScratch = [];
const triangleScratch = hullTriangleBuffer();

// Module scope rather than a field on Game, because a level up, a game over and a return to the
// menu each build a new Game. A flag on the instance would switch itself off mid session.
let enabled = false;

export function setHitboxes(on) {
  enabled = on;
}

export function drawHitboxes(p5, ship, asteroids) {
  if (!enabled) return;

  p5.push();
  p5.noFill();
  p5.strokeWeight(1);

  // An asteroid carries two reaches: what the ship is measured against, and the wider one a
  // shot is, because a shot is a point drawn 4px thick.
  p5.stroke(0, 255, 0);
  for (const asteroid of asteroids) {
    outline(p5, rockOutline(asteroid, collisionReach(asteroid), rockScratch));
  }

  p5.stroke(255, 255, 0);
  for (const asteroid of asteroids) {
    outline(
      p5,
      rockOutline(asteroid, collisionReach(asteroid, SHOT_REACH), shotRockScratch)
    );
  }

  if (!ship.exploded) {
    p5.stroke(0, 255, 255);
    for (let i = 0; i < HULL_TRIANGLES.length; i++) {
      outline(
        p5,
        transformInto(
          HULL_TRIANGLES[i],
          ship.position.x,
          ship.position.y,
          ship.angleOfShip,
          triangleScratch[i]
        )
      );
    }
  }

  p5.pop();
}

function rockOutline(asteroid, reach, scratch) {
  return ngonVertices(
    asteroid.position.x,
    asteroid.position.y,
    reach,
    asteroid.sides,
    asteroid.rotation.angle,
    scratch
  );
}

function outline(p5, vertices) {
  p5.beginShape();
  for (const [x, y] of vertices) p5.vertex(x, y);
  p5.endShape(p5.CLOSE);
}
