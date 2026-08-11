import { create } from 'zustand';

import { drone } from '@/audio/drone';
import { logToolEnd, logToolStart } from '@/practice/log';
import { useSettings } from './settings';

interface DroneState {
  playing: boolean;
  /** MIDI note of the drone root. Defaults to A4 — the violinist's anchor. */
  midi: number;
  withFifth: boolean;
  toggle: () => Promise<void>;
  setMidi: (midi: number) => void;
  setFifth: (withFifth: boolean) => void;
}

export const useDrone = create<DroneState>()((set, get) => ({
  playing: false,
  midi: 69,
  withFifth: false,

  toggle: async () => {
    const { playing, midi, withFifth } = get();
    if (playing) {
      drone.stop();
      logToolEnd('drone');
      set({ playing: false });
    } else {
      await drone.start(midi, useSettings.getState().a4, withFifth);
      logToolStart('drone');
      set({ playing: true });
    }
  },

  setMidi: (midi) => {
    set({ midi });
    if (get().playing) {
      drone.setNote(midi, useSettings.getState().a4);
    }
  },

  setFifth: (withFifth) => {
    set({ withFifth });
    if (get().playing) {
      drone.setFifth(withFifth, useSettings.getState().a4);
    }
  },
}));

// Retune a sounding drone when the A4 calibration changes.
useSettings.subscribe((settings, prev) => {
  if (settings.a4 !== prev.a4 && useDrone.getState().playing) {
    drone.setNote(useDrone.getState().midi, settings.a4);
  }
});
