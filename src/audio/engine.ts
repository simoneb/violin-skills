import { AudioContext, AudioManager, GainNode } from 'react-native-audio-api';

/**
 * Shared audio engine: one AudioContext + master gain for the whole app so
 * drone and metronome can play simultaneously through a single output chain,
 * and the audio session is configured in exactly one place.
 */

let context: AudioContext | null = null;
let masterGain: GainNode | null = null;
let sessionMode: 'playback' | 'playAndRecord' | null = null;

export function getAudioContext(): AudioContext {
  if (!context) {
    context = new AudioContext();
    masterGain = context.createGain();
    masterGain.connect(context.destination);
  }
  return context;
}

export function getMasterGain(): GainNode {
  getAudioContext();
  return masterGain!;
}

export function setMasterVolume(volume: number) {
  const ctx = getAudioContext();
  // setTargetAtTime avoids clicks when dragging a volume slider
  getMasterGain().gain.setTargetAtTime(volume, ctx.currentTime, 0.02);
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
