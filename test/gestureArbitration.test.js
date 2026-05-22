import assert from 'node:assert/strict';
import { arbitrateGestureChannel, GESTURE_ARBITRATION_THRESHOLD, shouldClosePullDismiss, PULL_DISMISS_DISTANCE_THRESHOLD, PULL_DISMISS_VELOCITY_THRESHOLD, isPhoneWidth, PHONE_BREAK_PX } from '../js/media-library/preview-overlay.js';

describe('arbitrateGestureChannel', () => {
  it('returns "zoom" when two fingers are down', () => {
    assert.equal(arbitrateGestureChannel({ dx: 0, dy: 0, touchCount: 2 }), 'zoom');
  });

  it('returns "idle" before the 10px arbitration threshold', () => {
    assert.equal(GESTURE_ARBITRATION_THRESHOLD, 10);
    assert.equal(arbitrateGestureChannel({ dx: 5, dy: 5, touchCount: 1 }), 'idle');
    assert.equal(arbitrateGestureChannel({ dx: 9, dy: 0, touchCount: 1 }), 'idle');
  });

  it('returns "swipe" when |dx| > |dy| past threshold and single-finger', () => {
    assert.equal(arbitrateGestureChannel({ dx: 20, dy: 5, touchCount: 1 }), 'swipe');
    assert.equal(arbitrateGestureChannel({ dx: -20, dy: 5, touchCount: 1 }), 'swipe');
  });

  it('returns "dismiss" only on downward single-finger drag past threshold', () => {
    assert.equal(arbitrateGestureChannel({ dx: 5, dy: 20, touchCount: 1 }), 'dismiss');
    assert.equal(arbitrateGestureChannel({ dx: 0, dy: 20, touchCount: 1 }), 'dismiss');
  });

  it('returns "idle" on upward drag (no-op, Tier-2 placeholder)', () => {
    assert.equal(arbitrateGestureChannel({ dx: 0, dy: -20, touchCount: 1 }), 'idle');
  });

  it('locks swipe channel when isPinch flag is true regardless of vector', () => {
    assert.equal(arbitrateGestureChannel({ dx: 30, dy: 0, touchCount: 1, isPinch: true }), 'zoom');
  });
});

describe('shouldClosePullDismiss', () => {
  it('exposes the documented thresholds (100px / 0.6 px-per-ms)', () => {
    assert.equal(PULL_DISMISS_DISTANCE_THRESHOLD, 100);
    assert.equal(PULL_DISMISS_VELOCITY_THRESHOLD, 0.6);
  });

  it('closes when dy exceeds distance threshold regardless of velocity', () => {
    assert.equal(shouldClosePullDismiss({ dy: 120, velocity: 0 }), true);
  });

  it('closes when velocity exceeds velocity threshold even at short distance', () => {
    assert.equal(shouldClosePullDismiss({ dy: 40, velocity: 1.2 }), true);
  });

  it('does not close on small slow drag', () => {
    assert.equal(shouldClosePullDismiss({ dy: 30, velocity: 0.1 }), false);
  });

  it('does not close on upward drag', () => {
    assert.equal(shouldClosePullDismiss({ dy: -200, velocity: -2 }), false);
  });
});

describe('isPhoneWidth', () => {
  it('exposes PHONE_BREAK_PX = 640', () => {
    assert.equal(PHONE_BREAK_PX, 640);
  });

  it('returns true at and below 640', () => {
    assert.equal(isPhoneWidth(640), true);
    assert.equal(isPhoneWidth(390), true);
    assert.equal(isPhoneWidth(320), true);
  });

  it('returns false above 640', () => {
    assert.equal(isPhoneWidth(641), false);
    assert.equal(isPhoneWidth(960), false);
  });

  it('handles non-numeric input as false', () => {
    assert.equal(isPhoneWidth(NaN), false);
    assert.equal(isPhoneWidth(null), false);
    assert.equal(isPhoneWidth(undefined), false);
  });
});
