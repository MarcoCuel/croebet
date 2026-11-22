import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createLove,applyLove,projectLove,legalLove,automateLove,botLove} from '../dist/modules/games/love-letter/engine.js';
import {createMatchSchema} from '@croebet/shared';
import {loveDriver} from '../dist/modules/games/love-letter/driver.js';
import {execute} from '../dist/modules/matches/execution.js';
import {flip7Driver} from '../dist/modules/games/flip7/driver.js';
const setup=n=>Array.from({length:n},(_,i)=>({name:`P${i}`,kind:'human'}));
for(const [mode,total,max] of [['classic',16,4],['modern',21,6]]){
 test(`Love Letter ${mode}: preparação, cartas ocultas e permissões por destinatário`,()=>{
  const s=createLove(setup(max),mode),spectator=projectLove(s,null),self=projectLove(s,s.turn);
  assert.equal(s.deck.length+s.players.reduce((n,p)=>n+p.hand.length,0)+1,total);
  assert.ok(spectator.players.every(p=>p.hand===null));assert.deepEqual(spectator.legalActions,[]);
  assert.equal(self.players.filter(p=>p.hand!==null).length,1);assert.ok(self.legalActions.length);
  assert.equal('deck' in self,false);assert.equal('aside' in self,false);
  const next=structuredClone(s);next.players[s.turn].notes=['segredo'];assert.deepEqual(projectLove(next,(s.turn+1)%max).privateInfo,[]);
 });
 test(`Love Letter ${mode}: partidas completas de bots, ações legais e sem alterações na entrada`,()=>{
  for(let i=0;i<20;i++){const s=createLove(setup(2+i%(max-1)).map(p=>({...p,kind:'normal'})),mode),before=structuredClone(s),result=automateLove(s);assert.equal(result.phase,'over');assert.ok(result.winners.length>0);assert.deepEqual(s,before);assert.ok(result.players.every(p=>p.tokens>=0));}
 });
}
test('Love Letter: Condessa obrigatória, alvo protegido e Princesa',()=>{
 const s=createLove(setup(3),'classic');s.turn=0;s.players[0].hand=[7,6];assert.deepEqual(legalLove(s),[{type:'play',card:7}]);
 assert.throws(()=>applyLove(s,{type:'play',card:6,target:1}),/ILLEGAL_ACTION/);
 s.players[0].hand=[1,8];s.players[1].protected=true;assert.ok(legalLove(s).every(a=>a.target!==1));
 const next=applyLove(s,{type:'play',card:8});assert.ok(next.players[0].out);assert.equal(s.players[0].out,false);
});
test('Love Letter: Chanceler mantém escolha privada e devolve cartas na ordem escolhida',()=>{
 const s=createLove(setup(3),'modern');s.turn=0;s.players[0].hand=[6,9];s.deck=[1,2,3,4];
 const next=applyLove(s,{type:'play',card:6});assert.ok(next.pending);assert.equal(next.players[0].hand.length,3);assert.deepEqual(projectLove(next,1).legalActions,[]);
 const action=legalLove(next)[0],done=applyLove(next,action);assert.equal(done.pending,false);assert.equal(done.players[0].hand[0],action.cards[0]);assert.deepEqual(done.deck.slice(0,2),action.cards.slice(1));
});
test('Love Letter: próxima compra acontece somente após o Chanceler resolver o baralho',()=>{
 const s=createLove(setup(3),'modern');s.turn=0;s.players[0].hand=[6,9];s.players[1].hand=[4];s.deck=[1,2,3,4];
 const pending=applyLove(s,{type:'play',card:6});
 assert.equal(pending.turn,0);assert.deepEqual(pending.players[1].hand,[4]);
 const done=applyLove(pending,{type:'keep',cards:[9,3,4]});
 assert.equal(done.turn,1);assert.deepEqual(done.players[1].hand,[4,2]);
 assert.deepEqual(done.deck,[3,4,1]);
});
test('Love Letter: empate do Clássico considera descartes, Moderno divide vitória e premia Espiã sobrevivente',()=>{
 for(const mode of ['classic','modern']){const s=createLove(setup(3),mode);s.turn=0;s.deck=[];s.players[0].hand=[4,5];s.players[1].hand=[5];s.players[2].hand=[2];s.players[1].discard=[0];s.players[0].discard=[3];const next=applyLove(s,{type:'play',card:4});assert.equal(next.phase,'summary');assert.deepEqual(next.winners,mode==='classic'?[0]:[0,1]);assert.equal(next.players[1].tokens,mode==='classic'?0:2);}
});
test('Flip 7: driver de teste permite apenas bots explicitamente; motor usual preserva autenticação',()=>{
 const bots=setup(2).map(p=>({...p,kind:'normal'}));const s=flip7Driver.create({setup:bots,options:{mode:'classic',brutal:false},onlyBots:true},'Admin');assert.ok(s.players.every(p=>p.kind==='normal'));assert.equal(flip7Driver.create({setup:bots,options:{mode:'classic',brutal:false}},'Admin').players[0].name,'Admin');
});
test('contrato diferencia teste e mantém compatibilidade das criações normais',()=>{
 const input={requestId:'11111111-1111-4111-8111-111111111111',game:'flip7',capacity:2,options:{mode:'classic',brutal:false}};
 assert.equal(createMatchSchema.parse(input).development,false);
 assert.equal(createMatchSchema.parse({...input,game:'love-letter',options:{mode:'modern',brutal:false},development:true}).development,true);
 assert.throws(()=>createLove(setup(5),'classic'));assert.throws(()=>createLove(setup(7),'modern'));
 assert.ok(botLove(createLove(setup(2),'modern')));
});

