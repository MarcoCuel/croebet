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
  assert.equal(played.discard.at(-1).id, initial.hands[0][1].id);
  assert.equal(played.discard[0].id, initial.discard[0].id);
  const next = loveTableState(v, 0, true, played);
  assert.deepEqual(next.discard, played.discard);
  assert.equal(new Set(next.discard.map(c => c.id)).size, 2);
});
test('carta oculta revelada no descarte anima com a mesma identidade sem inferir valores privados', () => {
  const v = view(); const initial = loveTableState(v, 0, true);
  v.players[1] = { hand: null, handCount: 0, discard: [4,9] };
  const next = loveTableState(v, 0, true, initial);
  assert.equal(next.discard.at(-1).id, initial.hands[1][0].id);
  assert.equal(next.discard.at(-1).value, 9);
  assert.deepEqual(next.hands[1], []);
});
test('edições compartilham arquivos existentes e corrigem a numeração clássica por personagem', async () => {
  for (const artwork of Object.values(loveArtwork)) for (const asset of [artwork.back, ...Object.values(artwork.faces)]) await access(new URL(`../public${asset.src}`, import.meta.url));
  assert.equal(loveArtwork.classic.faces[6].src, loveArtwork.modern.faces[7].src);
  assert.equal(loveArtwork.classic.faces[6].valueOverride, 6);
  assert.equal(loveArtwork.modern.faces[0], undefined);
});


test('trocar de rodada não reutiliza identidades nem movimentos da rodada anterior', () => {
  const v = view(); const first = loveTableState(v, 0, true);
  v.round = 2;
  const next = loveTableState(v, 0, true, first);
  assert.notEqual(next.hands[0][0].id, first.hands[0][0].id);
  assert.deepEqual(next.motions, {});
});
