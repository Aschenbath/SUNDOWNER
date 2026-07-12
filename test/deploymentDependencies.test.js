import assert from 'node:assert/strict';
import fs from 'node:fs';

function readJson(path) {
  return JSON.parse(fs.readFileSync(new URL(path, import.meta.url), 'utf8'));
}

describe('deployment dependency contracts', () => {
  it('pins fast-xml-parser to the known-compatible version in both install roots', () => {
    const root = readJson('../package.json');
    const functions = readJson('../functions/package.json');

    assert.equal(root.overrides?.['fast-xml-parser'], '5.9.3');
    assert.equal(functions.overrides?.['fast-xml-parser'], '5.9.3');
  });
});
