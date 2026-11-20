import { test } from "node:test";
import assert from "node:assert/strict";
import { splitPot } from "../dist/modules/matches/economy.js";

test("pote conserva Croins inteiros, inclusive empates com sobras e prêmios zero",()=>{
  assert.deepEqual(splitPot(15,[2,0]),[{seat:0,amount:8},{seat:2,amount:7}]);
  assert.deepEqual(splitPot(2,[2,1,0]),[{seat:0,amount:1},{seat:1,amount:1},{seat:2,amount:0}]);
  for(const amount of [1,5,30,Number.MAX_SAFE_INTEGER])for(let count=1;count<=12;count++){
    const payouts=splitPot(amount,Array.from({length:count},(_,i)=>i));
    assert.equal(payouts.reduce((sum,p)=>sum+BigInt(p.amount),0n),BigInt(amount));
    assert.ok(payouts.every(p=>Number.isSafeInteger(p.amount) && p.amount>=0));
    assert.ok(payouts[0].amount-payouts.at(-1).amount<=1);
  }
  assert.throws(()=>splitPot(2,[]));assert.throws(()=>splitPot(2,[0,0]));
});

test("abandono coletivo devolve todas as contribuições e mantém a transação do chamador",async()=>{
 const {refundCollectiveMatch}=await import('../dist/modules/matches/economy.js');
 const {randomUUID}=await import('node:crypto');
 const people=[0,1,2].map(seat=>({seat,userId:randomUUID(),accountId:randomUUID()}));const pot=randomUUID(),calls=[];
 const row={status:'pending',contributions:people,entry_amount:'5',pot_total:'15',pot_account_id:pot};
 const client={query:async(sql,args)=>{calls.push({sql,args});if(sql.startsWith('select * from game_match_stakes'))return {rows:[row]};if(sql.startsWith('select id, payload_hash'))return {rows:[]};if(sql.startsWith('select id, kind'))return {rows:[{id:pot,kind:'pot',balance:'15'},...people.map(p=>({id:p.accountId,user_id:p.userId,kind:'user',balance:'25'}))].filter(r=>args[0].includes(r.id))};return {rows:[]};},release:()=>assert.fail('o serviço não libera a transação externa')};
 await refundCollectiveMatch(client,'match','ABCDEF112233');
 const refunds=calls.filter(c=>c.sql.startsWith('insert into wallet_operations'));
 assert.equal(refunds.length,3);assert.ok(refunds.every(c=>c.args.includes('Devolução por abandono coletivo')));
 const settled=calls.find(c=>c.sql.startsWith('update game_match_stakes'));
 assert.deepEqual(JSON.parse(settled.args[1]),people.map(p=>({seat:p.seat,amount:5,house:false})));
 assert.equal(calls.some(c=>/^(begin|commit|rollback)$/i.test(c.sql)),false);
});
test("abandono coletivo não pode devolver um pote já liquidado",async()=>{
 const {refundCollectiveMatch}=await import('../dist/modules/matches/economy.js');
 for(const status of ['paid','refunded']){
 let queries=0;await assert.rejects(refundCollectiveMatch({query:async()=>{queries++;return {rows:[{status}]};}},'match','ABCDEF112233'),{code:'POT_ALREADY_SETTLED'});assert.equal(queries,1);
 }
});
