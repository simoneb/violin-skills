import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { DEFAULT_VOLUMES, setSourceVolume, type AudioSource } from '@/audio/engine';

export const A4_PRESETS = [415, 432, 440, 442, 443, 444] as const;

export type TuningMode = 'equal' | 'just';

interface SettingsState {
  /** A4 calibration in Hz — shared by drone, tuner, scales, intonation trainer. */
  a4: number;
  /** Output volume 0..1 per audio generator — each one is independent. */
  volumes: Record<AudioSource, number>;
  /**
   * 'just': while the drone plays, pitch targets shift to pure intervals
   * relative to the drone root. 'equal': standard equal temperament.
   */
  tuningMode: TuningMode;
  setA4: (a4: number) => void;
  setVolume: (source: AudioSource, volume: number) => void;
  setTuningMode: (tuningMode: TuningMode) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set, get) => ({
      a4: 440,
      volumes: { ...DEFAULT_VOLUMES },
      tuningMode: 'equal' as TuningMode,
      setA4: (a4) => set({ a4 }),
      setVolume: (source, volume) => {
        set({ volumes: { ...get().volumes, [source]: volume } });
        setSourceVolume(source, volume);
      },
      setTuningMode: (tuningMode) => set({ tuningMode }),
    }),
    {
      name: 'settings',
      storage: createJSONStorage(() => Storage),
      version: 1,
      // v0 had a single master `volume` for everything; seed both generators
      // from it so nobody's saved level is lost.
      migrate: (persisted, version) => {
        const state = (persisted ?? {}) as Partial<SettingsState> & { volume?: number };
        if (version >= 1) {
          return state as SettingsState;
        }
        const { volume, ...rest } = state;
        return {
          ...rest,
          volumes: {
            drone: volume ?? DEFAULT_VOLUMES.drone,
            metronome: volume ?? DEFAULT_VOLUMES.metronome,
          },
        } as SettingsState;
      },
      // Saved levels must reach the mixer even if the user never touches a
      // slider this session.
      onRehydrateStorage: () => (state) => {
        for (const [source, volume] of Object.entries(state?.volumes ?? {})) {
          setSourceVolume(source as AudioSource, volume);
        }
      },
    },
  ),
);
