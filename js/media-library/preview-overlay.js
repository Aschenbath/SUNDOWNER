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

export const PULL_DISMISS_DISTANCE_THRESHOLD = 100;
export const PULL_DISMISS_VELOCITY_THRESHOLD = 0.6;

/**
 * Decide whether a downward pull-to-dismiss gesture should close the preview.
 * Pure function.
 *
 * @param {{ dy: number, velocity: number }} input dy = vertical pixels moved (positive = down). velocity = px/ms.
 * @returns {boolean}
 */
export function shouldClosePullDismiss(input) {
  const { dy = 0, velocity = 0 } = input || {};
  if (dy <= 0) return false;
  if (dy >= PULL_DISMISS_DISTANCE_THRESHOLD) return true;
  if (velocity >= PULL_DISMISS_VELOCITY_THRESHOLD) return true;
  return false;
}

export const PHONE_BREAK_PX = 640;

/**
 * Returns true if the given viewport width is in the phone segment.
 * Pure function.
 *
 * @param {number} width
 * @returns {boolean}
 */
export function isPhoneWidth(width) {
  if (typeof width !== 'number' || !Number.isFinite(width)) return false;
  return width <= PHONE_BREAK_PX;
}

export const LONG_PRESS_MS = 450;
export const LONG_PRESS_MOVE_TOLERANCE = 10;

export const IDLE_FADE_MS = 3000;
