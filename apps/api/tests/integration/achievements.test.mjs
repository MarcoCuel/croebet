import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createDatabase } from '../../dist/db/client.js';
import { readAchievementMetrics } from '../../dist/modules/achievements/metrics.js';
import { readOwnAchievements, saveAchievement } from '../../dist/modules/achievements/service.js';

// Temporary read models and a rolled-back transaction; never resets or modifies real accounts.
test('PostgreSQL: conquistas usam histórico real, Brasília, empates, bots, prejuízos e concessão idempotente protegida',async t=>{
  if(!process.env.TEST_DATABASE_URL)throw Error('Configure TEST_DATABASE_URL com banco exclusivo identificado como test.');
  const {pool}=createDatabase(process.env.TEST_DATABASE_URL);t.after(()=>pool.end());
  assert.equal((await pool.query('select environment from application_environment where id=1')).rows[0]?.environment,'test');
  const client=await pool.connect();
  const user=randomUUID(),other=randomUUID(),hash='a'.repeat(64);
  try{
    await client.query('begin');
    await client.query(`create temporary table users(id uuid primary key,role text,status text) on commit drop;
      create temporary table sessions(user_id uuid,token_hash text,expires_at timestamptz,idle_expires_at timestamptz) on commit drop;
      create temporary table wallet_accounts(id uuid,user_id uuid) on commit drop;
      create temporary table daily_claims(account_id uuid,claimed_at timestamptz) on commit drop;
      create temporary table coupon_redemptions(account_id uuid,created_at timestamptz) on commit drop;
      create temporary table game_match_archives(status text,state jsonb,participants jsonb,ended_at timestamptz) on commit drop;
      create temporary table game_match_stakes(entry_amount bigint,payouts jsonb,contributions jsonb,status text,settled_at timestamptz) on commit drop;
      create temporary table achievement_definitions(like public.achievement_definitions including all) on commit drop;
      create temporary table achievement_levels(like public.achievement_levels including all) on commit drop;
      create temporary table achievement_unlocks(like public.achievement_unlocks including all) on commit drop;
      create temporary table admin_audit(actor_id uuid,target_id uuid,action text,reason text,details jsonb) on commit drop;`);
    await client.query("insert into users values($1,'admin','active'),($2,'user','active')",[user,other]);
    await client.query("insert into sessions values($1,$2,now()+interval '1 day',now()+interval '1 day')",[user,hash]);
    await client.query('insert into wallet_accounts values($1,$1),($2,$2)',[user,other]);
    await client.query(`insert into daily_claims values
      ($1,'2026-11-01T12:00Z'),($1,'2026-11-02T12:00Z'),($1,'2026-11-03T12:00Z'),
      ($1,'2026-11-19T02:59:59Z'),($1,'2026-11-19T03:00Z'),($1,'2026-11-20T03:00Z'),($2,'2026-11-01T12:00Z')`,[user,other]);
    const people=[{userId:user,seat:0},{userId:other,seat:1}];
    const game=async(kind,total,otherTotal,status='finished')=>client.query("insert into game_match_archives values($1,$2,$3,'2026-11-20T12:00Z')",[status,JSON.stringify({phase:'over',players:[{kind,total},{kind:'human',total:otherTotal}]}),JSON.stringify(people)]);
    await game('human',200,100);await game('human',200,200);await game('bot',250,100);await game('human',200,100,'abandoned');
    const stake=async(entry,payouts,status='paid')=>client.query("insert into game_match_stakes values($1,$2,$3,$4,'2026-11-20T12:00Z')",[entry,JSON.stringify(payouts),JSON.stringify(people),status]);
    await stake(10,[{seat:0,amount:20,house:false}]);await stake(5,[{seat:1,amount:10,house:false}]);await stake(5,[{seat:0,amount:10,house:true}]);await stake(100,[],'refunded');await stake(100,[],'pending');
    await client.query("insert into coupon_redemptions values($1,'2026-11-20T12:00Z'),($2,'2026-11-20T12:00Z')",[user,other]);
    const fixed={query:(sql,args)=>client.query(sql.replaceAll('now()','$2::timestamptz'),[...args,'2026-11-20T15:00Z'])};
    const {metrics,stats}=await readAchievementMetrics(fixed,user);
    assert.deepEqual(metrics,{games:2,wins:2,dailyDays:6,dailyStreak:3,coupons:1,losingGames:2});
    assert.deepEqual(stats,{currentStreak:3,games:2,lostCroins:10});
    const broken={query:(sql,args)=>client.query(sql.replaceAll('now()','$2::timestamptz'),[...args,'2026-11-23T15:00Z'])};
    assert.equal((await readAchievementMetrics(broken,user)).stats.currentStreak,0);
    assert.equal((await readAchievementMetrics(broken,user)).metrics.dailyStreak,3);
    const transactionPool={connect:async()=>({query:(sql,args)=>sql.startsWith('with days as')?fixed.query(sql,args):client.query(sql==='begin'?'savepoint achievement_write':sql==='commit'?'release savepoint achievement_write':sql==='rollback'?'rollback to savepoint achievement_write':sql,args),release(){}})};
    const levels=[1,2,10].map(target=>({id:randomUUID(),target,description:`Complete ${target} partidas.`}));
    let definition=await saveAchievement(transactionPool,user,hash,null,{name:'Só mais uma',icon:'playing-cards',metric:'games',active:true,order:0,version:0,levels});
    const first=await readOwnAchievements(transactionPool,user,hash);
    assert.equal(first.items[0].levels.filter(l=>l.unlockedAt).length,2);
    const again=await readOwnAchievements(transactionPool,user,hash);
    assert.deepEqual(again.items[0].levels,first.items[0].levels);
    const toWrite=()=>({...definition,levels:definition.levels.map(({id,target,description})=>({id,target,description}))});
    await assert.rejects(saveAchievement(transactionPool,user,hash,definition.id,{...toWrite(),levels:levels.slice(1)}),{code:'AWARDED_LEVEL'});
    await assert.rejects(saveAchievement(transactionPool,user,hash,definition.id,{...toWrite(),metric:'wins'}),{code:'AWARDED_METRIC'});
    // Description edits, adding levels and deactivation preserve earned dates.
    definition=await saveAchievement(transactionPool,user,hash,definition.id,{...toWrite(),active:false,levels:[...levels,{id:randomUUID(),target:20,description:'Mais uma etapa.'}]});
    assert.equal((await readOwnAchievements(transactionPool,user,hash)).items.length,0);
    assert.equal((await client.query('select count(*)::int as count from achievement_unlocks')).rows[0].count,2);
    await assert.rejects(saveAchievement(transactionPool,user,hash,definition.id,{...toWrite(),version:1}),{code:'VERSION_CONFLICT'});
    await client.query('delete from sessions');
    await assert.rejects(readOwnAchievements(transactionPool,user,hash),{code:'UNAUTHENTICATED'});
  }finally{await client.query('rollback');client.release();}
});
