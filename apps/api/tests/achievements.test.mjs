import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { achievementWriteSchema } from '@croebet/shared';
import { validateAchievementChanges, readOwnAchievements } from '../dist/modules/achievements/service.js';
import { createApp } from '../dist/app.js';
import { authRoutes } from '../dist/modules/auth/routes.js';

const level = (target)=>({id:randomUUID(),target,description:`Complete ${target} partidas.`});
const input = ()=>({name:'Só mais uma',icon:'playing-cards',metric:'games',active:true,order:0,version:0,levels:[level(1),level(25),level(100)]});
test('conquistas aceitam quantidade livre de níveis e exigem metas crescentes, identidade única e critério conhecido',()=>{
  assert.equal(achievementWriteSchema.parse(input()).imageUrl,'');
  const imageUrl=`/api/v1/media/${randomUUID()}.webp`;
  assert.equal(achievementWriteSchema.parse({...input(),imageUrl}).imageUrl,imageUrl);
  assert.equal(achievementWriteSchema.safeParse({...input(),levels:Array.from({length:180},(_,i)=>level(i+1))}).success,true);
  for(const change of [{levels:[]},{levels:[level(0)]},{levels:[level(5),level(5)]},{levels:[level(10),level(1)]},{metric:'sql'},{icon:'<script>'},{version:-1},{imageUrl:'https://example.com/badge.png'},{imageUrl:'javascript:alert(1)'}]) assert.equal(achievementWriteSchema.safeParse({...input(),...change}).success,false);
  const repeated=level(1);
  assert.equal(achievementWriteSchema.safeParse({...input(),levels:[repeated,{...repeated,target:2}]}).success,false);
});
test('metas já conquistadas e critério ficam protegidos; textos, publicação e novos níveis continuam editáveis',()=>{
  const write=input();
  const before={...write,id:randomUUID(),version:1,levels:write.levels.map((item,i)=>({...item,locked:i===0}))};
  assert.throws(()=>validateAchievementChanges(before,{...write,metric:'wins'}),{code:'AWARDED_METRIC'});
  assert.throws(()=>validateAchievementChanges(before,{...write,levels:write.levels.slice(1)}),{code:'AWARDED_LEVEL'});
  assert.throws(()=>validateAchievementChanges(before,{...write,levels:write.levels.map((item,i)=>i===0?{...item,target:2}:item)}),{code:'AWARDED_LEVEL'});
  assert.doesNotThrow(()=>validateAchievementChanges(before,{...write,active:false,name:'Novo nome',levels:[...write.levels.map(item=>({...item,description:'Novo texto'})),level(1000)]}));
  assert.doesNotThrow(()=>validateAchievementChanges({...before,levels:before.levels.map(item=>({...item,locked:false}))},{...write,metric:'wins'}));
});
test('consulta revalida conta e sessão na transação antes de conceder níveis e libera conexão ao falhar',async()=>{
  const calls=[];
  const client={query:async(sql)=>{calls.push(sql);return {rows:[]};},release:()=>calls.push('release')};
  await assert.rejects(readOwnAchievements({connect:async()=>client},randomUUID(),'revoked'),{code:'UNAUTHENTICATED'});
  assert.equal(calls.some(sql=>sql.startsWith('insert into achievement_unlocks')),false);
  assert.ok(calls.includes('rollback'));assert.equal(calls.at(-1),'release');
});
test('rotas de conquistas mantêm progresso privado e exigem admin e CSRF para edição',async t=>{
  const app=createApp(async()=>{});t.after(()=>app.close());
  const pool={query:async()=>({rows:[{environment:'test'}]})};
  await app.register(authRoutes,{pool,config:{APP_ENV:'test'}});
  assert.equal((await app.inject('/api/v1/me/achievements')).statusCode,401);
  assert.equal((await app.inject('/api/v1/admin/achievements')).statusCode,404);
  assert.equal((await app.inject(`/api/v1/admin/achievements/${randomUUID()}`)).statusCode,404);
  for(const method of ['POST','PATCH']) assert.equal((await app.inject({url:`/api/v1/admin/achievements${method==='PATCH'?'/'+randomUUID():''}`,method,payload:input()})).statusCode,403);
});

test('cores e imagens dos níveis são opcionais e validadas sem aceitar CSS ou URLs arbitrários',()=>{
  const original=input();
  const parsed=achievementWriteSchema.parse(original);
  assert.equal(parsed.color,null);
  assert.equal(parsed.levels[0].color,null);
  assert.equal(parsed.levels[0].imageUrl,'');
  const imageUrl=`/api/v1/media/${randomUUID()}.webp`;
  const custom=achievementWriteSchema.parse({...original,color:'#42C0E3',levels:original.levels.map(l=>({...l,color:'#a8ff60',imageUrl}))});
  assert.equal(custom.color,'#42C0E3');
  assert.equal(custom.levels[0].imageUrl,imageUrl);
  for(const color of ['red','#fff','url(x)','#12345678','']) {
    assert.equal(achievementWriteSchema.safeParse({...original,color}).success,false);
    assert.equal(achievementWriteSchema.safeParse({...original,levels:original.levels.map(l=>({...l,color}))}).success,false);
  }
  assert.equal(achievementWriteSchema.safeParse({...original,levels:original.levels.map(l=>({...l,imageUrl:'https://example.com/image.png'}))}).success,false);
});
