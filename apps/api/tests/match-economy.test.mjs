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
