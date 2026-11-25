import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanupAuthState } from '../dist/modules/auth/cleanup.js';

function database(environment, fail = false) {
  const calls = [];
  const client = {
    release() {},
    async query(sql, values) {
      calls.push([sql, values]);
      if (sql === 'begin' || sql === 'commit' || sql === 'rollback') return { rows: [] };
      if (sql.startsWith('select environment')) return { rows: [{ environment }] };
      if (fail && sql.startsWith('delete from sessions')) throw Error('database unavailable');
      return { rows: [], rowCount: 2 };
    },
  };
  return { calls, pool: { connect: async () => client } };
}

test('limpeza remove sessões expiradas e limites antigos no ambiente correto', async () => {
  const db = database('test');
  assert.deepEqual(await cleanupAuthState(db.pool, 'test'), { sessions: 2, limits: 2 });
  assert.ok(db.calls.some(([sql]) => sql.startsWith('delete from sessions')));
  assert.ok(db.calls.some(([sql, values]) => sql.startsWith('delete from auth_rate_limits') && values[0] === 24));
  assert.ok(db.calls.some(([sql]) => sql === 'commit'));
});

test('limpeza recusa ambiente incompatível antes de apagar qualquer linha', async () => {
  const db = database('production');
  await assert.rejects(cleanupAuthState(db.pool, 'test'), /Ambiente/);
  assert.equal(db.calls.some(([sql]) => sql.startsWith('delete')), false);
  assert.ok(db.calls.some(([sql]) => sql === 'rollback'));
});

test('falha no banco reverte a limpeza', async () => {
  const db = database('test', true);
  await assert.rejects(cleanupAuthState(db.pool, 'test'), /database unavailable/);
  assert.ok(db.calls.some(([sql]) => sql === 'rollback'));
  assert.equal(db.calls.some(([sql]) => sql === 'commit'), false);
});
