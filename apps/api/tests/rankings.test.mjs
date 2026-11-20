import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rankingQuerySchema } from '@croebet/shared';
import { readRanking } from '../dist/modules/rankings/service.js';

test('ranking valida categorias, períodos e paginação pública limitada', () => {
  assert.deepEqual(rankingQuerySchema.parse({}),{category:'wins',period:'month',page:1});
  for (const input of [{category:'sql'},{period:'week'},{page:-1},{page:10001},{page:1.5}]) assert.equal(rankingQuerySchema.safeParse(input).success,false);
});
test('ranking mantém a própria posição fora da página e não confunde falha com vazio', async () => {
  const id='93089d02-0b34-4b78-9d3e-f2679c190b5b';
  const row={userId:id,username:'Tonho',displayName:'Tonho',avatar_key:null,position:'24',ordering:'24',value:'30',games:'0'};
  const result=await readRanking({query:async()=>({rows:[row]})},{category:'richest',period:'month',page:1},id);
  assert.equal(result.period,'all'); assert.deepEqual(result.items,[]); assert.equal(result.own.position,24); assert.equal(result.hasMore,false);
  await assert.rejects(readRanking({query:async()=>{throw Error('offline')}},{category:'wins',period:'month',page:1}),/offline/);
});
