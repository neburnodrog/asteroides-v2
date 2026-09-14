import { calcVelocityComponents, calcVectorValue } from '../helpers';

export default class Shot {
    constructor(p5, ship) {
        this.p5 = p5;
        this.position = { x: ship.position.x, y: ship.position.y }
        // Where the shot was at the top of this frame. Collision substeps read this, because a
        // shot crosses up to 20.88px of canvas per frame and a small asteroid is 53px across.
        this.prevPosition = { x: this.position.x, y: this.position.y }
        this.absoluteSpeed = 15;
        this.velocity = calcVelocityComponents(
            ship.angleOfShip,
            this.absoluteSpeed + calcVectorValue(ship.velocity.x, ship.velocity.y)
        );
        this.hit = false;
    }

    calcPosition() {
        this.position.x += this.velocity.x;
        this.position.y += this.velocity.y;
    }

    step() {
        this.prevPosition.x = this.position.x;
        this.prevPosition.y = this.position.y;

        this.calcPosition();
    }

    draw() {
        const p5 = this.p5;

        p5.push();
        p5.strokeWeight(8);
        p5.stroke("#ff01ef");
        p5.point(this.position.x, this.position.y);
        p5.pop();
    }
}