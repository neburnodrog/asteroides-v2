import { ngonVertices } from './geometry.js';

export function randomInteger(a, b) {
    // random integer between a(included) & b(excluded).
    return Math.floor((Math.random() * (b - a))) + a;
}

// Reused across every asteroid on every frame. drawPolygon is called from inside a
// translate/rotate, so the vertices it asks for are centred on the origin at angle 0.
const polygonScratch = [];

export function drawPolygon(p5, x, y, radius, npoints) {
    const vertices = ngonVertices(x, y, radius, npoints, 0, polygonScratch);

    p5.beginShape();
    for (const [vx, vy] of vertices) p5.vertex(vx, vy);
    p5.endShape(p5.CLOSE);
}

export function calcVelocityComponents(direction, speed) {
    // only calculated when a new Shot is instanciated.
    return {
        x: Math.cos(direction) * speed,
        y: Math.sin(direction) * speed,
    }
}

export function calcVectorValue(x, y) {
    // The absolute value of the vector is the hypotenuse of the x & y components (Pythagorean theorem)
    return Math.sqrt(y ** 2 + x ** 2);
}


export function findOutWidth() {
    return window.innerWidth && document.documentElement.clientWidth ?
        Math.min(window.innerWidth, document.documentElement.clientWidth) * 0.99
        : window.innerWidth * 0.99
        || document.documentElement.clientWidth * 0.99
        || document.getElementsByTagName('body')[0].clientWidth * 0.99
}

export function findOutHeight() {
    return window.innerHeight && document.documentElement.clientHeight ?
        Math.min(window.innerHeight, document.documentElement.clientHeight) * 0.99
        : window.innerHeight * 0.99
        || document.documentElement.clientHeight * 0.99
        || document.getElementsByTagName('body')[0].clientHeight * 0.99
}