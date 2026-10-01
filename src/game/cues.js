// Cues the game plays that have no audio file behind them. Each one owns its p5.sound graph and
// answers the play({ rate, level }) and stop() a sampled cue does, so SoundManager keys them in
// the same map and neither of its methods learns which kind of cue it is holding. `rate` scales
// every frequency the cue plays and `level` is a fraction of its own amplitude.
//
// Nothing builds or starts a source until the first play(). A browser holds the audio context
// suspended until a user gesture, and a source started before then stays silent for the life of
// the page. Constructing a cue therefore touches no audio node at all, which is also what lets
// the preload list every key before any sound has been asked for.

// Three square-wave notes, a C major triad walked upwards.
const LEVEL_UP_NOTES = [523.25, 659.25, 783.99];
const LEVEL_UP_NOTE_SPACING = 0.09;
const LEVEL_UP_PEAK = 0.4;

const GAME_OVER_FROM = 330;
const GAME_OVER_TO = 55;
const GAME_OVER_SWEEP = 0.9;
const GAME_OVER_HOLD = 0.55;
const GAME_OVER_RELEASE = 0.35;
const GAME_OVER_PEAK = 0.5;

const THRUST_CUTOFF = 620;
const THRUST_RESONANCE = 4;
const THRUST_LEVEL = 0.35;
const THRUST_FADE_IN = 0.08;

// p5's process() only adds a connection: the source keeps its own route to the master output and
// is heard alongside the processed copy. A filter has to replace that route, so the raw signal is
// disconnected first. Reverb is the opposite and keeps it, which is what SoundManager.addReverb
// already does to the sampled cues: the dry signal carries the cue and the wet copy is the tail.
// Routing a cue wet-only leaves it about five times quieter than the samples it plays beside.
//
// The reverb is joined with no arguments on purpose. Passing a length rebuilds its impulse
// buffer, and since a cue joins on its first play that rebuild would land mid-game. addReverb
// has already built it by then.
function filterThrough(source, filter, freq, res) {
  source.disconnect();
  filter.process(source, freq, res);
}

class SynthCue {
  constructor(p5, { reverb } = {}) {
    this.p5 = p5;
    this.reverb = reverb;
    this.graph = null;
  }

  // p5.sound hangs its classes off the p5 constructor, the same place SoundManager reaches for
  // Reverb. In instance mode they are not on the instance.
  get sound() {
    return this.p5.constructor;
  }

  now() {
    return this.p5.getAudioContext().currentTime;
  }

  build() {
    if (!this.graph) this.graph = this.createGraph();
    return this.graph;
  }
}

// One oscillator retriggered per note. p5's Oscillator.start() tears down its node and builds a
// fresh one, stopping itself first if it was already running, so a second play lands as a restart
// rather than a second voice layered over the first.
class OneShotCue extends SynthCue {
  constructor(p5, options) {
    super(p5, options);
    this.endsAt = 0;
  }

  isPlaying() {
    return this.endsAt > this.now();
  }

  stop() {
    if (!this.graph) return;
    this.graph.osc.stop();
    this.endsAt = 0;
  }
}

class LevelUpCue extends OneShotCue {
  createGraph() {
    const osc = new this.sound.Oscillator(LEVEL_UP_NOTES[0], "square");
    const env = new this.sound.Envelope();
    env.setADSR(0.005, 0.07, 0, 0.02);

    osc.amp(0);
    if (this.reverb) this.reverb.process(osc);

    return { osc, env };
  }

  play({ rate = 1, level = 1 } = {}) {
    const { osc, env } = this.build();
    env.setRange(LEVEL_UP_PEAK * level, 0);

    osc.start();
    LEVEL_UP_NOTES.forEach((note, i) => {
      const at = i * LEVEL_UP_NOTE_SPACING;
      osc.freq(note * rate, 0, at);
      env.play(osc, at, 0);
    });

    this.endsAt = this.now() + LEVEL_UP_NOTES.length * LEVEL_UP_NOTE_SPACING + 0.1;
  }
}

class GameOverCue extends OneShotCue {
  createGraph() {
    const osc = new this.sound.Oscillator(GAME_OVER_FROM, "sawtooth");
    const env = new this.sound.Envelope();
    env.setADSR(0.01, 0.2, 0.6, GAME_OVER_RELEASE);

    osc.amp(0);
    if (this.reverb) this.reverb.process(osc);

    return { osc, env };
  }

  play({ rate = 1, level = 1 } = {}) {
    const { osc, env } = this.build();
    env.setRange(GAME_OVER_PEAK * level, 0);

    osc.start();
    osc.freq(GAME_OVER_FROM * rate);
    osc.freq(GAME_OVER_TO * rate, GAME_OVER_SWEEP);

    // Not Envelope.play: it truncates its sustain argument with ~~, so any hold under a second
    // becomes zero and the release cuts the sweep off a quarter of the way down.
    env.triggerAttack(osc);
    env.triggerRelease(osc, GAME_OVER_HOLD);

    this.endsAt = this.now() + GAME_OVER_HOLD + GAME_OVER_RELEASE;
  }
}

// Held for as long as thrust is held, so this is the one cue whose playing state is a fact about
// the source rather than a countdown. It carries no reverb: a tail on a loop smears into itself.
// Noise has no pitch, so the rate moves the filter cutoff instead, once per start.
class ThrustCue extends SynthCue {
  constructor(p5, options) {
    super(p5, options);
    this.playing = false;
  }

  createGraph() {
    const noise = new this.sound.Noise("brown");
    const filter = new this.sound.LowPass();
    filterThrough(noise, filter, THRUST_CUTOFF, THRUST_RESONANCE);
    noise.amp(0);

    return { noise, filter };
  }

  isPlaying() {
    return this.playing;
  }

  play({ rate = 1, level = 1 } = {}) {
    if (this.playing) return;
    const { noise, filter } = this.build();
    filter.freq(THRUST_CUTOFF * rate);

    noise.amp(0);
    noise.start();
    noise.amp(THRUST_LEVEL * level, THRUST_FADE_IN);
    this.playing = true;
  }

  stop() {
    if (!this.playing) return;
    this.graph.noise.amp(0);
    this.graph.noise.stop();
    this.playing = false;
  }
}

export function createSynthCues(p5, { reverb } = {}) {
  return {
    levelUp: new LevelUpCue(p5, { reverb }),
    gameOver: new GameOverCue(p5, { reverb }),
    shipThrust: new ThrustCue(p5),
  };
}
