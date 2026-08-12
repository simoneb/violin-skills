import { renderBarSamples, ticksPerBar, type MetronomeConfig } from '../click-pattern';

const SR = 48000;

function peakNear(data: Float32Array, frame: number, window = 0.02 * SR): number {
  let peak = 0;
  for (let i = frame; i < Math.min(data.length, frame + window); i++) {
    peak = Math.max(peak, Math.abs(data[i]));
  }
  return peak;
}

function peakOf(data: Float32Array): number {
  let peak = 0;
  for (const sample of data) {
    peak = Math.max(peak, Math.abs(sample));
  }
  return peak;
}

describe('renderBarSamples', () => {
  it('renders exactly one bar', () => {
    const bar = renderBarSamples({ bpm: 80, beatsPerBar: 4, subdivision: 1 }, SR);
    // 4 beats at 80 BPM = 3 s
    expect(bar.length).toBe(3 * SR);
  });

  it('puts a click on every tick and silence between them', () => {
    const config: MetronomeConfig = { bpm: 120, beatsPerBar: 4, subdivision: 2 };
    const bar = renderBarSamples(config, SR);
    const tickFrames = bar.length / ticksPerBar(config);

    for (let tick = 0; tick < ticksPerBar(config); tick++) {
      const onset = Math.round(tick * tickFrames);
      expect(peakNear(bar, onset)).toBeGreaterThan(0.2);
      // Just before the next tick the previous click has decayed away.
      expect(peakNear(bar, onset + Math.round(tickFrames) - 200, 150)).toBeLessThan(0.01);
    }
  });

  it('accents the downbeat and keeps subdivisions quieter than beats', () => {
    const config: MetronomeConfig = { bpm: 60, beatsPerBar: 4, subdivision: 2 };
    const bar = renderBarSamples(config, SR);
    const tickFrames = bar.length / ticksPerBar(config);

    const downbeat = peakNear(bar, 0);
    const beat = peakNear(bar, Math.round(2 * tickFrames));
    const sub = peakNear(bar, Math.round(tickFrames));

    expect(downbeat).toBeGreaterThan(beat);
    expect(beat).toBeGreaterThan(sub);
  });

  it('gives every beat the same weight when there is no bar accent', () => {
    const config: MetronomeConfig = { bpm: 60, beatsPerBar: 1, subdivision: 1 };
    const bar = renderBarSamples(config, SR);
    expect(bar.length).toBe(SR);
    expect(peakNear(bar, 0)).toBeCloseTo(0.7, 1);
  });

  it('stays inside the unit range at every tempo and subdivision', () => {
    for (const bpm of [30, 80, 240]) {
      for (const subdivision of [1, 2, 3, 4] as const) {
        for (const beatsPerBar of [1, 2, 3, 4, 6]) {
          const bar = renderBarSamples({ bpm, beatsPerBar, subdivision }, SR);
          expect(peakOf(bar)).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('builds the click from odd harmonics of its own pitch', () => {
    // The click is a band-limited square: the fundamental dominates, even
    // harmonics are absent. A naively rendered square would instead fold its
    // above-Nyquist harmonics back into the spectrum as inharmonic junk.
    const bar = renderBarSamples({ bpm: 60, beatsPerBar: 1, subdivision: 1 }, SR);
    const frames = Math.round(0.05 * SR);
    const fundamental = goertzel(bar, frames, 1046.5, SR);

    expect(goertzel(bar, frames, 1046.5 * 3, SR)).toBeGreaterThan(fundamental * 0.1);
    for (const even of [2, 4, 6]) {
      expect(goertzel(bar, frames, 1046.5 * even, SR)).toBeLessThan(fundamental * 0.1);
    }
  });
});

/** Magnitude of one frequency bin, DFT-style. */
function goertzel(data: Float32Array, frames: number, frequency: number, sampleRate: number): number {
  let real = 0;
  let imag = 0;
  for (let i = 0; i < frames; i++) {
    const phase = (2 * Math.PI * frequency * i) / sampleRate;
    real += data[i] * Math.cos(phase);
    imag += data[i] * Math.sin(phase);
  }
  return Math.hypot(real, imag) / frames;
}
