import { test } from 'node:test';
import assert from 'node:assert/strict';
import { soloViewSchema,soloCardFace,tableVisualSettingsSchema } from '@croebet/shared';
import { soloTableState } from '../features/games/solo/table-model.ts';
import { soloCardArtwork } from '../features/games/solo/artwork.ts';
import { parseSettings,defaultSettings } from '../three/table/model.ts';
const card=(id,number=5,color='red')=>({id,kind:'number',number,color});
function view(){return soloViewSchema.parse({game:'solo',mode:'single',round:1,turn:0,direction:1,phase:'playing',activeColor:'red',deckCount:90,discard:[card('top')],penalty:0,penaltyKind:null,pendingCall:null,drawn:false,winners:[],log:['Rodada 1.'],players:[{name:'A',kind:'human',hand:[card('a'),card('b',2,'blue')],handCount:2,points:0},{name:'B',kind:'normal',hand:null,handCount:3,points:0}],legalActions:[]});}
test('Solo preserva cartas na mão/descarte e mantém oponente oculto durante compras',()=>{
 const before=view(),initial=soloTableState(before);const after=structuredClone(before);after.players[0].hand=after.players[0].hand.slice(1);after.players[0].handCount=1;after.discard.push(card('a'));after.log.push('A jogou 5 vermelho.');after.move={kind:'play',seat:0};
 const played=soloTableState(after,initial);assert.equal(played.discard.at(-1).id,initial.hands[0][0].id);assert.equal(played.hands[0][0].id,initial.hands[0][1].id);assert.ok(played.hands[1].every(c=>c.hidden && c.value===-1 && c.face===undefined));
 assert.equal(played.discard.at(-1).face,soloCardFace(card('a')));
 const drawn=structuredClone(after);drawn.players[1].handCount++;drawn.log.push('B comprou uma carta.');drawn.move={kind:'draw',seat:1};const next=soloTableState(drawn,played);assert.equal(next.hands[1].length,4);assert.ok(next.hands[1].every(c=>c.hidden));assert.equal(next.motions[next.hands[1].at(-1).id].kind,'draw');
});
test('troca de mãos anima o assento de origem sem revelar a mão entregue ao adversário',()=>{
 const before=view(),initial=soloTableState(before),after=structuredClone(before);after.move={kind:'swap',seat:0,target:1};after.log.push('A trocou com B.');after.players[0].hand=[card('c',7),card('d',8),card('e',9)];after.players[0].handCount=3;after.players[1].handCount=2;
 const next=soloTableState(after,initial);assert.deepEqual(next.hands[0].map(c=>c.id),initial.hands[1].map(c=>c.id));assert.deepEqual(next.hands[1].map(c=>c.id),initial.hands[0].map(c=>c.id));assert.ok(next.hands[1].every(c=>c.hidden && c.face===undefined));assert.ok(Object.values(next.motions).every(m=>m.kind==='swap'));
});
test('cores de fundo e número são independentes e presets antigos continuam seguindo o tema',()=>{
 const red=soloCardArtwork(card('r')),blue=soloCardArtwork(card('b',5,'blue')),yellow=soloCardArtwork(card('y',5,'yellow'));
 assert.notEqual(red.backgroundColor,blue.backgroundColor);assert.equal(red.color,blue.color);assert.notEqual(yellow.color,red.color);
 const old={...defaultSettings};delete old.numberCardBackground;assert.equal(parseSettings(old).numberCardBackground,null);
 const custom=tableVisualSettingsSchema.parse({numberCardColor:'#112233',numberCardBackground:'#ddeeff'});assert.equal(custom.numberCardColor,'#112233');assert.equal(custom.numberCardBackground,'#ddeeff');
 assert.equal(tableVisualSettingsSchema.safeParse({numberCardBackground:'red'}).success,false);
});
