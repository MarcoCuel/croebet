import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handPlacements } from '../three/table/layout.ts';
import { parseSettings, defaultSettings } from '../features/games/laboratory/model.ts';

test('mãos vazias, únicas e grandes mantêm posições finitas e largura limitada', () => {
  for (const count of [0, 1, 7, 20]) {
    for (const mode of ['line', 'fan']) {
      const cards = handPlacements(count, mode, 5, 1.6);
      assert.equal(cards.length, count);
      assert.ok(cards.every(card => Object.values(card).every(Number.isFinite)));
      if (count) assert.ok(cards.at(-1).x - cards[0].x <= 5);
      if (mode === 'line') assert.ok(cards.every(card => card.z === 0 && card.rotation === 0));
    }
  }
  assert.equal(handPlacements(1, 'fan', 5, 1.6)[0].x, 0);
});

test('preferências recusam dados corrompidos, valores extremos e observador fora da mesa', () => {
  assert.deepEqual(parseSettings(defaultSettings), defaultSettings);
  for (const value of [null, {}, { ...defaultSettings, viewer: 8 }, { ...defaultSettings, angle: NaN },
    { ...defaultSettings, counts: Array(12).fill(1001) }, { ...defaultSettings, players: 4.5 },
    { ...defaultSettings, shadows: 'sim' }, { ...defaultSettings, layout: 'unknown' }]) {
    assert.equal(parseSettings(value), null);
  }
});
