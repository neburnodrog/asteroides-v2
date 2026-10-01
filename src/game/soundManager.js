import shipShoot from "../sounds/shoot.wav";
import shipExplosion from "../sounds/explosion.wav";
import asteroidBreakS from "../sounds/bang_05.ogg";
import asteroidBreakM from "../sounds/bang_08.ogg";
import asteroidBreakL from "../sounds/bang_03.ogg";
import { createSynthCues } from "./cues";

// The variation every cue gets on each play. `rate` is the cue's base playback rate and `pitch`
// the fraction it may stray either side of it. A break keeps its size's file and the sizes sit
// far enough apart that no X break (asteroidBreakL) ever plays higher than an S break.
const VARIATION = {
  shoot: { rate: 1, pitch: 0.05 },
  shipExplosion: { rate: 1, pitch: 0.1 },
  asteroidBreakL: { rate: 0.85, pitch: 0.1 },
  asteroidBreakM: { rate: 1, pitch: 0.1 },
  asteroidBreakS: { rate: 1.15, pitch: 0.1 },
  levelUp: { rate: 1, pitch: 0.1 },
  gameOver: { rate: 1, pitch: 0.1 },
  shipThrust: { rate: 1, pitch: 0.05 },
};
// Loudness as a fraction of the cue's own base level, the same on every cue.
const LEVEL_FLOOR = 0.85;

// Both draws are in [0, 1]. 0 gives the lowest rate and the floor level, 1 the highest and full.
function variedPlay(name, pitchDraw, levelDraw) {
  const { rate, pitch } = VARIATION[name];
  return {
    rate: rate * (1 + (2 * pitchDraw - 1) * pitch),
    level: LEVEL_FLOOR + levelDraw * (1 - LEVEL_FLOOR),
  };
}

export function variationRange(name) {
  const low = variedPlay(name, 0, 0);
  const high = variedPlay(name, 1, 1);
  return {
    minRate: low.rate,
    maxRate: high.rate,
    minLevel: low.level,
    maxLevel: high.level,
  };
}

// A loaded file behind the same play({ rate, level }) the synthesized cues answer.
class SampledCue {
  constructor(file) {
    this.file = file;
  }

  // SoundFile.play's rate and amp arguments set state the file shares across every source it
  // has started: the last source's playbackRate and the file's one output gain. Either would
  // retune or re-level a shot still sounding from the last play. A new source reads
  // playbackRate when it is built, so the field sets this play's pitch alone, and a gain of its
  // own between the source and the file's output sets this play's level alone.
  play({ rate, level }) {
    this.file.playbackRate = rate;
    this.file.play();

    const source = this.file.bufferSourceNode;
    const gain = source.context.createGain();
    gain.gain.value = level;
    source.disconnect();
    source.connect(gain);
    gain.connect(this.file.output);
  }

  stop() {
    this.file.stop();
  }

  isPlaying() {
    return this.file.isPlaying();
  }
}

export default class SoundManager {
  constructor(p5) {
    this.p5 = p5;
    this.sounds = {};
    this.reverb = new p5.constructor.Reverb();
    // Replaceable so the harness can make the variation deterministic.
    this.random = Math.random;
    // What each cue was last handed and how often, which is the only account of a play a
    // headless browser can give, since it never resumes the audio context.
    this.lastPlay = {};
    this.playCount = {};
    this.outputLevel = 1;
  }

  // Every cue the game plays is registered here. Sampled cues load from a file, the three the
  // repository has no file for are synthesized, and both kinds answer play() and stop(), so
  // nothing below this line distinguishes them.
  preload() {
    const load = (file) => new SampledCue(this.p5.loadSound(file));

    this.sounds.shoot = load(shipShoot);
    this.sounds.shipExplosion = load(shipExplosion);
    this.sounds.asteroidBreakS = load(asteroidBreakS);
    this.sounds.asteroidBreakM = load(asteroidBreakM);
    this.sounds.asteroidBreakL = load(asteroidBreakL);

    Object.assign(this.sounds, createSynthCues(this.p5, { reverb: this.reverb }));
  }

  // The synthesized cues route themselves as they build, so this stays the sampled cues only.
  addReverb() {
    this.reverb.process(this.sounds.shipExplosion.file, 2, 2);
    this.reverb.process(this.sounds.asteroidBreakS.file, 2, 2);
    this.reverb.process(this.sounds.asteroidBreakM.file, 2, 2);
    this.reverb.process(this.sounds.asteroidBreakL.file, 2, 2);
  }

  play(name) {
    this.start(name, variedPlay(name, this.random(), this.random()));
  }

  // At the cue's base rate and full level, so two previews in a row sound alike and the only
  // difference the player hears is the volume.
  preview(name) {
    this.start(name, { rate: VARIATION[name].rate, level: 1 });
  }

  start(name, params) {
    const cue = this.sounds[name];
    if (!cue) return;

    cue.play(params);
    this.lastPlay[name] = params;
    this.playCount[name] = (this.playCount[name] ?? 0) + 1;
  }

  // p5.sound's one output gain, which every cue reaches the speakers through.
  setOutputLevel(level) {
    this.outputLevel = level;
    this.p5.outputVolume(level);
  }

  stop(name) {
    this.sounds[name]?.stop();
  }

  stopAll() {
    Object.values(this.sounds).forEach((cue) => cue.stop());
  }
}
