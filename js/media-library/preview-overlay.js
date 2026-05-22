export const PREVIEW_PANEL_SECTION_SELECTORS = [
  '.cml-preview__main',
  '.cml-preview__info',
  '.cml-preview__album-panel'
];

export const GESTURE_ARBITRATION_THRESHOLD = 10;

/**
 * Decide which gesture channel a touch sequence has claimed.
 * Pure function: no DOM, no side effects.
 *
 * @param {{ dx: number, dy: number, touchCount: number, isPinch?: boolean }} input
 * @returns {'idle' | 'swipe' | 'dismiss' | 'zoom'}
 */
export function arbitrateGestureChannel(input) {
  const { dx = 0, dy = 0, touchCount = 0, isPinch = false } = input || {};
  if (isPinch || touchCount >= 2) {
    return 'zoom';
  }
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);
  if (adx < GESTURE_ARBITRATION_THRESHOLD && ady < GESTURE_ARBITRATION_THRESHOLD) {
    return 'idle';
  }
  if (adx > ady) {
    return 'swipe';
  }
  if (dy > 0) {
    return 'dismiss';
  }
  return 'idle';
}
