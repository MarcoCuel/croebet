import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { createDatabase } from '../../dist/db/client.js';
import { readPage, readPageLinks, savePage, deletePage } from '../../dist/modules/pages/service.js';
test('PostgreSQL: publicação, unicidade, edição concorrente e auditoria de páginas', async t => {
  if (!process.env.TEST_DATABASE_URL) throw Error('Configure TEST_DATABASE_URL com banco isolado migrado e identificado como test.');
  const { pool } = createDatabase(process.env.TEST_DATABASE_URL);
  let actor;
  let slug;
  t.after(async () => { try {
    if (slug) await pool.query('delete from pages where slug=any($1::text[])', [[slug, `${slug}-novo`]]);
    if (actor) { await pool.query('delete from sessions where user_id=$1', [actor]); await pool.query('delete from users where id=$1', [actor]); }
  } finally { await pool.end(); } });
  assert.equal((await pool.query('select environment from application_environment where id=1')).rows[0]?.environment, 'test');
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
  actor = (await pool.query("insert into users (username,display_name,password_hash,role) values ($1,$1,'fixture','admin') returning id", [`Pages_${suffix}`])).rows[0].id;
  const hash = randomBytes(32).toString("hex");
  await pool.query("insert into sessions (token_hash,user_id,expires_at,idle_expires_at) values ($1,$2,now()+interval '1 day',now()+interval '1 day')", [hash, actor]);
  slug = `pagina-${suffix}`;
  const input = { slug, title: 'Página', document: [{ tag: 'p', children: ['Texto público'] }], published: false, showInMenu: true, version: 0 };
  const draft = await savePage(pool, actor, hash, null, input);
  assert.ok(draft.createdAt); assert.ok(draft.updatedAt); assert.equal(draft.publishedAt, null);
  assert.equal(draft.lastEditedBy, `Pages_${suffix}`);
  await assert.rejects(readPage(pool, slug), { code: 'NOT_FOUND' });
  assert.equal((await readPageLinks(pool)).items.some(page => page.slug === slug), false);
  await assert.rejects(savePage(pool, actor, hash, null, input), { code: '23505' });
  const attempts = await Promise.allSettled([1, 2].map(() => savePage(pool, actor, hash, draft.id, { ...input, published: true, version: draft.version })));
  assert.equal(attempts.filter(item => item.status === 'fulfilled').length, 1);
  assert.equal(attempts.find(item => item.status === 'rejected').reason.code, 'VERSION_CONFLICT');
  const published = await readPage(pool, slug);
  assert.ok(published.publishedAt); assert.equal(published.createdAt, draft.createdAt);
  assert.equal((await readPageLinks(pool)).items.find(page => page.slug === slug).showInMenu, true);
  const renamed = await savePage(pool, actor, hash, draft.id, { ...input, slug: `${slug}-novo`, published: false, version: published.version });
  await assert.rejects(readPage(pool, slug), { code: 'NOT_FOUND' });
  await assert.rejects(readPage(pool, `${slug}-novo`), { code: 'NOT_FOUND' });
  assert.equal((await pool.query("select count(*)::int as count from admin_audit where target_id=$1 and action like 'page.%'", [draft.id])).rows[0].count, 3);
  const scheduled = await savePage(pool, actor, hash, renamed.id, { ...input, slug: renamed.slug, status: 'scheduled', publishAt: '2099-01-01T12:00:00Z', version: renamed.version });
  assert.equal(scheduled.authorId, actor); assert.equal(scheduled.status, 'scheduled');
  await assert.rejects(readPage(pool, renamed.slug), { code: 'NOT_FOUND' });
  await pool.query("update pages set publish_at='2020-01-01T12:00:00Z' where id=$1", [scheduled.id]);
  assert.equal((await readPage(pool, renamed.slug)).published, true);
  assert.equal((await readPageLinks(pool)).items.some(page => page.slug === renamed.slug), true);
  for (const status of ['private', 'pending', 'trash', 'draft']) {
    const current = await readPage(pool, renamed.id, true);
    await savePage(pool, actor, hash, renamed.id, { ...input, slug: renamed.slug, status, version: current.version });
    await assert.rejects(readPage(pool, renamed.slug), { code: 'NOT_FOUND' });
  }
  const current = await readPage(pool, renamed.id, true);
  await assert.rejects(deletePage(pool, actor, hash, renamed.id, current.version - 1), { code: 'VERSION_CONFLICT' });
  await deletePage(pool, actor, hash, renamed.id, current.version);
  await assert.rejects(readPage(pool, renamed.id, true), { code: 'NOT_FOUND' });
  assert.equal((await pool.query("select count(*)::int as count from admin_audit where target_id=$1 and action='page.deleted'", [draft.id])).rows[0].count, 1);

});
