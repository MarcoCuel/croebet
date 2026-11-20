import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { guardMatches } from '../production.mjs';
import { freePort, running } from '../runtime.mjs';

test('parada/publicação adquire o lock de ciclo de vida antes de verificar partidas', async () => {
  const queries=[];
  const connection={query:async sql=>{queries.push(sql);return {rows:[{count:0}]};}};
  await guardMatches(connection);
  assert.match(queries[0],/pg_advisory_lock\(47851234\)/);
  assert.match(queries[1],/status='playing'/);
});
test('qualquer partida em andamento impede parada sem alterar dados', async () => {
  const queries=[];
  await assert.rejects(guardMatches({query:async sql=>{queries.push(sql);return {rows:[{count:2}]};}}),/2 partida.*recusada/);
  assert.equal(queries.length,2);
  assert.ok(queries.every(sql=>sql.startsWith('select ')));
});
test('porta ocupada é recusada sem encerrar seu servidor', async t => {
  const server=createServer();await new Promise(done=>server.listen(0,'127.0.0.1',done));
  t.after(()=>new Promise(done=>server.close(done)));
  await assert.rejects(freePort(server.address().port),/ocupada/);
  assert.equal(server.listening,true);
});
test('ausência de supervisor não é confundida com processo ativo', async t => {
  const root=mkdtempSync(join(tmpdir(),'croebet-control-'));
  t.after(()=>rmSync(root,{recursive:true,force:true}));
  assert.equal(await running(root),null);
});
