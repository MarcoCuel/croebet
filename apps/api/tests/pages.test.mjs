import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pageWriteSchema, pageSlugSchema } from '@croebet/shared';
import { createApp } from '../dist/app.js';
import { authRoutes } from '../dist/modules/auth/routes.js';
import { readPage, readPageLinks, savePage } from '../dist/modules/pages/service.js';

const input = { slug: 'sobre', title: 'Sobre', document: [{ tag: 'p', children: ['Conteúdo'] }], published: true, showInMenu: true, version: 0 };
test('páginas recusam rotas reservadas, conteúdo executável, publicação vazia e versões inválidas', () => {
  for (const slug of ['perfil', 'admin', 'api', 'nova', 'jogos', 'a/b', 'Sobre']) assert.equal(pageSlugSchema.safeParse(slug).success, false);
  assert.equal(pageWriteSchema.safeParse(input).success, true);
  for (const change of [{ document: [] }, { version: -1 }, { document: [{ tag: 'script', children: ['alert(1)'] }] }, { document: [{ tag: 'p', children: [], onclick: 'alert(1)' }] }]) assert.equal(pageWriteSchema.safeParse({ ...input, ...change }).success, false);
  assert.equal(pageWriteSchema.safeParse({ ...input, published: false, document: [] }).success, true);
});
test('consulta pública filtra rascunhos no banco e distingue página ausente', async () => {
  const pool = { query: async sql => { assert.match(sql, /published=true/); return { rows: [] }; } };
  await assert.rejects(readPage(pool, 'privacidade'), { code: 'NOT_FOUND', status: 404 });
  assert.deepEqual(await readPageLinks(pool), { items: [] });
});
test('endpoints administrativos de páginas não concedem acesso a visitantes', async t => {
  const app = createApp(async () => {}); t.after(() => app.close());
  const pool = { query: async sql => {
    assert.match(sql, /application_environment/); return { rows: [{ environment: 'test' }] };
  } };
  await app.register(authRoutes, { pool, config: { APP_ENV: 'test' } });
  assert.equal((await app.inject('/api/v1/admin/pages')).statusCode, 404);
  assert.equal((await app.inject({ url: '/api/v1/admin/pages', method: 'POST', payload: input })).statusCode, 403);
});
test('edição obsoleta é revertida antes de alterar conteúdo ou auditoria', async () => {
  const calls = [];
  const client = { query: async sql => {
    calls.push(sql);
    if (sql.startsWith('select id, role')) return { rows: [{ id: 'admin', role: 'admin', status: 'active' }] };
    if (sql.startsWith('select 1 from sessions')) return { rows: [{}] };
    if (sql.startsWith('select * from pages')) return { rows: [{ version: 2 }] };
    return { rows: [] };
  }, release: () => calls.push('release') };
  await assert.rejects(savePage({ connect: async () => client }, 'admin', 'hash', 'sobre', { ...input, version: 1 }), { code: 'VERSION_CONFLICT' });
  assert.ok(calls.includes('rollback')); assert.equal(calls.at(-1), 'release');
  assert.equal(calls.some(sql => /^(update|insert)/.test(sql)), false);
});
