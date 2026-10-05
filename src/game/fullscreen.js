// Fullscreen, and the pointer lock fullscreen play runs under. The corner button is the one DOM
// control on the page. It stops its own mouse events so p5, which listens on the window, never
// reads a press of it as a click on the game.
//
// A browser grants fullscreen and pointer lock only within a few seconds of a real key press or
// click. Every request here follows one: the F press, the button, or the confirm that starts or
// resumes play, read on the very next frame.

// Chrome refuses a lock for about a second after the player leaves one, and any lock asked for
// without a recent key press or click. Waiting this many frames covers the first and lets the
// next click in play cover the second.
const RETRY_FRAMES = 60;

const ICON = `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
  <path d="M1 5V1h4M11 1h4v4M15 11v4h-4M5 15H1v-4" fill="none" stroke="currentColor" stroke-width="1.5"/>
</svg>`;

export default class Fullscreen {
  // `onLost` runs when fullscreen ends, and when a lock play still wanted ends.
  constructor(p5, input, { onLost = () => {} } = {}) {
    this.p5 = p5;
    this.input = input;
    this.onLost = onLost;
    // Whether play wants the pointer locked. The browser may refuse, so this is not the lock.
    this.wantsLock = false;
    // A request is out and not yet refused.
    this.lockAsked = false;
    this.retryIn = 0;
    this.lockRequests = 0;

    this.button = document.createElement("button");
    this.button.className = "fullscreen-toggle";
    this.button.setAttribute("aria-label", "Fullscreen");
    this.button.setAttribute("aria-pressed", "false");
    this.button.innerHTML = ICON;
    // preventDefault keeps focus off the button, or a later Space would press it.
    this.button.addEventListener("mousedown", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    this.button.addEventListener("click", (event) => {
      event.stopPropagation();
      this.toggle();
    });
    document.body.appendChild(this.button);

    document.addEventListener("fullscreenchange", () => {
      this.button.setAttribute("aria-pressed", String(this.isActive()));
      if (!this.isActive()) this.onLost();
    });
    document.addEventListener("pointerlockchange", () => {
      this.lockChanged(document.pointerLockElement === p5.canvas);
    });
    document.addEventListener("pointerlockerror", () => {
      this.lockAsked = false;
      this.retryIn = RETRY_FRAMES;
    });
  }

  isActive() {
    return Boolean(document.fullscreenElement);
  }

  toggle() {
    if (this.isActive()) {
      document.exitFullscreen().catch(() => {});
    } else {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }

  // Only a lock play still wanted counts as lost. The game releasing it on a screen does not.
  lockChanged(locked) {
    const wasLocked = this.input.isPointerLocked();
    this.input.setPointerLocked(locked);
    if (locked) return;

    this.lockAsked = false;
    if (wasLocked && this.wantsLock) this.onLost();
  }

  syncPointerLock(inPlay) {
    this.wantsLock = inPlay && this.isActive();

    if (!this.wantsLock) {
      this.lockAsked = false;
      this.retryIn = 0;
      if (document.pointerLockElement) document.exitPointerLock();
      return;
    }

    if (this.input.isPointerLocked() || this.lockAsked) return;
    if (this.retryIn > 0) {
      this.retryIn -= 1;
      return;
    }

    this.lockAsked = true;
    this.lockRequests += 1;
    // Chromium returns a promise and rejects it on a refusal, which pointerlockerror handles.
    this.p5.canvas.requestPointerLock()?.catch?.(() => {});
  }
}
