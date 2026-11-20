import { test } from 'node:test';
import assert from 'node:assert/strict';
import { realtimeClientAddress } from '../dist/modules/matches/client-address.js';
import { readConfig } from '../dist/config.js';

test('Cloudflare distingue visitantes somente pelo proxy confiável em loopback', () => {
  for (const remote of ['127.0.0.1','::1','::ffff:127.0.0.1']) {
    assert.equal(realtimeClientAddress(remote,'203.0.113.20',true),'203.0.113.20');
    assert.equal(realtimeClientAddress(remote,'2001:db8::20',true),'2001:db8::20');
    assert.equal(realtimeClientAddress(remote,'203.0.113.20',false),remote);
    for (const header of [undefined,['203.0.113.20'],'203.0.113.20, 203.0.113.21','invalid'])assert.equal(realtimeClientAddress(remote,header,true),remote);
  }
  assert.equal(realtimeClientAddress('192.168.1.2','203.0.113.20',true),'192.168.1.2');
  const base={APP_ENV:'production',DATABASE_URL:'postgresql://localhost/test',WEB_ORIGIN:'https://example.com',CSRF_SECRET:'a'.repeat(64),AVATAR_STORAGE:'local',PRODUCTION_LOCAL_IMAGES:'true',AVATAR_LOCAL_DIR:'/isolated/production/images/avatars',TRUST_CLOUDFLARE_PROXY:'true'};
  assert.equal(readConfig(base).TRUST_CLOUDFLARE_PROXY,true);
  assert.throws(()=>readConfig({...base,API_HOST:'0.0.0.0'}));
  assert.throws(()=>readConfig({...base,APP_ENV:'development'}));
});
