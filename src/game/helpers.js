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

const facetScratch = [];
const rgbScratch = [0, 0, 0];

// Render only. The facets fill the n-gon geometry.js already produces without moving a vertex
// of it, so the silhouette the collision test reads is untouched. See ADR-0003.
//
// `look` is built once per asteroid and never mutated: apex in the rock's local frame,
// lightAngle the direction the light falls from, the rock's own HSL, and contrast, the lightness
// swing between its lit and unlit sides.
//
// Its own push/pop. The killing outline is stroked after this returns, and collisions.js offsets
// by what a mitred corner draws, so the round join the facets need must not reach it.
export function drawFacetedPolygon(p5, radius, npoints, look) {
    const vertices = ngonVertices(0, 0, radius, npoints, 0, facetScratch);
    const { apexX, apexY, lightAngle, hue, saturation, lightness, contrast } = look;

    p5.push();

    // Two antialiased fills meeting on a shared edge leave a seam. Stroking each facet in its
    // own fill colour seals it.
    p5.strokeWeight(1.2);
    p5.strokeJoin(p5.ROUND);

    for (let i = 0; i < npoints; i++) {
        const [ax, ay] = vertices[i];
        const [bx, by] = vertices[(i + 1) % npoints];

        const facetAngle = Math.atan2((ay + by + apexY) / 3, (ax + bx + apexX) / 3);
        const shade = lightness + Math.cos(facetAngle - lightAngle) * contrast;

        hslToRgb(hue, saturation, shade, rgbScratch);
        p5.fill(rgbScratch[0], rgbScratch[1], rgbScratch[2]);
        p5.stroke(rgbScratch[0], rgbScratch[1], rgbScratch[2]);

        p5.beginShape();
        p5.vertex(apexX, apexY);
        p5.vertex(ax, ay);
        p5.vertex(bx, by);
        p5.endShape(p5.CLOSE);
    }

    p5.pop();
}

// Hue in degrees, saturation and lightness in percent. Writes three 0-255 channels into `out`,
// which the caller owns, because this runs once per facet per frame.
function hslToRgb(hue, saturation, lightness, out) {
    const s = Math.min(Math.max(saturation, 0), 100) / 100;
    const l = Math.min(Math.max(lightness, 0), 100) / 100;

    const chroma = (1 - Math.abs(2 * l - 1)) * s;
    const sector = (((hue % 360) + 360) % 360) / 60;
    const second = chroma * (1 - Math.abs((sector % 2) - 1));
    const base = l - chroma / 2;

    let r = 0, g = 0, b = 0;
    if (sector < 1) { r = chroma; g = second; }
    else if (sector < 2) { r = second; g = chroma; }
    else if (sector < 3) { g = chroma; b = second; }
    else if (sector < 4) { g = second; b = chroma; }
    else if (sector < 5) { r = second; b = chroma; }
    else { r = chroma; b = second; }

    out[0] = Math.round((r + base) * 255);
    out[1] = Math.round((g + base) * 255);
    out[2] = Math.round((b + base) * 255);
    return out;
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