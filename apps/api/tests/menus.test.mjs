import { test } from 'node:test';
import assert from 'node:assert/strict';
import { menuWriteSchema, validMenuUrl, navigationSchema, iconNameSchema, iconNodeSchema, lucideIconNames } from '@croebet/shared';
import { lucideIconNodes } from '@croebet/shared/lucide-icon-nodes';
import { resolveMenu, saveMenu, readNavigation } from '../dist/modules/menus/service.js';
import { createApp } from '../dist/app.js';
import { authRoutes } from '../dist/modules/auth/routes.js';
const id = '93089d02-0b34-4b78-9d3e-f2679c190b5b';
const pageId = '93089d02-0b34-4b78-9d3e-f2679c190b5c';
const custom = { id, type: 'custom', label: 'Comunidade', url: 'https://example.com', newTab: true };
test('menus aceitam destinos seguros e recusam scripts, links ambíguos e IDs duplicados', () => {
  for (const url of ['/', '/sobre', '/jogos?modo=1#regras', 'https://example.com', 'mailto:contato@example.com', 'tel:+5511999999999', '#conteudo']) assert.equal(validMenuUrl(url), true, url);
  for (const url of ['javascript:alert(1)', 'data:text/html,x', '//example.com', '/\\example.com', 'https://user:password@example.com', 'sobre', 'https://example.com\n', '']) assert.equal(validMenuUrl(url), false, url);
  assert.equal(menuWriteSchema.safeParse({ version: 1, items: [custom] }).success, true);
  assert.equal(menuWriteSchema.safeParse({ version: 1, items: [custom, custom] }).success, false);
  assert.equal(menuWriteSchema.safeParse({ version: 1, items: [{ ...custom, url: 'javascript:alert(1)' }] }).success, false);
  assert.equal(menuWriteSchema.safeParse({ version: 1, items: [] }).success, true);
});
test('ordem e rótulos são independentes; IDs seguem renomeação e rascunhos são ocultos', () => {
  const items = [{ ...custom }, { id: pageId, type: 'page', pageId, label: 'Quem somos', newTab: false }];
  assert.deepEqual(resolveMenu(items, [{ id: pageId, slug: 'novo-endereco', published: false }]).map(item => item.label), ['Comunidade']);
  const resolved = resolveMenu(items, [{ id: pageId, slug: 'novo-endereco', published: true }]);
  assert.deepEqual(resolved.map(item => item.label), ['Comunidade', 'Quem somos']);
  assert.equal(resolved[1].href, '/novo-endereco');
  assert.equal(resolveMenu([{ id, type: 'fixed', target: 'rankings', label: 'Ranking', newTab: false }], [])[0].disabled, false);
});
test('menu ausente não é tratado como um menu vazio confirmado', async () => {
  await assert.rejects(readNavigation({ query: async () => ({ rows: [] }) }), /Menus indisponíveis/);
});
test('catálogo completo tem nomes únicos e vetores válidos; ícones arbitrários são recusados', () => {
  assert.ok(lucideIconNames.length > 1800);
  assert.equal(new Set(lucideIconNames).size, lucideIconNames.length);
  assert.deepEqual(Object.keys(lucideIconNodes).sort(), [...lucideIconNames]);
  for (const name of lucideIconNames) {
    assert.equal(iconNameSchema.safeParse(name).success, true, name);
    assert.equal(iconNodeSchema.safeParse(lucideIconNodes[name]).success, true, name);
  }
  for (const icon of ['not-an-icon', '__proto__', '<script>', '', 123]) {
    assert.equal(menuWriteSchema.safeParse({ version: 1, items: [{ ...custom, icon }] }).success, false);
  }
  assert.equal(menuWriteSchema.safeParse({ version: 1, items: [{ ...custom, icon: null }] }).success, true);
  assert.equal(menuWriteSchema.safeParse({ version: 1, items: [{ ...custom, icon: 'star', iconNode: [] }] }).success, false);
});
test('ícone escolhido é projetado nos três tipos de destino; remoção deixa o item sem ícone', () => {
  const items = [
    { ...custom, icon: 'star' },
    { id: pageId, type: 'page', pageId, label: 'Sobre', newTab: false, icon: 'heart' },
    { id: '93089d02-0b34-4b78-9d3e-f2679c190b5d', type: 'fixed', target: 'home', label: 'Início', newTab: false, icon: 'cat' },
  ];
  const resolved = resolveMenu(items, [{ id: pageId, slug: 'sobre', published: true }]);
  assert.deepEqual(resolved.map(item => item.icon), ['star', 'heart', 'cat']);
  for (const item of resolved) assert.deepEqual(item.iconNode, lucideIconNodes[item.icon]);
  assert.equal(navigationSchema.safeParse({ main: resolved, footer: [] }).success, true);
  for (const item of resolveMenu(items.map(item => ({ ...item, icon: null })), [{ id: pageId, slug: 'sobre', published: true }])) {
    assert.equal(item.iconNode, undefined);
  }
});
test('visitantes não acessam configuração dos menus e mutações exigem CSRF', async t => {
  const app = createApp(async () => {}); t.after(() => app.close());
  const pool = { query: async () => ({ rows: [{ environment: 'test' }] }) };
  await app.register(authRoutes, { pool, config: { APP_ENV: 'test' } });
  assert.equal((await app.inject('/api/v1/admin/menus')).statusCode, 404);
  assert.equal((await app.inject({ url: '/api/v1/admin/menus/main', method: 'PATCH', payload: { version: 1, items: [] } })).statusCode, 403);
});
test('conflito de versão reverte sem apagar itens de outro administrador', async () => {
  const calls = [];
  const client = { query: async sql => {
    calls.push(sql);
    if (sql.startsWith('select id, role')) return { rows: [{ id, role: 'admin', status: 'active' }] };
    if (sql.startsWith('select 1 from sessions')) return { rows: [{}] };
    if (sql.startsWith('select location,items')) return { rows: [{ location: 'main', version: 2, items: [custom] }] };
    return { rows: [] };
  }, release: () => calls.push('release') };
  await assert.rejects(saveMenu({ connect: async () => client }, id, 'hash', 'main', { version: 1, items: [] }), { code: 'VERSION_CONFLICT' });
  assert.ok(calls.includes('rollback')); assert.equal(calls.at(-1), 'release');
  assert.equal(calls.some(sql => /^(update|insert)/.test(sql)), false);
});
