import VolumeControl from "./volumeControl";
import { CONTROLS_TEXT } from "./startMenuScreen";

const OVERLAY = [0, 0, 0, 170];

// The frozen field under a dark overlay. It renders the entities without stepping them, so a
// paused frame is a still, and leaves resuming by Escape or P to Game.draw.
export default class PauseScreen {
  constructor(p5, game) {
    this.p5 = p5;
    this.game = game;
    this.volumeControl = new VolumeControl(p5, game);
    this.color = "#AFE4FF";
  }

  draw() {
    const p5 = this.p5;
    const { asteroids, ship, scoreboard, run } = this.game;

    p5.frameRate(60);

    asteroids.render();
    ship.render();
    scoreboard.draw(run);

    p5.push();

    p5.noStroke();
    p5.fill(...OVERLAY);
    p5.rect(0, 0, p5.width, p5.height);

    p5.fill(this.color);
    p5.textAlign(p5.CENTER, p5.CENTER);
    p5.translate(p5.width / 2, p5.height / 2);

    p5.textSize(52);
    p5.text("PAUSED", 0, -160);

    p5.textSize(24);
    p5.text("PRESS ESC/P OR ENTER/SPACE TO RESUME", 0, -90);

    this.volumeControl.draw(70);

    p5.textSize(24);
    p5.text(CONTROLS_TEXT, 0, 140);

    p5.pop();

    this.volumeControl.update();
    if (this.game.input.wasPressed("confirm")) this.game.resume();
  }
}
