import Shot from "./shot";
import ShipDebris from "./shipDebris";
import ShipTrace from "./shipTrace";
import { randomInteger, calcVectorValue } from "../helpers";

const PI = Math.PI;

export default class Ship {
  constructor(p5, game, image) {
    this.p5 = p5;
    this.game = game;

    // STATIC PROPERTIES
    this.image = image;
    this.shipLength = 50;
    this.shipWidth = 30;

    // DYNAMIC PROPERTIES
    this.acceleration = 0; // only when arrow_up is pressed
    this.resistance = 0.02;
    this.velocity = { x: 0, y: 0 };
    this.position = { x: p5.width / 2, y: p5.height / 2 };
    this.angleOfShip = 0; // expressed in radians

    // DEPENDANT ELEMENTS
    this.shots = [];
    this.traces = [];
    this.shipDebris = [];

    // STATE
    this.exploded = false;
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
      this.thrustSoundPlaying = false;
    }
  }

  brakes() {
    if (this.game.input.isHeld("brake")) {
      this.velocity.x -= 0.04 * Math.cos(this.angleOfShip);
      this.velocity.y -= 0.04 * Math.sin(this.angleOfShip);
    }
  }

  fireIfPressed() {
    if (this.game.input.wasPressed("shoot")) {
      this.shots.push(new Shot(this.p5, this));
      if (this.game?.soundManager) {
        this.game.soundManager.play("shoot");
      }
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
    const { width, height } = this.p5;
    let { x, y } = this.position;

    if (x < 0) return { x: x + width, y: y };
    if (x > width) return { x: x % width, y: y };
    if (y < 0) return { x: x, y: y + height };
    if (y > height) return { x: x, y: y % height };

    return { x: x, y: y };
  }

  /** EVENTS => triggered in game.js */
  handleExplosion() {
    const origin = { ...this.position };
    this.exploded = true;
    this.position = { x: null, y: null };
    const randomDebris = randomInteger(30, 40);
    this.shipDebris = new Array(randomDebris)
      .fill()
      .map(() => new ShipDebris(this.p5, origin));
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

  /** LOOP */
  draw() {
    const { p5 } = this;

    // A dead ship stops steering and stops shooting, but its shots, traces and
    // debris keep running until they expire.
    if (!this.exploded) {
      // USER ACTIONS
      this.rotateShip();
      this.accelerate();
      this.brakes();

      // CALCULATIONS
      this.velocity = this.calcVelocity();
      this.position = this.calcPosition();
      this.position = this.ifOverflowed();
    }

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
      p5.push();
      p5.translate(this.position.x, this.position.y);
      p5.rotate(this.angleOfShip);
      p5.image(this.image, 5, 0, this.shipLength, this.shipWidth);
      p5.pop();

      this.fireIfPressed();
    }
  }
}
