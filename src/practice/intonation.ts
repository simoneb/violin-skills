import { create } from 'zustand';

import { configureSession, ensureSessionActive, requestMicPermission } from '@/audio/engine';
import { pitchTracker } from '@/audio/pitch/tracker';
import { endSession, saveIntonationResult, startSession } from '@/db';
import { centsBetween, midiToFrequency, OPEN_STRINGS } from '@/music/notes';
import { useSettings } from '@/state/settings';

export type Tier = 'openStrings' | 'firstPosition' | 'allPositions';

export const TIER_LABELS: Record<Tier, string> = {
  openStrings: 'Open strings',
  firstPosition: '1st position',
  allPositions: 'All positions',
};

const TIER_RANGES: Record<Tier, number[]> = {
  openStrings: OPEN_STRINGS.map((s) => s.midi),
  // G3..C5 — comfortably reachable in first position
  firstPosition: Array.from({ length: 18 }, (_, i) => 55 + i),
  // G3..E6
  allPositions: Array.from({ length: 34 }, (_, i) => 55 + i),
};

export const NOTES_PER_SESSION = 10;
/** How long the target must be sustained to score it. */
const HOLD_MS = 1200;
/** Readings further off than this don't count as "playing the target". */
const MATCH_CENTS = 75;
/** Consecutive mismatches tolerated before the hold resets (bow noise etc.). */
const MISS_TOLERANCE = 2;
/** Pause on the per-note result before advancing. */
const SCORED_PAUSE_MS = 1100;

export interface NoteResult {
  targetMidi: number;
  /** Signed mean cents while held (+ sharp). */
  centsError: number;
  /** Mean absolute deviation. */
  absError: number;
  /** Standard deviation — pitch steadiness. */
  stability: number;
}

type Phase = 'idle' | 'listening' | 'scored' | 'done';

interface IntonationState {
  phase: Phase;
  tier: Tier;
  targets: number[];
  index: number;
  results: NoteResult[];
  /** Live cents vs the current target, or null when silent/off-target. */
  liveCents: number | null;
  /** 0..1 progress of the current hold. */
  holdProgress: number;
  begin: (tier: Tier) => Promise<boolean>;
  cancel: () => Promise<void>;
}

function pickTargets(tier: Tier): number[] {
  const pool = TIER_RANGES[tier];
  const targets: number[] = [];
  let last = -1;
  for (let i = 0; i < NOTES_PER_SESSION; i++) {
    let candidate = pool[Math.floor(Math.random() * pool.length)];
    while (candidate === last && pool.length > 1) {
      candidate = pool[Math.floor(Math.random() * pool.length)];
    }
    targets.push(candidate);
    last = candidate;
  }
  return targets;
}

let holdSamples: number[] = [];
let holdStartedAt = 0;
let missCount = 0;
let advanceTimer: ReturnType<typeof setTimeout> | null = null;
let dbSessionId: number | null = null;

export const useIntonation = create<IntonationState>()((set, get) => {
  const resetHold = () => {
    holdSamples = [];
    holdStartedAt = 0;
    missCount = 0;
  };

  const scoreCurrent = () => {
    const { targets, index, tier, results } = get();
    const n = holdSamples.length;
    const mean = holdSamples.reduce((a, b) => a + b, 0) / n;
    const absError = holdSamples.reduce((a, b) => a + Math.abs(b), 0) / n;
    const variance = holdSamples.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
    const result: NoteResult = {
      targetMidi: targets[index],
      centsError: mean,
      absError,
      stability: Math.sqrt(variance),
    };
    saveIntonationResult({ ...result, tier });
    resetHold();

    const nextResults = [...results, result];
    set({ phase: 'scored', results: nextResults, holdProgress: 1 });

    advanceTimer = setTimeout(() => {
      const state = get();
      if (state.phase !== 'scored') {
        return; // cancelled meanwhile
      }
      if (state.index + 1 >= state.targets.length) {
        set({ phase: 'done', liveCents: null });
        void finishTracking();
      } else {
        set({
          phase: 'listening',
          index: state.index + 1,
          liveCents: null,
          holdProgress: 0,
        });
      }
    }, SCORED_PAUSE_MS);
  };

  const onReading = (frequency: number | null) => {
    const { phase, targets, index } = get();
    if (phase !== 'listening') {
      return;
    }
    if (frequency === null) {
      missCount += 1;
      if (missCount > MISS_TOLERANCE && holdSamples.length > 0) {
        resetHold();
        set({ liveCents: null, holdProgress: 0 });
      }
      return;
    }
    const a4 = useSettings.getState().a4;
    const targetFreq = midiToFrequency(targets[index], a4);
    const cents = centsBetween(targetFreq, frequency);

    if (Math.abs(cents) > MATCH_CENTS) {
      missCount += 1;
      if (missCount > MISS_TOLERANCE && holdSamples.length > 0) {
        resetHold();
        set({ liveCents: null, holdProgress: 0 });
      }
      return;
    }

    missCount = 0;
    if (holdSamples.length === 0) {
      holdStartedAt = Date.now();
    }
    holdSamples.push(cents);

    const held = Date.now() - holdStartedAt;
    set({ liveCents: cents, holdProgress: Math.min(1, held / HOLD_MS) });

    if (held >= HOLD_MS) {
      scoreCurrent();
    }
  };

  const finishTracking = async () => {
    await pitchTracker.stop();
    configureSession('playback');
    if (dbSessionId !== null) {
      endSession(dbSessionId);
      dbSessionId = null;
    }
  };

  return {
    phase: 'idle',
    tier: 'openStrings',
    targets: [],
    index: 0,
    results: [],
    liveCents: null,
    holdProgress: 0,

    begin: async (tier) => {
      const granted = await requestMicPermission();
      if (!granted) {
        return false;
      }
      configureSession('playAndRecord');
      await ensureSessionActive();

      resetHold();
      dbSessionId = startSession('intonation');
      set({
        phase: 'listening',
        tier,
        targets: pickTargets(tier),
        index: 0,
        results: [],
        liveCents: null,
        holdProgress: 0,
      });
      await pitchTracker.start(({ frequency }) => onReading(frequency));
      return true;
    },

    cancel: async () => {
      if (advanceTimer) {
        clearTimeout(advanceTimer);
        advanceTimer = null;
      }
      resetHold();
      await finishTracking();
      set({ phase: 'idle', results: [], index: 0, liveCents: null, holdProgress: 0 });
    },
  };
});
