import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export const A4_PRESETS = [415, 432, 440, 442, 443, 444] as const;

export type TuningMode = 'equal' | 'just';

interface SettingsState {
  /** A4 calibration in Hz — shared by drone, tuner, scales, intonation trainer. */
  a4: number;
  /** Master output volume 0..1 for generated audio (drone, metronome). */
  volume: number;
  /**
   * 'just': while the drone plays, pitch targets shift to pure intervals
   * relative to the drone root. 'equal': standard equal temperament.
   */
  tuningMode: TuningMode;
  setA4: (a4: number) => void;
  setVolume: (volume: number) => void;
  setTuningMode: (tuningMode: TuningMode) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      a4: 440,
      volume: 0.8,
      tuningMode: 'equal' as TuningMode,
      setA4: (a4) => set({ a4 }),
      setVolume: (volume) => set({ volume }),
      setTuningMode: (tuningMode) => set({ tuningMode }),
    }),
    {
      name: 'settings',
      storage: createJSONStorage(() => Storage),
    },
  ),
);
