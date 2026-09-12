import shipShoot from "../sounds/shoot.wav";
import shipExplosion from "../sounds/explosion.wav";
import asteroidBreakS from "../sounds/bang_05.ogg";
import asteroidBreakM from "../sounds/bang_08.ogg";
import asteroidBreakL from "../sounds/bang_03.ogg";
import { createSynthCues } from "./cues";

export default class SoundManager {
  constructor(p5) {
    this.p5 = p5;
    this.sounds = {};
    this.reverb = new p5.constructor.Reverb();
  }

  // Every cue the game plays is registered here. Sampled cues load from a file, the three the
  // repository has no file for are synthesized, and both kinds answer play() and stop(), so
  // nothing below this line distinguishes them.
  preload() {
    this.sounds["shoot"] = this.p5.loadSound(shipShoot);
    this.sounds["shipExplosion"] = this.p5.loadSound(shipExplosion);
    this.sounds.asteroidBreakS = this.p5.loadSound(asteroidBreakS);
    this.sounds.asteroidBreakM = this.p5.loadSound(asteroidBreakM);
    this.sounds.asteroidBreakL = this.p5.loadSound(asteroidBreakL);

    Object.assign(this.sounds, createSynthCues(this.p5, { reverb: this.reverb }));
  }

  // The synthesized cues route themselves as they build, so this stays the sampled cues only.
  addReverb() {
    this.reverb.process(this.sounds["shipExplosion"], 2, 2);
    this.reverb.process(this.sounds["asteroidBreakS"], 2, 2);
    this.reverb.process(this.sounds["asteroidBreakM"], 2, 2);
    this.reverb.process(this.sounds["asteroidBreakL"], 2, 2);
  }

  play(sound) {
    this.sounds[sound]?.play();
  }

  stop(sound) {
    this.sounds[sound]?.stop();
  }
}
