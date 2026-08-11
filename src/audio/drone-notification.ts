import { PermissionsAndroid, Platform } from 'react-native';
import { PlaybackNotificationManager } from 'react-native-audio-api';

import { midiToLabel } from '@/music/notes';

/**
 * Media-style "Now playing" notification for the drone, so it can be paused,
 * resumed or stopped from the notification shade / lock screen while the app
 * is in the background. Notification failures must never break playback, so
 * every call is fire-and-forget behind a catch.
 */

export interface DroneNotificationHandlers {
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  /** User swiped the notification away — stop without re-showing it. */
  onDismissed: () => void;
}

let permissionRequested = false;

/** Android 13+ blocks all notifications (media ones included) until granted. */
async function ensureAndroidNotificationPermission() {
  if (Platform.OS !== 'android' || permissionRequested) {
    return;
  }
  permissionRequested = true;
  try {
    await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  } catch {
    // Older Android or request failure — showing the notification may still work.
  }
}

let controlsConfigured = false;

async function configureControls() {
  if (controlsConfigured) {
    return;
  }
  controlsConfigured = true;
  const wanted: [control: Parameters<typeof PlaybackNotificationManager.enableControl>[0], enabled: boolean][] = [
    ['play', true],
    ['pause', true],
    ['stop', true],
    ['nextTrack', false],
    ['previousTrack', false],
    ['skipForward', false],
    ['skipBackward', false],
    ['seekTo', false],
  ];
  await Promise.all(wanted.map(([control, enabled]) => PlaybackNotificationManager.enableControl(control, enabled)));
}

export function initDroneNotificationControls(handlers: DroneNotificationHandlers) {
  try {
    PlaybackNotificationManager.addEventListener('playbackNotificationPlay', handlers.onPlay);
    PlaybackNotificationManager.addEventListener('playbackNotificationPause', handlers.onPause);
    PlaybackNotificationManager.addEventListener('playbackNotificationStop', handlers.onStop);
    PlaybackNotificationManager.addEventListener('playbackNotificationDismissed', handlers.onDismissed);
  } catch {
    // Notification controls unavailable (e.g. web without Media Session).
  }
}

export function showDroneNotification(midi: number, withFifth: boolean, state: 'playing' | 'paused') {
  const title = `Drone · ${midiToLabel(midi)}${withFifth ? ` + ${midiToLabel(midi + 7)}` : ''}`;
  ensureAndroidNotificationPermission()
    .then(configureControls)
    .then(() => PlaybackNotificationManager.show({ title, artist: 'Violin Skills', state }))
    .catch(() => {});
}

export function hideDroneNotification() {
  PlaybackNotificationManager.hide().catch(() => {});
}
