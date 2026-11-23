import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSolo, soloDeck, applySolo, legalSolo, projectSolo, parseSolo } from '../dist/modules/games/solo/engine.js';
import { soloDriver } from '../dist/modules/games/solo/driver.js';
import { execute } from '../dist/modules/matches/execution.js';
import { soloCardPoints, gameDefinitions, createMatchSchema } from '@croebet/shared';
const rng=n=>n-1;
function fixture(hands,top,extra={}){
 const s=createSolo(hands.map((_,i)=>({name:`P${i}`,kind:'human'})),'single',rng),deck=soloDeck();
 const take=spec=>{const i=deck.findIndex(c=>Object.entries(spec).every(([k,v])=>c[k]===v));assert.ok(i>=0);return deck.splice(i,1)[0];};
 s.players.forEach((p,i)=>{p.hand=hands[i].map(take);});s.discard=[take(top)];s.deck=deck;s.activeColor=s.discard[0].color;s.turn=0;
 Object.assign(s,extra);parseSolo(s);return s;
}
const num=(number,color='red')=>({kind:'number',number,color});
const special=(kind,color='red')=>({kind,color});
const play=(s,seat,index=0,extra={})=>applySolo(s,{type:'solo-play',seat,cardId:s.players[seat].hand[index].id,...extra},rng);
test('Solo clássico: 112 cartas, 8 por pessoa e nenhuma carta das expansões',()=>{
 const deck=soloDeck();assert.equal(deck.length,112);assert.equal(new Set(deck.map(c=>c.id)).size,112);
 assert.equal(deck.filter(c=>c.kind==='number').length,72);assert.ok(deck.every(c=>!['gift','protection'].includes(c.kind)));
 for(const count of [2,6,10]){const s=createSolo(Array.from({length:count},(_,i)=>({name:`P${i}`,kind:'human'})),'single',rng);parseSolo(s);assert.ok(s.players.every(p=>p.hand.length===8));assert.equal(s.discard.at(-1).kind,'number');}
 assert.equal(gameDefinitions.solo.developmentOnly,true);assert.equal(gameDefinitions.solo.croins,false);
 assert.equal(createMatchSchema.safeParse({requestId:'00000000-0000-4000-8000-000000000001',game:'solo',capacity:11,options:{mode:'single'}}).success,false);
});
test('intervenção exige identidade de número/cor ou símbolo/cor e muda a sequência',()=>{
 const s=fixture([[num(1)],[num(5,'blue')],[num(5),num(3)]],num(5));
 assert.equal(legalSolo(s,1).length,0);assert.equal(legalSolo(s,2).filter(a=>a.type==='solo-play').length,2);
 const after=play(s,2,0,{solo:true});assert.equal(after.turn,0);assert.equal(after.players[2].hand.length,1);assert.deepEqual(s.players[2].hand.length,2);
 const actions=fixture([[num(1)],[special('reverse'),num(2)],[num(3)]],special('reverse'));
 assert.ok(legalSolo(actions,1).some(a=>a.type==='solo-play'));assert.equal(play(actions,1,0,{solo:true}).direction,-1);
});
test('+2 acumula somente com +2 e a compra de penalidade mantém a vez normal',()=>{
 let s=fixture([[special('draw2'),num(1)],[special('draw2','blue'),num(3)],[special('draw4',null),num(7)]],num(8));
 s=play(s,0,0,{solo:true});assert.equal(s.penalty,2);s=play(s,1,0,{solo:true});assert.equal(s.penalty,4);assert.equal(s.turn,2);
 assert.equal(legalSolo(s,2).filter(a=>a.type==='solo-play').length,0);
 const n=s.players[2].hand.length;s=applySolo(s,{type:'solo-draw',seat:2},rng);assert.equal(s.players[2].hand.length,n+4);assert.equal(s.turn,2);assert.equal(s.drawn,false);assert.equal(s.penalty,0);
});
test('+4 acumula com +4, define cor e não importa regras de desafio do Uno',()=>{
 let s=fixture([[special('draw4',null),num(1)],[special('draw4',null),num(2)],[num(3)]],num(8));
 s=play(s,0,0,{color:'blue',solo:true});assert.equal(s.activeColor,'blue');s=play(s,1,0,{color:'green',solo:true});assert.equal(s.penalty,8);assert.equal(s.activeColor,'green');
});
test('compra normal permite jogar apenas a comprada ou passar',()=>{
 let s=fixture([[num(2),num(7)],[num(3)]],num(8));
 const matching=s.deck.findIndex(c=>c.kind==='number' && c.color==='red');s.deck.push(...s.deck.splice(matching,1));
 s=applySolo(s,{type:'solo-draw',seat:0},rng);const choices=legalSolo(s,0);assert.ok(choices.some(a=>a.type==='solo-pass'));
 assert.ok(choices.filter(a=>a.type==='solo-play').every(a=>a.cardId===s.drawnCardId));
 assert.equal(applySolo(s,{type:'solo-pass',seat:0},rng).turn,1);
});
test('pular, inverter e trocar mão respeitam a versão BGA, inclusive 2 jogadores',()=>{
 let s=fixture([[special('skip'),num(1)],[num(2)],[num(3)]],num(8));assert.equal(play(s,0,0,{solo:true}).turn,2);
 s=fixture([[special('reverse'),num(1)],[num(2)]],num(8));assert.equal(play(s,0,0,{solo:true}).turn,1);
 s=fixture([[special('swap'),num(1)],[num(2)],[num(3),num(4)]],num(8));const expected=s.players[2].hand;
 const after=play(s,0,0,{target:2,solo:true});assert.deepEqual(after.players[0].hand,expected);assert.equal(after.turn,1);assert.equal(after.players[2].hand[0].number,1);
});
test('rodízio passa mãos no sentido atual e libera qualquer carta seguinte',()=>{
 let s=fixture([[special('rotate',null),num(1)],[num(2,'blue')],[num(3,'green')]],num(8),{direction:-1});
 s=play(s,0,0,{solo:true});assert.equal(s.players[2].hand[0].number,1);assert.equal(s.players[0].hand[0].number,2);assert.equal(s.turn,2);
 assert.ok(legalSolo(s,2).some(a=>a.type==='solo-play'));
});
test('anúncio Solo e penalidade são persistidos; última carta encerra sem executar efeito',()=>{
 let s=fixture([[num(4),special('draw4',null)],[num(2)]],num(8));s=play(s,0);assert.deepEqual(s.pendingCalls,[0]);
 const announced=applySolo(s,{type:'solo-call',seat:0},rng);assert.deepEqual(announced.pendingCalls,[]);
 const after=applySolo(s,{type:'solo-draw',seat:1},rng);assert.equal(after.players[0].hand.length,3);assert.deepEqual(after.pendingCalls,[]);
 const win=fixture([[special('draw4',null)],[num(2),num(3)]],num(8));const end=play(win,0,0,{color:'green'});assert.equal(end.phase,'over');assert.equal(end.players[1].hand.length,2);assert.equal(end.players[1].points,5);assert.equal(end.penalty,0);assert.deepEqual(end.winners,[0]);
});
test('rodadas, limites de pontos e empate usam menor penalidade',()=>{
 let s=fixture([[num(4)],[num(2),num(3)]],num(8),{mode:'rounds3',round:2});s=play(s,0);assert.equal(s.phase,'summary');assert.equal(s.players[1].points,5);
 s=applySolo(s,{type:'solo-next',seat:0},rng);assert.equal(s.round,3);assert.ok(s.players.every(p=>p.hand.length===8));assert.equal(s.players[1].points,5);
 s=fixture([[num(4)],[num(2),num(3)]],num(8),{mode:'points100'});s.players[1].points=95;s=play(s,0);assert.equal(s.phase,'over');assert.deepEqual(s.winners,[0]);
 assert.equal(soloCardPoints({id:'x',kind:'draw4',number:null,color:null}),50);
});
test('reposição preserva o topo e todas as identidades de cartas',()=>{
 const s=fixture([[num(1)],[num(2)]],num(8));s.discard.unshift(...s.deck);s.deck=[];const top=s.discard.at(-1).id;
 const after=applySolo(s,{type:'solo-draw',seat:0},rng);assert.equal(after.discard.at(-1).id,top);assert.equal(after.discard.length,1);assert.ok(after.deck.length>0);parseSolo(after);
});
test('projeções e bots não expõem mãos, baralho, carta comprada nem ações privadas',()=>{
 const s=createSolo([{name:'A',kind:'human'},{name:'B',kind:'normal'}],'single',rng),view=projectSolo(s,0),spectator=projectSolo(s,null);
 assert.deepEqual(view.players[0].hand,s.players[0].hand);assert.equal(view.players[1].hand,null);assert.ok(spectator.players.every(p=>p.hand===null));assert.deepEqual(spectator.legalActions,[]);
 assert.equal('drawnCardId' in spectator,false);assert.equal('deck' in spectator,false);
 assert.throws(()=>parseSolo({...s,deck:s.deck.slice(1)}));
 assert.equal(soloDriver.authorize(s,1,{type:'solo-draw',seat:0}),false);
 assert.deepEqual(soloDriver.eventAction({type:'solo-play',seat:0,cardId:'private',solo:false}),{type:'step'});
 const auto=createSolo([{name:'A',kind:'normal'},{name:'B',kind:'normal'}],'single',rng);const result=execute(soloDriver,auto,1);assert.equal(result.frames.length,0);assert.equal(result.status,'playing');
});

