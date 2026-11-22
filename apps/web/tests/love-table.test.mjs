import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loveTableState } from '../features/games/love-letter/table-model.ts';
import { loveArtwork } from '../features/games/love-letter/artwork.ts';
import { presentedHands } from '../three/table/model.ts';
import { lovePlaybackView } from '../features/games/love-letter/playback-view.ts';
import { access } from 'node:fs/promises';

const view = () => ({ round: 1, phase: 'playing', pending: false, turn: 0, deckCount: 12, legalActions: [{ type: 'play', card: 4 }], players: [
  { hand: [1,4], handCount: 2, discard: [] }, { hand: null, handCount: 1, discard: [4] },
] });
test('compra automática acrescenta a carta confirmada sem clique e preserva a primeira', () => {
  const v = view(); v.players[0].hand = [1]; v.players[0].handCount = 1; v.deckCount = 13;
  const initial = loveTableState(v, 0);
  v.players[0].hand = [1,4]; v.players[0].handCount = 2; v.deckCount = 12;
  const drawn = loveTableState(v, 0, initial);
  assert.equal(drawn.deck.length, 12); assert.equal(drawn.hands[0][0].id, initial.hands[0][0].id);
  assert.equal(drawn.hands[0][1].value, 4);
  assert.equal(drawn.motions[drawn.hands[0][1].id].kind, 'draw');
  assert.deepEqual(drawn.hands[1].map(c => c.value), [-1]);
});
test('reprodução mantém somente a mão confirmada do observador visível fora da vez', () => {
  const confirmed = view(); confirmed.players[0].hand = [4]; confirmed.players[0].handCount = 1;
  const frame = { ...view(), turn: 1, legalActions: [], players: view().players.map(p => ({ ...p, hand: null, handCount: 1 })) };
  const visible = lovePlaybackView(frame, confirmed, 0);
  const table = loveTableState(visible, 0);
  assert.deepEqual(table.hands[0].map(c => [c.value, c.hidden]), [[4, false]]);
  assert.deepEqual(table.hands[1].map(c => [c.value, c.hidden]), [[-1, true]]);
  assert.deepEqual(visible.legalActions, []);
  assert.equal(frame.players[0].hand, null);
  assert.equal(lovePlaybackView(frame, confirmed), frame);
  assert.equal(lovePlaybackView(frame, { ...confirmed, round: 2 }, 0), frame);
  const swapped = { ...confirmed, players: [{ ...confirmed.players[0], hand: [9] }, confirmed.players[1]] };
  assert.deepEqual(lovePlaybackView(frame, swapped, 0).players[0].hand, [9]);
  const nextTurn = { ...confirmed, players: [{ ...confirmed.players[0], hand: [4, 9], handCount: 2 }, confirmed.players[1]] };
  assert.deepEqual(lovePlaybackView(frame, nextTurn, 0).players[0].hand, [4]);
  const turnStarts = { ...frame, turn: 0, players: [{ ...frame.players[0], handCount: 2 }, frame.players[1]] };
  assert.deepEqual(lovePlaybackView(turnStarts, nextTurn, 0).players[0].hand, [4, 9]);
});
test('descartes duplicados preservam identidade, ordem e transferência da mão sem roubar cartas de outro assento', () => {
  const v = view(); const initial = loveTableState(v, 0);
  v.players[0] = { hand: [1], handCount: 1, discard: [4] };
  const played = loveTableState(v, 0, initial);
  assert.equal(played.exposed[0].at(-1).id, initial.hands[0][1].id);
  assert.equal(played.exposed[1][0].id, initial.exposed[1][0].id);
  const next = loveTableState(v, 0, played);
  assert.deepEqual(next.exposed, played.exposed);
  assert.equal(new Set(next.exposed.flat().map(c => c.id)).size, 2);
});
test('carta oculta revelada no descarte anima com a mesma identidade sem inferir valores privados', () => {
  const v = view(); const initial = loveTableState(v, 0);
  v.players[1] = { hand: null, handCount: 0, discard: [4,9] };
  const next = loveTableState(v, 0, initial);
  assert.equal(next.exposed[1].at(-1).id, initial.hands[1][0].id);
  assert.equal(next.exposed[1].at(-1).value, 9);
  assert.deepEqual(next.hands[1], []);
});
test('edições compartilham arquivos existentes e corrigem a numeração clássica por personagem', async () => {
  for (const artwork of Object.values(loveArtwork)) for (const asset of [artwork.back, ...Object.values(artwork.faces)]) await access(new URL(`../public${asset.src}`, import.meta.url));
  assert.equal(loveArtwork.classic.faces[6].src, loveArtwork.modern.faces[7].src);
  assert.equal(loveArtwork.classic.faces[6].valueOverride, 6);
  assert.equal(loveArtwork.modern.faces[0].src, '/games/love-letter/0.png');
});


