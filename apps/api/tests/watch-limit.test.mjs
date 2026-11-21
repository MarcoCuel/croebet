import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWatchLimit } from '../dist/modules/matches/watch-limit.js';

test('assinaturas compartilham limite por identidade e se recuperam em um minuto', () => {
  let time = 0;
  const allow = createWatchLimit(() => time);
  for (let i = 0; i < 120; i++) assert.equal(allow('alice'), true);
  assert.equal(allow('alice'), false);
  assert.equal(allow('bob'), true);
  time = 59999;
  assert.equal(allow('alice'), false);
  time = 60000;
  assert.equal(allow('alice'), true);
});