test('troca com duas mãos unitárias permite anunciar cada mão, sem penalizar anúncio já confirmado',()=>{
 let s=fixture([[special('swap'),num(1)],[num(2)]],num(8));s=play(s,0,0,{target:1});assert.deepEqual(s.pendingCalls,[0,1]);
 s=applySolo(s,{type:'solo-call',seat:1},rng);assert.deepEqual(s.pendingCalls,[0]);s=applySolo(s,{type:'solo-call',seat:0},rng);assert.deepEqual(s.pendingCalls,[]);
});
test('bots intervêm também na vez humana; partidas completas conservam cartas e encerram em todos os modos',()=>{
 const jump=fixture([[num(1),num(2)],[num(5),num(3)]],num(5));jump.players[1].kind='normal';assert.equal(soloDriver.automatic(jump).seat,1);
 for(const [players,mode,seed] of [[2,'single',7],[4,'rounds3',17],[10,'points100',31]]){
  let value=seed;const random=upper=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value%upper;};
  let s=createSolo(Array.from({length:players},(_,i)=>({name:`P${i}`,kind:'normal'})),mode,random);
  for(let step=0;s.phase!=='over';step++){
   assert.ok(step<10000,`${players}/${mode} não concluiu`);const a=soloDriver.automatic(s);assert.ok(a);s=applySolo(s,a,random);parseSolo(s);
  }
  assert.ok(s.winners.length);if(mode==='rounds3')assert.equal(s.round,3);
 }
});
