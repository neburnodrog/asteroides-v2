const HEART_SIZE = 20;
const SCORE_COLOR = "#00ca8d";

export default class Scoreboard {
  constructor(p5, heartImage) {
    this.p5 = p5;
    this.heartImage = heartImage;
  }

  draw(run) {
    const p5 = this.p5;

    p5.push();

    for (let i = 0; i < run.lives; i++) {
      p5.image(this.heartImage, (i + 1) * HEART_SIZE, 15, HEART_SIZE, HEART_SIZE);
    }

    p5.textSize(24);
    p5.fill(SCORE_COLOR);
    p5.textAlign(p5.CENTER, p5.CENTER);
    p5.text(run.score, 100, 12);

    p5.pop();
  }
}
