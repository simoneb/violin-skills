import type { GainNode, OscillatorNode } from 'react-native-audio-api';

import { ensureSessionActive, getAudioContext, getMasterGain } from './engine';

/**
 * Lookahead scheduler ("A Tale of Two Clocks" pattern): a JS interval wakes up
 * regularly and schedules every click that falls inside the lookahead window
 * on the audio clock, so playback stays sample-accurate even when the JS
 * thread jitters. The window is generous to survive OS timer throttling with
 * the screen off.
 */
const LOOKAHEAD_SECONDS = 0.5;
const SCHEDULER_INTERVAL_MS = 120;
const CLICK_DURATION = 0.05;

export type Subdivision = 1 | 2 | 3 | 4;

export interface MetronomeConfig {
  bpm: number;
  /** Beats per bar (time-signature numerator); 1 = no accent pattern. */
  beatsPerBar: number;
  subdivision: Subdivision;
}

export type BeatCallback = (beatInBar: number) => void;

interface Click {
  /** Accented downbeat / regular beat / subdivision tick. */
  kind: 'accent' | 'beat' | 'sub';
  frequency: number;
  level: number;
}

const CLICKS: Record<Click['kind'], Click> = {
  accent: { kind: 'accent', frequency: 1568, level: 1 },
  beat: { kind: 'beat', frequency: 1046.5, level: 0.75 },
  sub: { kind: 'sub', frequency: 784, level: 0.4 },
};

class MetronomeEngine {
  private config: MetronomeConfig = { bpm: 80, beatsPerBar: 4, subdivision: 1 };
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextTickTime = 0;
  /** Index of the next subdivision tick since start; beat = tick / subdivision. */
  private tickIndex = 0;
  private onBeat: BeatCallback | null = null;
  private bus: GainNode | null = null;

  get isRunning(): boolean {
    return this.timer !== null;
  }

  setConfig(config: MetronomeConfig) {
    this.config = config;
  }

  async start(config: MetronomeConfig, onBeat?: BeatCallback) {
    if (this.timer) {
      return;
    }
    this.config = config;
    this.onBeat = onBeat ?? null;

    const ctx = getAudioContext();
    await ensureSessionActive();

    if (!this.bus) {
      this.bus = ctx.createGain();
      this.bus.connect(getMasterGain());
    }

    this.tickIndex = 0;
    this.nextTickTime = ctx.currentTime + 0.1;
    this.schedule();
    this.timer = setInterval(() => this.schedule(), SCHEDULER_INTERVAL_MS);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.onBeat = null;
  }

  private schedule() {
    const ctx = getAudioContext();
    const { bpm, beatsPerBar, subdivision } = this.config;
    const tickInterval = 60 / bpm / subdivision;

    while (this.nextTickTime < ctx.currentTime + LOOKAHEAD_SECONDS) {
      const isBeat = this.tickIndex % subdivision === 0;
      const beatIndex = Math.floor(this.tickIndex / subdivision);
      const beatInBar = beatIndex % beatsPerBar;

      const click = !isBeat
        ? CLICKS.sub
        : beatInBar === 0 && beatsPerBar > 1
          ? CLICKS.accent
          : CLICKS.beat;

      this.playClick(click, this.nextTickTime);

      if (isBeat && this.onBeat) {
        const cb = this.onBeat;
        const delayMs = Math.max(0, (this.nextTickTime - ctx.currentTime) * 1000);
        setTimeout(() => cb(beatInBar), delayMs);
      }

      this.nextTickTime += tickInterval;
      this.tickIndex += 1;
    }
  }

  private playClick(click: Click, time: number) {
    const ctx = getAudioContext();
    const osc: OscillatorNode = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = click.frequency;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(click.level, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + CLICK_DURATION);

    osc.connect(gain);
    gain.connect(this.bus!);
    osc.start(time);
    osc.stop(time + CLICK_DURATION + 0.01);
  }
}

export const metronome = new MetronomeEngine();
