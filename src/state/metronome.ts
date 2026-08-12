import { create } from 'zustand';

import { metronome, type Subdivision } from '@/audio/metronome';
import {
  notifyPaused,
  notifyPlaying,
  notifyStopped,
  refreshNowPlayingTitle,
  registerPlaybackSource,
} from '@/audio/now-playing';
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
  start: () => Promise<void>;
  /** Full stop: silence the metronome and remove it from the notification. */
  stop: () => void;
  /** Notification pause: silence it but stay listed there, resumable. */
  pause: () => void;
  setBpm: (bpm: number) => void;
  setBeatsPerBar: (beats: number) => void;
  setSubdivision: (subdivision: Subdivision) => void;
  tap: () => void;
}

let tapTimes: number[] = [];

export const useMetronome = create<MetronomeState>()((set, get) => {
  /** Push the current config to the running engine and to the notification. */
  const syncEngine = () => {
    const { playing, bpm, beatsPerBar, subdivision } = get();
    metronome.setConfig({ bpm, beatsPerBar, subdivision });
    if (playing) {
      refreshNowPlayingTitle();
    }
  };

  const silence = () => {
    metronome.stop();
    logToolEnd('metronome');
    set({ playing: false, currentBeat: -1 });
  };

  return {
    playing: false,
    bpm: 80,
    beatsPerBar: 4,
    subdivision: 1,
    currentBeat: -1,

    toggle: async () => {
      if (get().playing) {
        get().stop();
      } else {
        await get().start();
      }
    },

    start: async () => {
      const { bpm, beatsPerBar, subdivision } = get();
      await metronome.start({ bpm, beatsPerBar, subdivision }, (beatInBar) => {
        set({ currentBeat: beatInBar });
      });
      logToolStart('metronome');
      set({ playing: true });
      notifyPlaying('metronome');
    },

    stop: () => {
      if (!get().playing) {
        return;
      }
      silence();
      notifyStopped('metronome');
    },

    pause: () => {
      if (!get().playing) {
        return;
      }
      silence();
      notifyPaused('metronome');
    },

    setBpm: (bpm) => {
      const clamped = Math.round(Math.max(MIN_BPM, Math.min(MAX_BPM, bpm)));
      if (clamped === get().bpm) {
        return;
      }
      set({ bpm: clamped });
      syncEngine();
    },

    setBeatsPerBar: (beatsPerBar) => {
      set({ beatsPerBar });
      syncEngine();
    },

    setSubdivision: (subdivision) => {
      set({ subdivision });
      syncEngine();
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
  };
});

// Media-notification controls drive the same store as the in-app button.
registerPlaybackSource('metronome', {
  title: () => `Metronome ${useMetronome.getState().bpm} BPM`,
  resume: () => void useMetronome.getState().start(),
  pause: () => useMetronome.getState().pause(),
  stop: () => useMetronome.getState().stop(),
});
