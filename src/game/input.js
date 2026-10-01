const KEY_MAP = {
  thrust: [87, 38],
  brake: [83, 40],
  rotateLeft: [65, 37],
  rotateRight: [68, 39],
  shoot: [32, 13],
  confirm: [32, 13],
  volumeDown: [65, 37],
  volumeUp: [68, 39],
  pause: [27, 80],
};

const ACTIONS_BY_KEY = {};
for (const [action, codes] of Object.entries(KEY_MAP)) {
  for (const code of codes) {
    (ACTIONS_BY_KEY[code] ??= []).push(action);
  }
}

export default class Input {
  constructor(p5) {
    this.p5 = p5;
    // keyCode -> Set<action>. A single physical press queues all bound actions
    // under one key entry; consuming any action clears the whole entry, so one
    // press can never satisfy two actions (e.g. confirm + shoot on Space).
    this._pending = new Map();

    p5.keyPressed = () => {
      const actions = ACTIONS_BY_KEY[p5.keyCode];
      if (actions) this._pending.set(p5.keyCode, new Set(actions));
    };
  }

  isHeld(action) {
    const codes = KEY_MAP[action];
    return codes ? codes.some((c) => this.p5.keyIsDown(c)) : false;
  }

  // Drops every press nobody read. A screen calls this as it takes over, so a press made on the
  // last one, a D held to steer, say, cannot land as a volume change on this one.
  flush() {
    this._pending.clear();
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
