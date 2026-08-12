import type { AudioBuffer, AudioBufferSourceNode, BaseAudioContext, GainNode } from 'react-native-audio-api';

import {
  renderBarSamples,
  ticksPerBar,
  type MetronomeConfig,
  type Subdivision,
} from './click-pattern';
import { ensureSessionActive, getAudioContext, getSourceBus } from './engine';

/**
 * The metronome renders one whole bar of clicks into an AudioBuffer and plays
 * it as a looping source, so once it is running the native audio graph sustains
 * it on its own.
 *
 * A JS lookahead scheduler ("A Tale of Two Clocks") can't be used here: React
 * Native drives setTimeout/setInterval off the host's frame callbacks, which
 * stop firing while the app is backgrounded — the clicks would simply stop a
 * fraction of a second after the app left the foreground. Nothing in this file
 * needs the JS thread while sounding; the only timers left are for coalescing
 * config changes and for the visual beat, both of which matter in the
 * foreground only.
 */

/** Schedule a bar swap at least this far ahead of the audio clock. */
const SWAP_LEAD_SECONDS = 0.08;
/** Coalesce bursts of config changes (slider drags) into a single rebuild. */
const REBUILD_DEBOUNCE_MS = 90;
/** How often the visual beat is read off the audio clock. */
const BEAT_POLL_MS = 30;
const STOP_FADE_SECONDS = 0.02;

export type { MetronomeConfig, Subdivision };

export type BeatCallback = (beatInBar: number) => void;

interface Loop {
  source: AudioBufferSourceNode;
  /** Config this loop was rendered from — may lag `this.config` briefly. */
  config: MetronomeConfig;
  /** Audio-clock time this loop takes over at; may still be in the future. */
  swapAt: number;
  /** Audio-clock time of this loop's downbeat (usually in the past). */
  barZero: number;
  /** Exact looped length, derived from the rendered frame count. */
  barDuration: number;
  ticksPerBar: number;
}

/** Wrap one rendered bar in a buffer the graph can loop. */
function createBar(
  ctx: BaseAudioContext,
  config: MetronomeConfig,
): { buffer: AudioBuffer; barDuration: number; ticksPerBar: number } {
  const data = renderBarSamples(config, ctx.sampleRate);
  const buffer = ctx.createBuffer(1, data.length, ctx.sampleRate);
  buffer.copyToChannel(data, 0);
  return {
    buffer,
    // Derived from the frame count, so the beat maths match the audio exactly.
    barDuration: data.length / ctx.sampleRate,
    ticksPerBar: ticksPerBar(config),
  };
}

class MetronomeEngine {
  private config: MetronomeConfig = { bpm: 80, beatsPerBar: 4, subdivision: 1 };
  private bus: GainNode | null = null;
  private loop: Loop | null = null;
  private rebuildTimer: ReturnType<typeof setTimeout> | null = null;
  private beatTimer: ReturnType<typeof setInterval> | null = null;
  /** Next rebuild should restart from the downbeat instead of holding position. */
  private resetPending = false;
  private lastBeat = -1;
  private onBeat: BeatCallback | null = null;
  /** Guards the await in start() against a double tap creating two loops. */
  private starting = false;

  get isRunning(): boolean {
    return this.loop !== null;
  }

  setConfig(config: MetronomeConfig) {
    const previous = this.config;
    this.config = config;
    if (!this.loop) {
      return;
    }
    if (config.beatsPerBar !== previous.beatsPerBar || config.subdivision !== previous.subdivision) {
      // A different pattern starts from its downbeat; a plain tempo change
      // keeps the current position in the bar so the pulse never stutters.
      this.resetPending = true;
    }
    if (!this.rebuildTimer) {
      this.rebuildTimer = setTimeout(() => {
        this.rebuildTimer = null;
        this.rebuild();
      }, REBUILD_DEBOUNCE_MS);
    }
  }

