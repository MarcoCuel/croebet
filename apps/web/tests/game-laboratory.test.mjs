import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handPlacements, handWindow, seatPlacements, sceneBounds, fitCamera } from '../three/table/layout.ts';
import { arcPosition, easedProgress } from '../three/table/motion.ts';
import { parseSettings, defaultSettings, initialState, laboratoryReducer } from '../features/games/laboratory/model.ts';
const options = { layout: 'fan', width: 5.5, curve: 1.2, spacing: 0.76, overlap: 0.35, tilt: 14, scale: 1.15, orientation: 0 };

test('mãos vazias, únicas e grandes mantêm posições finitas e largura limitada', () => {
  for (const count of [0, 1, 7, 20, 50, 1000]) {
    for (const layout of ['line', 'fan']) {
      const cards = handPlacements(count, { ...options, layout });
      assert.equal(cards.length, count);
      assert.ok(cards.every(card => [...card.position, ...card.rotation, card.scale].every(Number.isFinite)));
      if (count) assert.ok(cards.at(-1).position[0] - cards[0].position[0] <= options.width + 1e-9);
      if (layout === 'line') assert.ok(cards.every(card => card.rotation[2] === 0));
    }
  }
  assert.equal(handPlacements(1, options)[0].position[0], 0);
  assert.ok(handWindow(1000, 9, 0.5).length > handWindow(1000, 2, 1.8).length);
  assert.ok(handWindow(1000, 9, 0.5).length > 20);
  const last = handWindow(1000, 5, 1, 999);
  assert.equal(last.start + last.length, 1000);
});

test('câmera enquadra todos os limites em retrato/paisagem e mantém o observador na frente', () => {
  for (const players of [2, 3, 4, 6, 8, 12]) for (const viewer of [0, players - 1]) {
    const seats = seatPlacements(players, viewer, 4, 3.2, 5.5);
    assert.equal(seats[0].seat, viewer); assert.equal(seats[0].position[0], 0); assert.ok(seats[0].position[2] > 0);
    assert.equal(new Set(seats.map(seat => seat.seat)).size, players);
    const points = sceneBounds(seats, 1.8, 3);
    for (const aspect of [0.4, 0.7, 1, 1.8, 2.4]) for (const angle of [25, 36, 65]) {
      const fit = fitCamera(points, aspect, angle); const pitch = angle * Math.PI / 180;
      const tangent = Math.tan(44 * Math.PI / 360);
      for (const [x, worldY, z] of points) {
        const y = worldY - fit.target[1]; const depth = fit.distance - y * Math.sin(pitch) - z * Math.cos(pitch);
        assert.ok(depth > 0);
        assert.ok(Math.abs(x) <= depth * tangent * aspect + 1e-8);
        assert.ok(Math.abs(y * Math.cos(pitch) - z * Math.sin(pitch)) <= depth * tangent + 1e-8);
      }
    }
  }
});

test('preferências migram presets anteriores e recusam valores corrompidos', () => {
  assert.deepEqual(parseSettings(defaultSettings), defaultSettings);
  const { tilt, overlap, ...legacy } = defaultSettings;
  assert.equal(parseSettings(legacy).tilt, tilt); assert.equal(parseSettings(legacy).overlap, overlap);
  for (const value of [null, {}, { ...defaultSettings, viewer: 8 }, { ...defaultSettings, angle: NaN },
    { ...defaultSettings, counts: Array(12).fill(1001) }, { ...defaultSettings, players: 4.5 },
    { ...defaultSettings, shadows: 'sim' }, { ...defaultSettings, layout: 'unknown' }, { ...defaultSettings, scale: Infinity }]) assert.equal(parseSettings(value), null);
});
const identities = state => [...state.hands.flat(), ...state.deck, ...state.discard].map(card => card.id).sort();
test('comprar, distribuir, virar, descartar, trocar, recolher e embaralhar preservam cartas e identidades', () => {
  let state = initialState(defaultSettings); const ids = identities(state);
  const apply = action => { const previous = state; state = laboratoryReducer(state, action); assert.deepEqual(identities(state), ids); assert.equal(new Set(identities(state)).size, ids.length); assert.notEqual(previous, state); };
  const bought = state.deck.at(-1).id;
  apply({ type: 'draw', seat: 0 }); assert.equal(state.hands[0].at(-1).id, bought);
  apply({ type: 'deal', players: 4, count: 3 }); assert.equal(state.cue.ids.length, 12);
  const persistentMotion = state.motions[bought];
  apply({ type: 'flip', seat: 0, id: bought }); assert.ok(state.flipped.includes(bought));
  const another = state.hands[0][0].id; const counterpart = state.hands[1].at(-1).id;
  apply({ type: 'swap', seat: 0, target: 1, id: another });
  assert.equal(state.hands[1].at(-1).id, another); assert.ok(state.hands[0].some(card => card.id === counterpart));
  const motionBeforeUnrelated = state.motions[another];
  apply({ type: 'discard', seat: 0, id: bought }); assert.equal(state.discard.at(-1).id, bought);
  assert.deepEqual(state.motions[another], motionBeforeUnrelated); assert.ok(persistentMotion);
  apply({ type: 'collect', players: 4 }); assert.ok(state.hands.slice(0, 4).every(hand => hand.length === 0)); assert.equal(state.discard.length, 0);
  apply({ type: 'shuffle', order: state.deck.map((_, i) => state.deck.length - i - 1) });
  assert.equal(laboratoryReducer(state, { type: 'shuffle', order: [0, 0] }), state);
});

test('trajetórias arqueadas preservam os extremos e respeitam atraso e duração', () => {
  const from = [0, 0, 0], to = [4, 1, 2];
  assert.deepEqual(arcPosition(from, to, 0, 2), from);
  const end = arcPosition(from, to, 1, 2); assert.ok(end.every((n, i) => Math.abs(n - to[i]) < 1e-9));
  assert.ok(arcPosition(from, to, 0.5, 2)[1] > 2);
  assert.equal(easedProgress(0.2, 1, 0.3), 0); assert.equal(easedProgress(1.3, 1, 0.3), 1);
});
