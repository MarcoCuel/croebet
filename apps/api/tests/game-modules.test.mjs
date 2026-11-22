import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {gameDefinitions,createMatchSchema,gameRoomSchema,realtimeRequestSchema} from '@croebet/shared';
import {gameDriver} from '../dist/modules/games/registry.js';
import {execute} from '../dist/modules/matches/execution.js';
import {commandMatch,getRoomSync} from '../dist/modules/matches/service.js';
import {legalLove} from '../dist/modules/games/love-letter/engine.js';
import {botAction} from '../dist/modules/games/flip7/engine.js';

function fixture(game){
 const driver=gameDriver(game),ids=[randomUUID(),randomUUID()];
 const initial=driver.create({setup:[{name:'Ana',kind:'human'},{name:'Beto',kind:'human'}],options:gameDefinitions[game].defaults},'Ana');
 const row={id:randomUUID(),game_id:randomUUID(),code:'ABCDEF123456',game_slug:game,rules_version:1,version:1,status:'playing',state:execute(driver,initial,1).state,owner_id:ids[0],capacity:2,options:gameDefinitions[game].defaults,development:true,bots:0,only_bots:false,entry_amount:'0'};
 const receipts=new Map(),events=[];
 const client={release(){},async query(sql,values=[]){
  if(sql.includes('select u.username from users'))return {rows:[{username:'Ana'}]};
  if(sql.startsWith('select * from game_matches'))return {rows:[row]};
  if(sql.startsWith('select p.match_id'))return {rows:ids.map((id,seat)=>({match_id:row.id,user_id:id,username:seat?'Beto':'Ana',display_name:seat?'Beto':'Ana',avatar_key:null,seat}))};
  if(sql.startsWith('select payload_hash,response'))return {rows:receipts.has(values[2])?[receipts.get(values[2])]:[]};
  if(sql.startsWith('insert into game_match_commands'))receipts.set(values[2],{payload_hash:values[3],response:JSON.parse(values[4])});
  if(sql.startsWith('insert into game_match_events'))events.push(JSON.parse(values[2]));
  if(sql.startsWith('update game_matches set state=')){row.state=JSON.parse(values[1]);row.version=values[2];row.status=values[3];}
  if(sql.startsWith('select 1'))return {rows:[{}]};
  return {rows:[]};
 }};
 return {driver,ids,row,events,receipts,pool:{connect:async()=>client}};
}
for(const game of Object.keys(gameDefinitions)){
 test(`${game}: mesmo executor cria, automatiza e conclui bots sem alterar o estado inicial`,()=>{
  const driver=gameDriver(game),initial=driver.create({setup:[{name:'A',kind:'normal'},{name:'B',kind:'normal'}],options:gameDefinitions[game].defaults,onlyBots:true},'Observador');
  const before=structuredClone(initial),result=execute(driver,initial,1);
  assert.equal(result.status,'finished');assert.ok(result.frames.length>0);
  assert.deepEqual(initial,before);assert.ok(driver.outcome(result.state).winners.length);
  for(const frame of result.frames){assert.equal('deck' in frame.state,false);assert.equal('seed' in frame.state,false);}
 });
 test(`${game}: comandos comuns autorizam o turno, deduplicam e recusam versão obsoleta`,async()=>{
  const f=fixture(game),seat=f.driver.decision(f.row.state).seat;
  const action=game==='flip7'?botAction(f.row.state):legalLove(f.row.state)[0];
  const input={commandId:randomUUID(),expectedVersion:f.row.version,action};
  assert.equal(realtimeRequestSchema.safeParse({type:'command',code:f.row.code,input}).success,true);
  await assert.rejects(commandMatch(f.pool,f.ids[1-seat],'session',f.row.code,input),{code:'NOT_YOUR_TURN'});
  const reply=await commandMatch(f.pool,f.ids[seat],'session',f.row.code,input);
  const count=f.events.length;
  assert.deepEqual(await commandMatch(f.pool,f.ids[seat],'session',f.row.code,input),reply);
  assert.equal(f.events.length,count);
  await assert.rejects(commandMatch(f.pool,f.ids[seat],'session',f.row.code,{...input,commandId:randomUUID()}),{code:'VERSION_CONFLICT'});
  if(game==='love-letter'){
   assert.ok(reply.frames.length);
   assert.deepEqual(reply.match.state.privateInfo,[]);
   for(const event of f.events){if(event.state.phase==='playing')assert.ok(event.state.players.every(p=>p.hand===null));assert.deepEqual(event.state.privateInfo,[]);assert.deepEqual(event.state.legalActions,[]);assert.equal('cards' in event.action,false);}
  }
 });
 test(`${game}: abandono usa o mesmo comando e entrega a vaga ao bot`,async()=>{
  const f=fixture(game);
  await commandMatch(f.pool,f.ids[0],'session',f.row.code,{commandId:randomUUID(),expectedVersion:f.row.version},true);
  assert.equal(f.driver.human(f.row.state,0),false);
  const sync=await getRoomSync(f.pool,f.ids[0],f.row.code);
  assert.equal(gameRoomSchema.safeParse(sync.room).success,true);
  if(game==='love-letter'){assert.equal(sync.reset,true);assert.deepEqual(sync.room.state.privateInfo,[]);assert.deepEqual(sync.room.state.legalActions,[]);assert.equal(sync.room.state.players[0].hand,null);}
 });
}
test('registro recusa configurações cruzadas e capacidade incompatível com o jogo',()=>{
 const base={requestId:randomUUID(),capacity:2};
 assert.equal(createMatchSchema.safeParse({...base,game:'love-letter',options:{mode:'vengeance',brutal:false}}).success,false);
 assert.equal(createMatchSchema.safeParse({...base,game:'flip7',options:{mode:'modern',brutal:false}}).success,false);
 assert.equal(createMatchSchema.safeParse({...base,game:'love-letter',capacity:5,options:{mode:'classic'}}).success,false);
 assert.equal(createMatchSchema.safeParse({...base,game:'love-letter',capacity:6,options:{mode:'modern'}}).success,true);
});
test('adaptador recusa uma jogada ilegal mesmo ao validar cópias do snapshot',()=>{
 const f=fixture('flip7');
 assert.throws(()=>execute(f.driver,f.row.state,1,{type:'bonus',target:null}),/ILLEGAL_ACTION/);
});

