/**
 * Just intonation support: when practicing against a drone, pure intervals
 * (small whole-number frequency ratios) differ from equal temperament by up
 * to ~18 cents. In "just" tuning mode the target for each note shifts by the
 * interval's deviation relative to the drone root.
 */

/** 5-limit just ratios for each semitone interval above the root. */
export const JUST_RATIOS: readonly [number, number][] = [
  [1, 1], // P1
  [16, 15], // m2
  [9, 8], // M2
  [6, 5], // m3
  [5, 4], // M3
  [4, 3], // P4
  [45, 32], // TT
  [3, 2], // P5
  [8, 5], // m6
  [5, 3], // M6
  [9, 5], // m7
  [15, 8], // M7
];

/**
 * Deviation of each just interval from its equal-tempered size, in cents.
 * Index = semitones above the root (0–11). E.g. a just major third is
 * ~13.7 cents FLATTER than the equal-tempered one.
 */
export const JUST_OFFSETS_CENTS: readonly number[] = JUST_RATIOS.map(
  ([num, den], semitones) => 1200 * Math.log2(num / den) - 100 * semitones,
);

/**
 * How far the just target for `noteMidi` (relative to a drone root) deviates
 * from that note's equal-tempered pitch, in cents.
 */
export function justOffsetCents(noteMidi: number, rootMidi: number): number {
  const interval = (((noteMidi - rootMidi) % 12) + 12) % 12;
  return JUST_OFFSETS_CENTS[interval];
}
