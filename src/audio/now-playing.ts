import { PermissionsAndroid, Platform } from 'react-native';
import { PlaybackNotificationManager } from 'react-native-audio-api';

import type { AudioSource } from './engine';

/**
 * Media-style "Now playing" notification shared by every generator in the app.
 *
 * The OS gives an app a single media session, so drone and metronome are
 * reported as one entry listing whatever currently sounds, with transport
 * controls that act on all of them. On Android the notification is also what
 * keeps the audio foreground service alive — without it, playback dies shortly
 * after the app is backgrounded — so every source must be registered here.
 *
 * Notification failures must never break playback, so every call to the OS is
 * fire-and-forget behind a catch.
 */

export interface PlaybackSource {
  /** Line describing this source in the shade, e.g. `Drone A4 + E5`. */
  title: () => string;
  /** Resume after a notification pause. */
  resume: () => void;
  /** Silence but stay resumable from the notification. */
  pause: () => void;
  stop: () => void;
}

/** Fixed order so the notification text doesn't jump around. */
const ORDER: AudioSource[] = ['drone', 'metronome'];

const sources = new Map<AudioSource, PlaybackSource>();
const playing = new Set<AudioSource>();
const paused = new Set<AudioSource>();

/** Coalesce title refreshes — tempo/note changes can arrive per slider frame. */
const TITLE_REFRESH_MS = 250;
let titleTimer: ReturnType<typeof setTimeout> | null = null;

export function registerPlaybackSource(source: AudioSource, handlers: PlaybackSource) {
  sources.set(source, handlers);
}

export function notifyPlaying(source: AudioSource) {
  playing.add(source);
  paused.delete(source);
  refresh();
}

/** Silenced from the notification but still listed there, resumable. */
export function notifyPaused(source: AudioSource) {
  playing.delete(source);
  paused.add(source);
  refresh();
}

export function notifyStopped(source: AudioSource) {
  playing.delete(source);
  paused.delete(source);
  refresh();
}

/** The description changed (drone note, tempo, ...) — update the shade. */
export function refreshNowPlayingTitle() {
  if (titleTimer || (playing.size === 0 && paused.size === 0)) {
    return;
  }
  titleTimer = setTimeout(() => {
    titleTimer = null;
    refresh();
  }, TITLE_REFRESH_MS);
}

function refresh() {
  if (titleTimer) {
    clearTimeout(titleTimer);
    titleTimer = null;
  }
  if (playing.size === 0 && paused.size === 0) {
    enqueue(() => PlaybackNotificationManager.hide());
    return;
  }
  const title = ORDER.filter((id) => playing.has(id) || paused.has(id))
    .map((id) => sources.get(id)?.title() ?? id)
    .join(' · ');
  const state = playing.size > 0 ? 'playing' : 'paused';
  enqueue(async () => {
    await ensureAndroidNotificationPermission();
    await configureControls();
    await PlaybackNotificationManager.show({ title, artist: 'Violin Skills', state });
  });
}

/**
 * One at a time, in order: a stop immediately followed by another source
 * starting must not leave the shade showing whichever call happened to win.
 */
let queue: Promise<unknown> = Promise.resolve();

function enqueue(operation: () => Promise<unknown>) {
  queue = queue.then(operation).catch(() => {});
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

function dispatch(ids: Iterable<AudioSource>, action: 'resume' | 'pause' | 'stop') {
  // Copy first: the handlers mutate the playing/paused sets as they run.
  for (const id of [...ids]) {
    sources.get(id)?.[action]();
  }
}

try {
  PlaybackNotificationManager.addEventListener('playbackNotificationPlay', () => dispatch(paused, 'resume'));
  PlaybackNotificationManager.addEventListener('playbackNotificationPause', () => dispatch(playing, 'pause'));
  PlaybackNotificationManager.addEventListener('playbackNotificationStop', () => {
    dispatch(playing, 'stop');
    dispatch(paused, 'stop');
  });
  // Swiped away: already gone from the shade, stopping is enough.
  PlaybackNotificationManager.addEventListener('playbackNotificationDismissed', () => {
    dispatch(playing, 'stop');
    dispatch(paused, 'stop');
  });
} catch {
  // Notification controls unavailable (e.g. web without Media Session).
}
