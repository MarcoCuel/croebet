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
  const pool = { query: async sql => { assert.match(sql, /status='published'/); return { rows: [] }; } };
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
test('página expõe autoria e datas confirmadas, preservando ausência de histórico', async () => {
  const row = { id: '93089d02-0b34-4b78-9d3e-f2679c190b5c', slug: 'ajuda', title: 'Ajuda', document: [], published: false, show_in_menu: false, version: 1 };
  const historical = await readPage({ query: async () => ({ rows: [row] }) }, 'ajuda', true);
  assert.equal(historical.createdAt, null); assert.equal(historical.lastEditedBy, null);
  const date = new Date('2026-11-19T05:00:00Z');
  const edited = await readPage({ query: async () => ({ rows: [{ ...row, created_at: date, updated_at: date, published_at: date, last_edited_by: 'Tonho' }] }) }, 'ajuda', true);
  assert.equal(edited.createdAt, date.toISOString()); assert.equal(edited.updatedAt, date.toISOString());
  assert.equal(edited.publishedAt, date.toISOString()); assert.equal(edited.lastEditedBy, 'Tonho');
});
test('agendamento exige data e conteúdo; estados editoriais e autor são validados', () => {
  assert.equal(pageWriteSchema.safeParse({ ...input, status: 'scheduled', publishAt: null }).success, false);
  assert.equal(pageWriteSchema.safeParse({ ...input, status: 'scheduled', publishAt: '2099-01-01T12:00:00Z', document: [] }).success, false);
  for (const status of ['draft', 'pending', 'private']) assert.equal(pageWriteSchema.safeParse({ ...input, status, published: false, document: [] }).success, true);
  assert.equal(pageWriteSchema.safeParse({ ...input, status: 'unknown' }).success, false);
  assert.equal(pageWriteSchema.safeParse({ ...input, authorId: 'username' }).success, false);
});
test('agenda vencida é projetada como publicada sem depender de tarefa em background', async () => {
  const row = { id: '93089d02-0b34-4b78-9d3e-f2679c190b5c', slug: 'ajuda', title: 'Ajuda', document: input.document, published: false, show_in_menu: false, status: 'scheduled', version: 1 };
  const read = date => readPage({ query: async () => ({ rows: [{ ...row, publish_at: new Date(date) }] }) }, 'ajuda', true);
  const future = await read('2099-01-01T12:00:00Z');
  assert.equal(future.published, false); assert.equal(future.status, 'scheduled');
  const past = await read('2020-01-01T12:00:00Z');
  assert.equal(past.published, true); assert.equal(past.status, 'published');
  assert.equal(past.publishedAt, '2020-01-01T12:00:00.000Z');
});
function pageTransaction(before, author = { id: 'admin', username: 'Admin', display_name: 'Autor', role: 'admin', status: 'active' }) {
  const calls = [];
  const client = { query: async (sql, params) => {
    calls.push({ sql, params });
    if (sql.startsWith('select id, role')) return { rows: [{ id: 'admin', role: 'admin', status: 'active' }] };
    if (sql.startsWith('select 1 from sessions')) return { rows: [{}] };
    if (sql.startsWith('select * from pages')) return { rows: before ? [before] : [] };
    if (sql.startsWith('select id,username')) return { rows: [author] };
    return { rows: [] };
  }, release: () => {} };
  return { calls, pool: { connect: async () => client } };
}
test('data de agendamento passada e autor sem permissão são recusados antes da escrita', async () => {
  const schedule = pageTransaction(null);
  await assert.rejects(savePage(schedule.pool, 'admin', 'hash', null, { ...input, status: 'scheduled', publishAt: '2020-01-01T12:00:00Z' }), { code: 'INVALID_SCHEDULE' });
  assert.equal(schedule.calls.some(call => call.sql.startsWith('insert')), false);
  const author = pageTransaction(null, { id: 'user', username: 'User', display_name: 'User', role: 'user', status: 'active' });
  await assert.rejects(savePage(author.pool, 'admin', 'hash', null, { ...input, authorId: 'user' }), { code: 'INVALID_AUTHOR' });
  assert.equal(author.calls.some(call => call.sql.startsWith('insert')), false);
});
test('exclusão verifica versão, registra auditoria e confirma junto com a remoção', async () => {
  const { deletePage } = await import('../dist/modules/pages/service.js');
  const before = { id: '93089d02-0b34-4b78-9d3e-f2679c190b5c', slug: 'ajuda', title: 'Ajuda', document: [], published: false, show_in_menu: false, version: 2 };
  const stale = pageTransaction(before);
  await assert.rejects(deletePage(stale.pool, 'admin', 'hash', 'ajuda', 1), { code: 'VERSION_CONFLICT' });
  assert.equal(stale.calls.some(call => call.sql.startsWith('delete')), false);
  const valid = pageTransaction(before);
  assert.deepEqual(await deletePage(valid.pool, 'admin', 'hash', 'ajuda', 2), { ok: true });
  assert.ok(valid.calls.some(call => call.sql.startsWith('delete from pages')));
  assert.ok(valid.calls.some(call => call.params?.includes('page.deleted')));
  assert.equal(valid.calls.at(-1).sql, 'commit');
});
