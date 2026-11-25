import { test } from "node:test";
import assert from "node:assert/strict";
import { notificationRefresh, matchNotificationSchema } from "../dist/modules/matches/notifications.js";

const table = { actor: "alice", code: "A", watching: true, directoryWatching: false };
const directory = { ...table, code: undefined, directoryWatching: true };
const enabled = value => Object.keys(value).filter(key => value[key]).sort();
test("jogada atualiza apenas observadores da sala, sem listagens, convites ou presença", () => {
  const event = {kind:"room",code:"A",directory:false,matches:false};
  assert.deepEqual(enabled(notificationRefresh(event,table)),["room"]);
  assert.deepEqual(enabled(notificationRefresh(event,{...table,code:"B"})),[]);
  assert.deepEqual(enabled(notificationRefresh(event,directory)),[]);
  assert.deepEqual(enabled(notificationRefresh(event,{...table,actor:null})),["room"]);
});
test("mudanças de ciclo de vida atualizam listagens somente para quem as acompanha", () => {
  const event={kind:"room",code:"B",directory:true,matches:true};
  assert.deepEqual(enabled(notificationRefresh(event,table)),[]);
  assert.deepEqual(enabled(notificationRefresh(event,directory)),["directory","matches"]);
  assert.deepEqual(enabled(notificationRefresh({...event,code:"A"},{...table,directoryWatching:true})),["directory","matches","room"]);
});
test("convites, controle de vagas e revogação são direcionados à conta afetada", () => {
  assert.deepEqual(enabled(notificationRefresh({kind:"invitation",code:"B",userId:"alice"},table)),["invitations"]);
  assert.deepEqual(enabled(notificationRefresh({kind:"invitation",code:"B",userId:"bob"},table)),[]);
  assert.deepEqual(enabled(notificationRefresh({kind:"account",userId:"alice"},directory)),["directory","personal","presence"]);
  assert.deepEqual(enabled(notificationRefresh({kind:"account",userId:"bob"},directory)),[]);
  assert.deepEqual(enabled(notificationRefresh({kind:"auth",userId:"alice"},table)),["auth"]);
  assert.deepEqual(enabled(notificationRefresh({kind:"auth",userId:"bob"},table)),[]);
});
test("presença não consulta convites nem mesas não relacionadas; payloads inválidos são recusados", () => {
  assert.deepEqual(enabled(notificationRefresh({kind:"presence",code:"B"},table)),[]);
  assert.deepEqual(enabled(notificationRefresh({kind:"presence",code:"A"},table)),["room"]);
  assert.equal(matchNotificationSchema.safeParse({kind:"room",code:"A"}).success,false);
  assert.equal(matchNotificationSchema.safeParse({kind:"room",code:"A",directory:false,matches:false,state:{deck:[]}}).success,false);
});

test("listagem consulta somente resumo e controles, sem projetar estado privado", async () => {
  const { listMatches } = await import("../dist/modules/matches/service.js");
  const { randomUUID } = await import("node:crypto");
  const id=randomUUID(),actor=randomUUID();const queries=[];
  const client={
    release(){},
    async query(sql){
      queries.push(sql);
      if(sql.includes("array(select p.controller_id"))return {rows:[{
        id,code:"ABCDEF123456",game_slug:"flip7",owner_id:actor,rules_version:1,version:5,
        entry_amount:"0",capacity:6,options:{mode:"classic",brutal:false},round:2,controller_ids:[actor],
      }]};
      if(sql.includes("select p.match_id"))return {rows:[{match_id:id,user_id:actor,username:"Marco",display_name:"Marco",avatar_key:null,seat:0}]};
      return {rows:[]};
    },
  };
  const summary=(await listMatches({connect:async()=>client},null)).items[0];
  assert.equal(summary.round,2);assert.deepEqual(summary.controllerIds,[actor]);
  assert.equal("state" in summary,false);
  assert.equal(queries.some(sql=>sql.includes("select m.*")),false);
  assert.equal(summary.participants[0].username,"Marco");
});

test("limite operacional é configurável, preserva padrão 200 e rejeita valores inválidos", async () => {
  const { readConfig } = await import("../dist/config.js");
  const env={APP_ENV:"development",DATABASE_URL:"postgres://user:pass@localhost/croebet",CSRF_SECRET:"test-secret-with-at-least-32-characters"};
  assert.equal(readConfig(env).REALTIME_MAX_CONNECTIONS,200);
  assert.equal(readConfig({...env,REALTIME_MAX_CONNECTIONS:"350"}).REALTIME_MAX_CONNECTIONS,350);
  assert.throws(()=>readConfig({...env,REALTIME_MAX_CONNECTIONS:"0"}));
});

test("turnos acompanham só as partidas da conta, mesmo sem observar mesa ou diretório", () => {
  const site={actor:"alice",watching:false,directoryWatching:false,personalCodes:new Set(["A"])};
  const event={kind:"room",code:"A",directory:false,matches:false};
  assert.deepEqual(enabled(notificationRefresh(event,site)),["personal"]);
  assert.deepEqual(enabled(notificationRefresh({...event,code:"B"},site)),[]);
  assert.deepEqual(enabled(notificationRefresh(event,{...site,actor:null})),[]);
  assert.deepEqual(enabled(notificationRefresh({kind:"account",userId:"alice"},site)),["personal","presence"]);
});

