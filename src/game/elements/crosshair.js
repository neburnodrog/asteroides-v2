import { TEXT_COLOR } from "../state/palette";

// Pixels from the centre to the end of each arm, and the gap left open in the middle.
const ARM = 9;
const GAP = 3;

export function drawCrosshair(p5, { x, y }) {
  p5.push();
  p5.stroke(TEXT_COLOR);
  p5.strokeWeight(1.5);
  p5.line(x - ARM, y, x - GAP, y);
  p5.line(x + GAP, y, x + ARM, y);
  p5.line(x, y - ARM, x, y - GAP);
  p5.line(x, y + GAP, x, y + ARM);
  p5.pop();
}
