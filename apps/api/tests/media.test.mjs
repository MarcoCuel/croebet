import { test } from 'node:test';
import { S3Client } from '@aws-sdk/client-s3';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { processMedia } from '../dist/modules/media/image.js';
import { createImageStorage } from '../dist/modules/storage/images.js';
import { readConfig } from '../dist/config.js';
import { createApp } from '../dist/app.js';
import { authRoutes } from '../dist/modules/auth/routes.js';
import { csrfToken } from '../dist/modules/auth/security.js';
import { validateMediaReferences } from '../dist/modules/media/service.js';
const config = readConfig({ APP_ENV: 'test', DATABASE_URL: 'postgresql://localhost/test', CSRF_SECRET: 'test-secret-with-at-least-32-characters' });
const image = () => sharp({create:{width:600,height:300,channels:4,background:{r:255,g:0,b:0,alpha:.5}}}).png().withMetadata().toBuffer();
test('mídia preserva proporção/transparência, limita dimensão e remove metadados; rejeita arquivo falso', async () => {
  const result = await processMedia(await image(), 'image/png');
  const metadata = await sharp(result.data).metadata();
  assert.equal(result.width,600); assert.equal(result.height,300); assert.equal(metadata.hasAlpha,true);
  assert.equal(metadata.format,'webp'); assert.equal(metadata.exif,undefined);
  const large = await sharp({create:{width:5000,height:1000,channels:3,background:'red'}}).png().toBuffer();
  assert.equal((await processMedia(large,'image/png')).width,4096);
  for (const [bytes,type] of [[await image(),'image/jpeg'],[Buffer.from('<svg/>'),'image/svg+xml'],[Buffer.alloc(0),'image/png'],[Buffer.alloc(10*1024*1024+1),'image/png']]) await assert.rejects(processMedia(bytes,type),{code:'INVALID_IMAGE'});
});
test('mídia e avatares usam espaços distintos e não aceitam caminhos arbitrários', async t => {
  const root = await mkdtemp(join(tmpdir(),'croebet-media-')); t.after(()=>rm(root,{recursive:true,force:true}));
  const cfg = {...config, AVATAR_LOCAL_DIR:join(root,'avatars')};
  const avatars=createImageStorage(cfg,'avatars'), media=createImageStorage(cfg,'media');
  const key=`${randomUUID()}.webp`;
  await avatars.put(key,Buffer.from('avatar')); await media.put(key,Buffer.from('media'));
  await media.remove(key); assert.equal((await avatars.get(key)).toString(),'avatar');
  await assert.rejects(media.get('../avatars/'+key));
});
test('validação rejeita referência excluída inclusive URL absoluta, preserva URL legada', async () => {
  const client={query:async()=>({rows:[]})};
  await validateMediaReferences(client,['/old.png','https://example.com/old.webp','']);
  await assert.rejects(validateMediaReferences(client,[`https://example.com/api/v1/media/${randomUUID()}.webp`]),{code:'MEDIA_UNAVAILABLE'});
});
test('rotas da biblioteca exigem admin/CSRF e revalidam mídia antes de responder 304', async t => {
  const app=createApp(async()=>{}); t.after(()=>app.close());
  const id=randomUUID(), token='a'.repeat(43), nonce='b'.repeat(43); let role='user', ready=true;
  const query=async(sql)=>{
    if(sql.includes('application_environment'))return {rows:[{environment:'test'}]};
    if(sql.startsWith('update sessions'))return {rows:[{id,role,status:'active'}]};
    if(sql.includes('auth_rate_limits'))return {rows:[{attempts:1}]};
    if(sql.includes('select 1 from media_assets'))return {rows:ready?[{}]:[]};
    if(sql.includes("where state='ready'"))return {rows:[]};
    throw Error(sql);
  };
  await app.register(authRoutes,{pool:{query},config,mediaStorage:{get:async()=>Buffer.from('webp')}});
  const headers={cookie:`croebet-session=${token}; croebet-csrf=${nonce}`,origin:config.WEB_ORIGIN,'x-csrf-token':csrfToken(config.CSRF_SECRET,nonce,token)};
  assert.equal((await app.inject({url:'/api/v1/admin/media',headers})).statusCode,404);
  assert.equal((await app.inject({url:'/api/v1/admin/media',method:'POST',headers:{...headers,'content-type':'image/png'},payload:await image()})).statusCode,404);
  role='admin'; assert.equal((await app.inject({url:'/api/v1/admin/media',headers})).statusCode,200);
  assert.equal((await app.inject({url:'/api/v1/admin/media',method:'POST',headers:{cookie:headers.cookie,'content-type':'image/png'},payload:await image()})).statusCode,403);
  const key=`${id}.webp`, url=`/api/v1/media/${key}`;
  assert.equal((await app.inject({url,headers:{'if-none-match':`"${key}"`}})).statusCode,304);
  ready=false; assert.equal((await app.inject({url,headers:{'if-none-match':`"${key}"`}})).statusCode,404);
});

test('adaptador S3 usa bucket privado com prefixos independentes para mídia e avatares', async t => {
  const commands=[];
  t.mock.method(S3Client.prototype,'send',async command=>{commands.push(command.input);return {Body:{transformToByteArray:async()=>new Uint8Array([1,2])}};});
  const cfg={...config,AVATAR_STORAGE:'s3',S3_BUCKET:'private-images',S3_ACCESS_KEY_ID:'test',S3_SECRET_ACCESS_KEY:'test'};
  const media=createImageStorage(cfg,'media'), avatars=createImageStorage(cfg,'avatars');
  const key=`${randomUUID()}.webp`;
  await media.put(key,Buffer.from([1,2]));await media.get(key);await media.remove(key);await avatars.put(key,Buffer.from([3]));
  assert.deepEqual(commands.map(c=>c.Key),[`media/${key}`,`media/${key}`,`media/${key}`,`avatars/${key}`]);
  assert.equal(commands[0].Bucket,'private-images');assert.equal(commands[0].ContentType,'image/webp');assert.equal(commands[0].ACL,undefined);
});
