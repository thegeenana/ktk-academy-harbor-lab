import test from 'node:test';
import assert from 'node:assert/strict';
import { validateEntry } from './validation.js';

test('accepts bounded text and trims whitespace', () => {
  assert.deepEqual(validateEntry({ name: ' Ada ', message: ' arrived ' }), { name: 'Ada', message: 'arrived' });
});
test('rejects missing, oversized, and non-string fields', () => {
  for (const body of [null, {}, { name: 'A', message: '' },
    { name: 'A'.repeat(61), message: 'hi' }, { name: 'A', message: 'x'.repeat(281) },
    { name: 3, message: 'hi' }]) assert.equal(validateEntry(body), null);
});
