import {
  centsBetween,
  frequencyToMidi,
  frequencyToNote,
  midiToFrequency,
  midiToLabel,
  midiToNoteName,
  midiToOctave,
  OPEN_STRINGS,
} from '../notes';

describe('midiToFrequency', () => {
  it('maps A4 (69) to the calibration frequency', () => {
    expect(midiToFrequency(69, 440)).toBeCloseTo(440);
    expect(midiToFrequency(69, 442)).toBeCloseTo(442);
    expect(midiToFrequency(69, 415)).toBeCloseTo(415);
  });

  it('maps octaves to frequency doubling', () => {
    expect(midiToFrequency(81, 440)).toBeCloseTo(880);
    expect(midiToFrequency(57, 440)).toBeCloseTo(220);
  });

  it('maps the violin open strings correctly at A=440', () => {
    const [g, d, a, e] = OPEN_STRINGS;
    expect(midiToFrequency(g.midi)).toBeCloseTo(196.0, 1);
    expect(midiToFrequency(d.midi)).toBeCloseTo(293.66, 1);
    expect(midiToFrequency(a.midi)).toBeCloseTo(440.0, 1);
    expect(midiToFrequency(e.midi)).toBeCloseTo(659.26, 1);
  });
});

describe('frequencyToMidi', () => {
  it('is the inverse of midiToFrequency', () => {
    for (const midi of [55, 62, 69, 76, 100]) {
      expect(frequencyToMidi(midiToFrequency(midi, 442), 442)).toBeCloseTo(midi);
    }
  });
});

describe('frequencyToNote', () => {
  it('identifies an exact A4', () => {
    const note = frequencyToNote(440, 440);
    expect(note.name).toBe('A');
    expect(note.octave).toBe(4);
    expect(note.midi).toBe(69);
    expect(note.cents).toBeCloseTo(0);
  });

  it('reports sharp/flat deviations in cents', () => {
    // 10 cents sharp of A4
    const sharp = frequencyToNote(440 * Math.pow(2, 10 / 1200), 440);
    expect(sharp.midi).toBe(69);
    expect(sharp.cents).toBeCloseTo(10, 5);

    // 25 cents flat of A4
    const flat = frequencyToNote(440 * Math.pow(2, -25 / 1200), 440);
    expect(flat.midi).toBe(69);
    expect(flat.cents).toBeCloseTo(-25, 5);
  });

  it('honors the A4 calibration', () => {
    // 442 Hz is only "in tune" when calibrated to 442
    expect(Math.abs(frequencyToNote(442, 442).cents)).toBeLessThan(0.01);
    expect(frequencyToNote(442, 440).cents).toBeCloseTo(centsBetween(440, 442), 5);
  });

  it('supports flat spelling', () => {
    const note = frequencyToNote(midiToFrequency(70), 440, true);
    expect(note.name).toBe('B♭');
  });
});

describe('centsBetween', () => {
  it('returns 100 cents per semitone and 1200 per octave', () => {
    expect(centsBetween(440, 880)).toBeCloseTo(1200);
    expect(centsBetween(440, midiToFrequency(70))).toBeCloseTo(100);
    expect(centsBetween(440, 440)).toBeCloseTo(0);
  });

  it('is signed (+ sharp, - flat)', () => {
    expect(centsBetween(440, 445)).toBeGreaterThan(0);
    expect(centsBetween(440, 435)).toBeLessThan(0);
  });
});

describe('note naming', () => {
  it('names and octaves follow scientific pitch notation', () => {
    expect(midiToLabel(60)).toBe('C4');
    expect(midiToLabel(69)).toBe('A4');
    expect(midiToLabel(55)).toBe('G3');
    expect(midiToLabel(61)).toBe('C♯4');
    expect(midiToLabel(61, true)).toBe('D♭4');
    expect(midiToOctave(59)).toBe(3);
    expect(midiToNoteName(59)).toBe('B');
  });
});
