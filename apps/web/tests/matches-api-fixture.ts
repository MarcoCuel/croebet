import type { IncomingMessage, ServerResponse, Server as HttpServer } from "node:http";
import { Server, type Socket } from "socket.io";
import { randomUUID } from "node:crypto";
import { realtimeRequestSchema, createMatchSchema, updateLobbySchema, matchCommandSchema, matchResultSchema, type Room, type MatchFrame, type MatchParticipant } from "@croebet/shared";
import { flip7Driver } from "../../api/src/modules/games/flip7/driver";
import { createGame, replaceWithBot, type Game } from "../../api/src/modules/games/flip7/engine";
import { execute } from "../../api/src/modules/matches/execution";

export const matchUsers=[{id:"93089d02-0b34-4b78-9d3e-f2679c190b5b",username:"Marco",displayName:"Marco",role:"user"},{id:"93089d02-0b34-4b78-9d3e-f2679c190b5d",username:"Beto",displayName:"Beto",role:"user"}];
export const fixtureUser=(req:IncomingMessage)=>matchUsers[req.headers.cookie?.includes("game-fixture-beto")?1:0];
export function matchesFixture() {
  const states=new Map<string,{room:Room;privateState?:Game;frames:MatchFrame[]}>();
  const receipts=new Map<string,unknown>();
  const commands:unknown[]=[];
  const invitations=new Map<string,{code:string;sender:string;target:string}>();
  const streams=new Set<{socket:Socket;code:string|null;actor:string;version:number}>();
  let failAfterCommit=false;
  let createdCount=0;
  let csrfCount=0;
  const directory=(actor:string)=>{
    for(const {room} of states.values())if(room.status==="lobby"){
      room.onlineUserIds=[...new Set([...streams].filter(s=>s.code===room.code).map(s=>s.actor))];
      room.pendingInvitations=[...invitations.values()].filter(i=>i.code===room.code && !room.participants.some(p=>p.userId===i.target)).map(i=>({userId:i.target,username:matchUsers.find(u=>u.id===i.target)?.username ?? "Ana",avatarUrl:null}));
    }
    const items=[...states.values()].map(s=>s.room).filter(room=>room.status==="lobby");
    return {items,current:items.find(room=>room.participants.some(person=>person.userId===actor)) ?? null};
  };
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
    stream.socket.emit("lobbies",directory(stream.actor));
    stream.socket.emit("invitations",{items:[...invitations.values()].filter(i=>i.target===stream.actor && states.get(i.code)?.room.status==="lobby").map(i=>({code:i.code,username:matchUsers.find(u=>u.id===i.sender)!.username,avatarUrl:null}))});
    if(!stream.code)continue;
    const saved=states.get(stream.code);
    if(!saved){stream.socket.emit("room-closed",{message:"Sala encerrada."});stream.code=null;continue;}
    if(saved.room.version<=stream.version && saved.room.status!=="lobby")continue;
    if(saved.room.status!=="lobby" && !saved.room.participants.some(p=>p.userId===stream.actor)){stream.socket.emit("room-closed",{message:"Sala indisponível."});stream.code=null;continue;}
    if(saved.room.status==="playing" && saved.room.state.players[saved.room.participants.find(p=>p.userId===stream.actor)!.seat].kind!=="human"){
      stream.socket.emit("room-closed",{message:"Um bot assumiu sua vaga."});stream.code=null;continue;
    }
    const frames=saved.frames.filter(f=>f.version>stream.version);
    const reset=!frames.length || frames[0].version!==stream.version+1;
    stream.socket.emit("room",{room:saved.room,frames:reset?[]:frames,reset});stream.version=saved.room.version;
  }}
  return {commands,states,disconnectUser(userId:string){for(const stream of streams)if(stream.actor===userId)stream.socket.conn.close();},attach(server:HttpServer){
    const io=new Server(server,{path:"/api/v1/realtime",addTrailingSlash:false,transports:["websocket"]});
    io.use((socket,next)=>{
      const csrf=socket.request.headers.cookie?.match(/(?:^|; )fixture-csrf=([^;]+)/)?.[1];
      next(csrf && socket.handshake.auth.csrf===csrf?undefined:new Error("CSRF must precede WebSocket upgrade"));
    });
    io.on("connection",socket=>{
      const actor=fixtureUser(socket.request).id;
      const stream={socket,actor,code:null as string|null,version:0};streams.add(stream);notify();
      socket.on("watch",(input,ack)=>{
        stream.code=input.code ?? null;stream.version=input.afterVersion ?? 0;
        notify();ack({ok:true,data:{ok:true}});
      });
      socket.on("request",async(value,ack)=>{
        try{
          const request=realtimeRequestSchema.parse(value);
          const suffix=request.type==="create"?"":request.type==="presence"?"/presence":`/${"code" in request?request.code:""}/${request.type==="command"?"commands":request.type}`;
          const response=await fetch(`http://127.0.0.1:3201/api/v1/matches${suffix}`,{method:"POST",headers:{cookie:socket.request.headers.cookie ?? "","content-type":"application/json"},body:JSON.stringify("input" in request?request.input:{})});
          const data=await response.json();
          ack(response.ok?{ok:true,data}:{ok:false,error:{code:"FIXTURE_ERROR",message:data.error.message}});
        }catch{ack({ok:false,error:{code:"FIXTURE_ERROR",message:"Ação indisponível."}});}
      });
      socket.on("disconnect",()=>{streams.delete(stream);notify();});
    });
    return ()=>{io.disconnectSockets(true);io.engine.close();};
  },failNextResponse(){failAfterCommit=true;},async handler(request:IncomingMessage,response:ServerResponse){
    const url=new URL(request.url ?? "/","http://fixture"),path=url.pathname;
    if(!path.startsWith("/api/v1/matches") && path!=="/api/v1/auth/csrf")return false;
    const actor=fixtureUser(request);
    response.setHeader("content-type","application/json");
    const send=(body:unknown,status=200)=>{response.statusCode=status;response.end(JSON.stringify(body));return true;};
    if(path==="/api/v1/auth/csrf"){
      const token=`test-csrf-${++csrfCount}`;
      response.setHeader("set-cookie",`fixture-csrf=${token}; Path=/; HttpOnly; SameSite=Lax`);
      return send({token});
    }
    if(path==="/api/v1/matches/lobbies")return send(directory(actor.id));
    if(path==="/api/v1/matches/presence")return send({items:[...invitations.values()].filter(i=>i.target===actor.id && states.get(i.code)?.room.status==="lobby" && !states.get(i.code)?.room.participants.some(p=>p.userId===actor.id)).map(i=>({code:i.code,username:matchUsers.find(u=>u.id===i.sender)!.username,avatarUrl:null}))});
    if(path.endsWith("/players")){
      const room=states.get(path.split("/")[4])?.room;
      const candidates=[...matchUsers.map(user=>({userId:user.id,username:user.username,avatarUrl:null,online:true})),{userId:"93089d02-0b34-4b78-9d3e-f2679c190b5e",username:"Ana",avatarUrl:null,online:false}];
      return send({items:candidates.filter(u=>!room?.participants.some(p=>p.userId===u.userId) && u.username.toLowerCase().includes((url.searchParams.get("q") ?? "").toLowerCase())).map(u=>({...u,invited:invitations.has(`${room?.code}:${u.userId}`)})),hasMore:false});
    }

    if(request.method==="GET" && path==="/api/v1/matches")return send({items:[...states.values()].map(s=>s.room).filter(room=>room.status==="playing" && room.participants.some(p=>p.userId===actor.id))});
    const code=path.split("/")[4];
    if(request.method==="GET")return states.has(code)?send(states.get(code)!.room):send({error:{message:"Sala não encontrada."}},404);
    let raw="";for await(const chunk of request)raw+=String(chunk);const body=raw?JSON.parse(raw):{};
    if(path.endsWith("/decline")){invitations.delete(`${code}:${actor.id}`);const saved=states.get(code);if(saved)saved.room.version++;notify();return send({ok:true});}
    if(path.endsWith("/invite")){invitations.set(`${code}:${body.targetUserId}`,{code,sender:actor.id,target:body.targetUserId});const saved=states.get(code);if(saved)saved.room.version++;notify();return send({ok:true});}
    const key=`${actor.id}:${body.commandId ?? body.requestId}`;
    if(receipts.has(key)){notify();return send(receipts.get(key));}
    const person=(seat:number):MatchParticipant=>({userId:actor.id,username:actor.username,displayName:actor.displayName,avatarUrl:null,seat});
    if(path==="/api/v1/matches"){
      if(directory(actor.id).current)return send({error:{message:"Você já está em um lobby."}},409);
      const input=createMatchSchema.parse(body),code=(++createdCount).toString(16).padStart(12,"0").toUpperCase();
      const room:Room={id:randomUUID(),code,game:"flip7",rulesVersion:1,version:1,status:"lobby",state:null,pendingInvitations:[],onlineUserIds:[],capacity:input.capacity,options:input.options,hostId:actor.id,participants:[person(0)]};
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
      if(directory(actor.id).current && directory(actor.id).current?.code!==code)return send({error:{message:"Você já está em um lobby."}},409);
      if(saved.room.status!=="lobby" || saved.room.participants.length>=saved.room.capacity)return send({error:{message:"Sala indisponível."}},409);
      if(!saved.room.participants.some(p=>p.userId===actor.id))saved.room={...saved.room,version:saved.room.version+1,participants:[...saved.room.participants,person(saved.room.participants.length)]};
      invitations.delete(`${code}:${actor.id}`);
      receipts.set(key,saved.room);notify();return send(saved.room);
    }
    if(path.endsWith("/leave")){
      const people=saved.room.participants.filter(p=>p.userId!==actor.id);
      if(!people.length){const closed={code:saved.room.code,status:"closed"};states.delete(code);receipts.set(key,closed);notify();return send(closed);}
      saved.room={...saved.room,version:saved.room.version+1,participants:people,hostId:people[0]?.userId ?? actor.id};
      receipts.set(key,saved.room);notify();return send(saved.room);
    }
    if(path.endsWith("/start")){
      if(saved.room.hostId!==actor.id || saved.room.participants.length<2 || (saved.room.status==="lobby" && (saved.room.pendingInvitations.length>0 || saved.room.participants.some(p=>![...streams].some(s=>s.code===code && s.actor===p.userId)))))return send({error:{message:"Aguarde mais jogadores."}},409);
      const game=createGame(saved.room.participants.map(p=>({name:p.username,kind:"human" as const})),42,saved.room.options);
      for(const value of [11,10]){const index=game.deck.findIndex(c=>c.type==="number" && c.value===value);game.deck.push(...game.deck.splice(index,1));}
      const version=saved.room.version+1,result=execute(flip7Driver,game,version);
      saved.privateState=result.state;saved.frames.push({action:{type:"start"},state:result.before,version},...result.frames);
      const {pendingInvitations: _pending,onlineUserIds: _online,...base}=saved.room as Extract<Room,{status:"lobby"}>;
      void _pending;void _online;
      saved.room={...base,status:result.status,version:result.version,state:flip7Driver.project(result.state)};
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
