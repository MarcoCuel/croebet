import { test } from 'node:test';
import assert from 'node:assert/strict';
import { presentedHands, defaultSettings } from '../three/table/model.ts';
import { routeProgress } from '../three/table/motion.ts';
import { stagingTargets } from '../three/table/areas.ts';
import { resolveTableLayout, adaptiveHandWindow } from '../three/table/adaptive-layout.ts';
import { handPlacements } from '../three/table/layout.ts';
import { poseBounds } from '../three/table/pile-transform.ts';
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
  assert.ok(presentedHands(exposed, 0)[0].some(card => card.id === id));
  assert.equal(presentedHands(exposed, 0)[0][0].hidden, false);
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

test('centro do Flip 7 só mantém ações pendentes e esvazia após resolver, cancelar ou trocar de rodada', () => {
  const state = game();
  state.discard = [card(10, 12), card(11, 0, 'four')];
  const before = structuredClone(state);
  let table = flipTableState(state);
  assert.deepEqual(table.discard, []);
  assert.deepEqual(table.staging, []);
  assert.deepEqual(state, before, 'o descarte do motor é preservado');
  state.pending = { source: 0, card: card(12, 0, 'steal') };
  state.queue = [{ source: 1, card: card(13, 0, 'swap') }];
  table = flipTableState(state, table);
  assert.equal(table.stagingArea, 'discard');
  assert.deepEqual(table.staging.map(card => card.id), ['card:12', 'card:13']);
  assert.equal(table.motions['card:12'].kind, 'draw');
  state.discard.push(state.pending.card);
  state.pending = state.queue.shift();
  table = flipTableState(state, table);
  assert.deepEqual(table.staging.map(card => card.id), ['card:13']);
  assert.deepEqual(table.discard, []);
  state.discard.push(state.pending.card); state.pending = null;
  table = flipTableState(state, table);
  assert.deepEqual(table.staging, []);
  state.round++;
  assert.deepEqual(flipTableState(state).discard, []);
  assert.equal(state.discard.length, 4);
});

test('espaçamento compacto preserva curvatura, inclinação e acesso às cartas de todas as mãos', () => {
  for (const [width, height] of [[390, 700], [960, 640], [1600, 650], [2560, 900]]) {
    for (const players of [2, 4, 6, 12]) for (const count of [2, 7, 20, 1000]) for (const cardWidth of [0.72, 1.05]) {
      const counts = Array(players).fill(count), angle = 36;
      const layout = resolveTableLayout({ players, viewer: 0, counts, width, height, angle,
        handLayout: 'spread', cardWidths: Array(players).fill(cardWidth), deck: [-1.5, 0.035, -0.6] });
      const original = resolveTableLayout({ players, viewer: 0, counts, width, height, angle, deck: [-1.5, 0.035, -0.6] });
      for (let place = 0; place < layout.seats.length; place++) {
        const hand = layout.hands[place];
        assert.equal(hand.layout, original.hands[place].layout);
        assert.equal(hand.curve, original.hands[place].curve);
        assert.equal(hand.spatialCurve, original.hands[place].spatialCurve);
        assert.equal(hand.tilt, original.hands[place].tilt);
        assert.equal(hand.spacing, cardWidth + 0.04, 'intervalo discreto, sem afastamento exagerado');
        for (const focus of [0, count]) {
          const window = adaptiveHandWindow(count, hand, focus, place === 0);
          assert.ok(window.length >= 1 && window.start + window.length <= count);
          if (focus === count) assert.equal(window.start + window.length, count, 'a última carta é acessível');
          const poses = handPlacements(window.length, hand);
          for (let i = 1; i < poses.length; i++) {
            const a = poses[i - 1].position, b = poses[i].position;
            assert.ok(Math.hypot(...a.map((n, j) => n - b[j])) >= cardWidth * hand.scale,
              `${width}×${height}, ${players} pessoas, ${count} cartas, assento ${place}: centros devem ter espaço para a largura da carta`);
          }
        }
      }
      const other = resolveTableLayout({ players, viewer: 0, counts: counts.map(n => n + 1), width, height, angle, handLayout: 'spread', deck: [-1.5, 0.035, -0.6] });
      assert.deepEqual(other.fit, layout.fit, 'compras não alteram o enquadramento');
    }
  }
});

test('escolhas temporárias mantêm exatamente o leque anterior, inclusive no Love Letter', () => {
  for (const [width, height] of [[390, 700], [960, 640], [1600, 650]]) {
    const input = { players: 4, viewer: 0, counts: [9, 2, 1, 1], width, height, angle: 36, deck: [-1.5, 0.035, -0.6] };
    const original = resolveTableLayout(input);
    const choosing = resolveTableLayout({ ...input, handLayout: 'spread', choosing: true });
    assert.deepEqual(choosing.hands[0], original.hands[0]);
    assert.deepEqual(choosing.localSeat, original.localSeat);
    assert.deepEqual(choosing.fit, original.fit);
  }
});

test('ações temporárias ficam separadas em linhas, sem formar uma pilha', () => {
  const cards = Array.from({ length: 15 }, (_, i) => ({ id: String(i), value: i }));
  const angle = 36, fit = resolveTableLayout({ players: 4, viewer: 0, counts: [7, 7, 7, 7], width: 1600, height: 800, angle, deck: [-1.5, 0.035, -0.6] }).fit;
  const viewport = { fit, angle, width: 1600, height: 800 };
  for (const targets of [stagingTargets(cards, { x: 0, z: 0.15, scale: 1 }, angle, 3)]) {
    const boxes = targets.map(target => poseBounds(target.pose, viewport));
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      assert.ok(a.right < b.left || b.right < a.left || a.bottom < b.top || b.bottom < a.top);
    }
  }
});
