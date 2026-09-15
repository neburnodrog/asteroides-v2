import { drawFacetedPolygon, drawPolygon, randomInteger } from '../helpers';
import AsteroidDebris from './asteroidDebris';

// The treatment settled in prototype/asteroid-treatments.html, on the
// prototype/asteroid-treatments branch. Every number here was picked by eye against a live field.
const OUTLINE = "#F29F38";
const BASE_HUE = 33;
const HUE_JITTER = 12;
const BASE_SATURATION = 90;
const SATURATION_JITTER = 4;
// A rock reads lighter than the one it split from, so a shower of S is legible against its parent.
const LIGHTNESS = { X: 34, M: 40, S: 46 };
// How far off centre the fan apex sits, as a fraction of the radius. At 0 the rock is a pinwheel.
const APEX_OFFSET = 0.3;
// Lightness swing between the lit and the unlit side of a rock, in HSL points.
const FACET_CONTRAST = 13;

export default class Asteroids {
    constructor(p5, level, size = 'X') {
        this.p5 = p5;
        this.level = level;
        this.array = this.createInitialAsteroids(size);
        this.asteroidDebris = [];
    }

    createInitialAsteroids() {
        return new Array(this.level * 2)
            .fill()
            .map(() => new Asteroid(this.p5, 'X', this.initialPosition()));
    }

    initialPosition() {
        const { width, height } = this.p5

        let x = width * Math.random();
        let y = height * Math.random();

        while (this.p5.dist(x, y, width / 2, height / 2) < 300) {
            x = width * Math.random();
            y = height * Math.random();
        }

        return { x: x, y: y, }
    }

    handleExplodedAsteroids(explodedAsteroids) {
        explodedAsteroids.forEach(asteroid => {
            this.createDebris(asteroid);

            let { size, position } = { ...asteroid };
            if (size === 'X') this.addAsteroids(2, 'M', { ...position })
            else if (size === 'M') this.addAsteroids(2, 'S', { ...position });
        });
    }

    addAsteroids(howMany, size, position) {
        this.array = this.array
            .concat(new Array(howMany).fill()
                .map(() => new Asteroid(this.p5, size, { ...position })))
    }

    cleanExplodedAsteroids() {
        this.array = this.array.filter(asteroid => !asteroid.exploded)
    }

    createDebris(asteroid) {
        const totalDebris = this.randomNumOfDebris(asteroid.radius);
        for (let i = 0; i < totalDebris; i++) {
            this.asteroidDebris.push(new AsteroidDebris(this.p5, totalDebris, asteroid));
        }
    }

    randomNumOfDebris(radius) {
        return Math.floor(randomInteger(1, 3) * Math.sqrt(radius));
    };

    step() {
        this.array.forEach(asteroid => asteroid.step());
    }

    draw() {
        this.asteroidDebris = this.asteroidDebris.filter(debris => !debris.faded);

        this.array.forEach(asteroid => asteroid.draw());
        this.asteroidDebris.forEach(debris => debris.draw());
    }
}


class Asteroid {
    constructor(p5, size, position) {
        this.p5 = p5;

        this.size = size;
        this.position = position;

        this.asteroidVelocityMap = { X: 4, M: 7, S: 10 }
        this.velocity = this.initialVelocity();
        this.sides = randomInteger(7, 13);
        this.radius = this.initialRadius(size);
        this.rotation = this.initialRotation();

        this.prevPosition = { x: position.x, y: position.y };
        this.prevAngle = 0;
        this.wrapped = false;

        this.strokes = { X: 8, M: 6, S: 4 }
        this.look = this.initialLook();
        this.exploded = false;
    }

    // Built once and never mutated. The apex and the light angle live in the rock's local frame,
    // so they turn with it and the shading stays put on the rock rather than sliding as it spins.
    initialLook() {
        const apexAngle = Math.random() * 2 * Math.PI;
        const apexReach = this.radius * APEX_OFFSET * (0.4 + Math.random() * 0.6);

        return {
            apexX: Math.cos(apexAngle) * apexReach,
            apexY: Math.sin(apexAngle) * apexReach,
            lightAngle: Math.random() * 2 * Math.PI,
            hue: BASE_HUE + (Math.random() * 2 - 1) * HUE_JITTER,
            saturation: BASE_SATURATION + (Math.random() * 2 - 1) * SATURATION_JITTER,
            lightness: LIGHTNESS[this.size],
            contrast: FACET_CONTRAST,
        };
    }

    initialVelocity() {
        return {
            x: (Math.random() - 0.5) * this.asteroidVelocityMap[this.size],
            y: (Math.random() - 0.5) * this.asteroidVelocityMap[this.size],
        }
    }

    initialRadius(size) {
        if (size === 'X') return Math.random() * 25 + 70;
        if (size === 'M') return Math.random() * 15 + 40;
        if (size === 'S') return Math.random() * 10 + 20;
    }

    initialRotation() {
        return { angle: 0, velocity: (Math.random() - 0.5) * this.asteroidVelocityMap[this.size] / 50 }
    }

    // What it is drawn with. The stroke is centred on the edge, so collision reads this to work
    // out how far past the geometry the pixels reach.
    get strokeWeight() {
        return this.strokes[this.size];
    }

    // CALCULATIONS
    calcRotation() {
        this.rotation.angle += this.rotation.velocity;
    }

    calcPosition() {
        const { width, height } = this.p5;

        this.position.x += this.velocity.x;
        this.position.y += this.velocity.y;

        // All four read the same pre-wrap position, so an earlier branch cannot change what a
        // later one judges.
        const { x, y } = this.position;
        const offRight = x > width + this.radius;
        const offLeft = x < 0 - this.radius;
        const offBottom = y > height + this.radius;
        const offTop = y < 0 - this.radius;

        this.wrapped = offRight || offLeft || offBottom || offTop;

        if (offRight) this.position.x = 0 - this.radius;
        if (offLeft) this.position.x = width + this.radius;
        if (offBottom) this.position.y = 0 - this.radius;
        if (offTop) this.position.y = height + this.radius;
    }

    step() {
        this.prevPosition.x = this.position.x;
        this.prevPosition.y = this.position.y;
        this.prevAngle = this.rotation.angle;

        this.calcRotation();
        this.calcPosition();
    }

    draw() {
        const p5 = this.p5;

        // RENDERING
        p5.push();

        p5.translate(this.position.x, this.position.y);
        p5.rotate(this.rotation.angle);

        drawFacetedPolygon(p5, this.radius, this.sides, this.look);

        // Last, so the facet hairlines cannot bleed over the edge that kills.
        p5.strokeWeight(this.strokes[this.size]);
        p5.stroke(OUTLINE);
        p5.noFill();
        drawPolygon(p5, 0, 0, this.radius, this.sides);

        p5.pop();
    }
}