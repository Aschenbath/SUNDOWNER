import assert from 'node:assert/strict';
import { arbitrateGestureChannel, GESTURE_ARBITRATION_THRESHOLD } from '../js/media-library/preview-overlay.js';

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
