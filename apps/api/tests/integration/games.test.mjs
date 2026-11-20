import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createDatabase } from '../../dist/db/client.js';
import { createGame, readGame, saveGame } from '../../dist/modules/games/service.js';
import { readAudit } from '../../dist/modules/admin/service.js';
import { gameCreateSchema } from '@croebet/shared';

test('PostgreSQL: cadastro de jogo preserva catálogo, valida unicidade, permissões e auditoria', async t => {
  if (!process.env.TEST_DATABASE_URL) throw Error('Configure TEST_DATABASE_URL com banco isolado, migrado e identificado como test.');
  const { pool } = createDatabase(process.env.TEST_DATABASE_URL);
  const ids = [], games = [];
  let verified = false;
  t.after(async () => {
    try {
      if (!verified) return;
      await pool.query('delete from admin_audit where target_id=any($1::uuid[])', [games]);
      await pool.query('delete from games where id=any($1::uuid[])', [games]);
      await pool.query('delete from users where id=any($1::uuid[])', [ids]);
    } finally { await pool.end(); }
  });
  assert.equal((await pool.query('select environment from application_environment where id=1')).rows[0]?.environment, 'test');
  verified = true;
  async function account(role) {
    const name = `Game_${randomUUID().replaceAll('-', '').slice(0,12)}`;
    const id = (await pool.query('insert into users(username,display_name,password_hash,role) values($1,$1,$1,$2) returning id', [name,role])).rows[0].id;
    ids.push(id);
    const hash = randomUUID();
    await pool.query("insert into sessions(token_hash,user_id,expires_at,idle_expires_at) values($1,$2,now()+interval '1 day',now()+interval '1 day')", [hash,id]);
    return {id,hash};
  }
  const admin = await account('admin'), user = await account('user');
  const original = await readGame(pool, 'flip7', false);
  const input = gameCreateSchema.parse({slug:`teste-${randomUUID()}`,name:'Novo jogo',description:'Em desenvolvimento.',enabled:true,imageUrl:null});
  await assert.rejects(createGame(pool,user.id,user.hash,input), {code:'NOT_FOUND'});
  await assert.rejects(createGame(pool,admin.id,'revoked',input), {code:'NOT_FOUND'});
  const game = await createGame(pool,admin.id,admin.hash,input);
  games.push(game.id);
  assert.equal(game.version,1);
  assert.equal((await readGame(pool,input.slug)).id,game.id);
  assert.deepEqual(await readGame(pool,'flip7'),original);
  await assert.rejects(createGame(pool,admin.id,admin.hash,input), {code:'23505'});
  const audit = await readAudit(pool,game.id);
  assert.equal(audit.items.length,1);
  assert.equal(audit.items[0].action,'game.created');
  assert.equal(audit.items[0].details.after.slug,input.slug);
  await saveGame(pool,admin.id,admin.hash,game.id,{name:game.name,description:game.description,seo:game.seo,imageUrl:game.imageUrl,version:game.version,enabled:false});
  await assert.rejects(readGame(pool,input.slug),{code:'NOT_FOUND'});
  assert.equal((await readGame(pool,game.id,true)).enabled,false);
});
