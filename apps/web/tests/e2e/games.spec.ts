import { flip7Driver } from "../../../api/src/modules/games/flip7/driver";
import { Server as SocketServer } from "socket.io";
import { gameRoomSchema, seoFieldsSchema, type PersonalMatches } from "@croebet/shared";
import { createServer, type Server } from "node:http";
import { expect, test } from "@playwright/test";
import type { GameRecord } from "@croebet/shared";

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
let loveRoom: ReturnType<typeof gameRoomSchema.parse> | null = null;
let personalMatches: PersonalMatches = {items:[]};
let roomWatches: { code: string; afterVersion: number }[] = [];
function respond(path: string, method: string, body: Record<string, unknown> = {}): { status: number; data: unknown } {
  const url=new URL(path,"http://fixture");
  path=url.pathname;
  if(loveRoom && path===`/api/v1/matches/${loveRoom.code}`)return {status:200,data:loveRoom};
  if(path===`/api/v1/admin/games/${id}/matches`) return {status:200,data:{items:url.searchParams.get("q")==="ninguém"?[]:[historyMatch],hasMore:false}};
  if(path==="/api/v1/me/history")return {status:200,data:{items:[{id:`game:${matchId}`,matchId,matchCode:historyMatch.code,gameSlug:"flip7",kind:"game",description:"Flip 7 · Partida concluída",createdAt:historyMatch.endedAt,amount:null}],hasMore:false}};
  if(path===`/api/v1/me/matches/${historyMatch.code}` || path===`/api/v1/admin/games/${id}/matches/${matchId}`) {
    const offset=Number(url.searchParams.get("offset")??0),limit=Number(url.searchParams.get("limit")??100);
    return {status:200,data:{match:historyMatch,finalState:historyFinalState,frames:replayFrames.slice(offset,offset+limit),offset,hasMore:offset+limit<105}};
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
  if (path === "/api/v1/games/flip7" && game.enabled) return { status: 200, data: game };
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
    socket.on("watch",(request,ack)=>{
      ack?.({ok:true,data:{}});
      if(loveRoom && request.active!==false && request.code===loveRoom.code){
        roomWatches.push({code:request.code,afterVersion:request.afterVersion});
        // Bound a regression loop so the test fails without flooding its server.
        if(roomWatches.length<=10)socket.emit("room",{room:loveRoom,frames:[],reset:true});
      }
      if(loveRoom && request.directory){
        const summary={...loveRoom, state:undefined};
        socket.emit("lobbies",{items:[],joined:[],owned:null,active:null,testMatches:[{...summary,round:1,controllerIds:[]}]});
      }
    });
  });
  await new Promise<void>((resolve, reject) => { api.once("error", reject); api.listen(3201, "127.0.0.1", resolve); });
});
test.afterAll(async () => { await new Promise<void>(resolve => sockets.close(() => resolve())); });
test.beforeEach(async ({ page, context }) => {
  loveRoom = null;roomWatches=[];personalMatches={items:[]};
  game = { id, seo: seoFieldsSchema.parse({}), slug: "flip7", name: "Flip 7", description: "", enabled: true, imageUrl: null, version: 1 }; failure = false; upcoming = null; sessionRole = "admin";
  await context.addCookies([{ name: "croebet-session", value: "games-test", url: "http://127.0.0.1:3100" }]);
  await page.route("**/api/v1/**", async route => {
    const req = route.request(); const result = respond(new URL(req.url()).pathname+new URL(req.url()).search, req.method(), req.postDataJSON() ?? {});
    await route.fulfill({ status: result.status, json: result.data });
  });
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
  await expect(page.getByLabel("Imagem de capa")).toHaveValue("");
  await page.getByLabel("Nome do jogo").fill("Flip da comunidade");
  await page.getByLabel("Descrição",{exact:true}).fill("Compre cartas com seus amigos.");
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
  await publicPage.goto("/jogos/flip7");
  await expect(publicPage.getByRole("heading", { name: "404", exact: true })).toBeVisible();
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
  await page.getByLabel("Endereço do jogo",{exact:true}).fill("blackjack");
  await page.getByLabel("Descrição",{exact:true}).fill("Um novo jogo para a comunidade.");
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

test("histórico abre o link original com resultado; Replay usa a mesa e a barra inferior", async ({ page }) => {
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
  const controls=page.locator("[data-flip7-controls]");
  await expect(controls.getByLabel("Controles de reprodução")).toBeVisible();
  await controls.getByRole("button",{name:"Pausar",exact:true}).click();
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

test("Love Letter no modo dev reutiliza configurações, vagas e listagem de salas",async({page})=>{
 upcoming={...game,id:"93089d02-0b34-4b78-9d3e-f2679c190b5e",slug:"love-letter",name:"Love Letter"};
 await page.goto("/jogos/love-letter?teste=1");
 await expect(page.getByLabel("Apresentação do jogo").getByRole("switch",{name:"Modo dev",exact:true})).toBeChecked();
 await expect(page.getByLabel("Apresentação do jogo").getByText("Desenvolvimento",{exact:true})).toBeVisible();
 await expect(page.getByText("Sem Croins, estatísticas ou conquistas.",{exact:true})).toHaveCount(0);
 await expect(page.getByLabel("Configuração e regras")).toBeVisible();
 await expect(page.getByLabel("Jogadores e vagas")).toBeVisible();
 await expect(page.getByLabel("Lobbies abertos")).toBeVisible();
 await expect(page.getByLabel("Modo do Love Letter").locator("option")).toHaveText(["Clássico","Moderno"]);
 await expect(page.getByRole("switch",{name:"Somente bots",exact:true})).toBeVisible();
 await expect(page.getByRole("group",{name:"Aposta da partida"})).toHaveCount(0);
 await expect(page.getByRole("button",{name:"Criar partida de teste",exact:true})).toHaveCount(0);
 await expect(page.getByRole("switch",{name:"Modo dev",exact:true})).toBeDisabled();
 await page.goto("/jogos/love-letter");
 await expect(page.getByRole("switch",{name:"Modo dev",exact:true})).toBeChecked();
 await expect(page.getByRole("switch",{name:"Modo dev",exact:true})).toBeDisabled();
 await expect(page.getByLabel("Configuração e regras")).toBeVisible();
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
 await expect(page.getByLabel("Configuração e regras")).toHaveCount(0);
 await expect(page.getByRole("switch",{name:"Modo dev",exact:true})).toHaveCount(0);
});


test("abrir teste do Love Letter mantém link, recarga e volta para o jogo",async({page},testInfo)=>{
 upcoming={...game,id:"93089d02-0b34-4b78-9d3e-f2679c190b5e",slug:"love-letter",name:"Love Letter"};
 loveRoom=gameRoomSchema.parse({id:matchId,code:"ABCDEF654321",game:"love-letter",rulesVersion:1,version:2,capacity:2,options:{mode:"classic",brutal:false},hostId:id,participants:[],development:true,bots:2,onlyBots:true,status:"playing",state:{mode:"classic",round:1,turn:0,phase:"playing",deckCount:12,removed:[],winners:[],log:[],pending:false,players:["Bot 1","Bot 2"].map(name=>({name,kind:"normal",hand:null,handCount:1,discard:[],protected:false,out:false,tokens:0})),privateInfo:[],legalActions:[]}});
 await page.goto("/jogos/love-letter?teste=1");
 await page.getByRole("button",{name:"Visualizar",exact:true}).click();
 await expect(page).toHaveURL("/jogos/love-letter?partida=ABCDEF654321&teste=1");
 await expect(page.getByLabel("Controles de desenvolvimento",{exact:true})).toBeVisible();
 await page.reload();
 await expect(page.getByLabel("Controles de desenvolvimento",{exact:true})).toBeVisible();
 if(testInfo.project.name==="desktop"){
  await page.getByRole("link",{name:"Voltar para Love Letter",exact:true}).click();
  await expect(page).toHaveURL("/jogos/love-letter?teste=1");
  await expect(page.getByLabel("Modo do Love Letter")).toBeVisible();
 }
});

function prepareLoveTable() {
 upcoming={...game,id:"93089d02-0b34-4b78-9d3e-f2679c190b5e",slug:"love-letter",name:"Love Letter"};
 loveRoom=gameRoomSchema.parse({id:matchId,code:"ABCDEF654321",game:"love-letter",rulesVersion:1,version:2,capacity:6,options:{mode:"modern",brutal:false},hostId:id,participants:[{userId:id,username:"Admin",displayName:"Ana",avatarUrl:null,seat:0}],development:true,bots:5,onlyBots:false,status:"playing",state:{mode:"modern",round:1,turn:0,phase:"playing",deckCount:12,removed:[],winners:[],log:["Rodada 1 iniciada.","Bot 1 jogou Aia."],pending:false,players:[{name:"Ana",kind:"human",hand:[1,4],handCount:2,discard:[],protected:false,out:false,tokens:1},...[1,2,3,4,5].map(index=>({name:`Bot ${index}`,kind:"normal",hand:null,handCount:1,discard:[4],protected:index===1,out:index===5,tokens:0}))],privateInfo:[],legalActions:[{type:"play",card:1,target:2,guess:9},{type:"play",card:1,target:3,guess:8},{type:"play",card:4}]}});
}

test("mesa Love Letter seleciona cartas, valida alvo/palpite e recolhe histórico",async({page},testInfo)=>{
 prepareLoveTable();
 const commands:unknown[]=[];
 await page.route("**/api/v1/matches/ABCDEF654321/love-command",async route=>{commands.push(route.request().postDataJSON().action);await route.fulfill({json:{ok:true}});});
 await page.goto("/jogos/love-letter?partida=ABCDEF654321");
 const table=page.getByLabel("Mesa do Love Letter");
 await expect(table.getByRole("status")).toHaveText("Sua vez");
 await expect(page.getByLabel("Carta oculta",{exact:true})).toHaveCount(5);
 await expect(table.getByText("Protegido",{exact:false})).toBeVisible();
 await expect(table.getByText("Eliminado",{exact:false})).toBeVisible();
 const submit=table.getByRole("button",{name:"Jogar carta",exact:true});
 await expect(submit).toBeDisabled();
 await expect(page.getByLabel("Jogador",{exact:true})).toHaveCount(0);
 await page.getByRole("button",{name:"Selecionar 1 · Guarda",exact:true}).click();
 await expect(submit).toBeDisabled();
 await page.getByLabel("Jogador",{exact:true}).selectOption("2");
 await expect(page.getByLabel("Palpite",{exact:true}).locator('option[value="8"]')).toHaveCount(0);
 await expect(submit).toBeDisabled();
 await page.getByLabel("Palpite",{exact:true}).selectOption("9");
 await expect(submit).toBeEnabled();
 await submit.click();
 await expect.poll(()=>commands).toEqual([{type:"play",card:1,target:2,guess:9}]);
 await page.getByRole("button",{name:"Selecionar 4 · Aia",exact:true}).click();
 await expect(page.getByLabel("Jogador",{exact:true})).toHaveCount(0);
 await submit.click();
 await expect.poll(()=>commands.length).toBe(2);
 expect(commands[1]).toEqual({type:"play",card:4});
 await page.getByRole("button",{name:"Ocultar histórico",exact:true}).click();
 await expect(page.getByRole("complementary",{name:"Histórico da partida"})).toHaveCount(0);
 await page.getByRole("button",{name:"Histórico",exact:true}).click();
 await expect(page.getByRole("complementary",{name:"Histórico da partida"})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.screenshot({path:testInfo.outputPath("love-letter-table.png"),fullPage:true});
});

test("Love Letter preserva escolha do Chanceler, Condessa obrigatória e próxima rodada",async({page})=>{
 prepareLoveTable();
 if(!loveRoom || loveRoom.status==="lobby" || !("legalActions" in loveRoom.state))throw new Error("Fixture Love Letter ausente");
 const state=loveRoom.state;
 state.pending=true;state.players[0].hand=[1,4,9];state.players[0].handCount=3;
 state.legalActions=[{type:"keep",cards:[9,1,4]},{type:"keep",cards:[9,4,1]}];
 const commands:unknown[]=[];
 await page.route("**/api/v1/matches/ABCDEF654321/love-command",async route=>{commands.push(route.request().postDataJSON().action);await route.fulfill({json:{ok:true}});});
 await page.goto("/jogos/love-letter?partida=ABCDEF654321");
 await page.getByLabel("Carta para manter e ordem no fundo").selectOption("1");
 await page.getByRole("button",{name:"Confirmar escolha",exact:true}).click();
 await expect.poll(()=>commands[0]).toEqual({type:"keep",cards:[9,4,1]});
 state.pending=false;state.players[0].hand=[7,8];state.players[0].handCount=2;
 state.legalActions=[{type:"play",card:8}];
 await page.reload();
 await expect(page.getByRole("button",{name:"Selecionar 7 · Rei",exact:true})).toHaveCount(0);
 await page.getByRole("button",{name:"Selecionar 8 · Condessa",exact:true}).click();
 await page.getByRole("button",{name:"Jogar carta",exact:true}).click();
 await expect.poll(()=>commands[1]).toEqual({type:"play",card:8});
 state.phase="summary";state.winners=[0];state.legalActions=[{type:"next"}];
 await page.reload();
 await page.getByRole("button",{name:"Próxima rodada",exact:true}).click();
 await expect.poll(()=>commands[2]).toEqual({type:"next"});
});


test("estados de teste não recriam assinaturas e sair remove a observação",async({page})=>{
 prepareLoveTable();
 await page.goto("/jogos/love-letter?partida=ABCDEF654321");
 await expect(page.getByRole("region",{name:"Mesa do Love Letter"})).toBeVisible();
 await expect.poll(()=>roomWatches.length).toBe(1);
 for(let index=0;index<5;index++){
  if(!loveRoom || loveRoom.status==="lobby" || !("legalActions" in loveRoom.state))throw new Error("Fixture Love Letter ausente");
  loveRoom=gameRoomSchema.parse({...loveRoom,version:loveRoom.version+1,state:{...loveRoom.state,round:index+2}});
  sockets.emit("room",{room:loveRoom,frames:[],reset:false});
  await expect(page.getByText(`Rodada ${index+2}`,{exact:true})).toBeVisible();
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

test("navbar acompanha partidas e avisa turno fora da mesa sem repetir alertas", async ({page}) => {
 const flip={code:"ABCDEF123456",game:"flip7" as const,gameName:"Flip 7",status:"playing" as const,development:false,yourTurn:false,turnKey:null};
 const love={...flip,code:"ABCDEF654321",game:"love-letter" as const,gameName:"Love Letter",status:"lobby" as const,development:true};
 personalMatches={items:[flip]};
 await page.goto("/jogos");
 const direct=page.getByRole("link",{name:"Voltar à partida de Flip 7"});
 await expect(direct).toHaveAttribute("href","/jogos/flip7?partida=ABCDEF123456");
 await page.getByRole("link",{name:"Ver carteira",exact:true}).first().click();
 await expect(page).toHaveURL(/\/carteira$/);
 await expect(direct).toBeVisible();
 personalMatches={items:[flip,love]};sockets.emit("personal-matches",personalMatches);
 await page.getByRole("button",{name:"Minhas partidas (2)"}).click();
 await expect(page.getByRole("menuitem").filter({hasText:"Love Letter"})).toHaveAttribute("href","/jogos/love-letter?partida=ABCDEF654321");
 await page.keyboard.press("Escape");
 personalMatches={items:[{...flip,yourTurn:true,turnKey:"1:0"},love]};
 sockets.emit("personal-matches",personalMatches);
 const alert=page.getByRole("link",{name:"Sua vez em Flip 7"});
 await expect(alert).toBeVisible();
 sockets.emit("personal-matches",personalMatches);
 await expect(alert).toHaveCount(1);
 await alert.click();
 await expect(page).toHaveURL(/\/jogos\/flip7\?partida=ABCDEF123456/);
 await expect(alert).toHaveCount(0);
 // Completion removes the stale shortcut; only the other game's lobby remains.
 personalMatches={items:[love]};sockets.emit("personal-matches",personalMatches);
 await expect(page.getByRole("link",{name:"Voltar à partida de Love Letter"})).toBeVisible();
 personalMatches={items:[]};sockets.emit("personal-matches",personalMatches);
 await expect(page.getByRole("link",{name:"Voltar à partida de Love Letter"})).toHaveCount(0);
});
