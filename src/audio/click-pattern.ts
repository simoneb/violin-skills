/**
 * Offline rendering of one bar of metronome clicks. Pure sample math, no audio
 * graph — the metronome plays the result as a looping buffer (see metronome.ts).
 */

export type Subdivision = 1 | 2 | 3 | 4;

export interface MetronomeConfig {
  bpm: number;
  /** Beats per bar (time-signature numerator); 1 = no accent pattern. */
  beatsPerBar: number;
  subdivision: Subdivision;
}

const CLICK_DURATION = 0.05;
/** Envelope value reached at the end of CLICK_DURATION. */
const CLICK_DECAY_FLOOR = 0.001;

interface Click {
  frequency: number;
  level: number;
}

/**
 * Accented downbeat / regular beat / subdivision tick. Levels leave a little
 * headroom, since at fast subdivided tempos one click's tail overlaps the next.
 */
const CLICKS: Record<'accent' | 'beat' | 'sub', Click> = {
  accent: { frequency: 1568, level: 0.92 },
  beat: { frequency: 1046.5, level: 0.7 },
  sub: { frequency: 784, level: 0.37 },
};

export function ticksPerBar({ beatsPerBar, subdivision }: MetronomeConfig): number {
  return beatsPerBar * subdivision;
}

/**
 * A short percussive click: the odd harmonics of a square wave up to Nyquist
 * (band-limited, so rendering it offline doesn't alias) under an exponential
 * decay. Summed into `out`, wrapping past the end of the bar so a tail that
 * crosses the loop point continues at the top of the next one.
 */
function renderClick(out: Float32Array, startFrame: number, click: Click, sampleRate: number) {
  const frames = Math.round(CLICK_DURATION * sampleRate);
  const harmonics: number[] = [];
  for (let k = 1; k * click.frequency < sampleRate * 0.475; k += 2) {
    harmonics.push(k);
  }
  const decay = Math.log(CLICK_DECAY_FLOOR) / CLICK_DURATION;

  const shape = new Float32Array(frames);
  let peak = 0;
  for (let i = 0; i < frames; i++) {
    const t = i / sampleRate;
    let sample = 0;
    for (const k of harmonics) {
      sample += Math.sin(2 * Math.PI * k * click.frequency * t) / k;
    }
    shape[i] = sample;
    peak = Math.max(peak, Math.abs(sample));
  }

  // Scale so the click peaks exactly at its level, then apply the decay.
  const scale = peak > 0 ? click.level / peak : 0;
  for (let i = 0; i < frames; i++) {
    out[(startFrame + i) % out.length] += shape[i] * scale * Math.exp((decay * i) / sampleRate);
  }
}

/** One bar of the click pattern, ready to be looped seamlessly. */
export function renderBarSamples(
  config: MetronomeConfig,
  sampleRate: number,
): Float32Array<ArrayBuffer> {
  const { bpm, beatsPerBar, subdivision } = config;
  const tickDuration = 60 / bpm / subdivision;
  const ticks = ticksPerBar(config);
  const data = new Float32Array(Math.round(tickDuration * ticks * sampleRate));

  for (let tick = 0; tick < ticks; tick++) {
    const isBeat = tick % subdivision === 0;
    const beatInBar = tick / subdivision;
    const click = !isBeat
      ? CLICKS.sub
      : beatInBar === 0 && beatsPerBar > 1
        ? CLICKS.accent
        : CLICKS.beat;
    renderClick(data, Math.round(tick * tickDuration * sampleRate), click, sampleRate);
  }

  return data;
}
