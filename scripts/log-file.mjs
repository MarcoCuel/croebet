import { createWriteStream, existsSync, renameSync, rmSync, statSync } from 'node:fs';

export const LOG_LIMIT_BYTES = 10 * 1024 * 1024;
export const LOG_KEEP = 5;

export function rotateLog(path, { limit = LOG_LIMIT_BYTES, keep = LOG_KEEP } = {}) {
  if (!existsSync(path)) return false;
  try { if (statSync(path).size < limit) return false; } catch { return false; }
  for (let index = keep; index >= 1; index--) {
    const from = index === 1 ? path : `${path}.${index - 1}`;
    const to = `${path}.${index}`;
    if (!existsSync(from)) continue;
    if (existsSync(to)) rmSync(to, { force: true });
    renameSync(from, to);
  }
  return true;
}

/** Bounded append writer; rotates in place without restarting the supervised child. */
export function createLogSink(path, { limit = LOG_LIMIT_BYTES, keep = LOG_KEEP } = {}) {
  let stream;
  let bytes = 0;
  let rotating = false;
  let ended = false;
  const queue = [];

  function open() {
    rotateLog(path, { limit, keep });
    try { bytes = existsSync(path) ? statSync(path).size : 0; } catch { bytes = 0; }
    stream = createWriteStream(path, { flags: 'a', mode: 0o600 });
  }

  function append(data) {
    stream.write(data);
    bytes += Buffer.byteLength(typeof data === 'string' ? data : data.toString());
  }

  async function rotate() {
    if (rotating) return;
    rotating = true;
    const previous = stream;
    await new Promise(resolve => previous.end(resolve));
    rotateLog(path, { limit: 0, keep });
    open();
    for (const data of queue.splice(0)) if (!ended) append(data);
    rotating = false;
    if (ended) stream.end();
  }

  open();
  return {
    write(data) {
      if (ended) return;
      if (rotating) { queue.push(data); return; }
      append(data);
      if (bytes >= limit) void rotate();
    },
    end() {
      ended = true;
      if (!rotating) stream.end();
    },
  };
}
