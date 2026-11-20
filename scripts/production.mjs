import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync, chmodSync, cpSync, lstatSync, openSync, closeSync, realpathSync, symlinkSync, renameSync, unlinkSync } from 'node:fs';
import { resolve, join, dirname, relative, isAbsolute } from 'node:path';
import { randomBytes, createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { sourceRoot, envFile, baseEnv, delay, running, control, health, freePort, background, logFiles } from './runtime.mjs';

const marker = join(sourceRoot, '.production-home');
const home = resolve(process.env.CROEBET_PRODUCTION_DIR ?? (existsSync(marker) ? readFileSync(marker,'utf8').trim() : join(sourceRoot, '../croebet-production')));
const shared = join(home, 'shared'), current = join(home, 'current');
const command = process.argv[2] ?? 'status';
const workspace = existsSync(marker) ? JSON.parse(readFileSync(join(shared, 'installation.json'), 'utf8')).source : sourceRoot;
const configFile = join(shared, 'installation.json');
const secret = () => randomBytes(32).toString('hex');
const stamp = () => new Date().toISOString().replace(/[:.]/g,'-') + '-' + randomBytes(3).toString('hex');
const privateWrite = (path, value) => { writeFileSync(path, value, { mode:0o600 }); chmodSync(path,0o600); };
const jsonWrite = (path, value) => privateWrite(path, JSON.stringify(value,null,2)+'\n');
const installation = () => JSON.parse(readFileSync(configFile,'utf8'));
const activeRelease = () => existsSync(current) ? realpathSync(current) : null;
function assertHome() {
  const within = (parent, child) => { const path = relative(parent,child); return path === '' || (!path.startsWith('..') && !isAbsolute(path)); };
  if (within(workspace,home) || within(home,workspace)) throw new Error('Produção e fonte precisam ser pastas independentes, sem aninhamento.');
  if (existsSync(home) && realpathSync(home) !== home) throw new Error('A pasta de produção não pode ser um link simbólico.');
}
async function run(bin, args, { cwd=sourceRoot, env={}, output, input, capture=false }={}) {
  return new Promise((done, reject) => {
    const child = spawn(bin,args,{cwd,env:{...baseEnv(),...env},stdio:[input ?? 'ignore',output ?? (capture?'pipe':'inherit'),capture?'pipe':'inherit']});
    let result='';
    if(capture) child.stdout.on('data',chunk=>{result+=chunk;});
    // Não imprimir argumentos, configuração de banco nem stderr capturado: podem conter credenciais.
    child.once('error',()=>reject(new Error(`Não foi possível executar ${bin}.`)));
    child.once('exit',code=>code===0?done(result):reject(new Error(`${bin} falhou (${code}). Consulte o log da etapa.`)));
  });
}
function composeArgs() { return ['compose','--env-file',join(shared,'postgres.env'),'-f',join(home,'compose.yaml')]; }
const docker = (args,options={}) => run('docker',[...composeArgs(),...args],options);
async function client(url, release=activeRelease() ?? sourceRoot) {
  const {default:pg}=await import(pathToFileURL(join(release,'apps/api/node_modules/pg/lib/index.js')));
  const connection=new pg.Client({connectionString:url,connectionTimeoutMillis:5000,statement_timeout:30000});
  connection.on('error',()=>{});
  await connection.connect(); return connection;
}
function urls() {
  const runtime=envFile(join(shared,'api.env')),migration=envFile(join(shared,'migration.env'));
  const a=new URL(runtime.DATABASE_URL), b=new URL(migration.DATABASE_MIGRATION_URL);
  for(const u of [a,b]) if(u.hostname!=='127.0.0.1'||u.port!=='5433'||u.pathname!=='/croebet_production'||u.search||u.hash) throw new Error('Destino de produção inválido; esperado banco exclusivo em 127.0.0.1:5433/croebet_production.');
  if(a.username===b.username||a.password===b.password)throw new Error('Runtime e migrations exigem credenciais distintas.');
  if(runtime.APP_ENV!=='production'||runtime.API_PORT!=='6768'||runtime.API_HOST!=='127.0.0.1'||runtime.AVATAR_LOCAL_DIR!==join(shared,'images/avatars'))throw new Error('Configuração de produção incompatível.');
  return {runtime,migration};
}
async function identity(connection, environment) {
  const row=(await connection.query('select environment,current_database() as name from application_environment where id=1')).rows[0];
  if(row?.environment!==environment)throw new Error('Marcador de ambiente incompatível.');
  return row;
}
export async function guardMatches(connection) {
  // O mesmo lock de início/abandono da API elimina a corrida entre consultar e parar.
  await connection.query('select pg_advisory_lock(47851234)');
  const rows=(await connection.query("select count(*)::int as count from game_matches where status='playing'")).rows;
  if(rows[0].count)throw new Error(`Há ${rows[0].count} partida(s) em andamento. Publicação/parada recusada; aguarde a conclusão. Nenhuma partida foi encerrada.`);
}
async function facts(connection) {
  const result={};
  for(const table of ['users','wallet_accounts','wallet_operations','wallet_entries','game_matches','game_match_archives','game_match_archive_frames','media_assets','admin_audit','coupons']) {
    result[table]=(await connection.query(`select count(*)::text as count from ${table}`)).rows[0].count;
  }
  result.balances=(await connection.query("select coalesce(sum(balance),0)::text as balance from wallet_accounts where kind <> 'issuance'")).rows[0].balance;
  return result;
}
async function verifyImages(connection, imageRoot) {
  const avatarKeys=(await connection.query('select avatar_key as key from users where avatar_key is not null')).rows;
  const mediaKeys=(await connection.query("select id::text || '.webp' as key from media_assets where state='ready'")).rows;
  for(const [namespace,rows]of [['avatars',avatarKeys],['media',mediaKeys]])for(const row of rows) {
    if(!/^[0-9a-f-]+\.webp$/.test(row.key)||!existsSync(join(imageRoot,namespace,row.key)))throw new Error(`Imagem referenciada ausente em ${namespace}; importação/publicação interrompida.`);
  }
}
async function stopRuntime() {
  if(!await running(shared))return;
  await control(shared,{command:'stop'});
  for(let attempt=0;attempt<60;attempt++){if(!await running(shared))return;await delay(500);}
  throw new Error('O supervisor não encerrou. Banco e imagens não serão alterados.');
}
async function backup() {
  const dir=join(home,'backups',stamp()); mkdirSync(dir,{recursive:true,mode:0o700});
  const fd=openSync(join(dir,'database.dump'),'wx',0o600);
  try {await docker(['exec','-T','postgres','pg_dump','-U','croebet_migrator','-d','croebet_production','--format=custom','--no-owner','--no-acl'],{output:fd});}
  finally{closeSync(fd);}
  const check=openSync(join(dir,'database.dump'),'r');
  try{await docker(['exec','-T','postgres','pg_restore','--list'],{input:check,capture:true});}finally{closeSync(check);}
  cpSync(join(shared,'images'),join(dir,'images'),{recursive:true});
  for(const file of ['api.env','migration.env','postgres.env','web.env','installation.json'])cpSync(join(shared,file),join(dir,file));
  if(existsSync(join(shared,'tunnel-token')))cpSync(join(shared,'tunnel-token'),join(dir,'tunnel-token'));
  const c=await client(urls().migration.DATABASE_MIGRATION_URL);
  try{jsonWrite(join(dir,'manifest.json'),{createdAt:new Date().toISOString(),release:activeRelease(),facts:await facts(c),databaseSHA256:createHash('sha256').update(readFileSync(join(dir,'database.dump'))).digest('hex')});await verifyImages(c,join(dir,'images'));}finally{await c.end();}
  console.log(`Backup completo: ${dir}`);return dir;
}
async function snapshot() {
  const id=stamp(),release=join(home,'releases',id);mkdirSync(release,{recursive:true,mode:0o700});
  const files=(await run('git',['ls-files','--cached','--others','--exclude-standard','-z'],{cwd:workspace,capture:true})).split('\0').filter(Boolean);
  for(const file of new Set(files)) {
    if(file.split('/').some(part=>['.git','.data','node_modules','.next','dist','test-results','playwright-report'].includes(part)))continue;
    if(file.split('/').some(part=>part.startsWith('.env')&&!part.endsWith('.example')))continue;
    const src=join(workspace,file);if(!existsSync(src))continue;
    if(lstatSync(src).isSymbolicLink())throw new Error(`Publicação recusa link simbólico na fonte: ${file}`);
    const target=join(release,file);mkdirSync(dirname(target),{recursive:true});cpSync(src,target);
  }
  privateWrite(join(release,'.production-home'),home+'\n');
  jsonWrite(join(release,'release.json'),{id,commit:(await run('git',['rev-parse','HEAD'],{cwd:workspace,capture:true})).trim(),workingTree:(await run('git',['status','--porcelain'],{cwd:workspace,capture:true})).trim(),createdAt:new Date().toISOString()});
  console.log(`Preparando build independente: ${id}`);
  await run('pnpm',['install','--frozen-lockfile','--package-import-method=copy'],{cwd:release});
  const web=envFile(join(shared,'web.env'));
  await run('pnpm',['build'],{cwd:release,env:{...web,NODE_ENV:'production'}});
  return release;
}
async function grants(connection) {
  await connection.query('grant connect on database croebet_production to croebet_runtime');
  await connection.query('grant usage on schema public to croebet_runtime');
  await connection.query('grant select,insert,update,delete on all tables in schema public to croebet_runtime');
  await connection.query('grant usage,select on all sequences in schema public to croebet_runtime');
  await connection.query('revoke all on application_environment from croebet_runtime');
  await connection.query('grant select on application_environment to croebet_runtime');
  await connection.query('revoke create on schema public from public');
  await connection.query('alter default privileges in schema public grant select,insert,update,delete on tables to croebet_runtime');
  await connection.query('alter default privileges in schema public grant usage,select on sequences to croebet_runtime');
}
async function migrate(release, url, environment = "production") {
  const {runtime,migration}=urls();
  await run(process.execPath,['--experimental-strip-types','src/db/cli.ts','migrate'],{cwd:join(release,'apps/api'),env:{...runtime,...migration,APP_ENV:environment,NODE_ENV:environment==='test'?'test':'production',...(url?{DATABASE_URL:url,DATABASE_MIGRATION_URL:url}:{})}});
}
async function rehearsal(release, backupDir) {
  const {migration}=urls(),url=new URL(migration.DATABASE_MIGRATION_URL);
  const database='croebet_test_rehearsal_'+randomBytes(8).toString('hex');
  const c=await client(url.href);let created=false;
  try {
    await c.query(`create database ${database}`);created=true;
    const fd=openSync(join(backupDir,'database.dump'),'r');
    try{await docker(['exec','-T','postgres','pg_restore','-U','croebet_migrator','-d',database,'--no-owner','--no-acl','--exit-on-error'],{input:fd});}finally{closeSync(fd);}
    url.pathname='/'+database;
    const testCopy=await client(url.href,release);
    try{await testCopy.query("update application_environment set environment='test' where id=1 and environment='production'");}finally{await testCopy.end();}
    await migrate(release,url.href,'test');
    const staged=await client(url.href,release);
    try{await identity(staged,'test');const before=JSON.parse(readFileSync(join(backupDir,'manifest.json'),'utf8')).facts;if(JSON.stringify(await facts(staged))!==JSON.stringify(before))throw new Error('Migrations alteraram contagens/saldos protegidos no ensaio. Produção não foi migrada.');}finally{await staged.end();}
    console.log('Migrations validadas em cópia isolada do backup.');
  }finally{
    // Apenas a cópia temporária criada por esta execução é descartada.
    if(created){
      const isolated=await client(url.href,release);
      try {
        const marker=await identity(isolated,'test');
        const {assertResetAllowed}=await import(pathToFileURL(join(release,'apps/api/dist/db/reset-guard.js')));
        assertResetAllowed({APP_ENV:'test',NODE_ENV:'test',DB_RESET_ALLOWED_URL:url.href,DB_RESET_CONFIRM:database},marker.environment,marker.name,url.href);
      } finally { await isolated.end(); }
      await c.query(`drop database ${database}`);
    }
    await c.end();
  }
}
function activate(release) {
  const previous=activeRelease();
  if(previous)privateWrite(join(shared,'previous-release'),previous+'\n');
  const next=join(home,'current.next');if(existsSync(next))unlinkSync(next);
  symlinkSync(release,next);renameSync(next,current);
}
async function publish() {
  const release=await snapshot();
  const c=await client(urls().migration.DATABASE_MIGRATION_URL);
  try {
    await identity(c,'production');await guardMatches(c);await stopRuntime();
    const saved=await backup();await rehearsal(release,saved);await migrate(release);await grants(c);
    activate(release);
  }finally{await c.end();}
  await background(shared,'production',release);
}
async function setup() {
  if(existsSync(configFile))throw new Error('Produção já tem configuração. Use prod:deploy; setup nunca sobrescreve banco ou imagens.');
  await freePort(6767);await freePort(6768);await freePort(5433);await freePort(3001);
  const source=envFile(join(sourceRoot,'apps/api/.env')),postgres=envFile(join(sourceRoot,'.env'));
  const src=new URL(source.DATABASE_URL);
  if(source.APP_ENV!=='development'||src.hostname!=='127.0.0.1'||(src.port||'5432')!=='5432'||src.pathname!=='/'+postgres.POSTGRES_DB||(source.AVATAR_STORAGE??'local')!=='local')throw new Error('Origem de importação não corresponde ao PostgreSQL local e armazenamento local identificados.');
  const c=await client(source.DATABASE_URL,sourceRoot);
  try {
    await identity(c,'development');await guardMatches(c);
    mkdirSync(shared,{recursive:true,mode:0o700});chmodSync(home,0o700);
    for(const dir of ['images/avatars','images/media','logs','run'])mkdirSync(join(shared,dir),{recursive:true,mode:0o700});
    const migrationPassword=secret(),runtimePassword=secret();
    privateWrite(join(shared,'postgres.env'),`POSTGRES_PASSWORD=${migrationPassword}\n`);
    privateWrite(join(shared,'migration.env'),`DATABASE_MIGRATION_URL=postgresql://croebet_migrator:${migrationPassword}@127.0.0.1:5433/croebet_production\n`);
    privateWrite(join(shared,'api.env'),`APP_ENV=production\nAPI_HOST=127.0.0.1\nAPI_PORT=6768\nDATABASE_URL=postgresql://croebet_runtime:${runtimePassword}@127.0.0.1:5433/croebet_production\nWEB_ORIGIN=https://croebet.marcocuel.com\nCSRF_SECRET=${secret()}\nAVATAR_STORAGE=local\nPRODUCTION_LOCAL_IMAGES=true\nAVATAR_LOCAL_DIR=${join(shared,'images/avatars')}\n`);
    privateWrite(join(shared,'web.env'),'API_INTERNAL_URL=http://127.0.0.1:6768\nWEB_ORIGIN=https://croebet.marcocuel.com\nENFORCE_HTTPS=true\n');
    cpSync(join(sourceRoot,'ops/compose.production.yaml'),join(home,'compose.yaml'));
    jsonWrite(configFile,{source:sourceRoot,sourceDatabase:src.pathname.slice(1),state:'preparing',createdAt:new Date().toISOString()});
    // Conserva a base antiga e tira uma cópia completa, incluindo journal de migrations.
    const saved=join(home,'backups','initial-'+stamp());mkdirSync(saved,{recursive:true,mode:0o700});
    const fd=openSync(join(saved,'database.dump'),'wx',0o600);
    try{await run('docker',['compose','exec','-T','postgres','pg_dump','-U',postgres.POSTGRES_USER??'croebet','-d',postgres.POSTGRES_DB,'--format=custom','--no-owner','--no-acl'],{output:fd});}finally{closeSync(fd);}
    const avatarRoot=resolve(sourceRoot,'apps/api',source.AVATAR_LOCAL_DIR??'.data/avatars');
    for(const [namespace,path]of [['avatars',avatarRoot],['media',resolve(avatarRoot,'../media')]])if(existsSync(path))cpSync(path,join(shared,'images',namespace),{recursive:true});
    cpSync(join(shared,'images'),join(saved,'images'),{recursive:true});
    await verifyImages(c,join(saved,'images'));
    const originalFacts=await facts(c);jsonWrite(join(saved,'manifest.json'),{source:src.pathname,environment:'development',facts:originalFacts,createdAt:new Date().toISOString()});
    await docker(['up','-d','--wait','postgres']);
    const migration=urls().migration;
    const dest=await client(migration.DATABASE_MIGRATION_URL,sourceRoot);
    try {
      if((await dest.query("select to_regclass('public.users') as name")).rows[0].name)throw new Error('Destino já contém dados. Importação recusada.');
      const input=openSync(join(saved,'database.dump'),'r');
      try{await docker(['exec','-T','postgres','pg_restore','-U','croebet_migrator','-d','croebet_production','--no-owner','--no-acl','--exit-on-error'],{input});}finally{closeSync(input);}
      if(JSON.stringify(await facts(dest))!==JSON.stringify(originalFacts))throw new Error('A cópia diverge dos dados de origem.');
      await verifyImages(dest,join(shared,'images'));
      // Só a cópia nova muda de identidade; a origem permanece development intacta.
      await dest.query("update application_environment set environment='production' where id=1 and environment='development'");
      await dest.query(`create role croebet_runtime login password '${runtimePassword}'`);
      await grants(dest);
    }finally{await dest.end();}
    jsonWrite(configFile,{...installation(),state:'initialized',initialBackup:saved,facts:originalFacts});
    console.log(`Dados reais copiados e conferidos; origem preservada. Backup: ${saved}`);
  }finally{await c.end();}
  await publish();
}
async function stopOrBackup(wantBackup) {
  const c=await client(urls().migration.DATABASE_MIGRATION_URL);
  try{await identity(c,'production');await guardMatches(c);await stopRuntime();if(wantBackup)await backup();}
  finally{await c.end();}
}
async function status() {
  console.log(`Produção: ${home}`);
  if(!existsSync(configFile)){console.log('Ainda não configurada. Execute pnpm prod:setup.');return;}
  const state=await running(shared);
  console.log(JSON.stringify({installation:installation().state,supervisor:state,apiReady:await health(6768),webReady:await health(6767),tunnelToken:existsSync(join(shared,'tunnel-token'))},null,2));
  const c=await client(urls().runtime.DATABASE_URL);
  try{await identity(c,'production');console.log('Partidas:',(await c.query('select status,count(*) from game_matches group by status')).rows);}finally{await c.end();}
}
async function main() {
  assertHome();
  if(command==='status'){await status();return;}
  if(command==='logs'){logFiles(shared);return;}
  mkdirSync(home,{recursive:true,mode:0o700});
  const lock=join(home,'.operation-lock');
  try{mkdirSync(lock);}catch{throw new Error('Outra operação está em andamento (ou restou .operation-lock após interrupção). Confira os processos antes de remover o lock.');}
  try {
    privateWrite(join(lock,'owner'),String(process.pid));
    if(command==='setup')await setup();
    else {
      if(installation().state!=='initialized')throw new Error('Instalação incompleta; preserve backups e volume e consulte installation.json antes de recuperar.');
      urls();
      if(command==='deploy')await publish();
      else if(command==='start'){await docker(['up','-d','--wait','postgres']);const release=activeRelease();if(!release)throw new Error('Sem build publicado; execute prod:deploy.');await background(shared,'production',release);}
      else if(command==='stop')await stopOrBackup(false);
      else if(command==='backup')await stopOrBackup(true);
      else if(command==='rollback'){
        const previous=readFileSync(join(shared,'previous-release'),'utf8').trim();
        if(!previous.startsWith(join(home,'releases')+'/')||!existsSync(join(previous,'release.json')))throw new Error('Release anterior inválida.');
        await stopOrBackup(true);activate(previous);await background(shared,'production',previous);
      }else throw new Error('Comando inválido.');
    }
  }finally{unlinkSync(join(lock,'owner'));const {rmdirSync}=await import('node:fs');rmdirSync(lock);}
}
if(process.argv[1]&&resolve(process.argv[1])===new URL(import.meta.url).pathname)main().catch(error=>{console.error(error.message);console.error(`Operação ${command} não concluída. Consulte a etapa acima; banco e backups existentes foram preservados.`);process.exitCode=1;});
