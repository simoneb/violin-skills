import { create } from 'zustand';

import { drone } from '@/audio/drone';
import {
  notifyPaused,
  notifyPlaying,
  notifyStopped,
  refreshNowPlayingTitle,
  registerPlaybackSource,
} from '@/audio/now-playing';
import { midiToLabel } from '@/music/notes';
import { logToolEnd, logToolStart } from '@/practice/log';
import { useSettings } from './settings';

interface DroneState {
  playing: boolean;
  /** MIDI note of the drone root. Defaults to A4 — the violinist's anchor. */
  midi: number;
  withFifth: boolean;
  toggle: () => Promise<void>;
  start: () => Promise<void>;
  /** Full stop: silence the drone and remove it from the media notification. */
  stop: () => void;
  /** Notification pause: silence the drone but stay listed there, resumable. */
  pause: () => void;
  setMidi: (midi: number) => void;
  setFifth: (withFifth: boolean) => void;
}

export const useDrone = create<DroneState>()((set, get) => ({
  playing: false,
  midi: 69,
  withFifth: false,

  toggle: async () => {
    if (get().playing) {
      get().stop();
    } else {
      await get().start();
    }
  },

  start: async () => {
    const { midi, withFifth } = get();
    await drone.start(midi, useSettings.getState().a4, withFifth);
    logToolStart('drone');
    set({ playing: true });
    notifyPlaying('drone');
  },

  stop: () => {
    if (!get().playing) {
      return;
    }
    drone.stop();
    logToolEnd('drone');
    set({ playing: false });
    notifyStopped('drone');
  },

  pause: () => {
    if (!get().playing) {
      return;
    }
    drone.stop();
    logToolEnd('drone');
    set({ playing: false });
    notifyPaused('drone');
  },

  setMidi: (midi) => {
    set({ midi });
    if (get().playing) {
      drone.setNote(midi, useSettings.getState().a4);
      refreshNowPlayingTitle();
    }
  },

  setFifth: (withFifth) => {
    set({ withFifth });
    if (get().playing) {
      drone.setFifth(withFifth, useSettings.getState().a4);
      refreshNowPlayingTitle();
    }
  },
}));

// Retune a sounding drone when the A4 calibration changes.
useSettings.subscribe((settings, prev) => {
  if (settings.a4 !== prev.a4 && useDrone.getState().playing) {
    drone.setNote(useDrone.getState().midi, settings.a4);
  }
});

// Media-notification controls drive the same store as the in-app button.
registerPlaybackSource('drone', {
  title: () => {
    const { midi, withFifth } = useDrone.getState();
    return `Drone ${midiToLabel(midi)}${withFifth ? ` + ${midiToLabel(midi + 7)}` : ''}`;
  },
  resume: () => void useDrone.getState().start(),
  pause: () => useDrone.getState().pause(),
  stop: () => useDrone.getState().stop(),
});
