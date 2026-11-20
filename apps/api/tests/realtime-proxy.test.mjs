import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import cookie from '@fastify/cookie';
import { io } from 'socket.io-client';
import { createApp } from '../dist/app.js';
import { matchLive } from '../dist/modules/matches/live.js';

for (const trusted of [true,false]) test(`WebSocket: limite por visitante atrás da Cloudflare (confiável=${trusted})`, async t => {
  const listener=new EventEmitter();listener.query=async()=>({rows:[]});listener.release=()=>{};
  const pool={connect:async()=>listener,query:async()=>({rows:[]})};
  const app=createApp(async()=>{});await app.register(cookie);
  matchLive(app,pool,{sessionName:'session',csrfName:'csrf',csrfSecret:'test-secret-with-at-least-32-characters',environment:'production',trustCloudflareProxy:trusted,origins:['https://croebet.example'],limit:async()=>true});
  await app.listen({host:'127.0.0.1',port:0});
  const sockets=[];
  t.after(async()=>{for(const socket of sockets)socket.disconnect();await app.close();});
  const connect=address=>new Promise((done,reject)=>{
    const socket=io(`http://127.0.0.1:${app.server.address().port}`,{path:'/api/v1/realtime',addTrailingSlash:false,transports:['websocket'],extraHeaders:{Origin:'https://croebet.example','cf-connecting-ip':address},reconnection:false,timeout:2000});
    sockets.push(socket);socket.once('connect',()=>done(socket));socket.once('connect_error',reject);
  });
  for(let i=0;i<6;i++)await connect('203.0.113.20');
  await assert.rejects(connect('203.0.113.20'),/Muitas conexões/);
  if(trusted)assert.equal((await connect('203.0.113.21')).connected,true);
  else await assert.rejects(connect('203.0.113.21'),/Muitas conexões/);
});
