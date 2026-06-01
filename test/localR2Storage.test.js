import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { LocalR2Storage } from '../server/r2Storage.js';

describe('LocalR2Storage', () => {
  it('clamps range metadata length at end of file', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'sundowner-r2-'));
    try {
      const r2 = new LocalR2Storage(dir);
      await r2.put('video.bin', '0123456789');

      const object = await r2.get('video.bin', {
        range: { offset: 8, length: 100 },
      });

      assert.equal(await new Response(object.body).text(), '89');
      assert.deepEqual(object.range, { offset: 8, length: 2 });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