  async start(config: MetronomeConfig, onBeat?: BeatCallback) {
    if (this.loop || this.starting) {
      return;
    }
    this.starting = true;
    this.config = config;
    this.onBeat = onBeat ?? null;
    this.resetPending = false;
    this.lastBeat = -1;

    try {
      const ctx = getAudioContext();
      await ensureSessionActive();

      // A gain node per run: stopping fades this one out and abandons it, so a
      // bar that was still scheduled when the user hit stop can never be heard
      // again after a restart.
      this.bus = ctx.createGain();
      this.bus.connect(getSourceBus('metronome'));

      this.launch(ctx.currentTime + 0.12, 0);
      this.beatTimer = setInterval(() => this.pollBeat(), BEAT_POLL_MS);
    } finally {
      this.starting = false;
    }
  }

  stop() {
    if (this.rebuildTimer) {
      clearTimeout(this.rebuildTimer);
      this.rebuildTimer = null;
    }
    if (this.beatTimer) {
      clearInterval(this.beatTimer);
      this.beatTimer = null;
    }
    this.onBeat = null;
    if (!this.loop) {
      return;
    }
    // Short fade so stopping in the middle of a click doesn't pop.
    const now = getAudioContext().currentTime;
    const bus = this.bus;
    bus?.gain.setTargetAtTime(0, now, STOP_FADE_SECONDS / 3);
    this.loop.source.stop(now + STOP_FADE_SECONDS * 3);
    this.bus = null;
    this.loop = null;
    this.lastBeat = -1;
    // Detach once the fade has run its course, so runs don't pile up.
    setTimeout(() => bus?.disconnect(), 500);
  }

  /** (Re)start the looping bar at `when`, entering it `offset` seconds in. */
  private launch(when: number, offset: number) {
    const ctx = getAudioContext();
    const config = this.config;
    const bar = createBar(ctx, config);

    const source = ctx.createBufferSource();
    source.buffer = bar.buffer;
    source.loop = true;
    source.connect(this.bus!);
    source.start(when, offset);
    // Hand over exactly at a tick boundary, where the outgoing bar is silent.
    this.loop?.source.stop(when);

    this.loop = {
      source,
      config,
      swapAt: when,
      barZero: when - offset,
      barDuration: bar.barDuration,
      ticksPerBar: bar.ticksPerBar,
    };
  }

  /** Swap in a bar rendered from the current config at the next tick boundary. */
  private rebuild() {
    const loop = this.loop;
    if (!loop) {
      return;
    }
    const tickDuration = loop.barDuration / loop.ticksPerBar;
    // Never swap earlier than the loop being replaced takes over: at slow
    // tempos its own start can still be a tick away, and swapping before that
    // would leave two bars sounding at once.
    const from = Math.max(getAudioContext().currentTime + SWAP_LEAD_SECONDS, loop.swapAt);
    const tickIndex = Math.ceil((from - loop.barZero) / tickDuration - 1e-9);
    const when = loop.barZero + tickIndex * tickDuration;

    const holdPosition = !this.resetPending;
    this.resetPending = false;
    const nextTickDuration = 60 / this.config.bpm / this.config.subdivision;
    const offset = holdPosition ? (tickIndex % loop.ticksPerBar) * nextTickDuration : 0;

    this.launch(when, offset);
  }

  /**
   * Derive the beat for the visual pulse from the audio clock. Polling (rather
   * than a callback scheduled per beat) means the dots resync themselves the
   * moment the app comes back to the foreground and JS timers resume.
   */
  private pollBeat() {
    const loop = this.loop;
    if (!loop || !this.onBeat) {
      return;
    }
    const elapsed = getAudioContext().currentTime - loop.barZero;
    if (elapsed < 0) {
      return;
    }
    const beatDuration = loop.barDuration / loop.config.beatsPerBar;
    const beat = Math.floor((elapsed % loop.barDuration) / beatDuration);
    if (beat !== this.lastBeat) {
      this.lastBeat = beat;
      this.onBeat(beat);
    }
  }
}

export const metronome = new MetronomeEngine();
