import { flip7Driver } from "../../../api/src/modules/games/flip7/driver";
import { Server as SocketServer } from "socket.io";
import { gameRoomSchema, lobbySchema, realtimeRequestSchema, seoFieldsSchema, type PersonalMatches } from "@croebet/shared";
import { createServer, type Server } from "node:http";
import { expect, test, type Page, type Locator } from "@playwright/test";
import type { GameRecord, LoveView } from "@croebet/shared";

async function openMatchOptions(page: Page) {
 const menu = page.locator('[data-slot="dropdown-menu-content"][data-state="open"]');
 if (!await menu.isVisible()) await page.getByRole("button", {name:"Opções da partida", exact:true}).click();
 await expect(menu).toBeVisible();
}
async function closeMatchOptions(page: Page) {
 const menu = page.locator('[data-slot="dropdown-menu-content"][data-state="open"]');
 const trigger = page.getByRole("button", {name:"Opções da partida", exact:true});
 if (await menu.isVisible()) await trigger.click();
 await expect(menu).toBeHidden();
 await expect(trigger).toHaveAttribute("aria-expanded", "false");
}

async function checkTableControls(page: Page, table: Locator, desktop: boolean) {
 await openMatchOptions(page);
 const controls = page.getByLabel("Controles da partida", {exact:true});
 const options = page.getByRole("menu", {name:"Opções da partida", exact:true});
 const fullscreen = controls.getByRole("button", {name:"Tela cheia", exact:true});
 const toggle = options.getByRole("button", {name:"Esconder histórico", exact:true});
 await expect(fullscreen).toBeVisible();
 await expect(toggle).toHaveAttribute("aria-expanded", "true");
 const panel = page.getByRole("complementary", {name:"Histórico da partida"});
 await expect(toggle).toHaveAttribute("aria-controls", await panel.getAttribute("id") ?? "");
 if (desktop) {
  const panelBox = await panel.boundingBox();
  const tableBox = await table.boundingBox();
  expect(panelBox!.width).toBeCloseTo(224, 0);
  expect(panelBox!.x).toBeGreaterThan(tableBox!.x + tableBox!.width);
 }
 await closeMatchOptions(page);
 await fullscreen.click();
 await expect(controls.getByRole("button", {name:"Sair da tela cheia", exact:true})).toBeVisible();
 await expect(panel).toBeVisible();
 await controls.getByRole("button", {name:"Sair da tela cheia", exact:true}).click();
 await openMatchOptions(page);
 await options.getByRole("button", {name:"Esconder histórico", exact:true}).click();
 await expect(page.getByRole("complementary",{name:"Histórico da partida"})).toHaveCount(0);
 await page.getByRole("button",{name:"Mostrar histórico",exact:true}).click();
 await expect(page.getByRole("complementary",{name:"Histórico da partida"})).toBeVisible();
 await closeMatchOptions(page);
}

