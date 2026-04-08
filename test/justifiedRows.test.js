import assert from 'node:assert/strict';

import { buildJustifiedRows } from '../js/media-library/components.js';

describe('buildJustifiedRows sparse day sizing', () => {
  it('caps sparse 2-item rows so they do not grow oversized', () => {
    const rows = buildJustifiedRows([
      { width: 900, height: 1200 },
      { width: 1200, height: 1600 },
    ], {
      containerWidth: 1600,
      denseGrid: false,
    });

    assert.equal(rows.length, 1);
    assert.equal(rows[0].items.length, 2);
    assert.equal(rows[0].height, 284);
  });

  it('keeps denser rows on the existing moderate scale', () => {
    const rows = buildJustifiedRows([
      { width: 900, height: 1200 },
      { width: 1200, height: 1600 },
      { width: 1600, height: 1100 },
      { width: 1500, height: 1000 },
      { width: 1300, height: 900 },
    ], {
      containerWidth: 1600,
      denseGrid: false,
    });

    assert.equal(rows.length, 1);
    assert.equal(rows[0].items.length, 5);
    assert.equal(rows[0].height, 270);
  });
});