test('Padre aguarda confirmação, preserva snapshot privado e não avança compras',()=>{
 const s=createLove(setup(3),'modern');s.turn=0;s.players[0].hand=[2,9];s.players[1].hand=[4];s.deck=[1,2,3];
 const result=execute(loveDriver,s,1,{type:'play',card:2,target:1}),paused=result.state;
 assert.equal(paused.turn,0);assert.equal(paused.inspection.kind,'priest');assert.deepEqual(paused.deck,s.deck);
 assert.deepEqual(legalLove(paused),[{type:'continue'}]);assert.equal(loveDriver.automatic(paused),null);
 assert.deepEqual(loveDriver.decision(paused),{seat:0,key:'1:0:inspection'});
 assert.equal(projectLove(paused,0).inspection.cards[0].value,4);
 for(const seat of [null,1,2]){
  const view=projectLove(paused,seat);assert.ok(view.inspection.cards.every(c=>c.value===null));assert.deepEqual(view.legalActions,[]);
 }
 assert.ok(result.frames.every(f=>f.state.inspection.cards.every(c=>c.value===null)));
 assert.throws(()=>applyLove(paused,{type:'play',card:9}),/ILLEGAL_ACTION/);
 const restored=loveDriver.parse(JSON.parse(JSON.stringify(paused)));
 assert.equal(restored.inspection.cards[0].value,4);
 const done=applyLove(restored,{type:'continue'});
 assert.equal(done.inspection,null);assert.equal(done.turn,1);assert.deepEqual(done.players[1].hand,[4,3]);
 assert.throws(()=>applyLove(done,{type:'continue'}),/ILLEGAL_ACTION/);
 const replaced=loveDriver.replace(paused,0);
 assert.deepEqual(loveDriver.automatic(replaced),{type:'continue'});
});
for(const [own,other,loser] of [[8,4,1],[4,8,0],[4,4,null]])test(`Barão compara ${own} com ${other} e só resolve ao continuar`,()=>{
 const s=createLove(setup(3),'modern');s.turn=0;s.players[0].hand=[3,own];s.players[1].hand=[other];s.deck=[1,2,3];
 const paused=applyLove(s,{type:'play',card:3,target:1});
 assert.ok(paused.players.every(p=>!p.out));assert.equal(paused.turn,0);
 for(const seat of [0,1])assert.deepEqual(projectLove(paused,seat).inspection.cards.map(c=>c.value),[own,other]);
 for(const seat of [null,2])assert.ok(projectLove(paused,seat).inspection.cards.every(c=>c.value===null));
 assert.deepEqual(projectLove(paused,1).legalActions,[]);
 const done=applyLove(paused,{type:'continue'});
 assert.equal(done.inspection,null);
 assert.deepEqual(done.players.flatMap((p,i)=>p.out?[i]:[]),loser===null?[]:[loser]);
});
test('Barão de bot permite ao alvo humano observar e confirmar; bots sozinhos continuam automaticamente',()=>{
 const s=createLove(setup(3).map(p=>({...p,kind:'normal'})),'modern');s.turn=0;s.players[0].hand=[3,8];s.players[1].hand=[4];s.players[1].kind='human';
 const paused=applyLove(s,{type:'play',card:3,target:1});
 assert.equal(loveDriver.decision(paused).seat,1);assert.equal(loveDriver.automatic(paused),null);
 assert.deepEqual(projectLove(paused,1).legalActions,[{type:'continue'}]);assert.deepEqual(projectLove(paused,0).legalActions,[]);
 const bots=loveDriver.replace(paused,1);assert.deepEqual(loveDriver.automatic(bots),{type:'continue'});
});
test('snapshots anteriores continuam válidos sem inspeção',()=>{
 const s=createLove(setup(2),'classic');delete s.inspection;
 assert.equal(loveDriver.parse(s).inspection,null);
});
