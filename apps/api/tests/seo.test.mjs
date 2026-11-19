import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seoSettingsSchema, defaultSeoSettings, seoFieldsSchema } from '@croebet/shared';
import { readSeo, saveSeo } from '../dist/modules/admin/seo.js';
test('SEO: defaults, formatos e URLs seguros', () => {
  assert.deepEqual(seoFieldsSchema.parse({}), { title: '', description: '', image: '', imageAlt: '', index: true });
  for (const image of ['javascript:alert(1)', '//outro.site/a', 'http://outro.site/a']) assert.equal(seoFieldsSchema.safeParse({ image }).success, false);
  assert.equal(seoSettingsSchema.safeParse({ ...defaultSeoSettings, titleTemplate: 'Sem variável' }).success, false);
});
test('SEO: base vazia usa padrões e edição obsoleta não escreve', async () => {
  assert.deepEqual(await readSeo({ query: async () => ({ rows: [] }) }), defaultSeoSettings);
  const calls = [];
  const client = { query: async sql => {
    calls.push(sql);
    if (sql.startsWith('select id, role')) return { rows: [{ id: 'admin', role: 'admin', status: 'active' }] };
    if (sql.startsWith('select 1 from sessions')) return { rows: [{}] };
    if (sql.startsWith('select data,version')) return { rows: [{ version: 2 }] };
    return { rows: [] };
  }, release() {} };
  await assert.rejects(saveSeo({ connect: async () => client }, 'admin', 'hash', defaultSeoSettings), { code: 'VERSION_CONFLICT' });
  assert.ok(calls.includes('rollback'));
  assert.equal(calls.some(sql => /^(insert|update)/.test(sql)), false);
});
