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

export function variationRange(name) {
  const { rate, pitch } = VARIATION[name];
  return {
    minRate: rate * (1 - pitch),
    maxRate: rate * (1 + pitch),
    minLevel: LEVEL_FLOOR,
    maxLevel: 1,
  };
}

// A loaded file behind the same play({ rate, level }) the synthesized cues answer.
class SampledCue {
  constructor(file) {
    this.file = file;
  }

  // SoundFile.play(_, rate) retunes the source still sounding from the last play as well as the
  // new one. A new source reads playbackRate when it is built, so setting the field instead
  // leaves an overlapping shot at the pitch it started on.
  play({ rate, level }) {
    this.file.playbackRate = rate;
    this.file.play(0, undefined, level);
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

  vary(name) {
    const { rate, pitch } = VARIATION[name];
    return {
      rate: rate * (1 + (2 * this.random() - 1) * pitch),
      level: LEVEL_FLOOR + this.random() * (1 - LEVEL_FLOOR),
    };
  }

  // `vary: false` plays the cue at its base rate and full level, for a preview whose whole point
  // is that two plays in a row sound alike.
  play(name, { vary = true } = {}) {
    const cue = this.sounds[name];
    if (!cue) return;

    const params = vary
      ? this.vary(name)
      : { rate: VARIATION[name].rate, level: 1 };

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
}
