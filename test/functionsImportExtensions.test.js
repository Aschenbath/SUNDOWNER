import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const FUNCTIONS_DIR = path.resolve('functions');
const RELATIVE_IMPORT_RE = /from\s+['"](\.{1,2}\/[^'"]+)['"]/g;
const ALLOWED_EXTENSION_RE = /\.(?:js|json|mjs|cjs)$/;

async function collectJavaScriptFiles(rootDir) {
  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectJavaScriptFiles(fullPath));
      continue;
    }
    if (entry.isFile() && fullPath.endsWith('.js')) {
      files.push(fullPath);
    }
  }

  return files;
}

describe('functions import specifiers', () => {
  it('uses explicit file extensions for all relative ESM imports', async () => {
    const files = await collectJavaScriptFiles(FUNCTIONS_DIR);
    const violations = [];

    for (const filePath of files) {
      const source = await fs.readFile(filePath, 'utf8');
      for (const match of source.matchAll(RELATIVE_IMPORT_RE)) {
        const specifier = match[1];
        if (!ALLOWED_EXTENSION_RE.test(specifier)) {
          violations.push(`${path.relative(process.cwd(), filePath)} -> ${specifier}`);
        }
      }
    }

    assert.deepEqual(violations, []);
  });
});
