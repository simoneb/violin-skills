import { create } from 'zustand';

import { drone } from '@/audio/drone';
import {
  hideDroneNotification,
  initDroneNotificationControls,
  showDroneNotification,
} from '@/audio/drone-notification';
import { logToolEnd, logToolStart } from '@/practice/log';
import { useSettings } from './settings';

interface DroneState {
  playing: boolean;
  /** MIDI note of the drone root. Defaults to A4 — the violinist's anchor. */
  midi: number;
  withFifth: boolean;
  toggle: () => Promise<void>;
  start: () => Promise<void>;
  /** Full stop: silence the drone and remove the media notification. */
  stop: () => void;
  /** Notification pause: silence the drone but keep the notification, paused. */
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
    showDroneNotification(midi, withFifth, 'playing');
  },

  stop: () => {
    if (!get().playing) {
      return;
    }
    drone.stop();
    logToolEnd('drone');
    set({ playing: false });
    hideDroneNotification();
  },

  pause: () => {
    if (!get().playing) {
      return;
    }
    drone.stop();
    logToolEnd('drone');
    set({ playing: false });
    showDroneNotification(get().midi, get().withFifth, 'paused');
  },

  setMidi: (midi) => {
    set({ midi });
    if (get().playing) {
      drone.setNote(midi, useSettings.getState().a4);
      showDroneNotification(midi, get().withFifth, 'playing');
    }
  },

  setFifth: (withFifth) => {
    set({ withFifth });
    if (get().playing) {
      drone.setFifth(withFifth, useSettings.getState().a4);
      showDroneNotification(get().midi, withFifth, 'playing');
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
initDroneNotificationControls({
  onPlay: () => {
    if (!useDrone.getState().playing) {
      void useDrone.getState().start();
    }
  },
  onPause: () => useDrone.getState().pause(),
  onStop: () => useDrone.getState().stop(),
  // Already gone from the shade; stop() hiding it again is harmless.
  onDismissed: () => useDrone.getState().stop(),
});
