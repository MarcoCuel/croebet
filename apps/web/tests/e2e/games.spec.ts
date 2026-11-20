import { flip7Driver } from "../../../api/src/modules/games/flip7/driver";
import { seoFieldsSchema } from "@croebet/shared";
import { createServer, type Server } from "node:http";
import { expect, test } from "@playwright/test";
import type { GameRecord } from "@croebet/shared";

const id = "93089d02-0b34-4b78-9d3e-f2679c190b5c";
const matchId = "93089d02-0b34-4b78-9d3e-f2679c190b5a";
const replayState = flip7Driver.project(flip7Driver.create({ setup: [{name:"Ana",kind:"human"},{name:"Beto",kind:"human"}], options:{mode:"classic",brutal:false} },"Ana"));
const replayFrames = Array.from({length:105},(_,index)=>({ version:index+1, action:{type:"step" as const}, state:{...replayState, round:index+1, log:[{message:`Jogada registrada ${index+1}.`}]}}));
const historyMatch = { id:matchId, gameId:id, code:"ABCDEF123456",rulesVersion:1,status:"finished",options:{mode:"classic",brutal:false},startedAt:"2026-11-20T01:00:00Z",endedAt:"2026-11-20T02:00:00Z",players:[{seat:0,userId:id,name:"Ana",score:210,winner:true,bot:false},{seat:1,userId:null,name:"Beto",score:180,winner:false,bot:false}],frameCount:105 };
let game: GameRecord;
let failure = false;
let api: Server;
function respond(path: string, method: string, body: Record<string, unknown> = {}): { status: number; data: unknown } {
  const url=new URL(path,"http://fixture");
  path=url.pathname;
  if(path===`/api/v1/admin/games/${id}/matches`) return {status:200,data:{items:url.searchParams.get("q")==="ninguém"?[]:[historyMatch],hasMore:false}};
  if(path===`/api/v1/admin/games/${id}/matches/${matchId}`) {
    const offset=Number(url.searchParams.get("offset")??0),limit=Number(url.searchParams.get("limit")??100);
    return {status:200,data:{match:historyMatch,frames:replayFrames.slice(offset,offset+limit),offset,hasMore:offset+limit<105}};
  }
  if (path === "/api/v1/me") return { status: 200, data: { user: { id, username: "Admin", displayName: "Admin", role: "admin" } } };
  if (path === "/api/v1/economy") return { status: 200, data: { initialBalance: 30, dailyReward: 10, dailyResetTimeZone: "America/Sao_Paulo", suggestedBets: [1, 5, 10, 50], defaultBet: 5 } };
  if (path === "/api/v1/rewards/daily") return { status: 200, data: { balance: 30, eligible: true, lastClaimAt: null, nextClaimAt: null, serverNow: new Date().toISOString() } };
  if (path === "/api/v1/auth/csrf") return { status: 200, data: { token: "fixture" } };
  if (path === "/api/v1/pages") return { status: 200, data: { items: [] } };
  if (path === "/api/v1/navigation") return { status: 200, data: { main: [], footer: [] } };
  if (failure && path.includes("games")) return { status: 503, data: {} };
  if (path === "/api/v1/admin/games") return { status: 200, data: { items: [game] } };
  if (path === `/api/v1/admin/games/${id}`) {
    if (method === "PATCH") {
      if (body.version !== game.version) return { status: 409, data: { error: { message: "O jogo foi alterado." } } };
      game = { ...game, ...body, version: game.version + 1 } as GameRecord;
    }
    return { status: 200, data: game };
  }
  if (path === "/api/v1/games") return { status: 200, data: { items: game.enabled ? [game] : [] } };
  if (path === "/api/v1/games/flip7" && game.enabled) return { status: 200, data: game };
  return { status: 404, data: {} };
}
test.beforeAll(async () => {
  api = createServer((req, res) => {
    const result = respond(req.url ?? "", req.method ?? "GET");
    res.writeHead(result.status, { "content-type": "application/json" }); res.end(JSON.stringify(result.data));
  });
  await new Promise<void>((resolve, reject) => { api.once("error", reject); api.listen(3201, "127.0.0.1", resolve); });
});
test.afterAll(async () => { if (api?.listening) await new Promise<void>(resolve => api.close(() => resolve())); });
test.beforeEach(async ({ page, context }) => {
  game = { id, seo: seoFieldsSchema.parse({}), slug: "flip7", name: "Flip 7", description: "", enabled: true, imageUrl: null, version: 1 }; failure = false;
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
  await list.getByRole("link", { name: "Editar", exact: true }).click();
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
  await list.getByRole("button", { name: "Pausar" }).click();
  await expect(list.getByText("Inativo", { exact: true })).toBeVisible();
  expect(game.description).toBe("Compre cartas com seus amigos.");
  await publicPage.reload();
  await expect(publicPage.getByText("Nenhum jogo disponível.")).toBeVisible();
  await publicPage.goto("/jogos/flip7");
  await expect(publicPage.getByRole("heading", { name: "404", exact: true })).toBeVisible();
  await list.getByRole("button", { name: "Ativar" }).click();
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

test("admin consulta vencedores e reproduz jogadas sem alterar a partida", async ({ page }) => {
  await page.goto(`/admin/jogos/${id}`);
  const list=page.getByRole("list",{name:"Partidas do jogo"});
  await expect(list.getByText("Vencedor: Ana",{exact:true})).toBeVisible();
  await page.getByRole("searchbox",{name:"Buscar partidas por código ou participante"}).fill("ninguém");
  await expect(page.getByText("Nenhuma partida encontrada.")).toBeVisible();
  await page.getByRole("searchbox",{name:"Buscar partidas por código ou participante"}).fill("");
  await list.getByRole("link",{name:"Ver histórico"}).click();
  await expect(page.getByText("Jogada registrada 1.",{exact:true})).toBeVisible();
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
