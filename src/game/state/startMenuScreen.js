import VolumeControl from "./volumeControl";
import { TEXT_COLOR } from "./palette";

export const CONTROLS_TEXT = "Controls: ASWD/ARROWS to move & ENTER/SPACE to shoot";

export class StartMenuScreen {
  constructor(p5, game) {
    this.p5 = p5;
    this.game = game;
    this.title = { text: "ASTEROiDES", size: 52, position: { x: 0, y: -200 } };
    // The whole table, in columns of five. Five rows are what fits in the gap between the title
    // and the level line, so a second column is what buys the other five without moving anything
    // else on the menu. A table of five or fewer draws one centred column.
    this.scores = {
      heading: "BEST RUNS",
      headingSize: 18,
      rowSize: 16,
      perColumn: 5,
      columnGap: 220,
      top: -152,
      spacing: 21,
    };
    this.level = { text: `LEVEL `, position: { x: 0, y: 0 } };
    this.volume = { control: new VolumeControl(p5, game), y: 52 };
    this.start = {
      text: "PRESS ENTER/SPACE TO START",
      position: { x: 0, y: 100 },
    };
    this.controls = {
      text: CONTROLS_TEXT,
      position: { x: 0, y: 200 },
    };
    this.color = TEXT_COLOR;
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

    this._renderScores();

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

    this.volume?.control.draw(this.volume.y);

    p5.pop();
  }

  // An empty table draws no heading and no rows, so a first run does not start on a page of
  // placeholders. Everything else on the menu keeps its position either way.
  _renderScores() {
    if (!this.scores) return;

    const rows = this.game.highScores.entries();
    if (rows.length === 0) return;

    const { headingSize, rowSize, perColumn, columnGap, top, spacing } = this.scores;
    const p5 = this.p5;
    const columns = Math.ceil(rows.length / perColumn);

    p5.textSize(headingSize);
    p5.text(this.scores.heading, 0, top);

    p5.textSize(rowSize);
    rows.forEach((row, index) => {
      const column = Math.floor(index / perColumn);
      const line = index % perColumn;

      p5.text(
        `${index + 1}  ${row.score}  LEVEL ${row.level}`,
        (column - (columns - 1) / 2) * columnGap,
        top + spacing * (line + 1)
      );
    });
  }

  _onConfirm() {
    this.game.state.startPlaying();
  }

  draw() {
    this._render();
    this.volume?.control.update();
    if (this.game.input.wasPressed("confirm")) this._onConfirm();
  }
}

export class LevelUpScreen extends StartMenuScreen {
  constructor(p5, game) {
    super(p5, game);
    this.controls = { text: "", position: { x: 0, y: 0 } };
    // The screen between waves stays about the wave.
    this.scores = null;
    this.volume = null;
  }

  _onConfirm() {
    this.game.state.acknowledgeLevelUp();
  }
}
