export class StartMenuScreen {
  constructor(p5, game) {
    this.p5 = p5;
    this.game = game;
    this.title = { text: "ASTEROiDES", size: 52, position: { x: 0, y: -200 } };
    this.level = { text: `LEVEL `, position: { x: 0, y: 0 } };
    this.start = {
      text: "PRESS ENTER/SPACE TO START",
      position: { x: 0, y: 100 },
    };
    this.controls = {
      text: "Controls: ASWD/ARROWS to move & ENTER/SPACE to shoot",
      position: { x: 0, y: 200 },
    };
    this.color = "#AFE4FF";
  }

  _render() {
    const p5 = this.p5;

    p5.push();

    p5.frameRate(10);

    p5.fill(this.color);
    p5.textAlign(p5.CENTER, p5.CENTER);
    p5.translate(p5.width / 2, p5.height / 2);

    p5.textSize(this.title.size);
    p5.text(this.title.text, this.title.position.x, this.title.position.y);

    p5.textSize(32);
    p5.text(
      this.level.text + this.game.run.level.toString(),
      this.level.position.x,
      this.level.position.y
    );
    p5.text(this.start.text, this.start.position.x, this.start.position.y);
    p5.text(
      this.controls.text,
      this.controls.position.x,
      this.controls.position.y
    );

    p5.pop();
  }

  _onConfirm() {
    this.game.state.startPlaying();
  }

  draw() {
    this._render();
    if (this.game.input.wasPressed("confirm")) this._onConfirm();
  }
}

export class LevelUpScreen extends StartMenuScreen {
  constructor(p5, game) {
    super(p5, game);
    this.controls = { text: "", position: { x: 0, y: 0 } };
  }

  _onConfirm() {
    this.game.state.acknowledgeLevelUp();
  }
}
