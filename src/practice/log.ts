import { endSession, startSession, type Tool } from '@/db';

/**
 * Practice-time auto-tracking: tools open a span when they become active
 * (drone/metronome playing, tuner/scales listening) and close it when they
 * stop. The journal aggregates these spans.
 */
const openSpans: Partial<Record<Tool, number>> = {};

export function logToolStart(tool: Tool) {
  if (openSpans[tool] === undefined) {
    openSpans[tool] = startSession(tool);
  }
}

export function logToolEnd(tool: Tool) {
  const id = openSpans[tool];
  if (id !== undefined) {
    endSession(id);
    delete openSpans[tool];
  }
}