test("resumo da conta identifica decisões pendentes de Flip 7 e turno de Love Letter sem vazar cartas", async () => {
  const {listPersonalMatches}=await import("../dist/modules/matches/service.js");
  const {flip7Driver}=await import("../dist/modules/games/flip7/driver.js");
  const {createLove}=await import("../dist/modules/games/love-letter/engine.js");
  const {randomUUID}=await import("node:crypto");
  const actor=randomUUID();
  const state=flip7Driver.create({setup:[{name:"Ana",kind:"human"},{name:"Beto",kind:"human"},{name:"Bot 1",kind:"normal"}],options:{mode:"classic",brutal:false}},"Ana");
  const index=state.deck.findIndex(card=>card.type==='freeze');
  state.pending={source:1,card:state.deck.splice(index,1)[0],give:false};
  assert.equal('bonusChoice' in state,false);
  const love=createLove([{name:"Ana",kind:"human"},{name:"Beto",kind:"human"},{name:"Bot 1",kind:"normal"}],"classic");
  love.turn=1;
  const base={rules_version:1,controller_id:actor,seat:1,status:'playing',development:false,only_bots:false};
  const rows=[{...base,id:randomUUID(),code:'ABCDEF123456',game_slug:'flip7',game_name:'Flip 7',state},
    {...base,id:randomUUID(),code:'ABCDEF654321',game_slug:'love-letter',game_name:'Love Letter',state:love}];
  const client={release(){},async query(sql,values){
    if(sql.includes('select m.*,g.name')){assert.deepEqual(values,[actor]);return {rows};}
    if(sql.includes('u.avatar_key')){
      assert.deepEqual(values,[rows.map(row=>row.id)]);
      return {rows:[{match_id:rows[0].id,user_id:actor,seat:1,username:'ana',display_name:'Ana',avatar_key:null}]};
    }
    return {rows:[]};
  }};
  const result=await listPersonalMatches({connect:async()=>client},actor);
  assert.deepEqual(result.items.map(item=>item.yourTurn),[true,true]);
  assert.deepEqual(result.items.map(item=>item.turnKey),['1:1','1:1']);
  assert.deepEqual(result.items[0].participants,[
    {userId:null,seat:0,username:'Ana',displayName:'Ana',avatarUrl:null,bot:false},
    {userId:actor,seat:1,username:'ana',displayName:'Ana',avatarUrl:null,bot:false},
    {userId:null,seat:2,username:'Bot 1',displayName:'Bot 1',avatarUrl:null,bot:true},
  ]);
  assert.deepEqual(result.items[1].participants.map(person=>[person.seat,person.displayName,person.bot]),[[0,'Ana',false],[1,'Beto',false],[2,'Bot 1',true]]);
  assert.ok(result.items.every(item=>Object.keys(item).sort().join(',')==='code,development,game,gameName,lobbyExpiresAt,participants,status,turnKey,yourTurn'));
  for(const row of rows)row.controller_id=null;
  const withoutControl=await listPersonalMatches({connect:async()=>client},actor);
  assert.ok(withoutControl.items.every(item=>!item.yourTurn && item.turnKey===null));
});

 test("resumo de lobby inclui bots previstos, inclusive mesas somente de bots",async()=>{
  const {listPersonalMatches}=await import("../dist/modules/matches/service.js");
  const {randomUUID}=await import("node:crypto");
  const actor=randomUUID(),id=randomUUID();
  const row={id,code:"ABCDEF123456",game_slug:"flip7",game_name:"Flip 7",status:"lobby",development:true,bots:3,only_bots:false,state:null};
  const client={release(){},async query(sql){
    if(sql.includes("select m.*,g.name"))return {rows:[row]};
    if(sql.includes("u.avatar_key"))return {rows:row.only_bots?[]:[{match_id:id,user_id:actor,seat:0,username:"ana",display_name:"Ana",avatar_key:null}]};
    return {rows:[]};
  }};
  const pool={connect:async()=>client};
  const mixed=(await listPersonalMatches(pool,actor)).items[0];
  assert.deepEqual(mixed.participants.map(p=>[p.seat,p.displayName,p.bot]),[[0,"Ana",false],[1,"Bot 1",true],[2,"Bot 2",true],[3,"Bot 3",true]]);
  row.only_bots=true;
  const bots=(await listPersonalMatches(pool,actor)).items[0];
  assert.deepEqual(bots.participants.map(p=>[p.seat,p.userId,p.bot]),[[0,null,true],[1,null,true],[2,null,true]]);
 });

test("resumo de lobby associa nome e avatar ao assento, mesmo com lacunas",async()=>{
  const {listPersonalMatches}=await import("../dist/modules/matches/service.js");
  const {randomUUID}=await import("node:crypto");
  const actor=randomUUID(),id=randomUUID();
  const row={id,code:"ABCDEF654321",game_slug:"flip7",game_name:"Flip 7",status:"lobby",development:true,bots:1,only_bots:false,state:null};
  const client={release(){},async query(sql){
    if(sql.includes("select m.*,g.name"))return {rows:[row]};
    if(sql.includes("u.avatar_key"))return {rows:[
      {match_id:id,user_id:actor,seat:0,username:"ana",display_name:"Ana",avatar_key:null},
      {match_id:id,user_id:randomUUID(),seat:2,username:"carla",display_name:"Carla",avatar_key:null},
      {match_id:id,user_id:randomUUID(),seat:1,username:"dora",display_name:"Dora",avatar_key:null},
    ]};
    return {rows:[]};
  }};
  const item=(await listPersonalMatches({connect:async()=>client},actor)).items[0];
  assert.deepEqual(item.participants.map(p=>[p.seat,p.displayName,p.bot]),[
    [0,"Ana",false],[1,"Dora",false],[2,"Carla",false],[3,"Bot 1",true],
  ]);
 });
