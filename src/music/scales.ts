import { midiToNoteName, pitchClass } from './notes';

export type ScaleType =
  | 'major'
  | 'naturalMinor'
  | 'harmonicMinor'
  | 'melodicMinor'
  | 'majorArpeggio'
  | 'minorArpeggio';

export const SCALE_LABELS: Record<ScaleType, string> = {
  major: 'Major',
  naturalMinor: 'Natural minor',
  harmonicMinor: 'Harmonic minor',
  melodicMinor: 'Melodic minor',
  majorArpeggio: 'Major arpeggio',
  minorArpeggio: 'Minor arpeggio',
};

/** Ascending semitone offsets from the tonic, one octave (tonic included, octave excluded). */
const SCALE_INTERVALS: Record<ScaleType, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  naturalMinor: [0, 2, 3, 5, 7, 8, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
  melodicMinor: [0, 2, 3, 5, 7, 9, 11], // ascending form; descent uses natural minor
  majorArpeggio: [0, 4, 7],
  minorArpeggio: [0, 3, 7],
};

/** Keys where the flat spelling is conventional (pitch class of the tonic). */
const FLAT_MAJOR_TONICS = new Set([5, 10, 3, 8, 1]); // F, B♭, E♭, A♭, D♭
const FLAT_MINOR_TONICS = new Set([2, 7, 0, 5, 10]); // d, g, c, f, b♭

export function usesFlats(tonicPitchClass: number, type: ScaleType): boolean {
  const minorish =
    type === 'naturalMinor' || type === 'harmonicMinor' ||
    type === 'melodicMinor' || type === 'minorArpeggio';
  return minorish
    ? FLAT_MINOR_TONICS.has(tonicPitchClass)
    : FLAT_MAJOR_TONICS.has(tonicPitchClass);
}

export interface ScaleNote {
  midi: number;
  /** 1-based scale degree (1 = tonic). */
  degree: number;
  name: string;
}

/**
 * Generate an ascending scale starting at `tonicMidi`, spanning `octaves`
 * octaves plus the final tonic.
 */
export function buildScale(
  tonicMidi: number,
  type: ScaleType,
  octaves: 1 | 2 | 3 = 2,
): ScaleNote[] {
  const intervals = SCALE_INTERVALS[type];
  const flats = usesFlats(pitchClass(tonicMidi), type);
  const notes: ScaleNote[] = [];
  for (let oct = 0; oct < octaves; oct++) {
    for (let i = 0; i < intervals.length; i++) {
      const midi = tonicMidi + oct * 12 + intervals[i];
      notes.push({ midi, degree: i + 1, name: midiToNoteName(midi, flats) });
    }
  }
  const top = tonicMidi + octaves * 12;
  notes.push({ midi: top, degree: 1, name: midiToNoteName(top, flats) });
  return notes;
}

/** Descending melodic minor differs from its ascending form. */
export function buildDescent(
  tonicMidi: number,
  type: ScaleType,
  octaves: 1 | 2 | 3 = 2,
): ScaleNote[] {
  const effective: ScaleType = type === 'melodicMinor' ? 'naturalMinor' : type;
  return buildScale(tonicMidi, effective, octaves).slice().reverse();
}

/** Which pitch classes belong to the scale — used for live "am I on a scale note?" feedback. */
export function scalePitchClasses(tonicPitchClass: number, type: ScaleType): Set<number> {
  const set = new Set<number>();
  for (const interval of SCALE_INTERVALS[type]) {
    set.add((tonicPitchClass + interval) % 12);
  }
  if (type === 'melodicMinor') {
    // accept the descending (natural minor) degrees too
    for (const interval of SCALE_INTERVALS.naturalMinor) {
      set.add((tonicPitchClass + interval) % 12);
    }
  }
  return set;
}
