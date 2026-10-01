import { randomInteger } from '../helpers';

// Tuned so a trace lives ~12 frames, matching the lifetime of the per-trace
// setTimeout this replaced.
const FADE_PER_FRAME = 20;

export default class ShipTrace {
    constructor(p5, ship) {
        this.p5 = p5;

        this.radius = randomInteger(5, 20);
        this.color = this.getInitialColor();
        this.position = this.getInitialPosition({ ...ship.position });
        this.faded = false;
    }

    getInitialColor() {
        return {
            fill: {
                R: randomInteger(200, 255),
                G: randomInteger(0, 255),
                B: randomInteger(0, 125),
                A: randomInteger(200, 255),
            },
            stroke: {
                R: randomInteger(200, 255),
                G: randomInteger(0, 255),
                B: randomInteger(0, 125),
                A: randomInteger(200, 255),
            },
        }

    }

    getInitialPosition(position) {
        return {
            x: position.x + (4 * Math.random() - 2),
            y: position.y + (4 * Math.random() - 2),
        }
    }

    calcColor() {
        this.color.fill.A -= FADE_PER_FRAME;
        this.color.stroke.A -= FADE_PER_FRAME;

        if (this.color.fill.A <= 0 && this.color.stroke.A <= 0) {
            this.faded = true;
        }
    }

    calcRadius() {
        this.radius -= 0.1;

        if (this.radius < 0) {
            this.faded = true;
        }
    }


    step() {
        this.calcColor();
    }

    draw() {
        const p5 = this.p5;

        p5.push();

        p5.translate(this.position.x, this.position.y);
        p5.strokeWeight(1);
        p5.stroke(...Object.values(this.color.stroke));
        p5.fill(...Object.values(this.color.fill));
        p5.circle(0, 0, this.radius);

        p5.pop();


    }
}