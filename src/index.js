import p5 from "p5";
import "p5/lib/addons/p5.sound";
import "./css/index.css";

// FONTS
import font from "./font/SpaceQuest-yOY3.ttf";

// IMAGES
import heartImage from "./images/heart.png";
import "./images/favicon.ico";

// GAME COMPONENTS
import Background from "./game/elements/background.js";
import Game from "./game/game";
import Run from "./game/run.js";
import HighScores from "./game/highScores.js";
import Volume from "./game/volume.js";
import { findOutHeight, findOutWidth } from "./game/helpers";

import SoundManager from "./game/soundManager.js";
import Input from "./game/input.js";

// global variables
let background;
let game;
let heart;
let spaceQuest;

// p5 SKETCH
const sketch = (p5) => {
  let soundManager = new SoundManager(p5);
  let input = new Input(p5);
  let run = new Run();
  let highScores = new HighScores();
  let volume = new Volume({
    onChange: (level) => soundManager.setOutputLevel(level),
  });
  const lasting = { soundManager, input, run, highScores, volume };
  // Set before the harness module resolves, so no blur in between can pause the game a test is
  // about to arrange.
  let harnessAttached = false;

  const autoPause = () => game?.pause();
  const onFocusLost = () => {
    if (!harnessAttached) autoPause();
  };

  const resetSketch = (current) => {
    game?.teardown();
    game = new Game(p5, lasting, current, { heart });
  };

  const attachTestHarnessIfAsked = () => {
    // The NODE_ENV test has to stay inline like this. Webpack folds it at parse time, so a
    // production build never registers the dynamic import and emits no chunk for the harness.
    // Reading it into a variable first defeats that and ships the module. See e2e/README.md.
    if (process.env.NODE_ENV !== "production") {
      if (!window.location.search.includes("e2e=1")) return;

      harnessAttached = true;
      import("./game/harness.js").then(({ attachHarness }) => {
        attachHarness({
          p5,
          run,
          highScores,
          volume,
          autoPause,
          getGame: () => game,
        });
      });
    }
  };

  p5.preload = () => {
    heart = p5.loadImage(heartImage);
    spaceQuest = p5.loadFont(font);
    soundManager.preload();
    soundManager.addReverb();
    soundManager.setOutputLevel(volume.level());
  };

  p5.setup = () => {
    p5.createCanvas(findOutWidth(), findOutHeight());
    p5.imageMode(p5.CENTER);
    background = new Background(p5);
    resetSketch("menu");
    p5.textFont(spaceQuest);
    attachTestHarnessIfAsked();

    // Focus coming back does nothing, so the player resumes when ready.
    window.addEventListener("blur", onFocusLost);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) onFocusLost();
    });
  };

  p5.draw = () => {
    background.draw();
    game.draw();

    const { nextState } = game.state;
    if (nextState) {
      // Rebuilding into the menu means the run ended. Everything else continues it.
      if (nextState === "menu") run.reset();
      resetSketch(nextState);
    }

    let fps = p5.frameRate();
    p5.fill(255);
    p5.stroke(0);
    p5.text("FPS: " + fps.toFixed(2), 10, p5.height - 10);
  };

  p5.windowResized = () => {
    p5.resizeCanvas(findOutWidth(), findOutHeight());
    background = new Background(p5);
  };
};

// p5 defers _start, and therefore preload, to the window load event whenever the document is not
// already complete. p5.sound's init hook has by then incremented the preload counter and started
// loading its audio worklet, so if that worklet resolves before the load event the counter hits
// zero and p5 runs setup before preload has ever run. setup then calls textFont on a font that was
// never loaded and p5 throws. Constructing once the document is complete makes p5 run _start inside
// the constructor, where preload cannot lose the race.
if (document.readyState === "complete") {
  new p5(sketch);
} else {
  window.addEventListener("load", () => new p5(sketch), { once: true });
}

window.top.document.onkeydown = function (evt) {
  evt = evt || window.event;
  var keyCode = evt.keyCode;
  if ((keyCode >= 37 && keyCode <= 40) || keyCode === 32) {
    return false;
  }
};

// p5's preload/setup lifecycle binds to the initial module instance.
// Opt out of HMR so module edits trigger a full reload (and re-run preload).
if (module.hot) module.hot.decline();
