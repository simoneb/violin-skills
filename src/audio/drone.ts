import type { BiquadFilterNode, GainNode, OscillatorNode } from 'react-native-audio-api';

import { midiToFrequency } from '@/music/notes';
import { ensureSessionActive, getAudioContext, getSourceBus } from './engine';
import { pitchTracker } from './pitch/tracker';

const FADE_SECONDS = 0.4;
/**
 * The fifth is tuned pure (3:2) rather than equal-tempered. An equal-tempered
 * fifth sits 2 cents below the root's own third harmonic, and the two beat
 * against each other at ~0.003·f0 — a slow wobble that gets faster the higher
 * the drone is set. A pure fifth shares the root's period, so the mixture is
 * perfectly steady, which is also what a reference drone should sound like.
 */
const FIFTH_RATIO = 3 / 2;
/** Gain of the optional fifth relative to the root. */
const FIFTH_LEVEL = 0.45;

/**
 * Harmonic amplitudes for the drone voice — a softened sawtooth. Strong
 * fundamental so intonation against it is unambiguous, enough upper partials
 * to give a string/organ character instead of a fatiguing pure sine.
 */
const PARTIALS = [1, 0.45, 0.3, 0.22, 0.12, 0.07, 0.04, 0.02];

interface Voice {
  osc: OscillatorNode;
  gain: GainNode;
}

/**
 * Sustained reference-pitch generator. One voice for the root, an optional
 * voice a pure fifth above, both through a gentle low-pass. Runs entirely in
 * the native audio graph, so it keeps sounding with the app backgrounded.
 */
class DroneEngine {
  private root: Voice | null = null;
  private fifth: Voice | null = null;
  private bus: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;

  private currentMidi: number | null = null;
  private currentA4 = 440;
  /** Guards the await below against a double tap building two voice chains. */
  private starting = false;

  get isPlaying(): boolean {
    return this.root !== null;
  }

  async start(midi: number, a4: number, withFifth: boolean) {
    if (this.starting) {
      return;
    }
    this.starting = true;
    const ctx = getAudioContext();
    try {
      await ensureSessionActive();
    } finally {
      this.starting = false;
    }

    if (this.root) {
      // Already sounding: retune / toggle fifth smoothly instead of restarting.
      this.setNote(midi, a4);
      this.setFifth(withFifth, a4);
      return;
    }

    const now = ctx.currentTime;

    // bus (fade in/out) -> filter -> drone volume
    this.bus = ctx.createGain();
    this.bus.gain.setValueAtTime(0, now);

    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 2200;
    this.filter.Q.value = 0.7;

    this.bus.connect(this.filter);
    this.filter.connect(getSourceBus('drone'));

    this.currentMidi = midi;
    this.currentA4 = a4;

    this.root = this.createVoice(midiToFrequency(midi, a4), 1);
    if (withFifth) {
      this.fifth = this.createVoice(this.fifthFrequency(), FIFTH_LEVEL);
    }

    this.bus.gain.setTargetAtTime(this.busLevel(), now, FADE_SECONDS / 3);
    this.publishEmitted();
  }

  stop() {
    const ctx = getAudioContext();
    if (!this.bus) {
      return;
    }
    const now = ctx.currentTime;
    const bus = this.bus;
    const voices = [this.root, this.fifth].filter((v): v is Voice => v !== null);

    // Snappy but click-free stop: ~0.2s perceived fade.
    bus.gain.cancelScheduledValues(now);
    bus.gain.setTargetAtTime(0, now, 0.06);
    const stopAt = now + 0.35;
    for (const voice of voices) {
      voice.osc.stop(stopAt);
    }

    this.root = null;
    this.fifth = null;
    this.bus = null;
    this.filter = null;
    this.currentMidi = null;
    this.publishEmitted();
  }

  /** Retune while playing (also called when the A4 calibration changes). */
  setNote(midi: number, a4: number) {
    const ctx = getAudioContext();
    this.currentMidi = midi;
    this.currentA4 = a4;
    if (this.root) {
      this.root.osc.frequency.setTargetAtTime(midiToFrequency(midi, a4), ctx.currentTime, 0.05);
    }
    if (this.fifth) {
      this.fifth.osc.frequency.setTargetAtTime(this.fifthFrequency(), ctx.currentTime, 0.05);
    }
    this.publishEmitted();
  }

  setFifth(enabled: boolean, a4: number) {
    const ctx = getAudioContext();
    this.currentA4 = a4;
    if (!this.root || this.currentMidi === null) {
      return;
    }
    if (enabled && !this.fifth) {
      this.fifth = this.createVoice(this.fifthFrequency(), 0);
      this.fifth.gain.gain.setTargetAtTime(FIFTH_LEVEL, ctx.currentTime, FADE_SECONDS / 3);
    } else if (!enabled && this.fifth) {
      const fifth = this.fifth;
      fifth.gain.gain.setTargetAtTime(0, ctx.currentTime, FADE_SECONDS / 3);
      fifth.osc.stop(ctx.currentTime + FADE_SECONDS * 2);
      this.fifth = null;
    }
    this.bus?.gain.setTargetAtTime(this.busLevel(), ctx.currentTime, FADE_SECONDS / 3);
    this.publishEmitted();
  }

  /**
   * Headroom for the voices currently sounding. Each one peaks at its own gain
   * (createPeriodicWave normalizes the waveform to 1.0), so root + fifth would
   * peak at 1.45 and clip once the volume slider passes ~two thirds — and a
   * clipped mixture is exactly where a "vibrating" edge would come back.
   */
  private busLevel(): number {
    return this.fifth ? 1 / (1 + FIFTH_LEVEL) : 1;
  }

  private fifthFrequency(): number {
    return midiToFrequency(this.currentMidi!, this.currentA4) * FIFTH_RATIO;
  }

  /**
   * Tell the pitch tracker which pitches this device is emitting, so speaker
   * bleed isn't mistaken for the player. With the fifth sounding, the mixture
   * can also read as the combined period an octave below the root.
   */
  private publishEmitted() {
    if (this.currentMidi === null) {
      pitchTracker.setSuppressedPitches([]);
      return;
    }
    const rootHz = midiToFrequency(this.currentMidi, this.currentA4);
    const freqs = [rootHz];
    if (this.fifth) {
      freqs.push(rootHz * FIFTH_RATIO, rootHz / 2);
    }
    pitchTracker.setSuppressedPitches(freqs);
  }

  private createVoice(frequency: number, level: number): Voice {
    const ctx = getAudioContext();
    const real = new Float32Array(PARTIALS.length + 1);
    const imag = new Float32Array(PARTIALS.length + 1);
    for (let i = 0; i < PARTIALS.length; i++) {
      imag[i + 1] = PARTIALS[i];
    }
    const wave = ctx.createPeriodicWave(real, imag);

    const osc = ctx.createOscillator();
    osc.setPeriodicWave(wave);
    osc.frequency.value = frequency;

    const gain = ctx.createGain();
    gain.gain.value = level;

    osc.connect(gain);
    gain.connect(this.bus!);
    osc.start(ctx.currentTime);
    return { osc, gain };
  }
}

export const drone = new DroneEngine();
