import type { BiquadFilterNode, GainNode, OscillatorNode } from 'react-native-audio-api';

import { midiToFrequency } from '@/music/notes';
import { ensureSessionActive, getAudioContext, getMasterGain } from './engine';

const FADE_SECONDS = 0.4;
/** Gain of the optional fifth relative to the root. */
const FIFTH_LEVEL = 0.5;
/** Depth of the slow amplitude LFO (0 = static organ, 1 = full tremolo). */
const LFO_DEPTH = 0.06;
const LFO_RATE_HZ = 0.35;

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
 * voice a perfect fifth above, both through a gentle low-pass and a slow
 * amplitude LFO so long practice sessions stay pleasant.
 */
class DroneEngine {
  private root: Voice | null = null;
  private fifth: Voice | null = null;
  private bus: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private lfoOsc: OscillatorNode | null = null;
  private lfoGain: GainNode | null = null;

  private currentMidi: number | null = null;
  private fifthEnabled = false;

  get isPlaying(): boolean {
    return this.root !== null;
  }

  async start(midi: number, a4: number, withFifth: boolean) {
    const ctx = getAudioContext();
    await ensureSessionActive();

    if (this.root) {
      // Already sounding: retune / toggle fifth smoothly instead of restarting.
      this.setNote(midi, a4);
      this.setFifth(withFifth, a4);
      return;
    }

    const now = ctx.currentTime;

    // bus (fade in/out) -> filter -> master
    this.bus = ctx.createGain();
    this.bus.gain.setValueAtTime(0, now);

    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 2200;
    this.filter.Q.value = 0.7;

    this.bus.connect(this.filter);
    this.filter.connect(getMasterGain());

    // Slow "breathing" LFO modulating the bus gain around its base level.
    this.lfoOsc = ctx.createOscillator();
    this.lfoOsc.frequency.value = LFO_RATE_HZ;
    this.lfoGain = ctx.createGain();
    this.lfoGain.gain.value = LFO_DEPTH;
    this.lfoOsc.connect(this.lfoGain);
    this.lfoGain.connect(this.bus.gain);
    this.lfoOsc.start(now);

    this.currentMidi = midi;
    this.fifthEnabled = withFifth;

    this.root = this.createVoice(midiToFrequency(midi, a4), 1);
    if (withFifth) {
      this.fifth = this.createVoice(midiToFrequency(midi + 7, a4), FIFTH_LEVEL);
    }

    this.bus.gain.setTargetAtTime(1, now, FADE_SECONDS / 3);
  }

  stop() {
    const ctx = getAudioContext();
    if (!this.bus) {
      return;
    }
    const now = ctx.currentTime;
    const bus = this.bus;
    const voices = [this.root, this.fifth].filter((v): v is Voice => v !== null);

    // Kill the LFO immediately — it adds ±depth to the bus gain and would keep
    // the drone faintly warbling through the fade.
    this.lfoGain?.disconnect();
    this.lfoOsc?.stop(now);

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
    this.lfoOsc = null;
    this.lfoGain = null;
    this.currentMidi = null;
  }

  /** Retune while playing (also called when the A4 calibration changes). */
  setNote(midi: number, a4: number) {
    const ctx = getAudioContext();
    this.currentMidi = midi;
    if (this.root) {
      this.root.osc.frequency.setTargetAtTime(midiToFrequency(midi, a4), ctx.currentTime, 0.05);
    }
    if (this.fifth) {
      this.fifth.osc.frequency.setTargetAtTime(midiToFrequency(midi + 7, a4), ctx.currentTime, 0.05);
    }
  }

  setFifth(enabled: boolean, a4: number) {
    const ctx = getAudioContext();
    this.fifthEnabled = enabled;
    if (!this.root || this.currentMidi === null) {
      return;
    }
    if (enabled && !this.fifth) {
      this.fifth = this.createVoice(midiToFrequency(this.currentMidi + 7, a4), 0);
      this.fifth.gain.gain.setTargetAtTime(FIFTH_LEVEL, ctx.currentTime, FADE_SECONDS / 3);
    } else if (!enabled && this.fifth) {
      const fifth = this.fifth;
      fifth.gain.gain.setTargetAtTime(0, ctx.currentTime, FADE_SECONDS / 3);
      fifth.osc.stop(ctx.currentTime + FADE_SECONDS * 2);
      this.fifth = null;
    }
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
