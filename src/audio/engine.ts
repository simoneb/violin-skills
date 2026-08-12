import { AudioContext, AudioManager, GainNode } from 'react-native-audio-api';

/**
 * Shared audio engine: one AudioContext for the whole app so every generator
 * plays simultaneously through a single output chain, and the audio session is
 * configured in exactly one place.
 *
 * Each generator gets its own bus, so its volume is independent of the others.
 */

/** Every independent audio generator in the app. */
export type AudioSource = 'drone' | 'metronome';

export const DEFAULT_VOLUMES: Record<AudioSource, number> = {
  drone: 0.8,
  metronome: 0.8,
};

let context: AudioContext | null = null;
let sessionMode: 'playback' | 'playAndRecord' | null = null;

const buses = new Map<AudioSource, GainNode>();
const volumes: Record<AudioSource, number> = { ...DEFAULT_VOLUMES };

export function getAudioContext(): AudioContext {
  if (!context) {
    context = new AudioContext();
  }
  return context;
}

/**
 * Output bus for one generator. Volume changes apply to this bus only, so the
 * drone slider can't move the metronome and vice versa.
 */
export function getSourceBus(source: AudioSource): GainNode {
  const existing = buses.get(source);
  if (existing) {
    return existing;
  }
  const ctx = getAudioContext();
  const bus = ctx.createGain();
  bus.gain.value = volumes[source];
  bus.connect(ctx.destination);
  buses.set(source, bus);
  return bus;
}

export function setSourceVolume(source: AudioSource, volume: number) {
  volumes[source] = volume;
  const bus = buses.get(source);
  if (!bus) {
    // Not sounding yet — the value is picked up when the bus is created.
    return;
  }
  const ctx = getAudioContext();
  // setTargetAtTime avoids clicks when dragging a volume slider
  bus.gain.setTargetAtTime(volume, ctx.currentTime, 0.02);
}

/**
 * Configure the OS audio session. 'playback' keeps drone/metronome running
 * with the screen locked; 'playAndRecord' additionally opens the microphone
 * for the tuner / intonation trainer.
 */
export function configureSession(mode: 'playback' | 'playAndRecord') {
  if (sessionMode === mode) {
    return;
  }
  sessionMode = mode;
  AudioManager.setAudioSessionOptions({
    iosCategory: mode,
    iosMode: mode === 'playAndRecord' ? 'measurement' : 'default',
    iosOptions:
      mode === 'playAndRecord'
        ? ['defaultToSpeaker', 'allowBluetoothA2DP']
        : ['allowBluetoothA2DP', 'allowAirPlay'],
  });
}

export async function ensureSessionActive() {
  if (!sessionMode) {
    configureSession('playback');
  }
  await AudioManager.setAudioSessionActivity(true);
}

export async function requestMicPermission(): Promise<boolean> {
  const status = await AudioManager.checkRecordingPermissions();
  if (status === 'Granted') {
    return true;
  }
  return (await AudioManager.requestRecordingPermissions()) === 'Granted';
}
