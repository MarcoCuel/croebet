import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDatabase } from '../../dist/db/client.js';
import { readRanking } from '../../dist/modules/rankings/service.js';

test('PostgreSQL: rankings agregam empates, bots, saldo e perdas líquidas, com paginação e período', async t => {
  if (!process.env.TEST_DATABASE_URL) throw Error('Configure TEST_DATABASE_URL com banco exclusivo identificado como test.');
  const { pool } = createDatabase(process.env.TEST_DATABASE_URL);
  t.after(() => pool.end());
  assert.equal((await pool.query('select environment from application_environment where id=1')).rows[0]?.environment,'test');
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(`create temporary table users (id uuid,username text,display_name text,avatar_key text,status text,deletion_scheduled_at timestamptz) on commit drop;
      create temporary table wallet_accounts (user_id uuid,kind text,balance bigint) on commit drop;
      create temporary table game_match_archives (status text,ended_at timestamptz,participants jsonb,state jsonb) on commit drop;
      create temporary table game_match_stakes (entry_amount bigint,payouts jsonb,contributions jsonb,status text,settled_at timestamptz) on commit drop;`);
    const ids = Array.from({length:13},(_,i)=>`93089d02-0b34-4b78-9d3e-f2679c190b${String(i).padStart(2,'0')}`);
    for (let i=0;i<ids.length;i++) {
      await client.query("insert into users values($1,$2,$2,null,$3,null)",[ids[i],`Player${String(i).padStart(2,'0')}`,i===12?'suspended':'active']);
      await client.query("insert into wallet_accounts values($1,'user',$2)",[ids[i],100-i]);
    }
    const people = ids.slice(0,3).map((userId,seat)=>({userId,seat}));
    const archive = async (players,status='finished',old=false) => client.query(`insert into game_match_archives values($1,case when $4 then date_trunc('month',now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo' - interval '1 second' else now() end,$2,$3)`,[status,JSON.stringify(people),JSON.stringify({phase:'over',players}),old]);
    const tied = [{kind:'human',total:200},{kind:'human',total:200},{kind:'human',total:100}];
    await archive(tied);
    await archive([{kind:'bot',total:250},{kind:'human',total:200},{kind:'human',total:100}]);
    await archive(tied,'abandoned');
    await archive(tied,'finished',true);
    let result = await readRanking(client,{category:'wins',period:'month',page:1},ids[2]);
    assert.deepEqual(result.items.map(x=>[x.userId,x.value,x.position]),[[ids[0],1,1],[ids[1],1,1]]);
    assert.equal(result.own,null);
    result=await readRanking(client,{category:'wins',period:'all',page:1});
    assert.equal(result.items[0].value,2);
    const stake = async (entry,payouts,status='paid') => client.query('insert into game_match_stakes values($1,$2,$3,$4,now())',[entry,JSON.stringify(payouts),JSON.stringify(people),status]);
    await stake(10,[{seat:0,amount:30,house:false}]);
    await stake(5,[{seat:1,amount:15,house:false}]);
    await stake(5,[{seat:2,amount:15,house:true}]);
    await stake(100,[],'pending'); await stake(100,[],'refunded');
    result=await readRanking(client,{category:'losers',period:'month',page:1});
    assert.deepEqual(result.items.map(x=>[x.userId,x.value]),[[ids[2],20],[ids[1],5]]);
    result=await readRanking(client,{category:'richest',period:'month',page:1},ids[11]);
    assert.equal(result.period,'all'); assert.equal(result.items.length,10); assert.equal(result.hasMore,true);
    assert.equal(result.own.position,12); assert.equal(result.own.value,89);
    result=await readRanking(client,{category:'richest',period:'all',page:2},ids[0]);
    assert.equal(result.items.length,2); assert.equal(result.hasMore,false); assert.equal(result.own.position,1);
    await client.query('delete from users');
    for(const category of ['wins','richest','losers']) assert.deepEqual((await readRanking(client,{category,period:'all',page:1})).items,[]);
  } finally { await client.query('rollback'); client.release(); }
});
