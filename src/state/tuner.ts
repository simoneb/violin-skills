import { create } from 'zustand';

import { configureSession, ensureSessionActive, requestMicPermission } from '@/audio/engine';
import { pitchTracker } from '@/audio/pitch/tracker';
import { justOffsetCents } from '@/music/just';
import { frequencyToNote, type NoteInfo } from '@/music/notes';
import { logToolEnd, logToolStart } from '@/practice/log';
import { useDrone } from './drone';
import { useSettings } from './settings';

/** EMA factor for the needle — higher = snappier, lower = steadier. */
const CENTS_SMOOTHING = 0.35;

interface TunerState {
  active: boolean;
  /** 'denied' when the user refused mic access. */
  permission: 'unknown' | 'granted' | 'denied';
  /** Latest detected note, or null while silent. */
  note: NoteInfo | null;
  /** Smoothed cents deviation for the needle (vs the just target when active). */
  cents: number;
  /** Drone root MIDI when just intonation is being applied, else null. */
  justRoot: number | null;
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
  justRoot: null,

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
      const { a4, tuningMode } = useSettings.getState();
      const note = frequencyToNote(frequency, a4);

      // Just intonation: while the drone sounds, measure against the pure
      // interval relative to its root instead of equal temperament.
      const droneState = useDrone.getState();
      const justActive = tuningMode === 'just' && droneState.playing;
      const justRoot = justActive ? droneState.midi : null;
      const rawCents = justActive
        ? note.cents - justOffsetCents(note.midi, droneState.midi)
        : note.cents;

      const sameNote = prev.note !== null && prev.note.midi === note.midi;
      const cents = sameNote
        ? prev.cents + CENTS_SMOOTHING * (rawCents - prev.cents)
        : rawCents;
      // Skip render-triggering updates when nothing visible moved (a steady
      // tone would otherwise waste JS-thread time on re-renders).
      if (
        sameNote &&
        prev.justRoot === justRoot &&
        Math.abs(cents - prev.cents) < 0.5 &&
        Math.abs(note.frequency - (prev.note?.frequency ?? 0)) < 0.5
      ) {
        return;
      }
      set({ note, cents, justRoot });
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
