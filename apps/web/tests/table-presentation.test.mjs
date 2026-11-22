import { test } from 'node:test';
import assert from 'node:assert/strict';
import { presentedHands, defaultSettings } from '../three/table/model.ts';
import { routeProgress } from '../three/table/motion.ts';
import { exposedTargets } from '../three/table/areas.ts';
import { flipTableState, cardFace } from '../features/games/flip7/table-model.ts';
import { laboratoryReducer, initialState } from '../features/games/laboratory/model.ts';

const card = (id, value, type = 'number') => ({ id, value, type });
const player = (cards, status = 'playing') => ({ name: 'Pessoa', kind: 'human', cards, status, total: 0, hasDrawn: true });
const game = () => ({ mode: 'vengeance', round: 1, turn: 0, phase: 'playing', deckCount: 50, players: [player([card(1, 6)]), player([card(2, 9)])], discard: [], pending: null, queue: [], forced: null });

test('seleção transporta cartas para o observador sem mudar o estado ou duplicar cartas nas mãos', () => {
  const state = flipTableState(game());
  const choice = { ...state, choice: { cards: [...state.hands[1]] } };
  const hands = presentedHands(choice, 0);
  assert.deepEqual(hands[0], state.hands[1]);
  assert.deepEqual(hands[1], []);
  assert.equal(state.hands[0][0].id, 'card:1');
  assert.equal(state.hands[1][0].id, 'card:2');
  assert.equal(presentedHands(state, 0), state.hands);
});

test('compra passa pela revelação, troca preserva identidade e ações pendentes ficam fora do descarte definitivo', () => {
  const before = game(); const initial = flipTableState(before);
  const next = structuredClone(before); next.players[1].cards.push(card(3, 13, 'lucky13'));
  const drawn = flipTableState(next, initial);
  assert.equal(drawn.motions['card:3'].kind, 'draw');
  assert.equal(drawn.motions['card:3'].via, 'reveal');
  next.players[0].cards.push(next.players[1].cards.shift());
  const moved = flipTableState(next, drawn);
  assert.equal(moved.motions['card:2'].kind, 'swap');
  assert.equal(moved.motions['card:2'].via, undefined);
  next.pending = { source: 0, card: card(4, 0, 'swap') }; next.discard = [next.pending.card];
  const pending = flipTableState(next, moved);
  assert.deepEqual(pending.discard, []);
  assert.equal(pending.staging[0].id, 'card:4');
  assert.notEqual(cardFace(card(5, 0, 'swap')), cardFace(card(6, 0, 'chance')));
});

test('linha do tempo mantém pausa de leitura e só conclui depois da entrega', () => {
  assert.deepEqual(routeProgress(0.3, 0.6, 0, 0.5, true), { leg: 0, progress: 1, done: false });
  assert.deepEqual(routeProgress(0.7, 0.6, 0, 0.5, true), { leg: 0, progress: 1, done: false });
  assert.equal(routeProgress(0.95, 0.6, 0, 0.5, true).leg, 1);
  assert.equal(routeProgress(1.1, 0.6, 0, 0.5, true).done, true);
});

test('cartas expostas ficam na área do dono e o cenário misto preserva cartas ocultas', () => {
  const initial = laboratoryReducer(initialState(defaultSettings), { type: 'scenario', mixed: true, settings: defaultSettings });
  assert.equal(initial.hands[0][0].hidden, false);
  assert.equal(initial.hands[1][0].hidden, true);
  const id = initial.hands[0][0].id;
  const exposed = laboratoryReducer(initial, { type: 'expose', seat: 0, id });
  assert.ok(!exposed.hands[0].some(card => card.id === id));
  assert.equal(exposed.exposed[0].at(-1).id, id);
  assert.deepEqual(exposed.discard, []);
  const targets = exposedTargets(exposed.exposed[0], { position: [2, 0, -2], angle: 0, width: 3, seat: 0 }, false, 1, 36);
  assert.ok(targets.every(target => target.zone === 'exposed' && !target.hidden && target.pose.position.every(Number.isFinite)));
  const collected = laboratoryReducer(exposed, { type: 'collect', players: defaultSettings.players });
  assert.ok(collected.exposed.every(hand => hand.length === 0));
  assert.ok(collected.deck.some(card => card.id === id));
});

test('efeitos contínuos acompanham o par sem transformar atualização em nova transferência', () => {
  const state = game();
  state.players[0].cards = [card(1, 6), card(3, 9)];
  const initial = flipTableState(state);
  assert.equal(initial.hands[0][0].idle.phase, 0);
  assert.equal(initial.hands[0][1].idle.phase, Math.PI);
  const next = structuredClone(state); next.players[1].cards.push(card(4, 12));
  const changed = flipTableState(next, initial);
  assert.deepEqual(changed.hands[0].map(card => card.idle), initial.hands[0].map(card => card.idle));
  assert.equal(changed.motions['card:1'], undefined);
  next.players[0].cards.push(card(5, 8));
  assert.ok(flipTableState(next, changed).hands[0].every(card => !card.idle));
});
