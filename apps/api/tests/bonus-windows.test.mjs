import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bonusWindowSettingsSchema, defaultBonusWindowSettings } from '@croebet/shared';
import { bonusWindowState, dailyClaimLimit } from '../dist/modules/economy/window.js';

const zone = 'America/Sao_Paulo';
const at = value => new Date(value);
const settings = windows => ({ enabled: true, windows, version: 1 });
const evening = settings([{ start: '18:00', end: '19:00' }]);

test('janela usa o relógio de São Paulo com início inclusivo e término exclusivo', () => {
  assert.equal(bonusWindowState(evening, at('2026-11-27T20:59:59.000Z'), zone).active, false);
  assert.equal(bonusWindowState(evening, at('2026-11-27T21:00:00.000Z'), zone).active, true); // 18:00
  assert.equal(bonusWindowState(evening, at('2026-11-27T21:59:59.000Z'), zone).active, true);
  assert.equal(bonusWindowState(evening, at('2026-11-27T22:00:00.000Z'), zone).active, false); // 19:00
  assert.equal(dailyClaimLimit(bonusWindowState(evening, at('2026-11-27T21:30:00.000Z'), zone)), 2);
  assert.equal(dailyClaimLimit(bonusWindowState(evening, at('2026-11-27T20:00:00.000Z'), zone)), 1);
  const midnight = settings([{ start: '00:00', end: '00:30' }]);
  assert.equal(bonusWindowState(midnight, at('2026-11-27T03:00:00.000Z'), zone).active, true); // 00:00
  assert.equal(bonusWindowState(midnight, at('2026-11-27T03:30:00.000Z'), zone).active, false);
});

test('janela desligada, sem horários ou vazia nunca libera o segundo resgate', () => {
  for (const value of [{ ...evening, enabled: false }, { ...evening, windows: [] }, defaultBonusWindowSettings]) {
    const state = bonusWindowState(value, at('2026-11-27T21:30:00.000Z'), zone);
    assert.deepEqual(state, { active: false, window: null });
    assert.equal(dailyClaimLimit(state), 1);
  }
});

test('contrato recusa horários inválidos, janelas sobrepostas e excesso de janelas', () => {
  assert.equal(bonusWindowSettingsSchema.safeParse({ enabled: true, windows: [{ start: '18:00', end: '19:00' }], version: 0 }).success, true);
  assert.equal(bonusWindowSettingsSchema.safeParse({ enabled: false, windows: [], version: 3 }).success, true);
  for (const invalid of [
    { enabled: true, windows: [{ start: '19:00', end: '18:00' }], version: 0 },
    { enabled: true, windows: [{ start: '18:00', end: '18:00' }], version: 0 },
    { enabled: true, windows: [{ start: '24:00', end: '25:00' }], version: 0 },
    { enabled: true, windows: [{ start: '8:00', end: '9:00' }], version: 0 },
    { enabled: true, windows: [{ start: '18:00', end: '19:00' }, { start: '18:30', end: '19:30' }], version: 0 },
    { enabled: true, windows: Array.from({ length: 9 }, (_, index) => ({ start: `${String(index).padStart(2, '0')}:00`, end: `${String(index).padStart(2, '0')}:30` })), version: 0 },
    { enabled: true, windows: [], version: -1 },
    { enabled: true, windows: [], version: 0, extra: true },
  ]) assert.equal(bonusWindowSettingsSchema.safeParse(invalid).success, false);
});

test('estado ativo devolve a faixa da janela vigente para a regra do resgate extra', () => {
  assert.deepEqual(bonusWindowState(evening, at('2026-11-27T21:30:00.000Z'), zone).window, { start: '18:00', end: '19:00' });
  assert.equal(bonusWindowState(evening, at('2026-11-27T20:00:00.000Z'), zone).window, null);
});
