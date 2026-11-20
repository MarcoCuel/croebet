import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gameCreateSchema, createMatchSchema, gameWriteSchema } from '@croebet/shared';
import { createApp } from '../dist/app.js';
import { authRoutes } from '../dist/modules/auth/routes.js';
import { createGame, readGames, readGame, saveGame } from '../dist/modules/games/service.js';

const row = { id: '93089d02-0b34-4b78-9d3e-f2679c190b5c', slug: 'flip7', name: 'Nome cadastrado', description: 'Descrição cadastrada.', enabled: true, image_url: null, version: 1 };
const input = { name: 'Flip 7', enabled: true, imageUrl: null, version: 1 };
test('jogos aceitam capa ausente e recusam URLs executáveis e versões inválidas', () => {
  assert.equal(gameWriteSchema.safeParse(input).success, true);
  assert.equal(gameWriteSchema.parse({ ...input, description: '  Texto.\nOutra linha.  ' }).description, 'Texto.\nOutra linha.');
  assert.equal(gameWriteSchema.parse({ ...input, description: '' }).description, '');
  assert.equal(gameWriteSchema.safeParse({ ...input, description: 'x'.repeat(2001) }).success, false);
  for (const imageUrl of ['javascript:alert(1)', 'data:image/svg+xml,x', '//example.com/a', '/\\example.com/a']) assert.equal(gameWriteSchema.safeParse({ ...input, imageUrl }).success, false);
  for (const imageUrl of ['https://example.com/capa.webp', '/art/minha-capa.webp']) assert.equal(gameWriteSchema.safeParse({ ...input, imageUrl }).success, true);
  assert.equal(gameWriteSchema.safeParse({ ...input, version: 0 }).success, false);
});
test('consulta pública só permite jogos ativos e não inventa jogos ou imagens', async () => {
  const pool = { query: async sql => { assert.match(sql, /enabled=true/); return { rows: [row] }; } };
  assert.equal((await readGames(pool)).items[0].imageUrl, null);
  assert.equal((await readGame(pool, 'flip7')).name, 'Nome cadastrado');
  assert.equal((await readGame(pool, 'flip7')).description, 'Descrição cadastrada.');
  await assert.rejects(readGame({ query: async () => ({ rows: [] }) }, 'flip7'), { status: 404 });
});
test('endpoints administrativos de jogos exigem sessão e proteção de escrita', async t => {
  const app = createApp(async () => {}); t.after(() => app.close());
  const pool = { query: async sql => ({ rows: sql.includes('from games') ? [] : [{ environment: 'test' }] }) };
  await app.register(authRoutes, { pool, config: { APP_ENV: 'test' } });
  assert.equal((await app.inject('/api/v1/admin/games')).statusCode, 404);
  assert.equal((await app.inject('/api/v1/games/roleta')).statusCode, 404);
  assert.equal((await app.inject({ url: "/api/v1/admin/games", method: "POST", payload: { ...input, slug: "roleta" } })).statusCode, 403);
  assert.equal((await app.inject({ url: `/api/v1/admin/games/${row.id}`, method: 'PATCH', payload: input })).statusCode, 403);
});
function transaction(version, failAudit = false) {
  const calls = [];
  const client = { query: async (sql, params) => {
    calls.push(sql);
    if (sql.startsWith('select id, role')) return { rows: [{ id: 'admin', role: 'admin', status: 'active' }] };
    if (sql.startsWith('select 1 from sessions')) return { rows: [{}] };
    if (sql.startsWith('select * from games')) {
      assert.equal(sql, 'select * from games where id=$1 for update');
      assert.deepEqual(params, [row.id]);
      return { rows: [{ ...row, version }] };
    }
    if (sql.startsWith('update games')) { assert.match(sql, /where id=\$4/); assert.equal(params[3], row.id); }
    if (sql.startsWith('update games')) return { rows: [{ ...row, name: params[0], enabled: params[1], image_url: params[2], description: params[5], version: version + 1 }] };
    if (failAudit && sql.startsWith('insert into admin_audit')) throw new Error('audit unavailable');
    return { rows: [] };
  }, release: () => calls.push('release') };
  return { calls, pool: { connect: async () => client } };
}
test('edição recusa versão obsoleta; status e auditoria confirmam juntos', async () => {
  const stale = transaction(2);
  await assert.rejects(saveGame(stale.pool, 'admin', 'hash', row.id, input), { code: 'VERSION_CONFLICT' });
  assert.equal(stale.calls.some(sql => sql.startsWith('update')), false);
  assert.ok(stale.calls.includes('rollback'));
  const valid = transaction(1);
  const game = await saveGame(valid.pool, 'admin', 'hash', row.id, { ...input, enabled: false });
  assert.equal(game.enabled, false); assert.equal(game.version, 2); assert.equal(game.imageUrl, null);
  assert.ok(valid.calls.some(sql => sql.startsWith('insert into admin_audit')));
  assert.ok(valid.calls.includes('commit'));
  const failed = transaction(1, true);
  await assert.rejects(saveGame(failed.pool, 'admin', 'hash', row.id, input));
  assert.ok(failed.calls.includes('rollback')); assert.equal(failed.calls.includes('commit'), false);
});

