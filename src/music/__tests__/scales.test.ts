import { buildDescent, buildScale, scalePitchClasses, usesFlats } from '../scales';

describe('buildScale', () => {
  it('builds a one-octave G major scale', () => {
    const scale = buildScale(55, 'major', 1); // G3
    expect(scale.map((n) => n.name)).toEqual(['G', 'A', 'B', 'C', 'D', 'E', 'F♯', 'G']);
    expect(scale.map((n) => n.midi)).toEqual([55, 57, 59, 60, 62, 64, 66, 67]);
    expect(scale[0].degree).toBe(1);
    expect(scale[6].degree).toBe(7);
    expect(scale[7].degree).toBe(1);
  });

  it('builds two octaves by default and ends on the tonic', () => {
    const scale = buildScale(55, 'major');
    expect(scale).toHaveLength(15);
    expect(scale[scale.length - 1].midi).toBe(55 + 24);
  });

  it('builds harmonic minor with the raised 7th', () => {
    const scale = buildScale(57, 'harmonicMinor', 1); // A3
    expect(scale.map((n) => n.name)).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G♯', 'A']);
  });

  it('spells flat keys with flats', () => {
    const scale = buildScale(58, 'major', 1); // B♭3
    expect(scale.map((n) => n.name)).toEqual(['B♭', 'C', 'D', 'E♭', 'F', 'G', 'A', 'B♭']);
  });

  it('builds arpeggios', () => {
    const arp = buildScale(55, 'majorArpeggio', 1);
    expect(arp.map((n) => n.midi)).toEqual([55, 59, 62, 67]);
  });
});

describe('buildDescent', () => {
  it('descends melodic minor using the natural minor form', () => {
    const descent = buildDescent(57, 'melodicMinor', 1);
    expect(descent.map((n) => n.name)).toEqual(['A', 'G', 'F', 'E', 'D', 'C', 'B', 'A']);
  });

  it('descends major as the reverse of the ascent', () => {
    const up = buildScale(55, 'major', 1).map((n) => n.midi);
    const down = buildDescent(55, 'major', 1).map((n) => n.midi);
    expect(down).toEqual(up.slice().reverse());
  });
});

describe('scalePitchClasses', () => {
  it('contains exactly the scale degrees', () => {
    const pcs = scalePitchClasses(7, 'major'); // G major
    expect(pcs).toEqual(new Set([7, 9, 11, 0, 2, 4, 6]));
  });

  it('accepts both melodic minor forms', () => {
    const pcs = scalePitchClasses(9, 'melodicMinor'); // A melodic minor
    // ascending F♯(6) G♯(8) and descending F(5) G(7) all valid
    for (const pc of [5, 6, 7, 8]) {
      expect(pcs.has(pc)).toBe(true);
    }
  });
});

describe('usesFlats', () => {
  it('flags conventional flat keys', () => {
    expect(usesFlats(10, 'major')).toBe(true); // B♭ major
    expect(usesFlats(7, 'major')).toBe(false); // G major
    expect(usesFlats(2, 'naturalMinor')).toBe(true); // D minor
    expect(usesFlats(4, 'naturalMinor')).toBe(false); // E minor
  });
});
