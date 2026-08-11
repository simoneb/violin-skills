/**
 * Pure music-theory utilities. MIDI note numbers are the canonical pitch
 * representation (A4 = 69). All frequency math is parameterized by the
 * A4 calibration setting (415–466 Hz) so every tool honors it.
 */

export const NOTE_NAMES_SHARP = [
  'C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B',
] as const;

export const NOTE_NAMES_FLAT = [
  'C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B',
] as const;

export const A4_MIDI = 69;
export const DEFAULT_A4 = 440;

/** Violin open strings, low to high: G3, D4, A4, E5. */
export const OPEN_STRINGS = [
  { name: 'G', midi: 55 },
  { name: 'D', midi: 62 },
  { name: 'A', midi: 69 },
  { name: 'E', midi: 76 },
] as const;

/** Practical violin range: G3 (lowest open string) up to ~E7. */
export const VIOLIN_MIN_MIDI = 55;
export const VIOLIN_MAX_MIDI = 100;

export function midiToFrequency(midi: number, a4: number = DEFAULT_A4): number {
  return a4 * Math.pow(2, (midi - A4_MIDI) / 12);
}

/** Fractional MIDI value for a frequency (e.g. 69.5 = quarter-tone above A4). */
export function frequencyToMidi(freq: number, a4: number = DEFAULT_A4): number {
  return A4_MIDI + 12 * Math.log2(freq / a4);
}

/** Signed cents from `reference` to `freq` (+ means sharp). */
export function centsBetween(reference: number, freq: number): number {
  return 1200 * Math.log2(freq / reference);
}

export interface NoteInfo {
  /** Nearest equal-tempered MIDI note. */
  midi: number;
  /** e.g. "A", "C♯" */
  name: string;
  /** Scientific pitch octave, e.g. 4 in "A4". */
  octave: number;
  /** Deviation from that note in cents, in [-50, 50). */
  cents: number;
  /** The exact frequency that was analyzed. */
  frequency: number;
}

export function frequencyToNote(
  freq: number,
  a4: number = DEFAULT_A4,
  useFlats = false,
): NoteInfo {
  const fractionalMidi = frequencyToMidi(freq, a4);
  const midi = Math.round(fractionalMidi);
  const cents = (fractionalMidi - midi) * 100;
  return {
    midi,
    name: midiToNoteName(midi, useFlats),
    octave: midiToOctave(midi),
    cents,
    frequency: freq,
  };
}

export function midiToNoteName(midi: number, useFlats = false): string {
  const names = useFlats ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP;
  return names[((midi % 12) + 12) % 12];
}

export function midiToOctave(midi: number): number {
  return Math.floor(midi / 12) - 1;
}

/** e.g. "A4", "C♯5" */
export function midiToLabel(midi: number, useFlats = false): string {
  return `${midiToNoteName(midi, useFlats)}${midiToOctave(midi)}`;
}

/** Pitch class (0–11) for a MIDI note; 0 = C. */
export function pitchClass(midi: number): number {
  return ((midi % 12) + 12) % 12;
}
