import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createDatabase } from '../../dist/db/client.js';
import { readTableVisualSettings, saveTableVisualSettings } from '../../dist/modules/admin/table-visual-settings.js';

test('PostgreSQL: preset global durável, concorrência, autorização e auditoria atômica', async t => {
  if (!process.env.TEST_DATABASE_URL) throw Error('Configure TEST_DATABASE_URL com banco exclusivo de test migrado.');
  const { pool } = createDatabase(process.env.TEST_DATABASE_URL);
  const ids = [];
  t.after(async () => {
    try {
      await pool.query('delete from sessions where user_id=any($1::uuid[])', [ids]);
      await pool.query('delete from users where id=any($1::uuid[])', [ids]);
    } finally { await pool.end(); }
  });
  assert.equal((await pool.query('select environment from application_environment where id=1')).rows[0]?.environment, 'test');
  async function account(role) {
    const username = `Visual_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
    const id = (await pool.query('insert into users (username,display_name,password_hash,role) values ($1,$1,$1,$2) returning id', [username, role])).rows[0].id;
    ids.push(id);
    const hash = randomUUID().replaceAll('-', '').repeat(2);
    await pool.query("insert into sessions (token_hash,user_id,expires_at,idle_expires_at) values ($1,$2,now()+interval '1 day',now()+interval '1 day')", [hash, id]);
    return { id, hash };
  }
  const admin = await account('admin'), user = await account('user');
  const initial = await readTableVisualSettings(pool);
  const input = { ...initial, settings: { ...initial.settings, localCardScale: 1.25 } };
  await assert.rejects(saveTableVisualSettings(pool, user.id, user.hash, input), { code: 'NOT_FOUND' });
  await assert.rejects(saveTableVisualSettings(pool, admin.id, 'invalid', input), { code: 'NOT_FOUND' });
  const race = await Promise.allSettled([1.25, 1.5].map(localCardScale => saveTableVisualSettings(pool, admin.id, admin.hash, { ...input, settings: { ...input.settings, localCardScale } })));
  assert.equal(race.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(race.find(r => r.status === 'rejected').reason.code, 'VERSION_CONFLICT');
  const saved = race.find(r => r.status === 'fulfilled').value;
  assert.deepEqual(await readTableVisualSettings(pool), saved);
  const audit = (await pool.query("select details from admin_audit where actor_id=$1 and action='table.visual.updated'", [admin.id])).rows;
  assert.equal(audit.length, 1);
  assert.deepEqual(audit[0].details.after, saved.settings);
  assert.equal(JSON.stringify(audit).includes(admin.hash), false);
  // Force an audit error inside a rollback-only transaction to verify atomic persistence.
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query('alter table admin_audit rename to admin_audit_visual_test');
    const txPool = { connect: async () => ({ query: (sql, args) => client.query(sql === 'begin' ? 'savepoint visual_write' : sql === 'rollback' ? 'rollback to savepoint visual_write' : sql === 'commit' ? 'release savepoint visual_write' : sql, args), release() {} }) };
    await assert.rejects(saveTableVisualSettings(txPool, admin.id, admin.hash, { ...saved, settings: { ...saved.settings, angle: 40 } }), { code: '42P01' });
    assert.equal((await client.query('select version from table_visual_settings where id=1')).rows[0].version, saved.version);
  } finally { await client.query('rollback'); client.release(); }
  await saveTableVisualSettings(pool, admin.id, admin.hash, { version: saved.version, settings: initial.settings });
});
