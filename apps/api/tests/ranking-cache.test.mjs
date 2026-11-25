import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRankingCache } from '../dist/modules/rankings/cache.js';

test('cache público reutiliza a classificação dentro do TTL e recarrega depois', async () => {
  let time = 1000;
  let loads = 0;
  const read = createRankingCache({ ttlMs: 100, max: 2, now: () => time });
  const load = async () => ({ value: ++loads });
  assert.deepEqual(await read('wins:month:1', load), { value: 1 });
  time = 1050;
  assert.deepEqual(await read('wins:month:1', load), { value: 1 });
  time = 1200;
  assert.deepEqual(await read('wins:month:1', load), { value: 2 });
  await read('richest:all:1', load);
  await read('losers:month:1', load);
  assert.equal(loads, 4);
});