test('trocar de rodada distribui novas identidades em ordem, sem reutilizar movimentos antigos', () => {
  const v = view(); const first = loveTableState(v, 0);
  v.round = 2;
  const next = loveTableState(v, 0, first);
  assert.notEqual(next.hands[0][0].id, first.hands[0][0].id);
  assert.equal(next.motions[next.hands[0][0].id].kind, "deal");
  assert.equal(next.motions[next.hands[1][0].id].order, 1);
});


test('cartas jogadas ficam públicas junto ao dono, sem misturar com mão ativa ou descarte central', () => {
  const v = view(); const initial = loveTableState(v, 0);
  v.players[1] = { hand: null, handCount: 0, discard: [4, 9] };
  const next = loveTableState(v, 0, initial);
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
  const initial = loveTableState(v, 0);
  v.players[0] = { name: 'Ana', hand: [9], handCount: 1, discard: [7] };
  v.log = ['Ana jogou 7 em Beto.'];
  const next = loveTableState(v, 0, initial);
  assert.equal(next.hands[0][0].id, initial.hands[1][0].id);
  assert.equal(next.hands[1][0].id, initial.hands[0][0].id);
  assert.equal(next.hands[1][0].value, -1);
  assert.equal(next.hands[1][0].hidden, true);
  assert.equal(next.motions[next.hands[0][0].id].kind, 'swap');
});

test('Chanceler devolve as cartas excedentes ao baralho sem perder sua identidade visual', () => {
  const v = { ...view(), pending: true, log: [] };
  v.players[0] = { hand: [1, 4, 9], handCount: 3, discard: [] };
  const initial = loveTableState(v, 0);
  v.pending = false; v.players[0] = { hand: [9], handCount: 1, discard: [] }; v.deckCount = 14;
  const next = loveTableState(v, 0, initial);
  assert.equal(next.hands[0][0].id, initial.hands[0][2].id);
  assert.equal(next.deck.length, 14);
  for (const card of initial.hands[0].slice(0, 2)) {
    assert.ok(next.deck.some(returned => returned.id === card.id && returned.value === -1));
    assert.equal(next.motions[card.id].kind, 'collect');
  }
});

for (const kind of ['priest','baron']) test(`${kind}: revelação temporária retira cartas da mão sem mudar posse e devolve os versos`, () => {
 const v = view();v.players[0].hand=[4];v.players[0].handCount=1;
 const initial=loveTableState(v,0);
 v.inspection={kind,actor:0,target:1,controller:0,cards:kind==='priest'?[{seat:1,value:9}]:[{seat:0,value:4},{seat:1,value:9}]};
 const showing=loveTableState(v,0,initial);
 assert.equal(showing.staging.at(-1).id,initial.hands[1][0].id);
 assert.equal(showing.staging.at(-1).value,9);
 assert.deepEqual(presentedHands(showing,0)[1], showing.exposed[1]);
 assert.equal(showing.hands[1][0].value,-1);
 assert.equal(showing.discard.length,0);
 const again=loveTableState(v,0,showing);
 assert.equal(again.staging.at(-1).id,showing.staging.at(-1).id);
 const publicView={...v,inspection:{...v.inspection,cards:v.inspection.cards.map(c=>({...c,value:null}))}};
 assert.ok(loveTableState(publicView,undefined).staging.every(c=>c.hidden && c.value===-1));
 v.inspection=null;const returned=loveTableState(v,0,showing);
 assert.equal(returned.staging.length,0);
 assert.equal(returned.hands[1][0].id,initial.hands[1][0].id);
 assert.equal(returned.hands[1][0].hidden,true);
 assert.equal(returned.hands[1][0].value,-1);
});


test('cartas públicas usam a própria mão sem ocultar descartes ou alterar a posse', () => {
  const initial = loveTableState(view(), 0);
  const hands = presentedHands(initial, 0);
  assert.deepEqual(hands[1].map(card => [card.value, card.hidden]), [[4, false], [-1, true]]);
  const nextView = view();
  nextView.players[0].hand = [4]; nextView.players[0].handCount = 1;
  nextView.players[0].discard = [1];
  const next = loveTableState(nextView, 0, initial);
  const displayed = presentedHands(next, 0);
  assert.deepEqual(displayed[0].map(card => card.value), [1, 4]);
  assert.equal(displayed[0][0].id, initial.hands[0][0].id);
  assert.deepEqual(next.hands[0].map(card => card.value), [4]);
  assert.equal(new Set(displayed.flat().map(card => card.id)).size, displayed.flat().length);
  const guessing = presentedHands({ ...next, choice: { cards: [{ id: 'guess:2', value: 2 }] } }, 0);
  assert.deepEqual(guessing[0].map(card => card.id), ['guess:2']);
  assert.deepEqual(guessing[1], displayed[1]);
});
