import Shot from "./shot";
import ShipDebris from "./shipDebris";
import ShipTrace from "./shipTrace";
import { randomInteger, calcVectorValue } from "../helpers";
import { HULL } from "../geometry.js";

const PI = Math.PI;

// The same magenta the shots and the ship debris use, so the ship, what it fires and what it
// breaks into all read as one colour.
const FILL = [255, 1, 241];
const STROKE = [255, 0, 98];

export default class Ship {
  constructor(p5, game) {
    this.p5 = p5;
    this.game = game;

    // DYNAMIC PROPERTIES
    this.acceleration = 0; // only when arrow_up is pressed
    this.resistance = 0.02;
    this.velocity = { x: 0, y: 0 };
    this.position = { x: p5.width / 2, y: p5.height / 2 };
    this.angleOfShip = 0; // expressed in radians

    // Where the ship was at the top of this frame. Collision substeps read these, because a
    // frame at speed is a journey rather than a jump.
    this.prevPosition = { x: this.position.x, y: this.position.y };
    this.prevAngle = 0;
    this.wrapped = false;

    // DEPENDANT ELEMENTS
    this.shots = [];
    this.traces = [];
    this.shipDebris = [];

    // STATE
    this.exploded = false;
    this.thrustSoundPlaying = false;
  }

  /** USER ACTION METHODS */
  rotateShip() {
    if (this.game.input.isHeld("rotateRight")) {
      this.angleOfShip += PI / 40;
    } else if (this.game.input.isHeld("rotateLeft")) {
      this.angleOfShip -= PI / 40;
    }

    if (this.angleOfShip > 2 * PI) this.angleOfShip % (2 * PI);
    if (this.angleOfShip < 0) this.angleOfShip + 2 * PI;
  }

  accelerate() {
    if (this.game.input.isHeld("thrust")) {
      this.acceleration = 1;
      this.createTraces();

      if (this.game?.soundManager && !this.thrustSoundPlaying) {
        this.game.soundManager.play("shipThrust");
        this.thrustSoundPlaying = true;
      }
    } else {
      this.acceleration = 0;
      this.stopThrust();
    }
  }

  // Every path that ends thrust comes through here: the key going up, the ship dying, and the
  // Game being torn down around a SoundManager that outlives it. The loop plays until something
  // stops it, so a path that only cleared the flag would leave it running forever.
  stopThrust() {
    if (!this.thrustSoundPlaying) return;
    this.game?.soundManager?.stop("shipThrust");
    this.thrustSoundPlaying = false;
  }

  brakes() {
    if (this.game.input.isHeld("brake")) {
      this.velocity.x -= 0.04 * Math.cos(this.angleOfShip);
      this.velocity.y -= 0.04 * Math.sin(this.angleOfShip);
    }
  }

  fireIfPressed() {
    const pressed = this.game.input.wasPressed("shoot");
    // A ghost reads the press and throws it away rather than leaving it unread, so nothing the
    // player held down during the ghost fires on the frame the ship becomes mortal.
    if (!pressed || this.game.state.isGhost()) return;

    this.shots.push(new Shot(this.p5, this));
    if (this.game?.soundManager) {
      this.game.soundManager.play("shoot");
    }
  }

  /** CALCULATIONS */
  calcVelocity() {
    let { x, y } = this.velocity;

    const absoluteVelocity = calcVectorValue(x, y);

    if (absoluteVelocity < 5) {
      x += this.acceleration * Math.cos(this.angleOfShip);
      y += this.acceleration * Math.sin(this.angleOfShip);
    }

    return {
      x: x - x * this.resistance,
      y: y - y * this.resistance,
    };
  }

  calcPosition() {
    const { x, y } = this.position;
    return {
      x: x + this.velocity.x,
      y: y + this.velocity.y,
    };
  }

