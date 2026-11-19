import type { IncomingMessage, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { createMatchSchema, updateLobbySchema, matchCommandSchema, matchResultSchema, type Room, type MatchFrame, type MatchParticipant } from "@croebet/shared";
import { flip7Driver } from "../../api/src/modules/games/flip7/driver";
import { createGame, replaceWithBot, type Game } from "../../api/src/modules/games/flip7/engine";
import { execute } from "../../api/src/modules/matches/execution";

export const matchUsers=[{id:"93089d02-0b34-4b78-9d3e-f2679c190b5b",username:"Marco",displayName:"Marco",role:"user"},{id:"93089d02-0b34-4b78-9d3e-f2679c190b5d",username:"Beto",displayName:"Beto",role:"user"}];
export const fixtureUser=(req:IncomingMessage)=>matchUsers[req.headers.cookie?.includes("game-fixture-beto")?1:0];
export function matchesFixture() {
  const states=new Map<string,{room:Room;privateState?:Game;frames:MatchFrame[]}>();
  const receipts=new Map<string,unknown>();
  const commands:unknown[]=[];
  const streams=new Set<{response:ServerResponse;code:string|null;actor:string;version:number}>();
  let failAfterCommit=false;
  const directory=()=>({items:[...states.values()].map(s=>s.room).filter(room=>room.status==="lobby")});
  function replace(saved:{room:Room;privateState?:Game;frames:MatchFrame[]},seat:number){
    if(!saved.privateState)throw Error("Partida não iniciada");
    const before=flip7Driver.project(saved.privateState),state=replaceWithBot(saved.privateState,seat),version=saved.room.version+1;
    const humans=saved.room.participants.filter(person=>state.players[person.seat].kind==="human");
    const result=humans.length?execute(flip7Driver,state,version):{state,version,frames:[],status:"abandoned" as const};
    const frames:MatchFrame[]=[{action:{type:"replace",seat},state:flip7Driver.project(state),version},...result.frames];
    saved.privateState=result.state;saved.frames.push(...frames);
    saved.room={...saved.room,status:result.status,version:result.version,state:flip7Driver.project(result.state),hostId:humans.some(p=>p.userId===saved.room.hostId)?saved.room.hostId:humans[0]?.userId ?? saved.room.hostId};
    return {match:saved.room,before,frames};
  }
  function notify(){for(const stream of streams){
    if(!stream.code){stream.response.write(`event: lobbies\ndata: ${JSON.stringify(directory())}\n\n`);continue;}
    const saved=states.get(stream.code);if(!saved || saved.room.version<=stream.version)continue;
    if(saved.room.status!=="lobby" && !saved.room.participants.some(p=>p.userId===stream.actor)){stream.response.end();continue;}
    if(saved.room.status==="playing" && saved.room.state.players[saved.room.participants.find(p=>p.userId===stream.actor)!.seat].kind!=="human"){
      stream.response.write(`event: closed\ndata: ${JSON.stringify({message:"Um bot assumiu sua vaga."})}\n\n`);stream.response.end();continue;
    }
    const frames=saved.frames.filter(f=>f.version>stream.version);
    const reset=!frames.length || frames[0].version!==stream.version+1;
    stream.response.write(`event: room\ndata: ${JSON.stringify({room:saved.room,frames:reset?[]:frames,reset})}\n\n`);stream.version=saved.room.version;
  }}
  return {commands,states,failNextResponse(){failAfterCommit=true;},async handler(request:IncomingMessage,response:ServerResponse){
    const url=new URL(request.url ?? "/","http://fixture"),path=url.pathname;
    if(!path.startsWith("/api/v1/matches") && path!=="/api/v1/auth/csrf")return false;
    const actor=fixtureUser(request);
    response.setHeader("content-type","application/json");
    const send=(body:unknown,status=200)=>{response.statusCode=status;response.end(JSON.stringify(body));return true;};
    if(path==="/api/v1/auth/csrf")return send({token:"test-csrf"});
    if(path==="/api/v1/matches/live"){
      response.writeHead(200,{"content-type":"text/event-stream","cache-control":"no-cache, no-store, no-transform","connection":"keep-alive","x-accel-buffering":"no"});
      response.flushHeaders();
      const code=url.searchParams.get("code"),version=Number(url.searchParams.get("afterVersion") ?? 0);
      const stream={response,code,actor:actor.id,version};streams.add(stream);response.on("close",()=>streams.delete(stream));
      const saved=code?states.get(code):null;
      if(saved)response.write(`event: room\ndata: ${JSON.stringify({room:saved.room,frames:saved.frames.filter(f=>f.version>version),reset:false})}\n\n`);
      else response.write(`event: lobbies\ndata: ${JSON.stringify(directory())}\n\n`);
      return true;
    }
    if(path==="/api/v1/matches/lobbies")return send(directory());
    if(request.method==="GET" && path==="/api/v1/matches")return send({items:[...states.values()].map(s=>s.room).filter(room=>room.status==="playing" && room.participants.some(p=>p.userId===actor.id))});
    const code=path.split("/")[4];
    if(request.method==="GET")return states.has(code)?send(states.get(code)!.room):send({error:{message:"Sala não encontrada."}},404);
    let raw="";for await(const chunk of request)raw+=String(chunk);const body=JSON.parse(raw);
    const key=`${actor.id}:${body.commandId ?? body.requestId}`;
    if(receipts.has(key)){notify();return send(receipts.get(key));}
    const person=(seat:number):MatchParticipant=>({userId:actor.id,username:actor.username,displayName:actor.displayName,avatarUrl:null,seat});
    if(path==="/api/v1/matches"){
      const input=createMatchSchema.parse(body),code=(states.size+1).toString(16).padStart(12,"0").toUpperCase();
      const room:Room={id:randomUUID(),code,game:"flip7",rulesVersion:1,version:1,status:"lobby",state:null,capacity:input.capacity,options:input.options,hostId:actor.id,participants:[person(0)]};
      states.set(code,{room,frames:[]});receipts.set(key,room);notify();return send(room);
    }
    const saved=states.get(code);if(!saved)return send({error:{message:"Sala não encontrada."}},404);
    if(path.endsWith("/kick")){
      const target=saved.room.participants.find(p=>p.userId===body.targetUserId);
      if(saved.room.hostId!==actor.id || !target || target.userId===actor.id || body.expectedVersion!==saved.room.version)return send({error:{message:"Expulsão indisponível."}},409);
      if(saved.room.status==="lobby")saved.room={...saved.room,version:saved.room.version+1,participants:saved.room.participants.filter(p=>p.userId!==target.userId)};
      else replace(saved,target.seat);
      receipts.set(key,saved.room);notify();return send(saved.room);
    }
    if(path.endsWith("/update")){
      const settings=updateLobbySchema.parse(body);
      if(saved.room.status!=="lobby" || saved.room.hostId!==actor.id)return send({error:{message:"Somente o host pode alterar uma sala aberta."}},403);
      if(settings.expectedVersion!==saved.room.version || settings.capacity<saved.room.participants.length)return send({error:{message:"Confira os participantes e tente novamente."}},409);
      saved.room={...saved.room,version:saved.room.version+1,capacity:settings.capacity,options:settings.options};
      receipts.set(key,saved.room);notify();return send(saved.room);
    }
    if(path.endsWith("/join")){
      if(saved.room.status!=="lobby" || saved.room.participants.length>=saved.room.capacity)return send({error:{message:"Sala indisponível."}},409);
      if(!saved.room.participants.some(p=>p.userId===actor.id))saved.room={...saved.room,version:saved.room.version+1,participants:[...saved.room.participants,person(saved.room.participants.length)]};
      receipts.set(key,saved.room);notify();return send(saved.room);
    }
    if(path.endsWith("/leave")){
      const people=saved.room.participants.filter(p=>p.userId!==actor.id);
      saved.room={...saved.room,version:saved.room.version+1,participants:people,hostId:people[0]?.userId ?? actor.id};
      receipts.set(key,saved.room);notify();return send(saved.room);
    }
    if(path.endsWith("/start")){
      if(saved.room.hostId!==actor.id || saved.room.participants.length<2)return send({error:{message:"Aguarde mais jogadores."}},409);
      const game=createGame(saved.room.participants.map(p=>({name:p.username,kind:"human" as const})),42,saved.room.options);
      for(const value of [11,10]){const index=game.deck.findIndex(c=>c.type==="number" && c.value===value);game.deck.push(...game.deck.splice(index,1));}
      const version=saved.room.version+1,result=execute(flip7Driver,game,version);
      saved.privateState=result.state;saved.frames.push({action:{type:"start"},state:result.before,version},...result.frames);
      saved.room={...saved.room,status:result.status,version:result.version,state:flip7Driver.project(result.state)};
      receipts.set(key,saved.room);notify();return send(saved.room);
    }
    if(saved.room.status==="lobby" || !saved.privateState)return send({error:{message:"A partida não começou."}},409);
    commands.push(body);
    if(body.expectedVersion!==saved.room.version)return send({error:{message:"A partida mudou."}},409);
    const seat=saved.privateState.bonusChoice ?? saved.privateState.pending?.source ?? saved.privateState.turn;
    if(!path.endsWith("/abandon") && saved.room.participants.find(p=>p.userId===actor.id)?.seat!==seat)return send({error:{message:"Aguarde sua vez."}},403);
    if(path.endsWith("/abandon")){
      const member=saved.room.participants.find(p=>p.userId===actor.id)!;
      const reply=matchResultSchema.parse(replace(saved,member.seat));receipts.set(key,reply);notify();return send(reply);
    }
    const result=execute(flip7Driver,saved.privateState,saved.room.version,matchCommandSchema.parse(body).action);
    saved.privateState=result.state;saved.frames.push(...result.frames);saved.room={...saved.room,version:result.version,status:result.status,state:flip7Driver.project(result.state)};
    const reply=matchResultSchema.parse({match:saved.room,before:result.before,frames:result.frames});receipts.set(key,reply);
    if(failAfterCommit){failAfterCommit=false;return send({error:{message:"Resposta indisponível."}},503);}
    notify();return send(reply);
  }};
}
