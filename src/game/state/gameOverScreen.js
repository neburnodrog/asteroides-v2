import { TEXT_COLOR } from './palette';

export default class GameOverScreen {
    constructor(p5, game) {
        this.p5 = p5;
        this.game = game;
        this.textSize = 42;
        this.color = TEXT_COLOR;
    }

    draw() {
        const p5 = this.p5;

        p5.push()

        p5.frameRate(20);

        p5.textAlign(p5.CENTER, p5.CENTER);
        p5.translate(p5.width / 2, p5.height / 2);

        p5.textSize(this.textSize);
        p5.fill(this.color);

        p5.text('GAME OVER', 0, 0)
        p5.text(`SCORE: ${this.game.run.score}`, 0, 100);

        // Nothing extra when the run missed the table, so a bad run is not decorated.
        if (this.game.rank) {
            p5.textSize(22);
            p5.text(`NEW HIGH SCORE #${this.game.rank}`, 0, 147);
            p5.textSize(this.textSize);
        }

        p5.text('PRESS SPACE TO PLAY AGAIN', 0, 200)

        p5.pop();

        if (this.game.input.wasPressed("confirm")) {
            this.game.state.acknowledgeGameOver();
        }
    }
}
