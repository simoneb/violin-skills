import { PitchDetector } from 'pitchy';
import { AudioRecorder } from 'react-native-audio-api';

/** Analysis window. 2048 @ 44.1 kHz ≈ 46 ms — spans 9 periods of the open G (196 Hz). */
const WINDOW_SIZE = 2048;
/** Preferred mic callback chunk; ~21 events per second at 44.1 kHz. */
const CHUNK_SIZE = 2048;
const PREFERRED_SAMPLE_RATE = 44100;
/**
 * MPM analysis is FFT-heavy and runs on the JS thread — unthrottled it
 * saturates the thread and the whole UI lags. ~10 readings/s is plenty
 * for a tuner needle.
 */
const ANALYSIS_INTERVAL_MS = 100;
/** Readings quieter than this (RMS dB) are treated as silence. */
const MIN_VOLUME_DB = -35;
/** MPM clarity below this is noise/transient — not a note. */
const MIN_CLARITY = 0.85;
/** Median window for spike rejection (odd). */
const MEDIAN_WINDOW = 3;
/**
 * Drone-leakage rejection: the phone speaker bleeds the drone into the mic,
 * and between violin notes the detector happily locks onto it. A reading is
 * discarded as leakage when it sits within this many cents of a pitch the app
 * itself is emitting AND the window is quieter than the gate below — a violin
 * played near the phone is far louder than speaker bleed, so real playing of
 * the drone note still gets through.
 */
const SUPPRESS_TOLERANCE_CENTS = 40;
const SUPPRESS_MIN_VOLUME_DB = -20;

export interface PitchReading {
  /** Median-filtered detected fundamental in Hz, or null for silence/noise. */
  frequency: number | null;
  /** MPM clarity 0..1 of the latest analysis. */
  clarity: number;
}

export type PitchCallback = (reading: PitchReading) => void;

/**
 * Streams microphone audio into a rolling window and runs McLeod pitch
 * detection on it, throttled to ANALYSIS_INTERVAL_MS. Consumers get ~10
 * readings per second.
 */
export class PitchTracker {
  private recorder: AudioRecorder | null = null;
  private detector = PitchDetector.forFloat32Array(WINDOW_SIZE);
  private window = new Float32Array(WINDOW_SIZE);
  private filled = 0;
  private recent: number[] = [];
  private lastAnalysisAt = 0;
  private suppressedHz: number[] = [];

  constructor() {
    this.detector.minVolumeDecibels = MIN_VOLUME_DB;
  }

  get isRunning(): boolean {
    return this.recorder !== null;
  }

  /**
   * Frequencies the app is currently emitting itself (drone root/fifth).
   * Quiet readings at these pitches are rejected as speaker→mic leakage.
   */
  setSuppressedPitches(freqs: number[]) {
    this.suppressedHz = freqs;
  }

  async start(callback: PitchCallback) {
    if (this.recorder) {
      return;
    }
    this.filled = 0;
    this.recent = [];

    const recorder = new AudioRecorder();
    this.recorder = recorder;

    recorder.onAudioReady(
      { sampleRate: PREFERRED_SAMPLE_RATE, bufferLength: CHUNK_SIZE, channelCount: 1 },
      (event) => {
        const data = event.buffer.getChannelData(0);
        const sampleRate = event.buffer.sampleRate;
        this.push(data);
        if (this.filled < WINDOW_SIZE) {
          return;
        }
        const now = Date.now();
        if (now - this.lastAnalysisAt < ANALYSIS_INTERVAL_MS) {
          return;
        }
        this.lastAnalysisAt = now;
        const [pitch, clarity] = this.detector.findPitch(this.window, sampleRate);
        callback(this.analyze(pitch, clarity));
      },
    );

    await recorder.start();
  }

  async stop() {
    const recorder = this.recorder;
    this.recorder = null;
    if (recorder) {
      recorder.clearOnAudioReady();
      await recorder.stop();
    }
  }

  /** Slide new samples into the rolling window. */
  private push(data: Float32Array) {
    const win = this.window;
    if (data.length >= WINDOW_SIZE) {
      win.set(data.subarray(data.length - WINDOW_SIZE));
      this.filled = WINDOW_SIZE;
      return;
    }
    win.copyWithin(0, data.length);
    win.set(data, WINDOW_SIZE - data.length);
    this.filled = Math.min(WINDOW_SIZE, this.filled + data.length);
  }

  private analyze(pitch: number, clarity: number): PitchReading {
    if (clarity < MIN_CLARITY || pitch <= 0 || !isFinite(pitch)) {
      this.recent = [];
      return { frequency: null, clarity };
    }
    if (this.isLeakage(pitch)) {
      this.recent = [];
      return { frequency: null, clarity };
    }
    this.recent.push(pitch);
    if (this.recent.length > MEDIAN_WINDOW) {
      this.recent.shift();
    }
    const sorted = this.recent.slice().sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    return { frequency: median, clarity };
  }

  private isLeakage(pitch: number): boolean {
    if (this.suppressedHz.length === 0) {
      return false;
    }
    const matches = this.suppressedHz.some(
      (f) => Math.abs(1200 * Math.log2(pitch / f)) < SUPPRESS_TOLERANCE_CENTS,
    );
    return matches && this.windowRmsDb() < SUPPRESS_MIN_VOLUME_DB;
  }

  private windowRmsDb(): number {
    const win = this.window;
    let sum = 0;
    for (let i = 0; i < WINDOW_SIZE; i++) {
      sum += win[i] * win[i];
    }
    const rms = Math.sqrt(sum / WINDOW_SIZE);
    return rms > 0 ? 20 * Math.log10(rms) : -Infinity;
  }
}

export const pitchTracker = new PitchTracker();
