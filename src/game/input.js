const KEY_MAP = {
  thrust: [87, 38],
  brake: [83, 40],
  rotateLeft: [37],
  rotateRight: [39],
  strafeLeft: [65],
  strafeRight: [68],
  shoot: [32, 13],
  confirm: [32, 13],
  volumeDown: [65, 37],
  volumeUp: [68, 39],
  pause: [27, 80],
  fullscreen: [70],
};

const ACTIONS_BY_KEY = {};
for (const [action, codes] of Object.entries(KEY_MAP)) {
  for (const code of codes) {
    (ACTIONS_BY_KEY[code] ??= []).push(action);
  }
}

// A left click is one more press of what Space does, under its own pending entry.
const CLICK = "click";

const clampToCanvas = (p5, { x, y }) => ({
  x: Math.min(Math.max(x, 0), p5.width),
  y: Math.min(Math.max(y, 0), p5.height),
});
const CLICK_ACTIONS = ["shoot", "confirm"];
const TURN_ACTIONS = ["rotateLeft", "rotateRight"];

export default class Input {
  constructor(p5, { onPointerLeave = () => {} } = {}) {
    this.p5 = p5;
    // keyCode -> Set<action>. A single physical press queues all bound actions
    // under one key entry; consuming any action clears the whole entry, so one
    // press can never satisfy two actions (e.g. confirm + shoot on Space).
    this._pending = new Map();
    // Canvas coordinates of the last pointer move, or null before the first.
    this.pointer = null;
    // Last input wins: a pointer move hands the turn to steering, a turn key takes it back.
    this._steering = false;
    // Under a pointer lock the event carries only movement, so `pointer` becomes a virtual one
    // the mouse pushes around inside the canvas.
    this._locked = false;

    p5.keyPressed = () => {
      const actions = ACTIONS_BY_KEY[p5.keyCode];
      if (!actions) return;
      this._pending.set(p5.keyCode, new Set(actions));
      if (actions.some((action) => TURN_ACTIONS.includes(action))) {
        this._steering = false;
      }
    };

    p5.mouseMoved = (event) => this._pointerMoved(event);
    p5.mouseDragged = (event) => this._pointerMoved(event);

    p5.mousePressed = (event) => {
      if (event?.button !== 0) return;
      this._pending.set(CLICK, new Set(CLICK_ACTIONS));
    };

    document.addEventListener("contextmenu", (event) => {
      if (event.target === p5.canvas) event.preventDefault();
    });
    document.documentElement.addEventListener("mouseleave", onPointerLeave);
  }

  // p5.mouseX is off by the canvas border, because p5 scales by the bounding rect, which
  // includes it. The ship aims at the pointer, so read the event against the content box.
  _pointerMoved(event) {
    const canvas = this.p5.canvas;
    if (!event || !canvas) return;

    if (this._locked) {
      this.pointer = clampToCanvas(this.p5, {
        x: this.pointer.x + event.movementX,
        y: this.pointer.y + event.movementY,
      });
      this._steering = true;
      return;
    }

    const rect = canvas.getBoundingClientRect();
    this.pointer = {
      x: event.clientX - rect.left - canvas.clientLeft,
      y: event.clientY - rect.top - canvas.clientTop,
    };
    this._steering = true;
  }

  isSteering() {
    return this._steering;
  }

  isPointerLocked() {
    return this._locked;
  }

  // The virtual pointer starts where the real one was last seen, or on the centre if it never
  // was, and the canvas may have shrunk since.
  setPointerLocked(locked) {
    this._locked = locked;
    if (!locked) return;

    const { width, height } = this.p5;
    this.pointer = clampToCanvas(this.p5, this.pointer ?? { x: width / 2, y: height / 2 });
  }

  isHeld(action) {
    const codes = KEY_MAP[action];
    return codes ? codes.some((c) => this.p5.keyIsDown(c)) : false;
  }

  // Drops every press nobody read, clicks included, and hands the turn back to the keys. Called
  // whenever a new screen takes over (a Game is built, play starts, a pause begins or ends), so
  // a press made for the last screen, a D held to strafe, say, cannot land as a volume change
  // or a shot on this one, and the ship steers only once the pointer moves during play.
  flush() {
    this._pending.clear();
    this._steering = false;
  }

  wasPressed(action) {
    for (const [code, actions] of this._pending) {
      if (actions.has(action)) {
        this._pending.delete(code);
        return true;
      }
    }
    return false;
  }
}