test('consulta administrativa identifica jogo pelo UUID e consulta pública pelo slug', async () => {
  for (const admin of [true, false]) {
    const identifier = admin ? row.id : row.slug;
    const pool = { query: async (sql, params) => {
      assert.ok(sql.includes(`where ${admin ? 'id' : 'slug'}=$1`));
      assert.deepEqual(params, [identifier]);
      return { rows: [row] };
    } };
    assert.equal((await readGame(pool, identifier, admin)).id, row.id);
  }
});


test('cadastro aceita jogos em desenvolvimento sem permitir criar partidas sem motor', () => {
  const fields = { name: 'Roleta', description: 'Em desenvolvimento.', enabled: true, imageUrl: null };
  assert.equal(gameCreateSchema.parse({ ...fields, slug: 'roleta' }).slug, 'roleta');
  assert.equal(gameCreateSchema.parse({ ...fields, slug: ' Flip 7 ' }).slug, 'flip-7');
  assert.equal(gameCreateSchema.parse({ ...fields, slug: '-roleta-' }).slug, 'roleta');
  for (const slug of ['', '---', 'a'.repeat(101)]) {
    assert.equal(gameCreateSchema.safeParse({ ...fields, slug }).success, false);
  }
  assert.equal(createMatchSchema.safeParse({ requestId: row.id, game: 'roleta', capacity: 2, options: {mode:'classic',brutal:false} }).success, false);
});

test('criação persiste catálogo e auditoria na mesma transação, com rollback se auditoria falhar', async () => {
  for (const failAudit of [false, true]) {
    const tx = transaction(1, failAudit);
    const pool = { connect: async () => {
      const client = await tx.pool.connect();
      const query = client.query;
      client.query = async (sql, params) => {
        if (sql.startsWith('insert into games')) return { rows: [{...row,slug:params[0],name:params[1],description:params[2],enabled:params[3],image_url:params[4],seo:JSON.parse(params[5])}] };
        return query(sql, params);
      };
      return client;
    } };
    const input = gameCreateSchema.parse({name:'Roleta',slug:'roleta',description:'Em desenvolvimento.',enabled:true,imageUrl:null});
    if (failAudit) {
      await assert.rejects(createGame(pool,'admin','hash',input), /audit unavailable/);
      assert.ok(tx.calls.includes('rollback'));
      assert.equal(tx.calls.includes('commit'),false);
    } else {
      const created = await createGame(pool,'admin','hash',input);
      assert.equal(created.slug,'roleta');
      assert.equal(created.version,1);
      assert.ok(tx.calls.includes('commit'));
      assert.ok(tx.calls.some(sql=>sql.startsWith('insert into admin_audit')));
    }
  }
});
