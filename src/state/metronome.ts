import { create } from 'zustand';

import { metronome, type Subdivision } from '@/audio/metronome';
import { logToolEnd, logToolStart } from '@/practice/log';

export const MIN_BPM = 30;
export const MAX_BPM = 240;
/** Tap-tempo averages the last N intervals. */
const TAP_WINDOW = 4;
/** Taps further apart than this start a new measurement. */
const TAP_RESET_MS = 2500;

interface MetronomeState {
  playing: boolean;
  bpm: number;
  beatsPerBar: number;
  subdivision: Subdivision;
  /** 0-based beat within the bar, for the visual pulse. -1 when stopped. */
  currentBeat: number;
  toggle: () => Promise<void>;
  setBpm: (bpm: number) => void;
  setBeatsPerBar: (beats: number) => void;
  setSubdivision: (subdivision: Subdivision) => void;
  tap: () => void;
}

let tapTimes: number[] = [];

export const useMetronome = create<MetronomeState>()((set, get) => ({
  playing: false,
  bpm: 80,
  beatsPerBar: 4,
  subdivision: 1,
  currentBeat: -1,

  toggle: async () => {
    const { playing, bpm, beatsPerBar, subdivision } = get();
    if (playing) {
      metronome.stop();
      logToolEnd('metronome');
      set({ playing: false, currentBeat: -1 });
    } else {
      await metronome.start({ bpm, beatsPerBar, subdivision }, (beatInBar) => {
        set({ currentBeat: beatInBar });
      });
      logToolStart('metronome');
      set({ playing: true });
    }
  },

  setBpm: (bpm) => {
    const clamped = Math.round(Math.max(MIN_BPM, Math.min(MAX_BPM, bpm)));
    set({ bpm: clamped });
    metronome.setConfig({ ...get(), bpm: clamped });
  },

  setBeatsPerBar: (beatsPerBar) => {
    set({ beatsPerBar });
    metronome.setConfig({ ...get(), beatsPerBar });
  },

  setSubdivision: (subdivision) => {
    set({ subdivision });
    metronome.setConfig({ ...get(), subdivision });
  },

  tap: () => {
    const now = Date.now();
    if (tapTimes.length > 0 && now - tapTimes[tapTimes.length - 1] > TAP_RESET_MS) {
      tapTimes = [];
    }
    tapTimes.push(now);
    if (tapTimes.length < 2) {
      return;
    }
    const intervals = [];
    const start = Math.max(1, tapTimes.length - TAP_WINDOW);
    for (let i = start; i < tapTimes.length; i++) {
      intervals.push(tapTimes[i] - tapTimes[i - 1]);
    }
    const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    get().setBpm(60000 / avg);
  },
}));
