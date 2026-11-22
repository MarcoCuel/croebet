import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loveTableState } from '../features/games/love-letter/table-model.ts';
import { loveArtwork } from '../features/games/love-letter/artwork.ts';
import { access } from 'node:fs/promises';

const view = () => ({ round: 1, phase: 'playing', pending: false, turn: 0, deckCount: 12, legalActions: [{ type: 'play', card: 4 }], players: [
  { hand: [1,4], handCount: 2, discard: [] }, { hand: null, handCount: 1, discard: [4] },
] });
test('compra visual preserva a primeira carta e acrescenta somente a carta confirmada pela API', () => {
  const v = view(); const initial = loveTableState(v, 0, false);
  assert.equal(initial.deck.length, 13); assert.equal(initial.hands[0].length, 1);
  const drawn = loveTableState(v, 0, true, initial);
  assert.equal(drawn.deck.length, 12); assert.equal(drawn.hands[0][0].id, initial.hands[0][0].id);
  assert.equal(drawn.hands[0][1].value, 4);
  assert.equal(drawn.motions[drawn.hands[0][1].id].kind, 'draw');
  assert.deepEqual(drawn.hands[1].map(c => c.value), [-1]);
});
test('descartes duplicados preservam identidade, ordem e transferência da mão sem roubar cartas de outro assento', () => {
  const v = view(); const initial = loveTableState(v, 0, true);
  v.players[0] = { hand: [1], handCount: 1, discard: [4] };
  const played = loveTableState(v, 0, true, initial);
  assert.equal(played.exposed[0].at(-1).id, initial.hands[0][1].id);
  assert.equal(played.exposed[1][0].id, initial.exposed[1][0].id);
  const next = loveTableState(v, 0, true, played);
  assert.deepEqual(next.exposed, played.exposed);
  assert.equal(new Set(next.exposed.flat().map(c => c.id)).size, 2);
});
test('carta oculta revelada no descarte anima com a mesma identidade sem inferir valores privados', () => {
  const v = view(); const initial = loveTableState(v, 0, true);
  v.players[1] = { hand: null, handCount: 0, discard: [4,9] };
  const next = loveTableState(v, 0, true, initial);
  assert.equal(next.exposed[1].at(-1).id, initial.hands[1][0].id);
  assert.equal(next.exposed[1].at(-1).value, 9);
  assert.deepEqual(next.hands[1], []);
});
test('edições compartilham arquivos existentes e corrigem a numeração clássica por personagem', async () => {
  for (const artwork of Object.values(loveArtwork)) for (const asset of [artwork.back, ...Object.values(artwork.faces)]) await access(new URL(`../public${asset.src}`, import.meta.url));
  assert.equal(loveArtwork.classic.faces[6].src, loveArtwork.modern.faces[7].src);
  assert.equal(loveArtwork.classic.faces[6].valueOverride, 6);
  assert.equal(loveArtwork.modern.faces[0], undefined);
});


test('trocar de rodada distribui novas identidades em ordem, sem reutilizar movimentos antigos', () => {
  const v = view(); const first = loveTableState(v, 0, true);
  v.round = 2;
  const next = loveTableState(v, 0, true, first);
  assert.notEqual(next.hands[0][0].id, first.hands[0][0].id);
  assert.equal(next.motions[next.hands[0][0].id].kind, "deal");
  assert.equal(next.motions[next.hands[1][0].id].order, 1);
});


test('cartas jogadas ficam públicas junto ao dono, sem misturar com mão ativa ou descarte central', () => {
  const v = view(); const initial = loveTableState(v, 0, true);
  v.players[1] = { hand: null, handCount: 0, discard: [4, 9] };
  const next = loveTableState(v, 0, true, initial);
  assert.deepEqual(next.discard, []);
  assert.equal(next.exposed[1].at(-1).hidden, false);
  assert.equal(next.exposed[1].at(-1).id, initial.hands[1][0].id);
  assert.equal(next.hands[0].length, 2);
});


test('Rei troca identidades entre assentos e apaga o valor que ficou oculto ao observador', () => {
  const v = { ...view(), mode: 'modern', log: [], legalActions: [{ type: 'play', card: 7 }], players: [
    { name: 'Ana', hand: [2, 7], handCount: 2, discard: [] },
    { name: 'Beto', hand: null, handCount: 1, discard: [] },
  ] };
  const initial = loveTableState(v, 0, true);
  v.players[0] = { name: 'Ana', hand: [9], handCount: 1, discard: [7] };
  v.log = ['Ana jogou 7 em Beto.'];
  const next = loveTableState(v, 0, true, initial);
  assert.equal(next.hands[0][0].id, initial.hands[1][0].id);
  assert.equal(next.hands[1][0].id, initial.hands[0][0].id);
  assert.equal(next.hands[1][0].value, -1);
  assert.equal(next.hands[1][0].hidden, true);
  assert.equal(next.motions[next.hands[0][0].id].kind, 'swap');
});

test('Chanceler devolve as cartas excedentes ao baralho sem perder sua identidade visual', () => {
  const v = { ...view(), pending: true, log: [] };
  v.players[0] = { hand: [1, 4, 9], handCount: 3, discard: [] };
  const initial = loveTableState(v, 0, true);
  v.pending = false; v.players[0] = { hand: [9], handCount: 1, discard: [] }; v.deckCount = 14;
  const next = loveTableState(v, 0, true, initial);
  assert.equal(next.hands[0][0].id, initial.hands[0][2].id);
  assert.equal(next.deck.length, 14);
  for (const card of initial.hands[0].slice(0, 2)) {
    assert.ok(next.deck.some(returned => returned.id === card.id && returned.value === -1));
    assert.equal(next.motions[card.id].kind, 'collect');
  }
});
