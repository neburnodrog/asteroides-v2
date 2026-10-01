const STEPS = 10;
const BOX = 14;
const GAP = 4;
const LABEL_SIZE = 20;
// Where the bar starts, left of the centre line, so label and bar together sit about centred.
const BAR_LEFT = -60;

// The volume line one screen draws and drives. The start menu and the pause screen each hold
// one, so both read the same presses and draw the same bar.
export default class VolumeControl {
  constructor(p5, game) {
    this.p5 = p5;
    this.game = game;
    this.color = "#AFE4FF";
  }

  // A press that cannot move the step, at either end, changes nothing and plays nothing. A move
  // plays one unvaried shot at the new level so the player hears what they chose.
  update() {
    const { input, volume, soundManager } = this.game;
    const delta =
      (input.wasPressed("volumeUp") ? 1 : 0) -
      (input.wasPressed("volumeDown") ? 1 : 0);

    if (delta !== 0 && volume.step(delta)) {
      soundManager.play("shoot", { vary: false });
    }
  }

  // Call inside a translate onto the centre of the canvas.
  draw(y) {
    const p5 = this.p5;
    const step = this.game.volume.get();

    p5.push();

    p5.textSize(LABEL_SIZE);
    p5.textAlign(p5.RIGHT, p5.CENTER);
    p5.noStroke();
    p5.fill(this.color);
    p5.text("VOLUME", BAR_LEFT - 20, y);

    p5.stroke(this.color);
    p5.strokeWeight(1);
    for (let i = 0; i < STEPS; i++) {
      if (i < step) p5.fill(this.color);
      else p5.noFill();
      p5.rect(BAR_LEFT + i * (BOX + GAP), y - BOX / 2, BOX, BOX);
    }

    p5.pop();
  }
}
