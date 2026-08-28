import { randomInteger, drawPolygon } from "../helpers";

const FILL = [255, 1, 241];
const STROKE = [255, 0, 98];
const FADE_PER_FRAME = 4;

export default class ShipDebris {
    constructor(p5, origin) {
        this.p5 = p5;

        this.sides = 3;
        this.radius = randomInteger(3, 8);
        this.position = { x: origin.x, y: origin.y };
        this.rotation = {
            angle: Math.random() * 2 * Math.PI,
            velocity: (Math.random() - 0.5) / 10,
        };
        this.velocity = this.calcInitialVelocityVectors();
        this.alpha = 255;
        this.faded = false;
    }

    calcInitialVelocityVectors() {
        const direction = Math.random() * 2 * Math.PI;
        const speed = 1 + Math.random() * 4;
        return {
            x: Math.cos(direction) * speed,
            y: Math.sin(direction) * speed,
        }
    }

    calcPosition() {
        this.position.x += this.velocity.x;
        this.position.y += this.velocity.y;
    }

    calcRotation() {
        this.rotation.angle += this.rotation.velocity;
    }

    calcVelocity() {
        this.velocity.x -= this.velocity.x * .02;
        this.velocity.y -= this.velocity.y * .02;
    }

    calcColor() {
        this.alpha -= FADE_PER_FRAME;

        if (this.alpha <= 0) {
            this.alpha = 0;
            this.faded = true;
        }
    }

    draw() {
        const p5 = this.p5;

        // CALCULATIONS
        this.calcPosition();
        this.calcRotation();
        this.calcVelocity();
        this.calcColor();

        // RENDERING
        p5.push();

        p5.translate(this.position.x, this.position.y);
        p5.rotate(this.rotation.angle);
        p5.strokeWeight(2);
        p5.stroke(...STROKE, this.alpha);
        p5.fill(...FILL, this.alpha);
        drawPolygon(p5, 0, 0, this.radius, this.sides);

        p5.pop();
    }
}