test('escolha privada do Chanceler nunca entra nos eventos públicos',()=>{
 const driver=gameDriver('love-letter');
 const state=driver.create({setup:[{name:'Ana',kind:'human'},{name:'Beto',kind:'human'}],options:{mode:'modern'}},'Ana');
 state.pending=true;state.players[state.turn].hand=[0,6,9];
 const result=execute(driver,state,1,{type:'keep',cards:[6,9,0]});
 for(const frame of result.frames){
  assert.deepEqual(driver.eventAction(frame.action),{type:'step'});
  if(frame.state.phase==='playing')assert.ok(frame.state.players.every(player=>player.hand===null));
  assert.deepEqual(frame.state.privateInfo,[]);assert.deepEqual(frame.state.legalActions,[]);
 }
 const opponent=1-state.turn;
 const view=driver.projectFor(state,opponent);
 assert.equal(view.players[state.turn].hand,null);
 assert.deepEqual(view.legalActions,[]);
});

test('inspeção privada usa autorização, recuperação e recibos comuns sem revelar valores nos eventos',async()=>{
 const f=fixture('love-letter'),s=f.row.state;
 s.turn=0;s.players[0].hand=[2,9];s.players[1].hand=[4];s.deck=[4,4,4];s.phase='playing';s.pending=false;s.inspection=null;
 const played=await commandMatch(f.pool,f.ids[0],'session',f.row.code,{commandId:randomUUID(),expectedVersion:f.row.version,action:{type:'play',card:2,target:1}});
 assert.equal(f.row.state.inspection.kind,'priest');assert.deepEqual(f.row.state.deck,[4,4,4]);
 assert.ok(played.frames.every(frame=>frame.state.inspection.cards.every(c=>c.value===null)));
 const owner=await getRoomSync(f.pool,f.ids[0],f.row.code),target=await getRoomSync(f.pool,f.ids[1],f.row.code);
 assert.equal(owner.room.state.inspection.cards[0].value,4);
 assert.equal(target.room.state.inspection.cards[0].value,null);
 const input={commandId:randomUUID(),expectedVersion:f.row.version,action:{type:'continue'}};
 await assert.rejects(commandMatch(f.pool,f.ids[1],'session',f.row.code,input),{code:'NOT_YOUR_TURN'});
 const done=await commandMatch(f.pool,f.ids[0],'session',f.row.code,input),count=f.events.length;
 assert.deepEqual(await commandMatch(f.pool,f.ids[0],'session',f.row.code,input),done);
 assert.equal(f.events.length,count);assert.equal(f.row.state.inspection,null);
 assert.equal(f.row.state.turn,1);assert.deepEqual(f.row.state.players[1].hand,[4,4]);
 for(const event of f.events)if(event.state.inspection)assert.ok(event.state.inspection.cards.every(c=>c.value===null));
});
