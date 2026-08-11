import { create } from 'zustand';

import { configureSession, ensureSessionActive, requestMicPermission } from '@/audio/engine';
import { pitchTracker } from '@/audio/pitch/tracker';
import { logToolEnd, logToolStart } from '@/practice/log';
import { frequencyToNote, type NoteInfo } from '@/music/notes';
import { useSettings } from './settings';

/** EMA factor for the needle — higher = snappier, lower = steadier. */
const CENTS_SMOOTHING = 0.35;

interface TunerState {
  active: boolean;
  /** 'denied' when the user refused mic access. */
  permission: 'unknown' | 'granted' | 'denied';
  /** Latest detected note, or null while silent. */
  note: NoteInfo | null;
  /** Smoothed cents deviation for the needle. */
  cents: number;
  /** Which tool the listening time is attributed to in the journal. */
  start: (source?: 'tuner' | 'scales') => Promise<void>;
  stop: () => Promise<void>;
}

let activeSource: 'tuner' | 'scales' = 'tuner';

export const useTuner = create<TunerState>()((set, get) => ({
  active: false,
  permission: 'unknown',
  note: null,
  cents: 0,

  start: async (source = 'tuner') => {
    if (get().active) {
      return;
    }
    activeSource = source;
    const granted = await requestMicPermission();
    if (!granted) {
      set({ permission: 'denied' });
      return;
    }
    configureSession('playAndRecord');
    await ensureSessionActive();

    await pitchTracker.start(({ frequency }) => {
      const prev = get();
      if (frequency === null) {
        if (prev.note !== null) {
          set({ note: null });
        }
        return;
      }
      const a4 = useSettings.getState().a4;
      const note = frequencyToNote(frequency, a4);
      const sameNote = prev.note !== null && prev.note.midi === note.midi;
      const cents = sameNote
        ? prev.cents + CENTS_SMOOTHING * (note.cents - prev.cents)
        : note.cents;
      // Readings arrive ~40×/s; skip render-triggering updates when nothing
      // visible moved (a steady tone would otherwise saturate the JS thread
      // and make button presses feel laggy).
      if (
        sameNote &&
        Math.abs(cents - prev.cents) < 0.5 &&
        Math.abs(note.frequency - (prev.note?.frequency ?? 0)) < 0.5
      ) {
        return;
      }
      set({ note, cents });
    });

    logToolStart(activeSource);
    set({ active: true, permission: 'granted', note: null, cents: 0 });
  },

  stop: async () => {
    if (!get().active) {
      return;
    }
    await pitchTracker.stop();
    // Return the session to playback-only so the drone keeps working cleanly.
    configureSession('playback');
    logToolEnd(activeSource);
    set({ active: false, note: null, cents: 0 });
  },
}));
