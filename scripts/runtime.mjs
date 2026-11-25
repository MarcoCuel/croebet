import { spawn } from 'node:child_process';
import { createServer, createConnection } from 'node:net';
import { existsSync, readFileSync, mkdirSync, chmodSync, openSync, unlinkSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { createLogSink } from './log-file.mjs';

export const sourceRoot = fileURLToPath(new URL('../', import.meta.url));
export const envFile = path => existsSync(path) ? parseEnv(readFileSync(path, 'utf8')) : {};
export const baseEnv = () => Object.fromEntries(['PATH','HOME','TMPDIR','LANG','SHELL','USER'].filter(key => process.env[key]).map(key => [key, process.env[key]]));
export const delay = ms => new Promise(done => setTimeout(done, ms));
export function control(home, message) {
  return new Promise((done, reject) => {
    const socket = createConnection(join(home, 'run', 'control.sock'));
    let data = '';
    socket.setTimeout(5000, () => socket.destroy(new Error('Supervisor sem resposta.')));
    socket.on('connect', () => socket.end(JSON.stringify(message) + '\n'));
    socket.on('data', chunk => { data += chunk; });
    socket.on('end', () => { try { done(JSON.parse(data)); } catch { reject(new Error('Resposta inválida do supervisor.')); } });
    socket.on('error', reject);
  });
}
export async function running(home) {
  try { return await control(home, { command: 'status' }); }
  catch (error) { if (['ENOENT','ECONNREFUSED'].includes(error.code)) return null; throw error; }
}
export async function health(port) {
  try { const response = await fetch(`http://127.0.0.1:${port}/api/v1/health/ready`, { signal: AbortSignal.timeout(2000) }); return response.ok; }
  catch { return false; }
}
export async function freePort(port) {
  await new Promise((done, reject) => {
    const server = createServer();
    server.once('error', () => reject(new Error(`Porta ${port} ocupada. Nenhum processo foi encerrado.`)));
    server.listen(port, '127.0.0.1', () => server.close(done));
  });
}
export function logFiles(home) {
  const directory = join(home, 'logs');
  for (const name of existsSync(directory) ? readdirSync(directory).filter(name => name.endsWith('.log')).sort() : []) {
    console.log(`\n--- ${name} ---\n${readFileSync(join(directory, name), 'utf8').split('\n').slice(-60).join('\n')}`);
  }
}
export async function background(home, mode, release) {
  if (await running(home)) throw new Error('O ambiente já está iniciado.');
  mkdirSync(join(home, 'logs'), { recursive: true, mode: 0o700 });
  const log = openSync(join(home, 'logs', 'supervisor.log'), 'a', 0o600);
  const child = spawn(process.execPath, [join(release, 'scripts/runtime.mjs'), mode, 'run', home, release], {
    cwd: release, env: baseEnv(), detached: true, stdio: ['ignore', log, log],
  });
  child.unref();
  for (let attempt = 0; attempt < 120; attempt++) {
    const status = await running(home);
    if (status?.ready) { console.log(JSON.stringify(status, null, 2)); return; }
    await delay(500);
  }
  throw new Error(`Inicialização não ficou pronta. Consulte os logs em ${home}/logs.`);
}
async function supervise(mode, home, release, foreground) {
  const production = mode === 'production';
  const webPort = production ? 6767 : 3000, apiPort = production ? 6768 : 3001;
  if (await running(home)) throw new Error('O ambiente já está iniciado.');
  await freePort(webPort); await freePort(apiPort);
  for (const dir of ['run','logs']) mkdirSync(join(home, dir), { recursive: true, mode: 0o700 });
  const socketPath = join(home, 'run/control.sock');
  if (existsSync(socketPath)) unlinkSync(socketPath);
  const api = envFile(production ? join(home, 'api.env') : join(release, 'apps/api/.env'));
  const web = production ? envFile(join(home, 'web.env')) : envFile(join(release, 'apps/web/.env.local'));
  if (api.APP_ENV !== (production ? 'production' : 'development')) throw new Error('Ambiente da API incompatível.');
  const children = new Set();
  let stopping = false, ready = false, tunnelRunning = false;
  const logs = [];
  const server = createServer({ allowHalfOpen: true }, socket => {
    let data = '';
    socket.on('data', chunk => { data += chunk; if (data.length > 1024) socket.destroy(); });
    socket.on('end', () => {
      try {
        const request = JSON.parse(data);
        if (request.command === 'status') socket.end(JSON.stringify({ ready, mode, release, webPort, apiPort, tunnel: tunnelRunning }));
        else if (request.command === 'stop') { socket.end('{"stopping":true}'); void stop(); }
        else socket.end('{"error":"Comando inválido"}');
      } catch { socket.destroy(); }
    });
  });
  await new Promise((done, reject) => { server.once('error', reject); server.listen(socketPath, done); });
  chmodSync(socketPath, 0o600);
  async function stop(failed = false) {
    if (stopping) return;
    stopping = true; ready = false;
    console.log('Encerrando aplicações e túnel...');
    const signal = (child, name) => { try { process.kill(-child.pid, name); } catch (error) { if (error.code !== 'ESRCH') throw error; } };
    const exits = [...children].map(child => new Promise(done => { child.once('exit', done); signal(child, 'SIGTERM'); }));
    const force = setTimeout(() => { for (const child of children) signal(child, 'SIGKILL'); }, 20000);
    await Promise.all(exits); clearTimeout(force);
    await new Promise(done => server.close(done));
    if (existsSync(socketPath)) unlinkSync(socketPath);
    for (const log of logs) log.end();
    process.exitCode = failed ? 1 : 0;
  }
  function start(name, command, args, cwd, env) {
    const log = createLogSink(join(home, 'logs', `${name}.log`));
    logs.push(log); log.write(`\n[${new Date().toISOString()}] ${release}\n`);
    const child = spawn(command, args, { cwd, env: { ...baseEnv(), ...env }, detached: true, stdio: ['ignore','pipe','pipe'] });
    children.add(child);
    if (name === 'tunnel') child.once('spawn', () => { tunnelRunning = true; });
    for (const stream of [child.stdout, child.stderr]) stream.on('data', data => { log.write(data); if (foreground) process.stdout.write(data); });
    child.once('error', error => { children.delete(child); console.error(`Falha ao iniciar ${name}: ${error.message}`); void stop(true); });
    child.once('exit', code => { if (name === 'tunnel') tunnelRunning = false; children.delete(child); if (!stopping) { console.error(`${name} encerrou (${code}).`); void stop(true); } });
  }
  process.once('SIGINT', () => { void stop(); });
  process.once('SIGTERM', () => { void stop(); });
  if (production) {
    const releaseId = JSON.parse(readFileSync(join(release, 'release.json'), 'utf8')).id;
    start('api', process.execPath, ['dist/main.js'], join(release, 'apps/api'), { ...api, NODE_ENV:'production', API_HOST:'127.0.0.1', API_PORT:String(apiPort) });
    start('web', process.execPath, ['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(webPort)], join(release,'apps/web'), { ...web, NODE_ENV:'production', NEXT_PUBLIC_RELEASE_ID:releaseId });
  } else {
    // Não propagar URLs, segredos ou túneis de produção para o desenvolvimento.
    start('api', 'pnpm', ['--filter','@croebet/api','dev'], release, { ...api, NODE_ENV:'development', API_PORT:'3001', API_HOST:'127.0.0.1', WEB_ORIGIN:'http://localhost:3000' });
    start('web', 'pnpm', ['--filter','@croebet/web','dev','--port','3000'], release, { ...web, NODE_ENV:'development', API_INTERNAL_URL:'http://127.0.0.1:3001', WEB_ORIGIN:'http://localhost:3000' });
  }
  for (let attempt = 0; attempt < 180 && !stopping; attempt++) {
    if (await health(apiPort) && await health(webPort)) { ready = true; break; }
    await delay(500);
  }
  if (!ready) { await stop(true); return; }
  if (production && existsSync(join(home, 'tunnel-token'))) start('tunnel', 'cloudflared', ['tunnel','--no-autoupdate','--protocol','http2','run','--token-file',join(home,'tunnel-token')], release, {});
  console.log(`${mode} pronto: web ${webPort}, API ${apiPort}.${production && !existsSync(join(home, 'tunnel-token')) ? ' Túnel pendente: salve shared/tunnel-token.' : ''}`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [mode = 'development', command = 'foreground', homeArg, releaseArg] = process.argv.slice(2);
  const home = homeArg ?? join(sourceRoot, '.data/development'), release = releaseArg ?? sourceRoot;
  try {
    if (command === 'run' || command === 'foreground') await supervise(mode, home, release, command === 'foreground');
    else if (command === 'start') await background(home, mode, release);
    else if (command === 'status') console.log(await running(home) ?? 'Ambiente parado.');
    else if (command === 'logs') logFiles(home);
    else if (command === 'stop') { if (await running(home)) await control(home, { command:'stop' }); else console.log('Ambiente parado.'); }
    else throw new Error('Comando inválido.');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
