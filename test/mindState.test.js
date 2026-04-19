import assert from 'node:assert/strict';
import fs from 'node:fs';

describe('mind visit-side persistence', () => {
  it('keeps current-visit web messages on the right until Mind is actually left', () => {
    const appSource = fs.readFileSync(new URL('../js/media-library/app.js', import.meta.url), 'utf8');

    assert.match(appSource, /let mindVisitStickyMessages = \[\];/);
    assert.match(appSource, /function isMindMessageStickyForVisit/);
    assert.match(appSource, /forceRight: isMindMessageStickyForVisit\(message, stickyMessages\)/);
    assert.match(appSource, /function clearMindVisitStickyMessages\(\)/);
    assert.match(appSource, /const leavingMind = state\.primaryFilter === 'Mind'/);
    assert.match(appSource, /if \(state\.primaryFilter !== 'Mind'\) \{\s*clearMindVisitStickyMessages\(\);/);
  });
});
