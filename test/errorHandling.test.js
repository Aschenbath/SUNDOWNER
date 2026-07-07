import assert from 'node:assert/strict';

import { withErrorHandling } from '../functions/utils/errorHandling.js';

const INTERNAL_MESSAGE = 'D1 private_token_456 failed';

describe('error handling utilities', () => {
  let originalConsoleError;

  beforeEach(() => {
    originalConsoleError = console.error;
    console.error = () => {};
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  it('does not expose raw database errors in standardized responses', async () => {
    const wrapped = withErrorHandling(async () => {
      const error = new Error(INTERNAL_MESSAGE);
      error.name = 'DatabaseError';
      throw error;
    });

    const response = await wrapped({});
    const text = await response.text();

    assert.equal(response.status, 500);
    assert.equal(text.includes(INTERNAL_MESSAGE), false);
    const payload = JSON.parse(text);
    assert.equal(payload.error.type, 'database_error');
    assert.equal(payload.error.message, 'Database operation failed');
    assert.equal(payload.error.details, undefined);
  });
});
