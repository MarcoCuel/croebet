import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createLogSink, rotateLog } from '../log-file.mjs';

test('log rotaciona ao atingir o limite e mantém arquivos históricos', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'croebet-log-'));
  try {
    const file = join(dir, 'api.log');
    writeFileSync(file, 'a'.repeat(15));
    assert.equal(rotateLog(file, { limit: 10, keep: 2 }), true);
    assert.equal(readFileSync(`${file}.1`, 'utf8'), 'a'.repeat(15));
    const sink = createLogSink(file, { limit: 10, keep: 2 });
    sink.write('123456');
    sink.write('789012');
    await new Promise(resolve => setTimeout(resolve, 50));
    sink.end();
    assert.equal(readFileSync(`${file}.1`, 'utf8'), '123456789012');
    assert.equal(readFileSync(file, 'utf8'), '');
    assert.deepEqual(readdirSync(dir).sort(), ['api.log', 'api.log.1', 'api.log.2']);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