const id = "93089d02-0b34-4b78-9d3e-f2679c190b5c";
const matchId = "93089d02-0b34-4b78-9d3e-f2679c190b5a";
const replayState = flip7Driver.project(flip7Driver.create({ setup: [{name:"Ana",kind:"human"},{name:"Beto",kind:"human"}], options:{mode:"classic",brutal:false} },"Ana"));
const replayFrames = Array.from({length:105},(_,index)=>({ version:index+1, action:{type:"step" as const}, state:{...replayState, round:index+1, log:[{message:`Jogada registrada ${index+1}.`}]}}));
const historyMatch = { id:matchId, gameId:id, code:"ABCDEF123456",rulesVersion:1,status:"finished",options:{mode:"classic",brutal:false},startedAt:"2026-11-20T01:00:00Z",endedAt:"2026-11-20T02:00:00Z",players:[{seat:0,userId:id,name:"Ana",score:210,winner:true,bot:false},{seat:1,userId:null,name:"Beto",score:180,winner:false,bot:false}],frameCount:105 };
const historyFinalState = { ...replayState, phase: "over" as const, round: 7, players: replayState.players.map((player, seat) => ({ ...player, total: historyMatch.players[seat].score })) };
replayFrames[104].state = { ...historyFinalState, log: [{ message: "Jogada registrada 105." }] };
let game: GameRecord;
let upcoming: GameRecord | null = null;
let failure = false;
let sessionRole: "admin" | "user" = "admin";
let api: Server;
let sockets: SocketServer;
let developmentHistory=false;
let loveRoom: ReturnType<typeof gameRoomSchema.parse> | null = null;
let personalMatches: PersonalMatches = {items:[]};
let gameCommands:unknown[]=[];
let createRequest:((input:Record<string,unknown>)=>unknown)|undefined;
let roomWatches: { code: string; afterVersion: number }[] = [];
function respond(path: string, method: string, body: Record<string, unknown> = {}): { status: number; data: unknown } {
  const url=new URL(path,"http://fixture");
  path=url.pathname;
  if(loveRoom && path===`/api/v1/matches/${loveRoom.code}`)return {status:200,data:loveRoom};
  if(path===`/api/v1/admin/games/${id}/matches`) {
    const development=url.searchParams.get("source")==="development";
    developmentHistory=development;
    return {status:200,data:{items:url.searchParams.get("q")==="ninguém"?[]:[{...historyMatch,development,durationSeconds:3600,activeDurationSeconds:development?120:null}],hasMore:false,averages:development?[{game:"flip7",options:historyMatch.options,players:2,onlyBots:true,count:3,durationSeconds:3600,activeDurationSeconds:120}]:[]}};
  }
  if(loveRoom && loveRoom.status!=="lobby" && path===`/api/v1/me/matches/${loveRoom.code}`) {
    const state=loveRoom.state;
    if(!("tokens" in state.players[0]))throw Error("Fixture de outro jogo");
    const publicState={...state,legalActions:[],privateInfo:[],players:state.players.map(p=>({...p,hand:null}))};
    return {status:200,data:{match:{...historyMatch,code:loveRoom.code,game:"love-letter",gameId:loveRoom.id,development:true,options:loveRoom.options,durationSeconds:125,activeDurationSeconds:90,frameCount:2,players:state.players.map((p,seat)=>({seat,userId:null,name:p.name,score:"tokens" in p?p.tokens:0,winner:seat===0,bot:true}))},finalState:publicState,frames:[{version:1,action:{type:"start"},state:{...publicState,phase:"playing",log:["Primeira jogada do teste."]}},{version:2,action:{type:"step"},state:{...publicState,phase:"over",log:["Última jogada do teste."]}}],offset:0,hasMore:false}};
  }
  if(path==="/api/v1/me/history")return {status:200,data:{items:[{id:`game:${matchId}`,matchId,matchCode:historyMatch.code,gameSlug:"flip7",kind:"game",description:"Flip 7 · Partida concluída",createdAt:historyMatch.endedAt,amount:null}],hasMore:false}};
  if(path===`/api/v1/me/matches/${historyMatch.code}` || path===`/api/v1/admin/games/${id}/matches/${matchId}`) {
    const offset=Number(url.searchParams.get("offset")??0),limit=Number(url.searchParams.get("limit")??100);
    return {status:200,data:{match:{...historyMatch,development:developmentHistory,activeDurationSeconds:developmentHistory?120:null},finalState:historyFinalState,frames:replayFrames.slice(offset,offset+limit),offset,hasMore:offset+limit<105}};
  }
  if (path === "/api/v1/me") return { status: 200, data: { user: { id, username: "Admin", displayName: "Admin", role: sessionRole } } };
  if (path === "/api/v1/economy") return { status: 200, data: { initialBalance: 30, dailyReward: 10, dailyResetTimeZone: "America/Sao_Paulo", suggestedBets: [1, 5, 10, 50], defaultBet: 5 } };
  if (path === "/api/v1/rewards/daily") return { status: 200, data: { balance: 30, eligible: true, lastClaimAt: null, nextClaimAt: null, serverNow: new Date().toISOString() } };
  if (path === "/api/v1/auth/csrf") return { status: 200, data: { token: "fixture" } };
  if (path === "/api/v1/pages") return { status: 200, data: { items: [] } };
  if (path === "/api/v1/navigation") return { status: 200, data: { main: [], footer: [] } };
  if (failure && path.includes("games")) return { status: 503, data: {} };
  if (path === "/api/v1/admin/pages" || path === "/api/v1/admin/markets") return {status:200,data:{items:[]}};
  if (path === "/api/v1/admin/coupons") return {status:200,data:{items:[],hasMore:false,total:0,counts:{Todos:0,Ativo:0,Agendado:0,Pausado:0,Expirado:0,Esgotado:0}}};
  if (path === "/api/v1/admin/games") {
    if (method === "POST") {
      upcoming = {...body,id:"93089d02-0b34-4b78-9d3e-f2679c190b5e",version:1} as GameRecord;
      return {status:200,data:upcoming};
    }
    return { status: 200, data: { items: [game, ...(upcoming ? [upcoming] : [])] } };
  }
  if (upcoming && path === `/api/v1/admin/games/${upcoming.id}/matches`) return {status:200,data:{items:[],hasMore:false}};
  if (upcoming && path === `/api/v1/admin/games/${upcoming.id}`) {
    if(method === "DELETE") { upcoming=null; return {status:200,data:{ok:true}}; }
    if(method === "PATCH") upcoming = {...upcoming,...body,version:upcoming.version+1} as GameRecord;
    return {status:200,data:upcoming};
  }
  if (upcoming?.enabled && path === `/api/v1/games/${upcoming.slug}`) return {status:200,data:upcoming};
  if (path === `/api/v1/admin/games/${id}`) {
    if (method === "PATCH") {
      if (body.version !== game.version) return { status: 409, data: { error: { message: "O jogo foi alterado." } } };
      game = { ...game, ...body, version: game.version + 1 } as GameRecord;
    }
    return { status: 200, data: game };
  }
  if (path === "/api/v1/games") return { status: 200, data: { items: [...(game.enabled ? [game] : []), ...(upcoming?.enabled ? [upcoming] : [])] } };
  if ((path === `/api/v1/games/${game.slug}` || path === "/api/v1/games/flip7") && game.enabled) return { status: 200, data: game };
  return { status: 404, data: {} };
}
test.beforeAll(async () => {
  api = createServer((req, res) => {
    const result = respond(req.url ?? "", req.method ?? "GET");
    res.writeHead(result.status, { "content-type": "application/json" }); res.end(JSON.stringify(result.data));
  });
  sockets = new SocketServer(api,{path:"/api/v1/realtime",addTrailingSlash:false});
  sockets.on("connection",socket=>{
    socket.emit("personal-matches",personalMatches);
    socket.on("request",(value,ack)=>{
      const request=realtimeRequestSchema.parse(value);
      if(request.type==="keep-open"){
        personalMatches={items:personalMatches.items.map(item=>item.code===request.code?{...item,lobbyExpiresAt:new Date(Date.now()+32*60000).toISOString()}:item)};
        socket.emit("personal-matches",personalMatches);ack?.({ok:true,data:{id:matchId,code:request.code,game:"flip7",rulesVersion:1,version:2,status:"lobby",state:null,hostId:id,capacity:2,options:{mode:"classic",brutal:false},participants:[],lobbyExpiresAt:personalMatches.items.find(item=>item.code===request.code)?.lobbyExpiresAt}});
      }
      else if(request.type==="create" && createRequest)ack?.({ok:true,data:createRequest(request.input)});
      else if(request.type==="command"){gameCommands.push(request.input.action);ack?.({ok:true,data:{ok:true}});}
      else if(request.type==="abandon")ack?.({ok:true,data:{ok:true}});
      else ack?.({ok:false,error:{code:"UNSUPPORTED",message:"Operação não configurada na fixture."}});
    });
    socket.on("watch",(request,ack)=>{
      ack?.({ok:true,data:{}});
      if(loveRoom && request.active!==false && request.code===loveRoom.code){
        roomWatches.push({code:request.code,afterVersion:request.afterVersion});
        // Bound a regression loop so the test fails without flooding its server.
        if(roomWatches.length<=10)socket.emit("room",{room:loveRoom,frames:[],reset:true});
      }
      if(loveRoom && loveRoom.status==="playing" && request.directory){
        const {
          state: _state,
          durationSeconds: _duration,
          activeDurationSeconds: _activeDuration,
          ...summary
        }=loveRoom;
        void _state; void _duration; void _activeDuration;
        socket.emit("lobbies",{items:[],joined:[],owned:null,active:null,testMatches:[{...summary,round:1,controllerIds:[]}]});
      }
    });
  });
  await new Promise<void>((resolve, reject) => { api.once("error", reject); api.listen(3201, "127.0.0.1", resolve); });
});
test.afterAll(async () => {
  try { await new Promise<void>((resolve,reject) => sockets.close(error => error ? reject(error) : resolve())); }
  finally {
    if (api.listening) {
      api.closeAllConnections();
      await new Promise<void>((resolve,reject) => api.close(error => error ? reject(error) : resolve()));
    }
  }
});
test.beforeEach(async ({ page, context }) => {
  developmentHistory=false;
  loveRoom = null;createRequest=undefined;roomWatches=[];gameCommands=[];personalMatches={items:[]};
  game = { id, seo: seoFieldsSchema.parse({}), slug: "flip7", name: "Flip 7", description: "", enabled: true, imageUrl: null, version: 1 }; failure = false; upcoming = null; sessionRole = "admin";
  await context.addCookies([{ name: "croebet-session", value: "games-test", url: "http://127.0.0.1:3100" }]);
  await page.route("**/api/v1/**", async route => {
    const req = route.request(); const result = respond(new URL(req.url()).pathname+new URL(req.url()).search, req.method(), req.postDataJSON() ?? {});
    await route.fulfill({ status: result.status, json: result.data });
  });
});
test("topbar exibe a capa do jogo ao lado do título na interna e na partida", async ({ page }) => {
  game = { ...game, imageUrl: "/cover-fixture.svg" };
  await page.route("**/cover-fixture.svg", route => route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" fill="purple"/></svg>' }));
  await page.goto("/jogos/flip7");
  const topbar = page.getByRole("banner");
  const cover = topbar.getByRole("img", { name: "Capa de Flip 7" });
  const title = topbar.getByText("Flip 7", { exact: true });
  await expect(cover).toBeVisible();
  await expect(title).toBeVisible();
  const [coverBox, titleBox] = await Promise.all([cover.boundingBox(), title.boundingBox()]);
  expect(coverBox!.x + coverBox!.width).toBeLessThanOrEqual(titleBox!.x);
  await page.evaluate(() => window.history.pushState(null, "", "/jogos/flip7?partida=ABCDEF123456"));
  await expect(cover).toBeVisible();
  await expect(title).toBeVisible();
});

test("lista administrativa edita o catálogo persistente e pausa sua publicação", async ({ page, browser }) => {
  await page.goto("/admin/jogos");
  const list = page.getByRole("list", { name: "Jogos", exact: true });
  await expect(list.getByRole("listitem")).toHaveCount(1);
  await expect(list.locator("img")).toHaveCount(0);
  await page.getByRole("searchbox", { name: "Buscar jogos no admin" }).fill("roleta");
  await expect(page.getByText("Nenhum jogo encontrado.")).toBeVisible();
  await page.getByRole("searchbox", { name: "Buscar jogos no admin" }).fill("");
  await expect(list.getByRole("button")).toHaveCount(0);
  await expect(list.getByText("/jogos/flip7", { exact: true })).toHaveCount(0);
  const gameLink = list.getByRole("link", { name: "Flip 7", exact: true });
  // Click the row padding, away from the title and cover.
  await gameLink.click({ position: { x: 5, y: 5 } });
  await expect(page).toHaveURL(`/admin/jogos/${id}`);
  await expect(page.getByRole("button", {name:"Selecionar imagem",exact:true})).toBeVisible();
  await page.getByLabel("Nome do jogo").fill("Flip da comunidade");
  await page.locator('textarea[name="description"]').fill("Compre cartas com seus amigos.");
  await page.getByRole("button", { name: "Salvar jogo" }).click();
  await expect(page).toHaveURL("/admin/jogos");
  await page.reload();
  expect(game.description).toBe("Compre cartas com seus amigos.");
  await expect(list.getByRole("link", { name: "Flip da comunidade" })).toBeVisible();
  const visitor = await browser.newContext({ javaScriptEnabled: false });
  const publicPage = await visitor.newPage();
  await publicPage.goto("/jogos");
  await expect(publicPage.getByRole("link", { name: "Flip da comunidade" })).toBeVisible();
  await expect(publicPage.getByRole("main").locator("img")).toHaveCount(0);
  await list.getByRole("link", { name: "Flip da comunidade", exact: true }).click();
  await page.getByRole("switch", { name: "Jogo ativo" }).uncheck();
  await page.getByRole("button", { name: "Salvar jogo" }).click();
  await expect(page).toHaveURL("/admin/jogos");
  await expect(list.getByText("Inativo", { exact: true })).toBeVisible();
  expect(game.description).toBe("Compre cartas com seus amigos.");
  await publicPage.reload();
  await expect(publicPage.getByText("Nenhum jogo disponível.")).toBeVisible();
  const response = await publicPage.goto("/jogos/flip7");
  expect(response?.status()).toBe(404);
  await expect(publicPage.locator('head meta[name="robots"]')).toHaveAttribute("content", "noindex");
  await list.getByRole("link", { name: "Flip da comunidade", exact: true }).click();
  await page.getByRole("switch", { name: "Jogo ativo" }).check();
  await page.getByRole("button", { name: "Salvar jogo" }).click();
  await expect(page).toHaveURL("/admin/jogos");
  await expect(list.getByText("Ativo", { exact: true })).toBeVisible();
  await visitor.close();
});
test("falha de serviço oferece nova tentativa sem exibir um catálogo vazio", async ({ page }) => {
  failure = true;
  await page.goto("/jogos");
  await expect(page.getByText("Não foi possível carregar estes dados.")).toBeVisible();
  await expect(page.getByText("Nenhum jogo disponível.")).toHaveCount(0);
  failure = false;
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(page.getByRole("link", { name: "Flip 7", exact: true })).toBeVisible();
});

test("interna usa nome de exibição no resumo, na mesa e no turno", async ({ page }) => {
  const archivedName = historyMatch.players[0].name;
  historyMatch.players[0].name = "Ana Pessoa";
  try {
    await page.goto(`/admin/jogos/${id}/partidas/${matchId}`);
    await expect(page.getByText("Vez de Ana Pessoa", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Resumo da partida").getByText("Ana Pessoa", { exact: true })).toBeVisible();
    await expect(page.getByText("Ana Pessoa", { exact: true })).toHaveCount(2);
  } finally {
    historyMatch.players[0].name = archivedName;
  }
});
test("admin consulta vencedores e reproduz jogadas sem alterar a partida", async ({ page }) => {
  await page.goto(`/admin/jogos/${id}`);
  const list=page.getByRole("list",{name:"Partidas do jogo"});
  await expect(list.getByText("Vencedor: Ana",{exact:true})).toBeVisible();
  await expect(list.locator("[data-slot=avatar]")).toHaveCount(2);
  await expect(list.getByText("Concluída",{exact:true})).toBeVisible();
  await expect(list.getByText("Clássico",{exact:true})).toBeVisible();
  await page.getByRole("searchbox",{name:"Buscar partidas por código ou participante"}).fill("ninguém");
  await expect(page.getByText("Nenhuma partida encontrada.")).toBeVisible();
  await page.getByRole("searchbox",{name:"Buscar partidas por código ou participante"}).fill("");
  await list.getByRole("link",{name:"Ver histórico"}).click();
  await expect(page.getByText("Jogada registrada 1.",{exact:true})).toBeVisible();
  await expect(page.getByRole("complementary",{name:"Resumo da partida"}).getByRole("heading",{name:"Resultado",exact:true})).toBeVisible();
  await expect(page.getByRole("complementary",{name:"Resumo da partida"}).locator("[data-slot=avatar]")).toHaveCount(2);
  await page.getByRole("button",{name:"Próxima jogada",exact:true}).click();
  await expect(page.getByText("Jogada registrada 2.",{exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Jogada anterior",exact:true}).click();
  await expect(page.getByText("Jogada registrada 1.",{exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Reproduzir",exact:true}).click();
  await expect(page.getByText("Jogada registrada 2.",{exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Pausar",exact:true}).click();
  const position=await page.getByRole("slider",{name:"Ir para jogada"}).inputValue();
  await page.waitForTimeout(1200);
  await expect(page.getByRole("slider",{name:"Ir para jogada"})).toHaveValue(position);
  await page.getByRole("button",{name:"Final",exact:true}).click();
  await expect(page.getByText("Jogada registrada 105.",{exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Início",exact:true}).click();
  await expect(page.getByText("Jogada registrada 1.",{exact:true})).toBeVisible();
});


test("ações de criação ficam após a busca nas quatro listagens, com layout responsivo", async ({page},testInfo) => {
  for (const [section,label,destination] of [
    ["paginas","Criar página","nova"], ["apostas","Criar aposta","nova"],
    ["cupons","Criar cupom","novo"], ["jogos","Criar jogo","novo"],
  ]) {
    await page.goto(`/admin/${section}`);
    const toolbar = page.locator('[data-slot="admin-list-header"]');
    const action = toolbar.getByRole("link",{name:label,exact:true});
    await expect(action).toBeVisible();
    await expect(action).toHaveAttribute("href",`/admin/${section}/${destination}`);
    await expect(page.locator("header").getByRole("link",{name:label,exact:true})).toHaveCount(0);
    await expect(action).toHaveCSS("background-image","none");
    const search = await toolbar.getByRole("searchbox").boundingBox();
    const button = await action.boundingBox();
    expect(button!.x).toBeGreaterThan(search!.x + search!.width);
    expect(Math.abs(button!.y-search!.y)).toBeLessThan(2);
    if(testInfo.project.name === "mobile") await expect(action.locator("span")).toBeHidden();
    else await expect(action.locator("span")).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    await action.click();
    await expect(page).toHaveURL(`/admin/${section}/${destination}`);
  }
});

test("admin cadastra um jogo em desenvolvimento e publica página em breve sem lobby",async ({page})=>{
  await page.goto("/admin/jogos");
  await page.getByRole("link",{name:"Criar jogo",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Criar jogo",exact:true})).toBeVisible();
  await page.getByLabel("Nome do jogo",{exact:true}).fill("Blackjack");
  await page.getByLabel("Nome do jogo",{exact:true}).blur();
  await expect(page.getByLabel("Endereço do jogo",{exact:true})).toHaveValue("blackjack");
  await page.locator('textarea[name="description"]').fill("Um novo jogo para a comunidade.");
  await page.getByRole("button",{name:"Criar jogo",exact:true}).click();
  await expect(page).toHaveURL("/admin/jogos");
  const row = page.getByRole("listitem").filter({has:page.getByRole("link",{name:"Blackjack",exact:true})});
  await expect(row.getByText("Em breve",{exact:true})).toBeVisible();
  await page.reload();
  await expect(page.getByRole("link",{name:"Blackjack",exact:true})).toBeVisible();
  await page.goto("/jogos/blackjack");
  await expect(page.getByRole("heading",{name:"Blackjack",exact:true})).toBeVisible();
  await expect(page.getByText("Em breve",{exact:true})).toBeVisible();
  await expect(page.getByText("Um novo jogo para a comunidade.",{exact:true})).toBeVisible();
  await expect(page.getByText("Lobbies abertos",{exact:true})).toHaveCount(0);
  await expect(page.getByRole("button",{name:"Jogar",exact:true})).toHaveCount(0);
  await page.goto(`/admin/jogos/${upcoming!.id}`);
  await page.getByRole("switch",{name:"Jogo ativo"}).uncheck();
  await page.getByRole("button",{name:"Salvar jogo",exact:true}).click();
  await expect(page).toHaveURL("/admin/jogos");
  await page.goto("/jogos");
  await expect(page.getByRole("link",{name:/Blackjack/})).toHaveCount(0);
});

test("editor de jogos salva configurações e SEO pelo aside", async ({ page }) => {
  await page.goto(`/admin/jogos/${id}`);
  const aside = page.getByRole("complementary", { name: "Configurações do jogo" });
  await expect(aside.getByRole("button", { name: "Salvar jogo", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Partidas", exact: true })).toBeVisible();
  await page.getByLabel("Nome do jogo", { exact: true }).fill("Novo nome do jogo");
  await page.locator("#game-editor").getByLabel("Descrição", { exact: true }).fill("Descrição atualizada.");
  await aside.getByRole("switch", { name: "Jogo ativo" }).uncheck();
  await aside.locator("summary").filter({ hasText: "SEO" }).click();
  await aside.getByLabel("Título SEO", { exact: true }).fill("Título para buscas");
  await aside.getByLabel("Descrição", { exact: true }).fill("Descrição para buscas.");
  await aside.getByRole("button", { name: "Salvar jogo", exact: true }).click();
  await expect(page).toHaveURL("/admin/jogos");
  expect(game.name).toBe("Novo nome do jogo");
  expect(game.description).toBe("Descrição atualizada.");
  expect(game.enabled).toBe(false);
  expect(game.seo.title).toBe("Título para buscas");
  expect(game.seo.description).toBe("Descrição para buscas.");
});

test("histórico abre o link original com resultado; Replay usa a mesa e a barra inferior", async ({ page }, testInfo) => {
  sessionRole="user";
  const requests:string[]=[];
  page.on("request",request=>{if(request.url().includes("/matches/"))requests.push(request.url());});
  await page.goto("/");
  await page.locator("header").getByRole("button",{name:"Conta de Admin",exact:true}).click();
  await page.getByRole("menuitem",{name:"Configurações",exact:true}).click();
  const settings=page.getByRole("dialog");
  await settings.getByRole("button",{name:"Histórico",exact:true}).click();
  const link=settings.getByRole("link",{name:/Flip 7 · Partida concluída/});
  const url=`/jogos/flip7?partida=${historyMatch.code}`;
  await expect(link).toHaveAttribute("href",url);
  await link.click();
  await expect(page).toHaveURL(url);
  const result=page.getByRole("dialog",{name:"Resultado da partida",exact:true});
  await expect(result).toBeVisible();
  await expect(result.getByText("Ana",{exact:true}).first()).toBeVisible();
  await expect(page.getByLabel("Controles de reprodução")).toHaveCount(0);
  await result.getByRole("button",{name:"Replay",exact:true}).click();
  await expect(result).not.toBeVisible();
  await expect(page.getByRole("region",{name:"Mesa de Flip7",exact:true})).toBeVisible();
  const controls=page.locator("[data-game-actions]");
  await expect(controls.getByLabel("Controles de reprodução")).toBeVisible();
  await controls.getByRole("button",{name:"Pausar",exact:true}).click();
  await checkTableControls(page, page.locator("[data-game-table-content]"), testInfo.project.name === "desktop");
  await controls.getByRole("button",{name:"Próxima jogada",exact:true}).click();
  await expect(page.getByText("Jogada registrada 2.",{exact:true})).toBeVisible();
  await controls.getByRole("button",{name:"Início",exact:true}).click();
  await expect(page.getByText("Jogada registrada 1.",{exact:true})).toBeVisible();
  await controls.getByRole("button",{name:"Próxima jogada",exact:true}).click();
  await expect(page.getByText("Jogada registrada 2.",{exact:true})).toBeVisible();
  await expect(page.getByRole("button",{name:"Comprar",exact:true})).toHaveCount(0);
  await expect(page.getByRole("button",{name:"Parar",exact:true})).toHaveCount(0);
  await expect(page.getByRole("button",{name:"Abandonar partida",exact:true})).toHaveCount(0);
  await controls.getByRole("button",{name:"Final",exact:true}).click();
  await expect(page.getByText("Jogada registrada 105.",{exact:true})).toBeVisible();
  expect(requests.some(path=>path.includes(`/me/matches/${historyMatch.code}?offset=100`))).toBe(true);
  expect(requests.some(path=>path.includes("/admin/") || path.includes("/commands"))).toBe(false);
  await controls.getByRole("button",{name:"Ver resultado",exact:true}).click();
  await expect(result).toBeVisible();
  await page.reload();
  await expect(result).toBeVisible();
  await expect(page.getByLabel("Controles de reprodução")).toHaveCount(0);
});

test("Love Letter no modo dev reutiliza sidebar, configurações no modal e listagem de salas",async({page})=>{
 upcoming={...game,id:"93089d02-0b34-4b78-9d3e-f2679c190b5e",slug:"love-letter",name:"Love Letter"};
 await page.goto("/jogos/love-letter?teste=1");
 await expect(page.getByLabel("Apresentação do jogo").getByRole("switch",{name:"Modo dev",exact:true})).toBeChecked();
 await expect(page.getByLabel("Apresentação do jogo").getByText("Desenvolvimento",{exact:true})).toBeVisible();
 await expect(page.getByText("Sem Croins, estatísticas ou conquistas.",{exact:true})).toHaveCount(0);
 await expect(page.getByLabel("Lobbies abertos")).toBeVisible();
 await expect(page.getByLabel("Configuração e regras")).toHaveCount(0);
 await expect(page.getByLabel("Jogadores e vagas")).toHaveCount(0);
 await expect(page.getByLabel("Apresentação do jogo").getByRole("switch",{name:"Modo dev",exact:true})).toBeDisabled();
 await page.getByRole("button",{name:"Jogar",exact:true}).click();
 const dialog=page.getByRole("dialog");
 await expect(dialog.getByLabel("Modo do Love Letter").locator("option")).toHaveText(["Clássico","Moderno"]);
 await expect(dialog.getByRole("switch",{name:"Somente bots",exact:true})).toBeVisible();
 await expect(dialog.getByRole("group",{name:"Aposta da partida"})).toHaveCount(0);
 await expect(page.getByRole("button",{name:"Criar partida de teste",exact:true})).toHaveCount(0);
 await page.keyboard.press("Escape");
 await page.goto("/jogos/love-letter");
 await expect(page.getByRole("switch",{name:"Modo dev",exact:true})).toBeChecked();
 await expect(page.getByRole("switch",{name:"Modo dev",exact:true})).toBeDisabled();
 await expect(page.getByRole("button",{name:"Jogar",exact:true})).toBeVisible();
});

test("lobby adapta modo e bots ao escolher a quantidade de jogadores",async({page})=>{
 const errors:string[]=[];
 page.on("pageerror",error=>errors.push(error.message));
 page.on("console",message=>{if(message.type()==="error")errors.push(message.text());});
 upcoming={...game,id:"93089d02-0b34-4b78-9d3e-f2679c190b5e",slug:"love-letter",name:"Love Letter"};
 await page.goto("/jogos/love-letter?teste=1");
 await page.getByRole("button",{name:"Jogar",exact:true}).click();
 const dialog=page.getByRole("dialog");
 const count=dialog.getByLabel("Número de jogadores"),mode=dialog.getByLabel("Modo do Love Letter");
 const bots=dialog.getByRole("combobox",{name:"Bots",exact:true});
 await expect(mode).toHaveValue("classic");
 await expect(count.locator("option")).toHaveText(["2","3","4","5","6"]);
 await count.selectOption("6");
 await expect(mode).toHaveValue("modern");
 await bots.selectOption("5");
 await mode.selectOption("classic");
 await expect(count).toHaveValue("4");await expect(bots).toHaveValue("3");
 await count.selectOption("2");
 await expect(count).toHaveValue("2");await expect(bots).toHaveValue("1");
 await expect(mode).toHaveValue("classic");
 await count.selectOption("5");await expect(mode).toHaveValue("modern");
 await page.reload();
 await page.getByRole("button",{name:"Jogar",exact:true}).click();
 const reopened=page.getByRole("dialog");
 await expect(reopened.getByLabel("Modo do Love Letter")).toHaveValue("modern");
 await expect(reopened.getByLabel("Número de jogadores")).toHaveValue("5");
 await expect(reopened.getByRole("combobox",{name:"Bots",exact:true}).locator("option")).toHaveText(["0","1","2","3","4"]);
 expect(errors.filter(message=>/hydration|hydrated|script tag|server rendered HTML/i.test(message))).toEqual([]);
 // Fixed-limit games use the same capacity control and trim bots as well.
 await page.goto("/jogos/flip7?teste=1");
 await page.getByRole("button",{name:"Jogar",exact:true}).click();
 const flipDialog=page.getByRole("dialog");
 const flipCount=flipDialog.getByLabel("Número de jogadores"),flipBots=flipDialog.getByRole("combobox",{name:"Bots",exact:true});
 await flipCount.selectOption("6");await flipBots.selectOption("5");
 await flipCount.selectOption("2");await expect(flipBots).toHaveValue("1");
 await expect(flipDialog.getByLabel("Modo do Flip7")).toHaveValue("classic");
});

test("modo dev permite criar outra partida do mesmo jogo com teste em andamento",async({page})=>{
 prepareLoveTable();
 await page.goto("/jogos/love-letter?teste=1");
 await expect(page.getByRole("button",{name:"Visualizar",exact:true})).toBeVisible();
 const play=page.getByRole("button",{name:"Jogar",exact:true});
 await expect(play).toBeEnabled();
 let creation:Record<string,unknown>|undefined;
 createRequest=input=>{
  creation=input;
  if(!loveRoom || loveRoom.status==="lobby")throw Error("Partida de teste não iniciada");
  const {
    durationSeconds: _duration,
    activeDurationSeconds: _activeDuration,
    ...base
  }=loveRoom;
  void _duration; void _activeDuration;
  return lobbySchema.parse({...base,id:"93089d02-0b34-4b78-9d3e-f2679c190b5b",code:"ABCDEF654322",version:1,status:"lobby",state:null,capacity:input.capacity,options:input.options,bots:0,onlyBots:false,participants:[{userId:id,username:"Admin",displayName:"Admin",avatarUrl:null,seat:0}]});
 };
 await play.click();
 await page.getByRole("dialog").getByRole("button",{name:"Criar sala",exact:true}).click();
 await expect(page).toHaveURL("/jogos/love-letter?partida=ABCDEF654322&teste=1");
 expect(creation).toMatchObject({development:true,game:"love-letter"});
});

test("Love Letter em desenvolvimento não permite criação por jogador comum",async({page})=>{
 upcoming={...game,id:"93089d02-0b34-4b78-9d3e-f2679c190b5e",slug:"love-letter",name:"Love Letter"};sessionRole="user";
 await page.goto("/jogos/love-letter");
 await expect(page.getByText("Em breve",{exact:true})).toBeVisible();
 await expect(page.getByRole("button",{name:"Criar partida de teste",exact:true})).toHaveCount(0);
 await expect(page.getByRole("switch",{name:"Modo dev",exact:true})).toHaveCount(0);
});


test("URL do modo dev retorna 404 para jogador comum antes de renderizar o lobby",async({page})=>{
 sessionRole="user";
 const response=await page.goto("/jogos/flip7?teste=1");
 expect(response?.status()).toBe(404);
 await expect(page.getByLabel("Apresentação do jogo")).toHaveCount(0);
 await expect(page.getByRole("switch",{name:"Modo dev",exact:true})).toHaveCount(0);
});


test("abrir teste do Love Letter mantém link, recarga e volta para o jogo",async({page},testInfo)=>{
 upcoming={...game,id:"93089d02-0b34-4b78-9d3e-f2679c190b5e",slug:"love-letter",name:"Love Letter"};
 loveRoom=gameRoomSchema.parse({id:matchId,code:"ABCDEF654321",game:"love-letter",rulesVersion:1,version:2,capacity:2,options:{mode:"classic",brutal:false},hostId:id,participants:[],development:true,bots:2,onlyBots:true,status:"playing",state:{mode:"classic",round:1,turn:0,phase:"playing",deckCount:12,removed:[],winners:[],log:[],pending:false,players:["Bot 1","Bot 2"].map(name=>({name,kind:"normal",hand:null,handCount:1,discard:[],protected:false,out:false,tokens:0})),privateInfo:[],legalActions:[]}});
 await page.goto("/jogos/love-letter?teste=1");
 await page.getByRole("button",{name:"Visualizar",exact:true}).click();
 await expect(page).toHaveURL("/jogos/love-letter?partida=ABCDEF654321&teste=1");
 await openMatchOptions(page);
 await expect(page.getByLabel("Controles de desenvolvimento",{exact:true})).toBeVisible();
 await page.reload();
 await openMatchOptions(page);
 await expect(page.getByLabel("Controles de desenvolvimento",{exact:true})).toBeVisible();
 if(testInfo.project.name==="desktop"){
  await page.getByRole("link",{name:"Voltar para Love Letter",exact:true}).click();
  await expect(page).toHaveURL("/jogos/love-letter?teste=1");
  await page.getByRole("button",{name:"Jogar",exact:true}).click();
  await expect(page.getByRole("dialog").getByLabel("Modo do Love Letter")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button",{name:"Visualizar",exact:true})).toBeVisible();
  await expect(page.getByText("Conectando às salas…",{exact:true})).toHaveCount(0);
 }
});

function prepareLoveTable() {
 upcoming={...game,id:"93089d02-0b34-4b78-9d3e-f2679c190b5e",slug:"love-letter",name:"Love Letter"};
 loveRoom=gameRoomSchema.parse({id:matchId,code:"ABCDEF654321",game:"love-letter",rulesVersion:1,version:2,capacity:6,options:{mode:"modern",brutal:false},hostId:id,participants:[{userId:id,username:"Admin",displayName:"Ana",avatarUrl:null,seat:0}],development:true,bots:5,onlyBots:false,status:"playing",state:{mode:"modern",round:1,turn:0,phase:"playing",deckCount:12,removed:[],winners:[],log:["Rodada 1 iniciada.","Bot 1 jogou 4."],pending:false,players:[{name:"Ana",kind:"human",hand:[1,4],handCount:2,discard:[],protected:false,out:false,tokens:1},...[1,2,3,4,5].map(index=>({name:`Bot ${index}`,kind:"normal",hand:null,handCount:1,discard:[4],protected:index===1,out:index===5,tokens:0}))],privateInfo:["Bot 2: 4 (ao jogar Sacerdote)."],legalActions:[{type:"play",card:1,target:2,guess:9},{type:"play",card:1,target:3,guess:8},{type:"play",card:4}]}});
}

test("link de teste abre a mesa sem exibir o lobby durante a revalidação", async ({page}) => {
 prepareLoveTable();
 await page.addInitScript(() => {
  const state = window as typeof window & { lobbyFlashed?: boolean };
  state.lobbyFlashed = false;
  new MutationObserver(() => {
   if (document.querySelector('[aria-label="Apresentação do jogo"]')) state.lobbyFlashed = true;
  }).observe(document, {childList:true, subtree:true});
 });
 let release!: () => void;
 const pending = new Promise<void>(resolve => { release = resolve; });
 await page.route("**/api/v1/matches/ABCDEF654321", async route => {
  await pending;
  await route.fulfill({json:loveRoom});
 });
 try {
  await page.goto("/jogos/love-letter?partida=ABCDEF654321&teste=1");
  await expect(page.getByLabel("Mesa do Love Letter")).toBeVisible();
  expect(await page.evaluate(() => (window as typeof window & {lobbyFlashed?:boolean}).lobbyFlashed)).toBe(false);
 } finally { release(); }
});

async function selectLoveCard(page: import("@playwright/test").Page, name: string) {
 const card = page.getByRole("button", { name, exact: true });
 await card.focus(); await card.press("Enter");
}

test("mesa Love Letter seleciona cartas, valida alvo/palpite e recolhe histórico",async({page},testInfo)=>{
 prepareLoveTable();
 const { loveTableState } = await import("../../features/games/love-letter/table-model");
 const { presentedHands } = await import("../../three/table/model");
 const { TableHand } = await import("../../three/table/hand");
 if (!loveRoom || loveRoom.status === "lobby" || !("privateInfo" in loveRoom.state)) throw new Error("Fixture Love Letter ausente");
 const state = loveTableState(loveRoom.state, 0);
 const hand = presentedHands(state, 0)[1];
 const cards = TableHand({ cards: hand, seat: { seat: 1, position: [0, 0, -2], angle: 0, width: 3 },
  options: { layout: "line", width: 3, scale: 1, spacing: 0.76, overlap: 0, curve: 0, tilt: 3.5, orientation: 0 },
  hidden: true, interactive: false, focus: 0, selected: null, flipped: [] });
 expect(cards.map(card => [card.zone, card.pose.scale, card.hidden])).toEqual([["hand", 1, false], ["hand", 1, true]]);
 expect(cards[0].id).toBe(state.exposed![1][0].id);
 expect(cards[1].id).toBe(state.hands[1][0].id);

 const commands=gameCommands;
 await page.goto("/jogos/love-letter?partida=ABCDEF654321");
 const table=page.getByLabel("Mesa do Love Letter");
 await expect(table.getByTestId("love-table-scene").locator("canvas")).toBeVisible();
 await expect(table.getByTestId("love-table-scene")).toHaveAttribute("data-hand-layout", "spread");
 await expect(table.getByTestId("love-table-scene").locator("[data-game-actions]")).toBeVisible();
 const localSeat = table.getByRole("button", { name: "Jogador Ana", exact: true });
 await expect(localSeat.getByText("Ana", { exact: true })).toBeVisible();
 await expect(localSeat.getByText("Você", { exact: true })).toHaveCount(0);
 await expect(localSeat.getByText(/cartas/)).toHaveCount(0);
 await expect(localSeat.getByLabel("1 de 3 fichas para vencer", { exact: true })).toBeVisible();
 await expect(localSeat.getByText("1/3", { exact: true })).toBeVisible();
 await expect(localSeat.locator(".rounded-full.bg-brand")).toHaveCount(1);
 await expect(localSeat.locator("span.size-3")).toHaveCount(3);
 await expect(localSeat.locator('[data-slot="avatar"]')).toHaveCSS("width", testInfo.project.name === "mobile" ? "40px" : "48px");
 await expect(localSeat).toHaveCSS("border-width", "0px");

 await expect(table.getByRole("status")).toHaveText("Escolha uma carta para descartar");
 await expect(table.getByText("Toque na carta que deseja descartar.",{exact:true})).toHaveCount(0);
 await expect(table.getByLabel("Informações privadas")).toHaveCount(0);
 await expect(table.getByText("Bot 2: 4 (ao jogar Sacerdote).",{exact:true})).toHaveCount(0);
 await expect(page.getByLabel("Carta oculta",{exact:true})).toHaveCount(5);
 await expect(table.getByText("Protegido",{exact:false})).toBeVisible();
 await expect(table.getByText("Eliminado",{exact:false})).toBeVisible();
 await expect(table.getByRole("combobox")).toHaveCount(0);
 await expect(table.getByRole("button",{name:"Descartar 1 · Guarda",exact:true})).toBeVisible();
 const actions = page.locator("[data-game-actions]");
 await expect(actions.getByRole("button", { name: "Comprar", exact: true })).toHaveCount(0);
 await expect(actions.getByRole("button", { name: "Parar", exact: false })).toHaveCount(0);
 const scene = table.getByTestId("love-table-scene");
 const assertActionsAboveScene = async () => {
  const toolbarBox = (await scene.locator("[data-table-toolbar]").boundingBox())!;
  const playfieldBox = (await scene.locator("[data-table-playfield]").boundingBox())!;
  const actionsBox = (await actions.boundingBox())!;
  expect(actionsBox.y).toBeGreaterThanOrEqual(toolbarBox.y);
  expect(actionsBox.y + actionsBox.height).toBeLessThanOrEqual(playfieldBox.y);
  expect(toolbarBox.y + toolbarBox.height).toBeLessThanOrEqual(playfieldBox.y + 1);
  expect(playfieldBox.height).toBeGreaterThan(100);
 };
 await assertActionsAboveScene();
 if (testInfo.project.name === "desktop") {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await expect.poll(async () => {
   const header = (await scene.locator("[data-table-header]").boundingBox())!;
   const action = (await actions.boundingBox())!;
   return Math.abs(action.x + action.width / 2 - header.x - header.width / 2);
  }).toBeLessThan(2);
  const controlsBox = (await page.getByLabel("Controles da partida", { exact: true }).boundingBox())!;
  const action = (await actions.boundingBox())!;
  expect(controlsBox.y + controlsBox.height).toBeLessThanOrEqual(action.y);
  await assertActionsAboveScene();
 }
 await selectLoveCard(page, "Descartar 1 · Guarda");
 await expect(actions.getByRole("status")).toHaveText("Toque no jogador que receberá a carta.");
 await expect(actions.getByRole("button", { name: "Cancelar escolha" })).toBeVisible();
 await expect(table.getByText("Toque no jogador que receberá a carta.", { exact: true })).toHaveCount(1);
 await assertActionsAboveScene();
 await expect(table.getByRole("button",{name:"Escolher jogador Bot 1",exact:true})).toHaveCount(0);
 await table.getByRole("button",{name:"Escolher jogador Bot 2",exact:true}).click();
 await expect(scene).toHaveAttribute("data-choice", "true");
 await actions.getByRole("button", { name: "Cancelar escolha", exact: true }).click();
 await selectLoveCard(page, "Descartar 1 · Guarda");
 await expect(scene.getByRole("button", { name: "Escolher jogador Bot 1 pelas cartas", exact: true })).toHaveCount(0);
 const targetCard = scene.getByRole("button", { name: "Escolher jogador Bot 2 pelas cartas", exact: true }).last();
 await targetCard.focus(); await targetCard.press("Enter");
 await expect(table.getByRole("button",{name:"Adivinhar 8 · Condessa",exact:true})).toHaveCount(0);
 await expect(table.getByTestId("love-table-scene")).toHaveAttribute("data-choice", "true");
 await expect(actions.getByRole("status")).toHaveText("Qual carta você acha que ele tem?");
 await assertActionsAboveScene();
 await selectLoveCard(page, "Adivinhar 9 · Princesa");
 await expect(table.getByTestId("love-table-scene")).toHaveAttribute("data-choice", "false");
 await expect(table.getByLabel("Descartes da rodada")).toHaveCount(0);
 await expect.poll(()=>commands).toEqual([{type:"play",card:1,target:2,guess:9}]);
 await selectLoveCard(page, "Descartar 4 · Aia");
 await expect.poll(()=>commands.length).toBe(2);
 expect(commands[1]).toEqual({type:"play",card:4});
 const history=page.getByRole("complementary",{name:"Histórico da partida"});
 const played=history.getByRole("listitem").filter({hasText:"Bot 1 jogou 4."});
 const thumbnail=played.getByRole("img",{name:"4 · Aia",exact:true});
 await expect(thumbnail).toBeAttached();
 await expect(played.locator('[data-slot="avatar"]')).toHaveText("B");
 const row=await played.evaluate(element=>{
  const [avatar,message,card]=Array.from(element.children).map(child=>child.getBoundingClientRect());
  return {avatarWidth:avatar.width,cardWidth:card.width,cardHeight:card.height,ordered:avatar.right<=message.left && message.right<=card.left};
 });
 expect(row).toEqual({avatarWidth:28,cardWidth:36,cardHeight:56,ordered:true});
 const round=history.getByRole("listitem").filter({hasText:"Rodada 1 iniciada."});
 await expect(round.locator('[data-slot="avatar"]')).toHaveCount(0);
 await expect(round.getByRole("img")).toHaveCount(0);
 await expect(history.getByRole("listitem").first()).toHaveText("BBot 1 jogou 4.");
 const navbar = page.getByRole("banner");
 await expect(navbar).toContainText("Love Letter");
 await expect(page.getByTestId("love-table-scene").getByLabel("Controles da partida", {exact:true})).toHaveCount(0);
 await checkTableControls(page, table, testInfo.project.name === "desktop");
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.screenshot({path:testInfo.outputPath("love-letter-table.png"),fullPage:true});
});

test("fichas exibem a meta da partida e os espaços restantes", async ({ page }) => {
 prepareLoveTable();
 const state = loveRoom!.state as LoveView;
 loveRoom = gameRoomSchema.parse({ ...loveRoom!, bots: 3, capacity: 4, state: { ...state, players: state.players.slice(0, 4).map((player, seat) => ({ ...player, tokens: seat === 0 ? 3 : 0 })) } });
 await page.goto("/jogos/love-letter?partida=ABCDEF654321");
 const localSeat = page.getByTestId("love-table-scene").getByRole("button", { name: "Jogador Ana", exact: true });
 await expect(localSeat.getByLabel("3 de 4 fichas para vencer", { exact: true })).toBeVisible();
 await expect(localSeat.getByText("3/4", { exact: true })).toBeVisible();
 await expect(localSeat.locator(".rounded-full.bg-brand")).toHaveCount(3);
 await expect(localSeat.locator("span.size-3")).toHaveCount(4);
 const progress = localSeat.getByLabel("3 de 4 fichas para vencer", { exact: true });
 await expect(progress).toHaveCSS("flex-wrap", "nowrap");
 const bounds = await progress.locator(":scope > span").evaluateAll(items => items.map(item => { const rect = item.getBoundingClientRect(); return { top: rect.top, bottom: rect.bottom }; }));
 expect(Math.max(...bounds.map(rect => rect.top))).toBeLessThan(Math.min(...bounds.map(rect => rect.bottom)));

});

test("Guarda com um único alvo válido abre palpites sem confirmar jogador",async({page})=>{
 prepareLoveTable();
 if(!loveRoom || loveRoom.status==="lobby" || !("privateInfo" in loveRoom.state))throw Error("Fixture Love Letter ausente");
 loveRoom.state.legalActions=[{type:"play",card:1,target:2,guess:9},{type:"play",card:1,target:2,guess:8},{type:"play",card:4}];
 const commands=gameCommands;
 await page.goto("/jogos/love-letter?partida=ABCDEF654321");
 const table=page.getByLabel("Mesa do Love Letter");
 await selectLoveCard(page,"Descartar 1 · Guarda");
 await expect(table.getByTestId("love-table-scene")).toHaveAttribute("data-choice","true");
 await expect(table.getByText("Qual carta você acha que ele tem?",{exact:true})).toBeVisible();
 expect(commands).toEqual([]);
 await table.getByRole("button",{name:"Cancelar escolha",exact:true}).click();
 await expect(table.getByTestId("love-table-scene")).toHaveAttribute("data-choice","false");
 await selectLoveCard(page,"Descartar 1 · Guarda");
 await selectLoveCard(page,"Adivinhar 9 · Princesa");
 await expect.poll(()=>commands).toEqual([{type:"play",card:1,target:2,guess:9}]);
});

for(const kind of ["priest","baron"] as const)test(`${kind}: revelação permanece até Continuar e sobrevive à recarga`,async({page})=>{
 prepareLoveTable();
 if(!loveRoom || loveRoom.status==="lobby" || !("privateInfo" in loveRoom.state))throw Error("Fixture Love Letter ausente");
 const state=loveRoom.state;
 state.players[0].hand=[4];state.players[0].handCount=1;
 state.inspection={kind,actor:0,target:2,controller:0,cards:kind==="priest"?[{seat:2,value:9}]:[{seat:0,value:4},{seat:2,value:9}]};
 state.legalActions=[{type:"continue"}];
 const commands=gameCommands;
 await page.goto("/jogos/love-letter?partida=ABCDEF654321");
 const table=page.getByLabel("Mesa do Love Letter"),scene=table.getByTestId("love-table-scene");
 await expect(scene).toHaveAttribute("data-staging-count",kind==="priest"?"1":"2");
 await expect(table.getByRole("button",{name:"Continuar",exact:true})).toBeEnabled();
 await expect(scene.getByLabel("Bot 2 · 9",{exact:true})).toBeAttached();
 const discardMove = scene.getByRole("button", { name: "Mover descarte", exact: true });
 await expect(discardMove).toBeVisible();
 const before = (await discardMove.boundingBox())!;
 await discardMove.focus(); await discardMove.press("ArrowRight");
 await expect.poll(async () => (await discardMove.boundingBox())!.x).toBeGreaterThan(before.x);
 expect(commands).toEqual([]);
 await page.waitForTimeout(1800); // Longer than the normal playback frame: reading has no automatic timeout.
 expect(commands).toEqual([]);
 await page.reload();
 await expect(scene).toHaveAttribute("data-staging-count",kind==="priest"?"1":"2");
 await table.getByRole("button",{name:"Continuar",exact:true}).click();
 await expect.poll(()=>commands).toEqual([{type:"continue"}]);
 state.inspection=null;state.turn=1;state.legalActions=[];
 loveRoom.version++;
 sockets.emit("room",{room:loveRoom,frames:[],reset:true});
 await expect(scene).toHaveAttribute("data-staging-count","0");
 await expect(table.getByRole("button",{name:"Continuar",exact:true})).toHaveCount(0);
});

test("revelação privada mostra somente versos e espera para os demais jogadores",async({page})=>{
 prepareLoveTable();
 if(!loveRoom || loveRoom.status==="lobby" || !("privateInfo" in loveRoom.state))throw Error("Fixture Love Letter ausente");
 loveRoom.state.turn=2;loveRoom.state.legalActions=[];
 loveRoom.state.inspection={kind:"priest",actor:2,target:3,controller:2,cards:[{seat:3,value:null}]};
 await page.goto("/jogos/love-letter?partida=ABCDEF654321");
 const scene=page.getByTestId("love-table-scene");
 await expect(scene).toHaveAttribute("data-staging-count","1");
 await expect(scene.getByLabel("Bot 3 · Carta oculta",{exact:true})).toBeAttached();
 await expect(page.getByRole("button",{name:"Continuar",exact:true})).toHaveCount(0);
 await expect(page.getByText("Bot 2 está observando as cartas.",{exact:true})).toBeVisible();
});

test("Love Letter preserva escolha do Chanceler, Condessa obrigatória e próxima rodada",async({page})=>{
 prepareLoveTable();
 if(!loveRoom || loveRoom.status==="lobby" || !("privateInfo" in loveRoom.state))throw new Error("Fixture Love Letter ausente");
 const state=loveRoom.state;
 state.pending=true;state.players[0].hand=[1,4,9];state.players[0].handCount=3;
 state.legalActions=[{type:"keep",cards:[9,1,4]},{type:"keep",cards:[9,4,1]}];
 const commands=gameCommands;
 await page.goto("/jogos/love-letter?partida=ABCDEF654321");
 await selectLoveCard(page, "Manter carta 3: 9 · Princesa");
 await selectLoveCard(page, "Devolver carta 2: 4 · Aia");
 await expect.poll(()=>commands[0]).toEqual({type:"keep",cards:[9,4,1]});
 state.pending=false;state.players[0].hand=[7,8];state.players[0].handCount=2;
 state.legalActions=[{type:"play",card:8}];
 await page.reload();
 await expect(page.getByRole("button",{name:"Descartar 7 · Rei",exact:true})).toHaveCount(0);
 await selectLoveCard(page, "Descartar 8 · Condessa");
 await expect.poll(()=>commands[1]).toEqual({type:"play",card:8});
 state.phase="summary";state.winners=[0];state.legalActions=[{type:"next"}];
 await page.reload();
 await page.getByRole("button",{name:"Distribuir próxima rodada",exact:true}).click();
 await expect.poll(()=>commands[2]).toEqual({type:"next"});
});


test("Love Letter apresenta bots em sequência e libera apenas a decisão final privada",async({page})=>{
 prepareLoveTable();
 if(!loveRoom || loveRoom.status==="lobby" || !("privateInfo" in loveRoom.state))throw Error("Fixture ausente");
 await page.goto("/jogos/love-letter?partida=ABCDEF654321");
 const turnStatus=page.locator("[data-game-actions]").getByRole("status");
 await expect(turnStatus).toHaveText("Escolha uma carta para descartar");
 const initial=structuredClone(loveRoom);
 if(!("privateInfo" in initial.state))throw Error("Fixture Love Letter ausente");
 const publicState={...initial.state,turn:2,legalActions:[],privateInfo:[],players:initial.state.players.map((p,i)=>({...p,hand:null,handCount:i===0?1:p.handCount}))};
 const second={...publicState,turn:3,deckCount:10,log:[...publicState.log,"Bot 2 jogou 4."],players:publicState.players.map((p,i)=>i===2?{...p,discard:[4,4]}:p)};
 const finalState={...second,turn:0,legalActions:initial.state.legalActions};
 loveRoom=gameRoomSchema.parse({...initial,version:5,state:{...initial.state,log:second.log,deckCount:9}});
 sockets.emit("room",{room:loveRoom,reset:false,frames:[{version:3,action:{type:"step"},state:publicState},{version:4,action:{type:"step"},state:second},{version:5,action:{type:"step"},state:finalState}]});
 const table=page.getByLabel("Mesa do Love Letter");
 await expect(turnStatus).toHaveText(/Aguarde a jogada…|Movendo cartas/);
 await expect(table.getByLabel("Carta oculta",{exact:true})).toHaveCount(5);
 await expect(table.getByRole("button",{name:"Baralho",exact:true})).toBeDisabled();
 // A duplicate final snapshot must not cancel the active frame queue.
 sockets.emit("room",{room:loveRoom,reset:false,frames:[]});
 await expect(turnStatus).toHaveText("Escolha uma carta para descartar");
 await expect(table.getByRole("button",{name:"Descartar 1 · Guarda",exact:true})).toBeEnabled({timeout:10000});
 await expect(table.getByRole("button",{name:"Descartar 1 · Guarda",exact:true})).toBeVisible();
});

test("Love Letter abre resultado após as jogadas, permite reabrir e voltar ao lobby dev",async({page})=>{
 prepareLoveTable();
 if(!loveRoom || loveRoom.status==="lobby" || !("privateInfo" in loveRoom.state))throw Error("Fixture ausente");
 await page.goto("/jogos/love-letter?partida=ABCDEF654321&teste=1");
 await expect(page.getByLabel("Mesa do Love Letter")).toBeVisible();
 const result=page.getByRole("dialog",{name:"Resultado da partida"});
 await expect(result).toHaveCount(0);
 const initial=structuredClone(loveRoom);
 const finalState={...initial.state,phase:"over",round:5,winners:[0,1],legalActions:[],players:initial.state.players.map((player,seat)=>({...player,tokens:seat<2?3:0}))};
 loveRoom=gameRoomSchema.parse({...initial,status:"finished",version:4,durationSeconds:125,state:finalState});
 sockets.emit("room",{room:loveRoom,reset:false,frames:[{version:3,action:{type:"step"},state:{...initial.state,turn:2,legalActions:[]}},{version:4,action:{type:"step"},state:finalState}]});
 await expect(page.locator("[data-game-actions]").getByRole("status")).toHaveText(/Aguarde a jogada…|Movendo cartas/);
 await expect(result).toBeVisible({timeout:10000});
 await expect(result.getByText("Ana e Bot 1",{exact:true})).toBeVisible();
 await expect(result.getByText("2 min 05 s",{exact:true})).toBeVisible();
 await expect(result.getByRole("list",{name:"Classificação final"}).getByRole("listitem")).toHaveCount(6);
 await expect(result.getByText("3 fichas",{exact:true})).toHaveCount(2);
 await result.getByRole("button",{name:"Fechar",exact:true}).first().click();
 sockets.emit("room",{room:loveRoom,frames:[],reset:true});
 await expect(result).toHaveCount(0);
 await page.getByRole("button",{name:"Ver resultado",exact:true}).click();
 await expect(result).toBeVisible();
 await page.reload();
 await expect(result).toBeVisible();
 await result.getByRole("button",{name:"Jogar novamente",exact:true}).click();
 await expect(page).toHaveURL("/jogos/love-letter?teste=1");
 await expect(result).toHaveCount(0);
});

test("Love Letter não abre resultado em resumo de rodada ou partida abandonada",async({page})=>{
 prepareLoveTable();
 if(!loveRoom || loveRoom.status==="lobby" || !("privateInfo" in loveRoom.state))throw Error("Fixture ausente");
 loveRoom.state.phase="summary";loveRoom.state.winners=[0];
 await page.goto("/jogos/love-letter?partida=ABCDEF654321");
 await expect(page.locator("[data-game-actions]").getByRole("status")).toContainText("Rodada encerrada");
 await expect(page.getByRole("dialog",{name:"Resultado da partida"})).toHaveCount(0);
 loveRoom=gameRoomSchema.parse({...loveRoom,version:3,status:"abandoned"});
 sockets.emit("room",{room:loveRoom,frames:[],reset:true});
 await expect(page.getByText("Teste encerrado.",{exact:true})).toBeVisible();
 await expect(page.getByRole("button",{name:"Ver resultado",exact:true})).toHaveCount(0);
});

test("catálogo Love Letter reutiliza cartas, miniaturas e versos das duas edições",async({page})=>{
 await page.goto("/admin/jogos/laboratorio/love-letter");
 await expect(page.getByRole("heading",{name:"Cartas do Love Letter",exact:true})).toBeVisible();
 await expect(page.getByRole("region",{name:"Edição clássica"}).getByRole("article")).toHaveCount(8);
 await expect(page.getByRole("region",{name:"Edição moderna"}).getByRole("article")).toHaveCount(10);
 await expect(page.getByText("Verso · normal, reduzido e miniatura",{exact:true})).toHaveCount(2);
 const layout=await page.evaluate(()=>({
  viewport:window.innerWidth,
  scrollWidth:document.documentElement.scrollWidth,
  offenders:[...document.querySelectorAll<HTMLElement>("main *")].map(element=>{
   const rect=element.getBoundingClientRect();
   return {tag:element.tagName,className:element.className,left:rect.left,right:rect.right,width:rect.width};
  }).filter(rect=>rect.right>window.innerWidth+1 || rect.left < -1).sort((a,b)=>b.right-a.right).slice(0,8),
 }));
 expect(layout.scrollWidth,JSON.stringify(layout)).toBeLessThanOrEqual(layout.viewport);
});

test("estados de teste não recriam assinaturas e sair remove a observação",async({page})=>{
 prepareLoveTable();
 await page.goto("/jogos/love-letter?partida=ABCDEF654321");
 await expect(page.getByRole("region",{name:"Mesa do Love Letter"})).toBeVisible();
 await expect.poll(()=>roomWatches.length).toBe(1);
 for(let index=0;index<5;index++){
  if(!loveRoom || loveRoom.status==="lobby" || !("privateInfo" in loveRoom.state))throw new Error("Fixture Love Letter ausente");
  const round=index+2;
  loveRoom=gameRoomSchema.parse({...loveRoom,version:loveRoom.version+1,state:{...loveRoom.state,round,log:[...loveRoom.state.log,`Rodada ${round} iniciada.`]}});
  sockets.emit("room",{room:loveRoom,frames:[],reset:false});
  await expect(page.getByText(`Rodada ${round} iniciada.`,{exact:true})).toBeVisible();
 }
 expect(roomWatches).toHaveLength(1);
 const latestVersion=loveRoom!.version;
 for(const socket of sockets.sockets.sockets.values())socket.conn.close();
 await expect.poll(()=>roomWatches.length).toBe(2);
 expect(roomWatches.at(-1)?.afterVersion).toBe(latestVersion);
 await page.goto("/jogos");
 sockets.emit("room",{room:loveRoom,frames:[],reset:false});
 await expect(page.getByRole("region",{name:"Mesa do Love Letter"})).toHaveCount(0);
 await page.goto("/jogos/love-letter?partida=ABCDEF654321");
 await expect(page.getByRole("region",{name:"Mesa do Love Letter"})).toBeVisible();
 await expect.poll(()=>roomWatches.length).toBe(3);
});

test("navbar acompanha partidas e avisa turno fora da mesa sem repetir alertas", async ({page,isMobile}) => {
 await page.route("**/avatar-fixture.svg",route=>route.fulfill({contentType:"image/svg+xml",body:'<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="pink"/></svg>'}));
 const flip={code:"ABCDEF123456",game:"flip7" as const,gameName:"Flip 7",status:"playing" as const,development:false,yourTurn:false,turnKey:null,participants:[{userId:id,username:"ana",displayName:"Ana",avatarUrl:null,seat:0},{userId:matchId,username:"beto",displayName:"Beto",avatarUrl:"/avatar-fixture.svg",seat:1}]};
 const love={...flip,code:"ABCDEF654321",game:"love-letter" as const,gameName:"Love Letter",status:"lobby" as const,development:true,participants:[...flip.participants,...Array.from({length:6},(_,i)=>({userId:null,seat:i+2,username:`Bot ${i+1}`,displayName:`Bot ${i+1}`,avatarUrl:null,bot:true}))]};
 personalMatches={items:[flip]};
 await page.goto("/jogos");
 const direct=page.getByRole("link",{name:"Voltar à partida de Flip 7"});
 await expect(direct).toHaveAttribute("href","/jogos/flip7?partida=ABCDEF123456");
 if(isMobile)await page.getByRole("button",{name:"Abrir menu",exact:true}).click();
 await page.getByRole("link",{name:"Ver carteira",exact:true}).filter({visible:true}).first().click();
 await expect(page).toHaveURL(/\/carteira$/);
 await expect(direct).toBeVisible();
 personalMatches={items:[flip,love]};sockets.emit("personal-matches",personalMatches);
 await page.getByRole("button",{name:"Minhas partidas (2)"}).click();
 await expect(page.getByRole("menuitem").filter({hasText:"Love Letter"})).toHaveAttribute("href","/jogos/love-letter?partida=ABCDEF654321");
 const card=page.getByRole("menuitem").filter({hasText:"Love Letter"});
 await expect(card.getByLabel("Ana",{exact:true})).toBeVisible();
 await expect(card.getByRole("img",{name:"Beto",exact:true})).toHaveAttribute("src",new URL("/avatar-fixture.svg",page.url()).href);
 for(let i=1;i<=6;i++)await expect(card.getByLabel(`Bot ${i}`,{exact:true})).toBeVisible();
 await expect(card.getByText("No lobby",{exact:true})).toBeVisible();
 await expect(card.getByText("#654321",{exact:true})).toBeVisible();
 await page.keyboard.press("Escape");
 personalMatches={items:[{...flip,yourTurn:true,turnKey:"1:0"},love]};
 sockets.emit("personal-matches",personalMatches);
 const alert=page.getByRole("link",{name:"Sua vez em Flip 7"});
 await expect(alert).toBeVisible();
 sockets.emit("personal-matches",personalMatches);
 await expect(alert).toHaveCount(1);
 await page.getByRole("button",{name:"Fechar notificação",exact:true}).click();
 await expect(alert).toHaveCount(0);
 sockets.emit("personal-matches",personalMatches);
 await page.getByRole("button",{name:"Minhas partidas (2)"}).click();
 await expect(page.getByRole("menuitem").filter({hasText:"Flip 7"}).getByText("Sua vez",{exact:true})).toBeVisible();
 await page.keyboard.press("Escape");
 await expect(alert).toHaveCount(0);
 // Reconnection replays the same summary without resurrecting a dismissed alert.
 const connections=[...sockets.sockets.sockets.keys()];
 for(const socket of sockets.sockets.sockets.values())socket.conn.close();
 await expect.poll(()=>[...sockets.sockets.sockets.keys()].filter(key=>!connections.includes(key)).length).toBe(connections.length);
 sockets.emit("personal-matches",personalMatches);
 await expect(alert).toHaveCount(0);
 // A new turn can notify again, but the toast expires instead of blocking forever.
 personalMatches={items:[{...flip,yourTurn:true,turnKey:"2:0"},love]};
 sockets.emit("personal-matches",personalMatches);
 await expect(alert).toBeVisible();
 await page.mouse.move(0,0);
 await expect(alert).toHaveCount(0,{timeout:10000});
 sockets.emit("personal-matches",personalMatches);
 await expect(alert).toHaveCount(0);
 personalMatches={items:[{...flip,yourTurn:true,turnKey:"3:0"},love]};
 sockets.emit("personal-matches",personalMatches);
 await expect(alert).toBeVisible();
 await alert.click();
 await expect(page).toHaveURL(/\/jogos\/flip7\?partida=ABCDEF123456/);
 await expect(alert).toHaveCount(0);
 // Completion removes the stale shortcut; only the other game's lobby remains.
 personalMatches={items:[love]};sockets.emit("personal-matches",personalMatches);
 await expect(page.getByRole("link",{name:"Voltar à partida de Love Letter"})).toBeVisible();
 personalMatches={items:[]};sockets.emit("personal-matches",personalMatches);
 await expect(page.getByRole("link",{name:"Voltar à partida de Love Letter"})).toHaveCount(0);
});

test("configurações declaradas pelo jogo respeitam limites e guardam a escolha pessoal",async({page})=>{
 upcoming={...game,id:"93089d02-0b34-4b78-9d3e-f2679c190b5e",slug:"love-letter",name:"Love Letter"};
 await page.goto("/jogos/love-letter?teste=1");
 await expect(page.getByRole("button",{name:"Jogar",exact:true})).toBeEnabled();
 await page.getByRole("button",{name:"Jogar",exact:true}).click();
 let dialog=page.getByRole("dialog");
 const mode=dialog.getByLabel("Modo do Love Letter"),count=dialog.getByLabel("Número de jogadores",{exact:true});
 await expect(count.locator("option")).toHaveCount(5);
 await mode.selectOption("modern");
 await expect(count.locator("option")).toHaveCount(5);
 await count.selectOption("6");
 await page.reload();
 await page.getByRole("button",{name:"Jogar",exact:true}).click();
 dialog=page.getByRole("dialog");
 await expect(dialog.getByLabel("Modo do Love Letter")).toHaveValue("modern");
 await expect(dialog.getByLabel("Número de jogadores",{exact:true})).toHaveValue("6");
 await dialog.getByLabel("Modo do Love Letter").selectOption("classic");
 await expect(dialog.getByLabel("Número de jogadores",{exact:true})).toHaveValue("4");
 await page.reload();
 await page.getByRole("button",{name:"Jogar",exact:true}).click();
 await expect(page.getByRole("dialog").getByLabel("Modo do Love Letter")).toHaveValue("classic");
 await expect(page.getByRole("dialog").getByLabel("Número de jogadores",{exact:true})).toHaveValue("4");
});

test("aviso de expiração permite manter lobby aberto fora da página do jogo", async ({page}) => {
 personalMatches={items:[{code:"ABCDEF123456",game:"flip7",gameName:"Flip 7",status:"lobby",development:false,yourTurn:false,turnKey:null,participants:[],lobbyExpiresAt:new Date(Date.now()+31*60000).toISOString()}]};
 await page.goto("/jogos");
 const keep=page.getByRole("button",{name:"Manter lobby aberto"});
 await expect(keep).toHaveCount(0);
 personalMatches={items:personalMatches.items.map(item=>({...item,lobbyExpiresAt:new Date(Date.now()+90000).toISOString()}))};
 sockets.emit("personal-matches",personalMatches);
 await expect(keep).toBeVisible();
 await keep.click();
 await expect(keep).toHaveCount(0);
 await expect(page).toHaveURL(/\/jogos$/);
 // A second warning disappears when the lobby closes, including other tabs.
 personalMatches={items:personalMatches.items.map(item=>({...item,lobbyExpiresAt:new Date(Date.now()+90000).toISOString()}))};
 sockets.emit("personal-matches",personalMatches);await expect(keep).toBeVisible();
 personalMatches={items:[]};sockets.emit("personal-matches",personalMatches);await expect(keep).toHaveCount(0);
});

test("pilhas da mesa continuam ajustáveis fora da vez sem enviar jogadas", async ({ page }) => {
 prepareLoveTable();
 if (!loveRoom || loveRoom.status === "lobby" || !("privateInfo" in loveRoom.state)) throw new Error("Fixture Love Letter ausente");
 loveRoom.state.turn = 1; loveRoom.state.legalActions = [];
 const commands = gameCommands;
 await page.goto("/jogos/love-letter?partida=ABCDEF654321");
 const scene = page.getByTestId("love-table-scene");
 await expect(scene.locator("canvas")).toBeVisible();
 for (const name of ["Rotacionar deck", "Redimensionar deck", "Rotacionar descarte", "Redimensionar descarte"]) {
  const control = scene.getByRole("button", { name, exact: true });
  await expect(control).toBeEnabled();
  const description = scene.locator(`[id="${await control.getAttribute("aria-describedby")}"]`);
  const before = await description.textContent();
  await control.focus(); await control.press(name === "Redimensionar descarte" ? "ArrowLeft" : "ArrowRight");
  await expect(description).not.toHaveText(before!);
 }
 const deck = scene.getByRole("button", { name: "Baralho", exact: true });
 await expect(deck).toHaveAttribute("aria-disabled", "true");
 const before = (await deck.boundingBox())!;
 const rotate = scene.getByRole("button", { name: "Rotacionar deck", exact: true });
 await rotate.focus(); await rotate.press("Alt+ArrowRight");
 await expect.poll(async () => (await deck.boundingBox())!.x).not.toBe(before.x);
 expect(commands).toEqual([]);
});


test("admin separa testes e mostra duração média e replay paginado",async({page})=>{
 await page.goto(`/admin/jogos/${id}`);
 await expect(page.getByRole("list",{name:"Partidas do jogo"}).getByRole("link")).toHaveCount(1);
 const source=page.getByRole("combobox",{name:"Origem das partidas"});
 await source.selectOption("development");
 await expect(source).toHaveValue("development");
 const averages=page.getByLabel("Médias dos testes");
 await expect(averages).toContainText("3 partidas");
 await expect(averages).toContainText("Em reprodução: 2 min 00 s");
 await page.getByRole("list",{name:"Partidas do jogo"}).getByRole("link").click();
 await expect(page.getByText("Jogada registrada 1.",{exact:true})).toBeVisible();
 await page.getByRole("button",{name:"Final",exact:true}).click();
 await expect(page.getByText("Jogada registrada 105.",{exact:true})).toBeVisible();
});

test("resultado de teste Love Letter mostra tempo ativo e reproduz na barra compartilhada sem comandos",async({page})=>{
 prepareLoveTable();
 if(!loveRoom || loveRoom.status==="lobby" || !("winners" in loveRoom.state))throw Error("Fixture ausente");
 loveRoom=gameRoomSchema.parse({...loveRoom,status:"finished",durationSeconds:125,activeDurationSeconds:90,state:{...loveRoom.state,phase:"over",winners:[0],legalActions:[]}});
 await page.goto("/jogos/love-letter?partida=ABCDEF654321&teste=1");
 const result=page.getByRole("dialog",{name:"Resultado da partida"});
 await expect(result).toContainText("Em reprodução: 1 min 30 s");
 await result.getByRole("button",{name:"Replay",exact:true}).click();
 await expect(page.getByText("Primeira jogada do teste.",{exact:true})).toBeVisible();
 const table=page.getByLabel("Mesa do Love Letter",{exact:true});
 const bar=table.locator("[data-game-actions]");
 const controls=bar.getByLabel("Controles de reprodução",{exact:true});
 await expect(controls).toBeVisible();
 await expect(page.getByLabel("Controles de reprodução",{exact:true})).toHaveCount(1);
 await expect(bar.getByRole("heading")).toHaveCount(0);
 const panel=bar.locator(":scope > div");
 expect(await panel.evaluate(el=>el.getBoundingClientRect().width)).toBeLessThanOrEqual(576);
 const slider=controls.getByLabel("Ir para jogada");
 await expect(slider).toHaveCSS("appearance","none");
 await expect(slider).toHaveCSS("border-top-width","0px");
 await controls.getByLabel("Velocidade da reprodução").selectOption("500");
 await expect(controls.getByLabel("Velocidade da reprodução")).toHaveValue("500");
 await controls.getByRole("button",{name:"Próxima jogada",exact:true}).click();
 await expect(page.getByText("Última jogada do teste.",{exact:true})).toBeVisible();
 await expect(controls.getByRole("button",{name:"Reproduzir",exact:true})).toBeDisabled();
 await controls.getByRole("button",{name:"Início",exact:true}).click();
 await expect(page.getByText("Primeira jogada do teste.",{exact:true})).toBeVisible();
 await controls.getByRole("button",{name:"Reproduzir",exact:true}).click();
 await expect(page.getByText("Última jogada do teste.",{exact:true})).toBeVisible();
 await expect(controls.getByRole("button",{name:"Pausar",exact:true})).toHaveCount(0);
 expect(gameCommands).toEqual([]);
 await page.getByRole("button",{name:"Voltar ao resultado"}).click();
 await expect(result).toBeVisible();
});

test("sidebar do jogo mostra jogadores e duração", async ({page}) => {
 upcoming={...game,id:"93089d02-0b34-4b78-9d3e-f2679c190b5e",slug:"love-letter",name:"Love Letter",averageDurationSeconds:1260};
 await page.goto("/jogos/love-letter?teste=1");
 const aside=page.getByLabel("Apresentação do jogo");
 const info=aside.getByLabel("Sobre o jogo");
 await expect(info.getByText("2 / 6",{exact:true})).toBeVisible();
 await expect(info.getByText("21 min.",{exact:true})).toBeVisible();
 const title=await aside.getByRole("heading",{name:"Love Letter",exact:true}).boundingBox();
 const tags=await info.getByLabel("Informações do jogo").boundingBox();
 expect(tags!.y).toBeGreaterThan(title!.y);
 upcoming={...upcoming,averageDurationSeconds:null};
 await page.reload();
 await expect(info.getByText("2 / 6",{exact:true})).toBeVisible();
 await expect(info.getByText("21 min.",{exact:true})).toHaveCount(0);
});

test("admin salva a duração padrão do jogo em minutos", async ({page}) => {
 await page.goto(`/admin/jogos/${id}`);
 await page.getByLabel("Duração padrão (minutos)").fill("35");
 await page.getByRole("button",{name:"Salvar jogo",exact:true}).click();
 await expect(page).toHaveURL(/\/admin\/jogos$/);
 expect(game.fallbackDurationMinutes).toBe(35);
});

test("altera o slug de jogo existente e preserva o motor e suas configurações", async ({page}) => {
  game.moduleId="flip7";
  await page.goto(`/admin/jogos/${id}`);
  await page.getByLabel("Endereço do jogo",{exact:true}).fill("Sete Cartas");
  await page.getByRole("button",{name:"Salvar jogo",exact:true}).click();
  await expect(page).toHaveURL(/\/admin\/jogos$/);
  expect(game.slug).toBe("sete-cartas");
  expect(game.moduleId).toBe("flip7");
  await page.goto("/jogos/sete-cartas");
  await expect(page.getByRole("heading",{name:"Flip 7",exact:true}).first()).toBeVisible();
  await expect(page.getByLabel("Informações do jogo")).toContainText("2 / 12");
});

test("exclui jogo do catálogo com confirmação e permite cancelar", async ({page}) => {
  upcoming={...game,id:"93089d02-0b34-4b78-9d3e-f2679c190b5e",slug:"roleta",name:"Roleta"};
  await page.goto(`/admin/jogos/${upcoming.id}`);
  await page.getByRole("button",{name:"Excluir jogo",exact:true}).click();
  const dialog=page.getByRole("dialog");
  await expect(dialog).toContainText("histórico de partidas");
  await dialog.getByRole("button",{name:"Cancelar",exact:true}).click();
  expect(upcoming).not.toBeNull();
  await page.getByRole("button",{name:"Excluir jogo",exact:true}).click();
  await dialog.getByRole("button",{name:"Excluir jogo",exact:true}).click();
  await expect(page).toHaveURL(/\/admin\/jogos$/);
  expect(upcoming).toBeNull();
  await expect(page.getByRole("list",{name:"Jogos",exact:true}).getByRole("listitem")).toHaveCount(1);
});

function prepareSolo(){
 upcoming={...game,id:"93089d02-0b34-4b78-9d3e-f2679c190b5e",moduleId:"solo",slug:"solo",name:"Solo"};
 const red={id:"red5",kind:"number",number:5,color:"red"};
 const wild={id:"wild",kind:"wild",number:null,color:null};
 loveRoom=gameRoomSchema.parse({id:matchId,code:"ABCDEF654321",game:"solo",rulesVersion:1,version:2,capacity:3,options:{mode:"single",brutal:false},hostId:id,participants:[{userId:id,username:"Admin",displayName:"Ana",avatarUrl:null,seat:0}],development:true,bots:2,onlyBots:false,status:"playing",state:{game:"solo",mode:"single",round:1,turn:1,direction:1,phase:"playing",activeColor:"red",deckCount:80,discard:[{...red,id:"top"}],penalty:0,penaltyKind:null,pendingCall:null,drawn:false,winners:[],log:["Rodada 1."],players:[{name:"Ana",kind:"human",hand:[red,wild],handCount:2,points:0},...[1,2].map(n=>({name:`Bot ${n}`,kind:"normal",hand:null,handCount:8,points:0}))],legalActions:[{type:"solo-play",seat:0,cardId:"red5",solo:false},{type:"solo-play",seat:0,cardId:"red5",solo:true}]}});
}
test("Solo em desenvolvimento permite intervenção e anúncio fora da vez sem expor mãos",async({page})=>{
 prepareSolo();
 await page.goto("/jogos/solo?partida=ABCDEF654321");
 const table=page.getByTestId("solo-table-scene");await expect(table).toBeVisible();
 await expect(table.getByText("Vez de Bot 1",{exact:true})).toBeVisible();
 await page.getByRole("button",{name:"Anunciar Solo!",exact:true}).click();
 const card=table.getByRole("button",{name:"Intervir com 5 vermelho",exact:true});await card.focus();await card.press("Enter");
 await expect.poll(()=>gameCommands[0]).toEqual({type:"solo-play",seat:0,cardId:"red5",solo:true});
 await expect(table.getByRole("button",{name:"Comprar",exact:true})).toHaveCount(0);
 await expect(table.getByRole("button",{name:/Jogar .*Bot/})).toHaveCount(0);
 await page.reload();await expect(table).toBeVisible();
});
test("Solo escolhe cor, mostra penalidade e usa descarte central",async({page})=>{
 prepareSolo();if(!loveRoom || loveRoom.status==="lobby" || !("game" in loveRoom.state))throw Error("Solo ausente");
 const state=loveRoom.state;state.turn=0;state.penalty=4;state.penaltyKind="draw4";
 state.legalActions=[{type:"solo-draw",seat:0},...(["red","yellow","green","blue"] as const).map(color=>({type:"solo-play" as const,seat:0,cardId:"wild",color,solo:false}))];
 await page.goto("/jogos/solo?partida=ABCDEF654321");
 const table=page.getByTestId("solo-table-scene");await expect(table).toHaveAttribute("data-discard-count","1");
 await expect(table.getByRole("button",{name:"Comprar 4",exact:true})).toBeVisible();
 const wild=table.getByRole("button",{name:"Jogar Escolher cor",exact:true});await wild.focus();await wild.press("Enter");
 await table.getByRole("button",{name:"Escolher azul",exact:true}).click();
 await expect.poll(()=>gameCommands[0]).toEqual({type:"solo-play",seat:0,cardId:"wild",color:"blue",solo:false});
});
test("Solo continua em breve para contas comuns e o lobby dev limita a dez pessoas",async({page})=>{
 prepareSolo();sessionRole="user";
 await page.goto("/jogos/solo");await expect(page.getByText("Em breve",{exact:true})).toBeVisible();
 await expect(page.getByRole("button",{name:"Jogar",exact:true})).toHaveCount(0);
 sessionRole="admin";await page.goto("/jogos/solo");
 await expect(page.getByRole("switch",{name:"Modo dev",exact:true})).toBeChecked();
 await expect(page.getByRole("switch",{name:"Modo dev",exact:true})).toBeDisabled();
 await page.getByRole("button",{name:"Jogar",exact:true}).click();
 await expect(page.getByRole("dialog").getByLabel("Duração",{exact:true})).toBeVisible();
});
