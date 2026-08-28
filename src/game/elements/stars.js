
export default class Stars {
    constructor(p5) {
        this.p5 = p5;
        this.stars = new Array(500).fill().map(() => new Star(p5));
    }

    draw() {
        const p5 = this.p5;

        p5.push();
        p5.stroke('#AFE4FF');
        p5.strokeWeight(3);

        this.stars.forEach(star => star.draw());

        p5.pop();
    }
}

class Star {
    constructor(p5) {
        this.p5 = p5
        this.position = {
            x: Math.random() * p5.width,
            y: Math.random() * p5.height,
        }
    }

    draw() {
        // Stroke and weight are set once by Stars.draw for the whole field.
        this.p5.point(this.position.x, this.position.y);
    }
}