  ifOverflowed() {
    const { x, y } = this.position;
    const { width, height } = this.p5;

    // A wrap is a teleport, not a path. Collision substeps read this and stop interpolating.
    this.wrapped = x < 0 || x > width || y < 0 || y > height;

    if (x < 0) return { x: x + width, y: y };
    if (x > width) return { x: x % width, y: y };
    if (y < 0) return { x: x, y: y + height };
    if (y > height) return { x: x, y: y % height };

    return { x: x, y: y };
  }

  /** EVENTS => triggered in game.js */
  handleExplosion() {
    this.stopThrust();
    const origin = { ...this.position };
    this.exploded = true;
    this.position = { x: null, y: null };
    const randomDebris = randomInteger(30, 40);
    this.shipDebris = new Array(randomDebris)
      .fill()
      .map(() => new ShipDebris(this.p5, origin));
  }

  // A death rebuilds the ship, not the Game, so this is the whole of the clean slate: back at
  // the point it died, stationary, with the wreck cleared away. The heading survives, so the
  // ghost faces the way the player was flying when it died.
  rebuildAt({ x, y }) {
    this.position = { x, y };
    this.prevPosition = { x, y };
    this.wrapped = false;
    this.velocity = { x: 0, y: 0 };
    this.acceleration = 0;
    this.exploded = false;
    this.shipDebris = [];
    this.traces = [];
  }

  createTraces() {
    this.traces.push(new ShipTrace(this.p5, this));
  }

  /** CLEANUP */
  filterOldShots() {
    const { width, height } = this.p5;
    this.shots = this.shots.filter(
      (shot) =>
        shot.hit === false &&
        shot.position.x >= 0 &&
        shot.position.x <= width &&
        shot.position.y >= 0 &&
        shot.position.y <= height
    );
  }

  filterOldTraces() {
    this.traces = this.traces.filter((trace) => trace.faded === false);
  }

  filterOldShipDebris() {
    this.shipDebris = this.shipDebris.filter(
      (debris) => debris.faded === false
    );
  }

  /** RENDERING */
  // Call inside a translate/rotate onto the ship. The ghost after a death fades through alpha,
  // which the hull has to carry on its fill and its stroke.
  drawHull(alpha) {
    const { p5 } = this;
    p5.fill(...FILL, 255 * alpha);
    p5.stroke(...STROKE, 255 * alpha);
    p5.strokeWeight(2);
    p5.beginShape();
    for (const [x, y] of HULL) p5.vertex(x, y);
    p5.endShape(p5.CLOSE);
  }

  /** LOOP */
  // Everything that moves, ahead of every test that measures. A dead ship stops steering, but
  // its shots keep flying.
  step() {
    this.prevPosition.x = this.position.x;
    this.prevPosition.y = this.position.y;
    this.prevAngle = this.angleOfShip;

    if (!this.exploded) {
      this.rotateShip();
      this.accelerate();
      this.brakes();

      this.velocity = this.calcVelocity();
      this.position = this.calcPosition();
      this.position = this.ifOverflowed();
    }

    this.shots.forEach((shot) => shot.step());
  }

  draw() {
    const { p5 } = this;

    // A dead ship stops shooting, but its shots, traces and debris keep running until they
    // expire.

    // CLEANUP
    this.filterOldShots();
    this.filterOldTraces();
    this.filterOldShipDebris();

    // RENDERING
    this.shots.forEach((shot) => shot.draw());
    this.traces.forEach((trace) => trace.draw());

    if (this.exploded) {
      this.shipDebris.forEach((debris) => debris.draw());
    } else {
      // RENDERS THE SHIP ITSELF
      // A ghost blinks and fades in off one curve owned by GameState, so the player watches the
      // protection run out. Null is a dark frame of the blink.
      const alpha = this.game.state.ghostAlpha();
      if (alpha !== null) {
        p5.push();
        p5.translate(this.position.x, this.position.y);
        p5.rotate(this.angleOfShip);
        this.drawHull(alpha);
        p5.pop();
      }

      this.fireIfPressed();
    }
  }
}
