import assert from 'node:assert/strict';
import { test } from 'node:test';
import nextConfig from '../next.config.mjs';

test('configuração do Next envia cabeçalhos de segurança e oculta a tecnologia', async () => {
  assert.equal(nextConfig.poweredByHeader, false);
  const [{ source, headers }] = await nextConfig.headers();
  assert.equal(source, '/:path*');
  const values = Object.fromEntries(headers.map(({ key, value }) => [key, value]));
  assert.equal(values['X-Content-Type-Options'], 'nosniff');
  assert.equal(values['X-Frame-Options'], 'DENY');
  assert.match(values['Content-Security-Policy'], /frame-ancestors 'none'/);
  assert.match(values['Permissions-Policy'], /camera=\(\)/);
});
