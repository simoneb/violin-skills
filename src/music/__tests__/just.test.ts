import { JUST_OFFSETS_CENTS, justOffsetCents } from '../just';

describe('JUST_OFFSETS_CENTS', () => {
  it('matches the classic 5-limit deviations', () => {
    expect(JUST_OFFSETS_CENTS[0]).toBeCloseTo(0, 5); // unison
    expect(JUST_OFFSETS_CENTS[7]).toBeCloseTo(1.955, 2); // pure fifth slightly wide
    expect(JUST_OFFSETS_CENTS[5]).toBeCloseTo(-1.955, 2); // pure fourth slightly narrow
    expect(JUST_OFFSETS_CENTS[4]).toBeCloseTo(-13.686, 2); // major third much flatter
    expect(JUST_OFFSETS_CENTS[3]).toBeCloseTo(15.641, 2); // minor third sharper
    expect(JUST_OFFSETS_CENTS[9]).toBeCloseTo(-15.641, 2); // major sixth flatter
  });
});

describe('justOffsetCents', () => {
  it('is periodic per octave and handles roots above the note', () => {
    // Major third above G3 (55): B (59)
    expect(justOffsetCents(59, 55)).toBeCloseTo(-13.686, 2);
    // Same pitch classes any octave apart
    expect(justOffsetCents(71, 55)).toBeCloseTo(-13.686, 2);
    // Note below the root wraps correctly: E (64) against A root (69) is a fifth (7)
    expect(justOffsetCents(64, 69)).toBeCloseTo(1.955, 2);
  });

  it('returns 0 for the root itself in any octave', () => {
    expect(justOffsetCents(55, 55)).toBeCloseTo(0);
    expect(justOffsetCents(67, 55)).toBeCloseTo(0);
  });
});
