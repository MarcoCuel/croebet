import { matchSchema } from "@croebet/shared";
import { createDeck, createGame, transition } from "../../../api/src/modules/games/flip7/engine";
import { flip7Driver } from "../../../api/src/modules/games/flip7/driver";
import { test, expect, type Page, type Browser } from "@playwright/test";
import { startPublicApi } from "../public-api-fixture";
import { matchesFixture, fixtureUser, matchUsers } from "../matches-api-fixture";

async function openMatchOptions(page: Page) {
  const menu = page.locator('[data-slot="dropdown-menu-content"][data-state="open"]');
  if (!await menu.isVisible()) await page.getByRole("button", { name: "Opções da partida", exact: true }).click();
  await expect(menu).toBeVisible();
}
function matchOptions(page: Page) {
  return page.getByRole("menu", { name: "Opções da partida", exact: true });
}
async function closeMatchOptions(page: Page) {
  const menu = page.locator('[data-slot="dropdown-menu-content"][data-state="open"]');
  const trigger = page.getByRole("button", { name: "Opções da partida", exact: true });
  if (await menu.isVisible()) {
    await trigger.click();
    if (await menu.isVisible()) await page.keyboard.press("Escape");
  }
  await expect(menu).toBeHidden();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
}

let fixture:ReturnType<typeof matchesFixture>;
let close:(()=>Promise<void>)|undefined;
test.beforeEach(async({context})=>{
  fixture=matchesFixture();close=undefined;close=await startPublicApi(fixtureUser,fixture.handler,fixture.attach);
  await context.addCookies([{name:"croebet-session",value:"game-fixture-marco",url:"http://127.0.0.1:3100"}]);
});
test.afterEach(async({context})=>{try{await context.close();}finally{await close?.();}});
test("sidebar, criação em modal e card da sala preservam configuração e ações",async({page},testInfo)=>{
  await page.goto("/jogos/flip7");
  const aside=page.getByLabel("Apresentação do jogo"),list=page.getByLabel("Lobbies abertos");
  await expect(aside.getByRole("heading",{name:"Flip da comunidade",exact:true})).toBeVisible();
  await expect(aside.getByText("2 / 12",{exact:true})).toBeVisible();
  await expect(aside.getByRole("button",{name:"Regras",exact:true})).toBeVisible();
  await expect(list.locator('[data-slot="empty-state"]')).toHaveText("Nenhum lobby aberto por enquanto.");
  if(testInfo.project.name==="desktop"){
    const asideBox=await aside.boundingBox(),listBox=await list.boundingBox();
    expect(asideBox!.x+asideBox!.width).toBeLessThan(listBox!.x);
    expect(asideBox!.y).toBe(listBox!.y);
  }
  await page.getByRole("button",{name:"Jogar",exact:true}).click();
  const create=page.getByRole("dialog");
  await expect(create.getByRole("heading",{name:"Configurar sala",exact:true})).toBeVisible();
  await expect(create.getByLabel("Modo do Flip7")).toBeEnabled();
  await expect(create.getByLabel("Número de jogadores")).toHaveValue("2");
  await create.getByLabel("Número de jogadores").selectOption("4");
  await create.getByRole("button",{name:"Criar sala",exact:true}).click();
  await expect(page).toHaveURL(/partida=[A-F0-9]{12}/);
  await expect(create).toHaveCount(0);
  const seats=list.getByRole("list",{name:"Vagas do lobby"});
  await expect(list.getByText("Sala de Marco",{exact:true})).toBeVisible();
  await expect(seats.getByRole("listitem")).toHaveCount(4);
  await expect(page.getByRole("button",{name:"Jogar",exact:true})).toBeDisabled();
  await expect(page.getByRole("button",{name:"Cancelar",exact:true})).toBeVisible();
  await expect(page.getByRole("button",{name:"Editar",exact:true})).toBeVisible();
  await expect(page.getByRole("button",{name:"Jogar",exact:true})).toHaveCount(0);
  await expect(page.getByLabel("Configuração e regras")).toHaveCount(0);
  await expect(page.getByLabel("Jogadores e vagas")).toHaveCount(0);
  await page.getByRole("button",{name:"Editar",exact:true}).click();
  const edit=page.getByRole("dialog");
  await expect(edit.getByRole("heading",{name:"Editar partida",exact:true})).toBeVisible();
  await edit.getByLabel("Número de jogadores").selectOption("3");
  await edit.getByRole("button",{name:"Concluir",exact:true}).click();
  await expect(edit).toHaveCount(0);
  await expect(seats.getByRole("listitem")).toHaveCount(3);
  await page.reload();
  await expect(page).toHaveURL(/partida=[A-F0-9]{12}/);
  await expect(page.getByRole("button",{name:"Editar",exact:true})).toBeVisible();
  await expect(seats.getByRole("listitem")).toHaveCount(3);
  expect(fixture.states.size).toBe(1);
  await page.getByRole("button",{name:"Cancelar",exact:true}).click();
  await expect(page.getByRole("button",{name:"Jogar",exact:true})).toBeEnabled();
  await expect(list.getByText("Nenhum lobby aberto por enquanto.")).toBeVisible();
  await page.getByRole("button",{name:"Jogar",exact:true}).click();
  await page.getByRole("dialog").getByRole("button",{name:"Criar sala",exact:true}).click();
  await expect(page.getByRole("button",{name:"Cancelar",exact:true})).toBeVisible();
  expect(fixture.states.size).toBe(1);
});
test("criar sala preserva escolhas próprias ao entrar em outra sala",async({page,browser})=>{
  await page.goto("/jogos/flip7");
  await page.getByRole("button",{name:"Jogar",exact:true}).click();
  let dialog=page.getByRole("dialog");
  await dialog.getByLabel("Número de jogadores").selectOption("5");
  await dialog.getByLabel("Modo do Flip7").selectOption("vengeance");
  await dialog.getByRole("switch",{name:"Modo Brutal",exact:true}).click();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  const peer=await second(browser);
  try{
    await peer.page.goto("/jogos/flip7");
    await peer.page.getByRole("button",{name:"Jogar",exact:true}).click();
    await peer.page.getByRole("dialog").getByRole("button",{name:"Criar sala",exact:true}).click();
    await expect(peer.page).toHaveURL(/partida=[A-F0-9]{12}/);
    const foreignCode=new URL(peer.page.url()).searchParams.get("partida")!;
    await page.goto(peer.page.url());
    await expect(page.getByRole("button",{name:"Aguardando o host",exact:true})).toBeVisible();
    await expect(page.getByLabel("Lobbies abertos").getByRole("list",{name:"Vagas do lobby"}).getByRole("listitem")).toHaveCount(2);
    await page.reload();
    await page.getByRole("button",{name:"Jogar",exact:true}).click();
    dialog=page.getByRole("dialog");
    await expect(dialog.getByLabel("Número de jogadores")).toHaveValue("5");
    await expect(dialog.getByLabel("Modo do Flip7")).toHaveValue("vengeance");
    await expect(dialog.getByRole("switch",{name:"Modo Brutal",exact:true})).toBeChecked();
    await dialog.getByRole("button",{name:"Criar sala",exact:true}).click();
    await expect(page).toHaveURL(/partida=[A-F0-9]{12}/);
    const ownCode=new URL(page.url()).searchParams.get("partida")!;
    expect(ownCode).not.toBe(foreignCode);
    expect(fixture.states.get(ownCode)!.room.capacity).toBe(5);
    expect(fixture.states.get(ownCode)!.room.options).toEqual({mode:"vengeance",brutal:true});
    await page.getByRole("button",{name:"Editar",exact:true}).click();
    dialog=page.getByRole("dialog");
    await expect(dialog.getByLabel("Número de jogadores")).toHaveValue("5");
    await page.keyboard.press("Escape");
    await page.reload();
    await page.getByRole("button",{name:"Editar",exact:true}).click();
    dialog=page.getByRole("dialog");
    await expect(dialog.getByLabel("Número de jogadores")).toHaveValue("5");
    await dialog.getByLabel("Número de jogadores").selectOption("6");
    await dialog.getByRole("button",{name:"Concluir",exact:true}).click();
    await page.getByLabel("Lobbies abertos").locator("li").filter({hasText:"Sala de Marco"}).getByRole("button",{name:"Cancelar",exact:true}).click();
    await page.reload();
    await page.getByRole("button",{name:"Jogar",exact:true}).click();
    dialog=page.getByRole("dialog");
    await expect(dialog.getByLabel("Número de jogadores")).toHaveValue("6");
    await expect(dialog.getByLabel("Modo do Flip7")).toHaveValue("vengeance");
    await expect(dialog.getByRole("switch",{name:"Modo Brutal",exact:true})).toBeChecked();
  }finally{await peer.context.close();}
});
test("lobby e notificações compartilham o handshake mesmo com CSRF lento",async({page})=>{
  let requests=0,completed=0,release!:()=>void;
  page.on("response",response=>{if(new URL(response.url()).pathname==="/api/v1/auth/csrf" && response.ok())completed++;});
  const gate=new Promise<void>(resolve=>{release=resolve;});
  await page.route("**/api/v1/auth/csrf",async route=>{requests++;await gate;await route.continue();});
  try{
    await page.goto("/jogos/flip7");
    await expect.poll(()=>requests).toBeGreaterThan(0);
    await expect(page.getByRole("button",{name:"Jogar",exact:true})).toBeDisabled();
    release();
    await page.getByRole("button",{name:"Jogar",exact:true}).click();
    await page.getByRole("dialog").getByRole("button",{name:"Criar sala",exact:true}).click();
    await expect(page).toHaveURL(/partida=[A-F0-9]{12}/);
    expect(completed).toBe(1);
  }finally{release();}
});
async function lobby(page:Page){
  await page.goto("/jogos/flip7");
  await page.getByRole("button",{name:"Jogar",exact:true}).click();
  await page.getByRole("dialog").getByLabel("Número de jogadores").selectOption("6");
  await page.getByRole("dialog").getByRole("button",{name:"Criar sala",exact:true}).click();
  await expect(page).toHaveURL(/partida=[A-F0-9]{12}/);
  await expect(page.getByRole("button",{name:"Jogar",exact:true})).toBeDisabled();
}
async function second(browser:Browser){
  const context=await browser.newContext();
  await context.addCookies([{name:"croebet-session",value:"game-fixture-beto",url:"http://127.0.0.1:3100"}]);
  const page=await context.newPage();return {context,page};
}
async function start(page:Page,browser:Browser){
  await lobby(page);const peer=await second(browser);
  await peer.page.goto("/jogos/flip7");
  await peer.page.getByRole("button",{name:"Entrar na sala de Marco, vaga 2",exact:true}).click();
  await expect(peer.page).toHaveURL(page.url());
  await expect(peer.page.getByRole("button",{name:"Aguardando o host",exact:true})).toBeVisible();
  await expect(page.getByRole("button",{name:"Jogar",exact:true})).toBeEnabled();
  await page.getByRole("button",{name:"Jogar",exact:true}).click();
  await expect(page.getByRole("button",{name:"Comprar",exact:true})).toBeVisible();
  return peer;
}
test("lobby e mesa exibem nome da pessoa quando diferente do usuário", async ({ page, browser }) => {
  const originalNames = matchUsers.map(user => user.displayName);
  matchUsers[0].displayName = "Marco Pessoa";
  matchUsers[1].displayName = "Roberto Pessoa";
  const peer = await second(browser);
  try {
    await page.goto("/jogos/flip7");
    await page.getByRole("button", { name: "Criar sala", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Criar sala", exact: true }).click();
    await expect(page).toHaveURL(/partida=[A-F0-9]{12}/);
    const list=page.getByLabel("Lobbies abertos");
    await expect(list.getByText("Sala de Marco Pessoa",{exact:true})).toBeVisible();
    await peer.page.goto(page.url());
    await expect(list.getByRole("list",{name:"Vagas do lobby"}).getByRole("listitem",{name:/Roberto Pessoa/})).toBeVisible();
    await expect(page.getByRole("button", { name: "Jogar", exact: true })).toBeEnabled();
    await page.getByRole("button", { name: "Jogar", exact: true }).click();
    await expect(page.getByRole("region", { name: "Mesa de Marco Pessoa", exact: true })).toBeVisible();
    await expect(page.getByRole("region", { name: "Mesa de Roberto Pessoa", exact: true })).toBeVisible();
  } finally {
    await peer.context.close();
    matchUsers.forEach((user, index) => { user.displayName = originalNames[index]; });
  }
});
test("cartas e camadas de animação permanecem abaixo do navbar", async ({ page, browser }) => {
  const peer = await start(page, browser);
  try {
    const board = page.getByRole("region", { name: "Mesa de Flip7" });
    await expect(page.locator("[data-flying-card], [data-moving-card]")).toHaveCount(0);
    for (const zIndex of [20, 30, 40]) {
      // Force overlap at each card layer without depending on animation timing.
      const coveredByNavbar = await board.evaluate((element, layer) => {
        const header = document.querySelector("header")!;
        const bounds = header.getBoundingClientRect();
        const x = bounds.left + bounds.width / 2;
        const y = bounds.top + bounds.height / 2;
        const card = element.querySelector('[aria-label$="cartas no baralho"]')!.cloneNode(true) as HTMLElement;
        Object.assign(card.style, { position: "fixed", left: `${x - 10}px`, top: `${y - 10}px`, width: "20px", height: "20px", zIndex: String(layer), pointerEvents: "auto" });
        element.append(card);
        const top = document.elementFromPoint(x, y);
        const covered = top !== null && header.contains(top);
        card.remove();
        return covered;
      }, zIndex);
      expect(coveredByNavbar).toBe(true);
    }
  } finally { await peer.context.close(); }
});
test("baralho fica acima da barra inferior e os jogadores ficam no aside, acima do histórico", async ({ page }) => {
  const code = "ABCDEF123456";
  const privateState = createGame(matchUsers.map(user => ({ name: user.username, kind: "human" as const })), 42, { mode: "classic", brutal: false });
  const state = flip7Driver.project(privateState);
  const deck = createDeck("classic");
  const first = deck.splice(deck.findIndex(card => card.type === "number"), 1)[0];
  state.players[0].cards = [first];
  state.players.forEach(player => { player.hasDrawn = true; });
  const room = matchSchema.parse({ id: "93089d02-0b34-4b78-9d3e-f2679c190b5e", code, game: "flip7", rulesVersion: 1, version: 1, status: "playing", state, hostId: matchUsers[0].id, capacity: 2, options: { mode: "classic", brutal: false }, participants: matchUsers.map((user, seat) => ({ userId: user.id, username: user.username, displayName: user.displayName, avatarUrl: null, seat })) });
  privateState.players = structuredClone(state.players);
  privateState.deck = deck;
  fixture.states.set(code, { room, privateState, frames: [] });
  await page.goto(`/jogos/flip7?partida=${code}`);
  const deckElement = page.getByLabel(/cartas no baralho$/);
  const users = page.getByLabel("Usuários da partida");
  const content = page.locator("[data-game-table-content]");
  const layout = page.locator("[data-game-table-layout]");
  const aside = page.locator("[data-game-table-aside]");
  const history = page.getByRole("complementary", { name: "Histórico da partida", exact: true });
  await expect(deckElement).toBeVisible();
  await expect(users).toBeVisible();
  const [deckBox, actionBox, usersBox, contentBox, historyBox, asideBox, layoutBox] = await Promise.all([
    deckElement.boundingBox(),
    page.locator("[data-game-actions] > div").last().boundingBox(),
    users.boundingBox(),
    content.boundingBox(),
    history.boundingBox(),
    aside.boundingBox(),
    layout.boundingBox(),
  ]);
  expect(deckBox!.y + deckBox!.height).toBeLessThanOrEqual(actionBox!.y);
  expect(Math.abs(deckBox!.x + deckBox!.width / 2 - actionBox!.x - actionBox!.width / 2)).toBeLessThan(2);
  // Os participantes saíram da mesa e passaram a ocupar o topo do aside,
  // imediatamente antes do histórico.
  expect(usersBox!.y + usersBox!.height).toBeLessThanOrEqual(historyBox!.y);
  if (layoutBox!.width < 768) {
    expect(usersBox!.y).toBeGreaterThanOrEqual(contentBox!.y + contentBox!.height);
  } else {
    expect(usersBox!.x).toBeGreaterThanOrEqual(contentBox!.x + contentBox!.width);
    expect(usersBox!.width).toBeLessThanOrEqual(asideBox!.width);
  }
  await page.getByRole("button", { name: "Comprar carta do baralho", exact: true }).click();
  await expect(page.locator("[data-flying-card]")).toBeVisible();
});
test("vários lobbies aceitam a mesma conta e o primeiro início cancela as outras filas",async({page,browser},testInfo)=>{
  await lobby(page);const firstCode=new URL(page.url()).searchParams.get("partida")!;
  const peer=await second(browser);
  try{
    await peer.page.goto(page.url());
    await expect(peer.page.getByRole("button",{name:"Aguardando o host",exact:true})).toBeVisible();
    await peer.page.getByRole("button",{name:"Jogar",exact:true}).click();
    await peer.page.getByRole("dialog").getByRole("button",{name:"Criar sala",exact:true}).click();
    await expect(peer.page).not.toHaveURL(page.url());
    await expect(peer.page.getByLabel("Lobbies abertos").locator("li").filter({hasText:"Sala de Beto"}).getByRole("button",{name:"Cancelar",exact:true})).toBeVisible();
    expect(fixture.states.size).toBe(2);
    await page.getByRole("button",{name:"Entrar na sala de Beto, vaga 2",exact:true}).click();
    await expect(page).toHaveURL(peer.page.url());
    await page.reload();
    await expect(page.getByRole("button",{name:"Aguardando o host",exact:true})).toBeVisible();
    for(const saved of fixture.states.values())expect(saved.room.participants).toHaveLength(2);
    await expect(page.getByRole("button",{name:"Meu lobby",exact:true})).toHaveCount(0);
    const cards=page.getByLabel("Lobbies abertos").locator(':scope > ul > li');
    const boxes=await cards.evaluateAll(items=>items.map(item=>{const {x,y,width,height}=item.getBoundingClientRect();return {x,y,width,height};}));
    expect(boxes).toHaveLength(2);
    if(testInfo.project.name==="desktop"){expect(boxes[0].y).toBe(boxes[1].y);expect(boxes[1].x).toBeGreaterThan(boxes[0].x);}
    await expect(page.getByRole("button",{name:"Editar",exact:true})).toBeVisible();
    await expect(page.getByRole("button",{name:"Aguardando o host",exact:true})).toBeVisible();
    await page.getByRole("button",{name:"Jogar",exact:true}).click();
    for(const client of [page,peer.page]){
      await expect(client).toHaveURL(new RegExp("partida="+firstCode));
      await expect(client.getByRole("region",{name:"Mesa de Flip7"})).toBeVisible();
    }
    expect(fixture.states.size).toBe(1);
    expect([...fixture.states.values()][0].room.status).toBe("playing");
    await peer.page.reload();
    await expect(peer.page.getByRole("region",{name:"Mesa de Flip7"})).toBeVisible();
  }finally{await peer.context.close();}
});
test("sala de seis começa com duas contas e sincroniza turnos e retorno após reload",async({page,browser})=>{
  const peer=await start(page,browser);
  try{
    expect([...fixture.states.values()][0].room.participants).toHaveLength(2);
    await expect(page.locator('[data-player-hand]').first()).toHaveAttribute("data-player-hand", "0");
    await expect(peer.page.locator('[data-player-hand]').first()).toHaveAttribute("data-player-hand", "1");
    await expect(page.getByLabel("Usuários da partida").locator("p").first()).toHaveText("Marco");
    await expect(peer.page.getByLabel("Usuários da partida").locator("p").first()).toHaveText("Beto");
    await expect(peer.page.getByRole("button",{name:"Comprar",exact:true})).toHaveCount(0);
    await page.getByRole("button",{name:"Parar",exact:true}).click();
    await expect(peer.page.getByRole("button",{name:"Comprar",exact:true})).toBeVisible();
    await expect(page.getByRole("button",{name:"Comprar",exact:true})).toHaveCount(0);
    await peer.page.getByRole("button",{name:"Comprar",exact:true}).click();
    await expect.poll(()=>fixture.commands.length).toBe(2);
    const room=[...fixture.states.values()][0].room;
    if(room.status==="lobby")throw Error("Partida não iniciada");
    await expect(page.locator('[data-player-hand="1"] [data-hand-card]')).toHaveCount(room.state.players[1].cards.length);
    const url=page.url();await page.reload();await expect(page).toHaveURL(url);
    expect(JSON.stringify(room)).not.toContain('"deck":');expect(JSON.stringify(room)).not.toContain('"seed":');
    expect(await page.evaluate(()=>localStorage.getItem("croebet:flip7:match"))).toBeNull();
  }finally{await peer.context.close();}
});
test("HTTP na LAN permite criar e jogar sem crypto.randomUUID",async({page,context,browser})=>{
  await context.addInitScript(()=>{Object.defineProperty(Crypto.prototype,"randomUUID",{configurable:true,value:undefined});});
  const peer=await start(page,browser);
  try{
    expect(await page.evaluate(()=>typeof crypto.randomUUID)).toBe("undefined");
    await page.getByRole("button",{name:"Parar",exact:true}).click();
    await expect(peer.page.getByRole("button",{name:"Comprar",exact:true})).toBeVisible();
    await expect.poll(()=>fixture.commands.length).toBe(1);
  }finally{await peer.context.close();}
});
test("Socket.IO reconecta sem reload e recupera a decisão recebida durante a queda",async({page,browser})=>{
  const sockets:string[]=[];page.on("websocket",socket=>sockets.push(socket.url()));
  const peer=await start(page,browser);
  try{
    await peer.context.setOffline(true);
    fixture.disconnectUser("93089d02-0b34-4b78-9d3e-f2679c190b5d");
    await expect(peer.page.getByRole("status").filter({hasText:"Reconectando à partida"})).toBeVisible();
    await expect(peer.page.getByRole("button",{name:"Comprar",exact:true})).toHaveCount(0);
    await page.getByRole("button",{name:"Parar",exact:true}).click();
    await expect.poll(()=>fixture.commands.length).toBe(1);
    await peer.context.setOffline(false);
    await expect(peer.page.getByRole("button",{name:"Comprar",exact:true})).toBeVisible({timeout:15000});
    await peer.page.getByRole("button",{name:"Comprar",exact:true}).click();
    await expect.poll(()=>fixture.commands.length).toBe(2);
    expect(sockets.some(url=>new URL(url).pathname==="/api/v1/realtime")).toBe(true);
  }finally{await peer.context.close();}
});
test("aba oculta toca o efeito e o retorno mostra o estado atual sem repetir",async({page,browser})=>{
  await instrumentAudio(page);
  const peer=await start(page,browser);
  try{
    const url=page.url();
    const leave=async()=>{
      const sidebar=page.getByRole("button",{name:"Mostrar menu lateral",exact:true});
      if(await sidebar.isVisible())await sidebar.click();
      const menu=page.getByRole("button",{name:"Abrir menu",exact:true});
      if(await menu.isVisible())await menu.click();
      await page.getByRole("link",{name:"Jogos",exact:true}).first().click();
      await expect(page).toHaveURL(/\/jogos$/);
    };
    const before=fixture.commands.length;
    // Client navigation must release the room watcher without abandoning the seat.
    await leave();
    await expect.poll(()=>fixture.watches.at(-1)?.active).toBe(false);
    for(let visit=0;visit<3;visit++){
      await page.goto(url);
      await expect(page.getByRole("button",{name:"Comprar",exact:true})).toBeVisible();
      expect(fixture.commands).toHaveLength(before);
      if(visit<2)await leave();
    }
    await page.evaluate(()=>{
      Object.defineProperty(document,"hidden",{configurable:true,value:true});
      Object.defineProperty(document,"visibilityState",{configurable:true,value:"hidden"});
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.getByRole("button",{name:"Parar",exact:true}).click();
    await expect(peer.page.getByRole("button",{name:"Comprar",exact:true})).toBeVisible();
    const effects=await page.evaluate(()=>(window as unknown as {playedEffects:number}).playedEffects);
    await peer.page.getByRole("button",{name:"Comprar",exact:true}).click();
    await expect.poll(()=>fixture.commands.length).toBe(before+2);
    const saved=[...fixture.states.values()][0].room;
    if(saved.status==="lobby")throw Error("Partida não iniciada");
    // Wait for the remote snapshot to be consumed while the tab is still hidden.
    await expect(page.locator('[data-player-hand="1"] [data-hand-card]')).toHaveCount(saved.state.players[1].cards.length);
    // The confirmed action is heard even with the tab hidden.
    await expect.poll(()=>page.evaluate(()=>(window as unknown as {playedEffects:number}).playedEffects)).toBeGreaterThan(effects);
    await page.evaluate(()=>{Reflect.deleteProperty(document,"hidden");Reflect.deleteProperty(document,"visibilityState");document.dispatchEvent(new Event("visibilitychange"));});
    await expect(page.locator("[data-flying-card]")).toHaveCount(0);
    const afterReturn=await page.evaluate(()=>(window as unknown as {playedEffects:number}).playedEffects);
    // Returning shows the current state; it never replays queued animations or cues.
    await page.waitForTimeout(500);
    expect(await page.evaluate(()=>(window as unknown as {playedEffects:number}).playedEffects)).toBe(afterReturn);
    await page.reload();
    await expect(page.locator('[data-player-hand="1"] [data-hand-card]')).toHaveCount(saved.state.players[1].cards.length);
    expect(await page.evaluate(()=>(window as unknown as {playedEffects:number}).playedEffects)).toBe(0);
    expect(fixture.commands).toHaveLength(before+2);
  }finally{await peer.context.close();}
});

test("reconexões durante escolha pendente preservam alvo e enviam uma única decisão",async({page,browser})=>{
  const peer=await second(browser);
  try{
    const code="ABCDEF112233";
    const state=createGame(matchUsers.map(user=>({name:user.username,kind:"human" as const})),42,{mode:"classic",brutal:false});
    const deck=createDeck("classic");
    const take=(type:string,value?:number)=>deck.splice(deck.findIndex(card=>card.type===type && (value===undefined || card.value===value)),1)[0];
    state.players[0].cards=[take("number",1)];state.players[1].cards=[take("number",2)];
    state.players.forEach(player=>{player.hasDrawn=true;});
    state.pending={source:1,card:take("freeze")};state.deck=deck;state.discard=[];state.turn=1;
    flip7Driver.parse(state);
    const room=matchSchema.parse({id:"93089d02-0b34-4b78-9d3e-f2679c190b5e",code,game:"flip7",rulesVersion:1,version:1,status:"playing",state:flip7Driver.project(state),hostId:matchUsers[0].id,capacity:2,options:{mode:"classic",brutal:false},participants:matchUsers.map((user,seat)=>({userId:user.id,username:user.username,displayName:user.displayName,avatarUrl:null,seat}))});
    fixture.states.set(code,{room,privateState:state,frames:[]});
    await page.goto(`/jogos/flip7?partida=${code}`);await peer.page.goto(page.url());
    const target=peer.page.getByRole("button",{name:"Escolher Marco",exact:true});
    await expect(target).toBeEnabled();
    for(let retry=0;retry<2;retry++){
      await peer.context.setOffline(true);fixture.disconnectUser(matchUsers[1].id);
      await expect(peer.page.getByRole("status").filter({hasText:"Reconectando à partida"})).toBeVisible();
      await expect(target).toHaveCount(0);
      expect(fixture.commands).toHaveLength(0);
      await peer.context.setOffline(false);await expect(target).toBeEnabled({timeout:15000});
    }
    await target.click();
    await expect.poll(()=>fixture.commands.length).toBe(1);
    await expect(target).toHaveCount(0);
    const saved=fixture.states.get(code)!.room;
    if(saved.status==="lobby")throw Error("Partida não iniciada");
    expect(saved.state.players[0].status).toBe("frozen");
    await peer.page.reload();await expect(target).toHaveCount(0);
    expect(fixture.commands).toHaveLength(1);
  }finally{await peer.context.close();}
});

test("card da lista de jogadores escolhe a pessoa na ação pendente",async({page,browser},testInfo)=>{
  const peer=await second(browser);
  try{
    const code="ABCDEF112234";
    const state=createGame(matchUsers.map(user=>({name:user.username,kind:"human" as const})),42,{mode:"classic",brutal:false});
    const deck=createDeck("classic");
    const take=(type:string,value?:number)=>deck.splice(deck.findIndex(card=>card.type===type && (value===undefined || card.value===value)),1)[0];
    state.players[0].cards=[take("number",1)];state.players[1].cards=[take("number",2)];
    state.players.forEach(player=>{player.hasDrawn=true;});
    state.pending={source:1,card:take("freeze")};state.deck=deck;state.discard=[];state.turn=1;
    flip7Driver.parse(state);
    const room=matchSchema.parse({id:"93089d02-0b34-4b78-9d3e-f2679c190b5e",code,game:"flip7",rulesVersion:1,version:1,status:"playing",state:flip7Driver.project(state),hostId:matchUsers[0].id,capacity:2,options:{mode:"classic",brutal:false},participants:matchUsers.map((user,seat)=>({userId:user.id,username:user.username,displayName:user.displayName,avatarUrl:null,seat}))});
    fixture.states.set(code,{room,privateState:state,frames:[]});
    await page.goto(`/jogos/flip7?partida=${code}`);await peer.page.goto(page.url());
    const byName=peer.page.getByRole("button",{name:"Escolher Marco na lista de jogadores",exact:true});
    const byPanel=peer.page.getByRole("button",{name:"Escolher Marco",exact:true});
    const card=peer.page.locator('[data-player-seat="0"]');
    await expect(byName).toBeEnabled();
    await expect(byPanel).toBeEnabled();
    await expect(card).toHaveCSS("cursor","pointer");
    // Tailwind only applies hover states on devices whose pointer supports hover.
    if(testInfo.project.name==="desktop"){
      await card.hover();
      await expect.poll(()=>card.evaluate(element=>getComputedStyle(element).boxShadow)).not.toBe("none");
    }
    await card.click();
    await expect.poll(()=>fixture.commands.length).toBe(1);
    const saved=fixture.states.get(code)!.room;
    if(saved.status==="lobby")throw Error("Partida não iniciada");
    expect(saved.state.players[0].status).toBe("frozen");
  }finally{await peer.context.close();}
});

test("saída do host transfere a sala para o outro participante",async({page,browser})=>{
  await lobby(page);const peer=await second(browser);
  try{
    await peer.page.goto(page.url());
    await expect(peer.page.getByRole("button",{name:"Aguardando o host",exact:true})).toBeVisible();
    await expect(page.getByRole("button",{name:"Jogar",exact:true})).toBeEnabled();
    await page.getByRole("button",{name:"Cancelar",exact:true}).click();
    await expect(peer.page.getByRole("button",{name:"Jogar",exact:true})).toBeDisabled();
    expect([...fixture.states.values()][0].room.hostId).toBe("93089d02-0b34-4b78-9d3e-f2679c190b5d");
  }finally{await peer.context.close();}
});
test("host altera versão, Brutal e capacidade no lobby e todos recebem a configuração",async({page,browser})=>{
  await lobby(page);const peer=await second(browser);
  try{
    await peer.page.goto(page.url());
    await expect(peer.page.getByRole("button",{name:"Aguardando o host",exact:true})).toBeVisible();
    await expect(page.getByRole("button",{name:"Jogar",exact:true})).toBeEnabled();
    const peerList=peer.page.getByLabel("Lobbies abertos");
    await expect(peerList.getByText("Clássico",{exact:true})).toBeVisible();
    await expect(peerList.getByRole("list",{name:"Vagas do lobby"}).getByRole("listitem")).toHaveCount(6);
    await expect(peer.page.getByLabel("Configuração e regras")).toHaveCount(0);
    await expect(peer.page.getByLabel("Número de jogadores")).toHaveCount(0);
    await page.getByRole("button",{name:"Editar",exact:true}).click();
    const edit=page.getByRole("dialog");
    await edit.getByLabel("Modo do Flip7").selectOption("vengeance");
    await edit.getByRole("switch",{name:"Modo Brutal"}).click();
    await edit.getByLabel("Número de jogadores").selectOption("3");
    await expect(edit.getByLabel("Número de jogadores")).toHaveValue("3");
    await expect(edit.getByRole("switch",{name:"Modo Brutal"})).toBeChecked();
    await edit.getByRole("button",{name:"Concluir",exact:true}).click();
    await expect(peerList.getByText("Vingança",{exact:true})).toBeVisible();
    await expect(peerList.getByText("Brutal",{exact:true})).toBeVisible();
    await expect(peerList.getByRole("list",{name:"Vagas do lobby"}).getByRole("listitem")).toHaveCount(3);
    await page.reload();
    await page.getByRole("button",{name:"Editar",exact:true}).click();
    await expect(page.getByRole("dialog").getByLabel("Número de jogadores")).toHaveValue("3");
    await expect(page.getByRole("dialog").getByRole("switch",{name:"Modo Brutal"})).toBeChecked();
    await page.getByRole("dialog").getByRole("button",{name:"Concluir",exact:true}).click();
    await page.getByRole("button",{name:"Jogar",exact:true}).click();
    await expect(page.getByRole("button",{name:"Comprar",exact:true})).toBeVisible();
    const room=[...fixture.states.values()][0].room;
    expect(room.options).toEqual({mode:"vengeance",brutal:true});
    expect(room.capacity).toBe(3);
    expect(room.status).toBe("playing");
  }finally{await peer.context.close();}
});
test("host pode expulsar uma pessoa do lobby",async({page,browser})=>{
  await lobby(page);const peer=await second(browser);
  try{
    await peer.page.goto(page.url());
    await expect(peer.page.getByRole("button",{name:"Aguardando o host",exact:true})).toBeVisible();
    await page.getByRole("button",{name:"Expulsar Beto",exact:true}).click();
    await page.getByRole("button",{name:"Confirmar expulsão",exact:true}).click();
    await expect(page.getByLabel("Lobbies abertos").getByRole("list",{name:"Vagas do lobby"}).getByRole("listitem",{name:/Beto/})).toHaveCount(0);
    await expect(peer.page.getByRole("button",{name:"Entrar",exact:true})).toBeVisible();
    await expect(peer.page.getByRole("button",{name:"Aguardando o host",exact:true})).toHaveCount(0);
    await expect(page.getByRole("button",{name:"Jogar",exact:true})).toBeDisabled();
  }finally{await peer.context.close();}
});
test("host expulsa durante a vez da outra conta e um bot mantém a partida",async({page,browser})=>{
  const peer=await start(page,browser);
  try{
    await page.getByRole("button",{name:"Parar",exact:true}).click();
    await expect(peer.page.getByRole("button",{name:"Comprar",exact:true})).toBeVisible();
    await page.getByRole("button",{name:"Expulsar Beto",exact:true}).click();
    await page.getByRole("button",{name:"Confirmar expulsão",exact:true}).click();
    await expect(peer.page.getByText("Espectador",{exact:true})).toBeVisible();
    await expect(page.getByText("Bot",{exact:true})).toBeVisible();
    await expect(page.getByRole("button",{name:"Comprar",exact:true})).toBeVisible({timeout:15000});
    const room=[...fixture.states.values()][0].room;
    expect(room.status).toBe("playing");
    if(room.status!=="lobby")expect(room.state.players[1].kind).toBe("normal");
  }finally{await peer.context.close();}
});
test("abandono do host transfere controle ao bot e host para a outra conta",async({page,browser})=>{
  const peer=await start(page,browser);
  try{
    await openMatchOptions(page);
    await page.getByRole("button",{name:"Abandonar partida",exact:true}).click();
    await expect(page.getByRole("dialog")).toContainText("Abandonar sozinho entrega sua vaga a um bot");
    await page.getByRole("dialog").getByRole("button",{name:"Abandonar sozinho",exact:true}).click();
    await expect(page).toHaveURL(/\/jogos\/flip7$/);
    await expect(peer.page.getByText("Bot",{exact:true})).toBeVisible();
    await expect(peer.page.getByRole("button",{name:"Comprar",exact:true})).toBeVisible({timeout:15000});
    const room=[...fixture.states.values()][0].room;
    expect(room.hostId).toBe("93089d02-0b34-4b78-9d3e-f2679c190b5d");
  }finally{await peer.context.close();}
});
test("resposta perdida permite repetir o mesmo comando sem comprar duas vezes",async({page,browser})=>{
  const peer=await start(page,browser);
  try{
    fixture.failNextResponse();await page.getByRole("button",{name:"Comprar",exact:true}).click();
    await expect(page.getByRole("region",{name:"Mesa de Flip7"}).getByRole("alert")).toContainText("Resposta indisponível");
    await page.getByRole("button",{name:"Tentar novamente",exact:true}).click();
    await expect(peer.page.getByRole("button",{name:"Comprar",exact:true})).toBeVisible();
    await expect(page.locator('[data-player-hand="0"] [data-hand-card]')).toHaveCount(2);
    const room=[...fixture.states.values()][0].room;if(room.status==="lobby")throw Error("Partida não iniciada");
    expect(room.state.players[0].cards).toHaveLength(2);
  }finally{await peer.context.close();}
});
test("atualização disponível recarrega a mesma mesa sem abandonar, repetir jogadas ou perder cartas",async({page,browser})=>{
  const peer=await start(page,browser);
  try{
    const url=page.url();
    const saved=structuredClone([...fixture.states.values()][0].room);
    const commands=fixture.commands.length;
    const current=await (await page.request.get('/api/deployment')).json();
    let ready=false,reloaded=false;
    await page.route("**/api/deployment",route=>route.fulfill({status:ready?200:503,json:ready?{release:reloaded?current.release:"next-deployment"}:{error:"Atualização em andamento."}}));
    const check=()=>page.evaluate(()=>document.dispatchEvent(new Event("visibilitychange")));
    const unavailable=page.waitForResponse(response=>response.url().endsWith('/api/deployment') && response.status()===503);
    await check();await unavailable;
    await expect(page.getByRole("button",{name:"Atualizar e continuar",exact:true})).toHaveCount(0);
    ready=true;await check();
    await expect(page.getByText("Atualização disponível",{exact:true})).toBeVisible();
    const dialog=page.getByRole("dialog",{name:"Atualização disponível",exact:true});
    const update=dialog.getByRole("button",{name:"Atualizar e continuar",exact:true});
    await expect(dialog).toContainText("A dona da bet deve ter manipulado os números de novo…");
    await expect(dialog.getByRole("button")).toHaveCount(1);
    await expect(update).toHaveClass(/bg-brand/);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
    await page.locator('[data-slot="dialog-overlay"]').click({position:{x:5,y:5},force:true});
    await expect(dialog).toBeVisible();
    const description=await dialog.locator('[data-slot="dialog-description"]').boundingBox();
    const action=await update.boundingBox();
    const bounds=await dialog.boundingBox();
    expect(action!.y).toBeGreaterThan(description!.y+description!.height);
    expect(action!.x+action!.width).toBeLessThan(bounds!.x+bounds!.width);
    ready=false;
    await update.click();
    await expect(dialog.getByRole("status")).toHaveText("A atualização está em andamento. Tente novamente em instantes.");
    await expect(update).toBeEnabled();
    await expect(page).toHaveURL(url);
    ready=true;
    page.once('framenavigated',()=>{reloaded=true;});
    await Promise.all([page.waitForEvent("load"),page.getByRole("button",{name:"Atualizar e continuar",exact:true}).click()]);
    await expect(page).toHaveURL(url);
    await expect(page.getByRole("button",{name:"Comprar",exact:true})).toBeEnabled();
    expect(fixture.commands).toHaveLength(commands);
    expect([...fixture.states.values()][0].room).toEqual(saved);
    await page.getByRole("button",{name:"Parar",exact:true}).click();
    await expect(peer.page.getByRole("button",{name:"Comprar",exact:true})).toBeEnabled();
    expect(fixture.commands).toHaveLength(commands+1);
  }finally{await peer.context.close();}
});
test("não oferece bots nem jogadores locais e mantém Croins opcionais",async({page})=>{
  await page.goto("/jogos/flip7");
  await expect(page.getByRole("button",{name:/Adicionar jogador/})).toHaveCount(0);
  await page.getByRole("button",{name:"Jogar",exact:true}).click();
  await expect(page.getByRole("dialog").getByRole("switch",{name:"Jogar apostando"})).not.toBeChecked();
  expect(fixture.states.size).toBe(0);
});


test("vagas ficam lado a lado e apenas a próxima permite convidar Online e Offline",async({page})=>{
  await page.goto("/jogos/flip7");
  await page.getByRole("button",{name:"Jogar",exact:true}).click();
  await page.getByRole("dialog").getByLabel("Número de jogadores").selectOption("6");
  await page.getByRole("dialog").getByRole("button",{name:"Criar sala",exact:true}).click();
  await expect(page).toHaveURL(/partida=[A-F0-9]{12}/);
  const slots=page.getByLabel("Lobbies abertos").getByRole("list",{name:"Vagas do lobby"});
  await expect(slots.getByRole("listitem")).toHaveCount(6);
  await expect(slots.getByRole("button",{name:"Convidar jogadores",exact:true})).toHaveCount(1);
  const positions=await slots.getByRole("listitem").evaluateAll(items=>items.slice(0,3).map(item=>({x:item.getBoundingClientRect().x,y:item.getBoundingClientRect().y})));
  expect(positions[0].y).toBe(positions[1].y);expect(positions[1].x).toBeGreaterThan(positions[0].x);
  await page.getByRole("button",{name:"Convidar jogadores",exact:true}).click();
  const dialog=page.getByRole("dialog",{name:"Convidar jogadores"});
  await expect(dialog.getByText("Online",{exact:false}).first()).toBeVisible();
  await expect(dialog.getByRole("button",{name:"Convidar Beto",exact:true})).toBeVisible();
  await dialog.getByRole("button",{name:"Convidar Beto",exact:true}).click();
  await expect(dialog.getByRole("button",{name:"Convite enviado para Beto",exact:true})).toBeDisabled();
  expect([...fixture.states.values()][0].room.participants).toHaveLength(1);
  await dialog.getByLabel("Encontrar jogadores").fill("Ana");
  await expect(dialog.getByRole("button",{name:"Convidar Ana",exact:true})).toBeVisible();
  await expect(dialog.getByRole("button",{name:"Convite enviado para Beto",exact:true})).toHaveCount(0);
});
test("convite reserva vaga, alerta permite recusar e aceitar libera o início",async({page,browser})=>{
  await lobby(page);
  async function invite(){
    await page.getByRole("button",{name:"Convidar jogadores",exact:true}).click();
    await page.getByRole("button",{name:"Convidar Beto",exact:true}).click();
    await page.keyboard.press("Escape");
  }
  await invite();
  const slots=page.getByLabel("Lobbies abertos").getByRole("list",{name:"Vagas do lobby"});
  await expect(slots.getByRole("listitem",{name:/Beto/})).toHaveClass(/opacity-40/);
  await expect(page.getByRole("button",{name:"Jogar",exact:true})).toBeDisabled();
  const peer=await second(browser);
  try{
    await peer.page.goto("/jogos/flip7");
    await peer.page.getByRole("alert").filter({hasText:"Marco convidou"}).getByRole("button",{name:"Recusar",exact:true}).click();
    await expect(slots.getByRole("listitem",{name:/Beto/})).toHaveCount(0);
    await invite();
    await peer.page.getByRole("alert").filter({hasText:"Marco convidou"}).getByRole("button",{name:"Aceitar",exact:true}).click();
    await expect(peer.page.getByRole("button",{name:"Aguardando o host",exact:true})).toBeVisible();
    await expect(slots.getByRole("listitem",{name:/Beto/})).not.toHaveClass(/opacity-40/);
    await expect(page.getByRole("button",{name:"Jogar",exact:true})).toBeEnabled();
    await peer.page.goto("/");
    await expect(page.getByRole("button",{name:"Jogar",exact:true})).toBeDisabled();
    await peer.page.goto(page.url());
    await expect(page.getByRole("button",{name:"Jogar",exact:true})).toBeEnabled();
  }finally{await peer.context.close();}
});

test("visitante abre o convite com configurações em texto e recebe atualizações da sala",async({page,browser})=>{
  await lobby(page);
  const visitor=await browser.newContext();
  try{
    const view=await visitor.newPage();
    await view.goto("/jogos/flip7");
    await expect(view.getByLabel("Apresentação do jogo")).toBeVisible();
    await expect(view.getByLabel("Apresentação do jogo").getByRole("heading",{name:"Flip da comunidade",exact:true})).toBeVisible();
    await expect(view.getByLabel("Apresentação do jogo").getByText("Texto cadastrado no painel para jogar com os amigos.",{exact:true})).toBeVisible();
    await expect(view.getByLabel("Apresentação do jogo").getByRole("button",{name:"Regras",exact:true})).toBeVisible();
    await view.getByLabel("Apresentação do jogo").getByRole("button",{name:"Regras",exact:true}).click();
    await expect(view.getByRole("dialog").getByRole("heading",{name:/Como jogar Flip7/})).toBeVisible();
    await view.keyboard.press("Escape");
    await expect(view.getByLabel("Jogadores e vagas")).toHaveCount(0);
    await expect(view.getByLabel("Configuração e regras")).toHaveCount(0);
    await expect(view.getByLabel("Número de jogadores")).toHaveCount(0);
    await view.goto(page.url());
    const list=view.getByLabel("Lobbies abertos");
    await expect(list.getByText("Sala de Marco",{exact:true})).toBeVisible();
    await expect(list.getByRole("listitem",{name:"Marco, vaga 1"})).toBeVisible();
    await expect(list.getByText("Clássico",{exact:true})).toBeVisible();
    await page.getByRole("button",{name:"Editar",exact:true}).click();
    const edit=page.getByRole("dialog");
    await edit.getByLabel("Modo do Flip7").selectOption("vengeance");
    await edit.getByRole("switch",{name:"Modo Brutal"}).click();
    await edit.getByRole("button",{name:"Concluir",exact:true}).click();
    await expect(list.getByText("Vingança",{exact:true})).toBeVisible();
    await expect(list.getByText("Brutal",{exact:true})).toBeVisible();
    expect([...fixture.states.values()][0].room.participants).toHaveLength(1);
  }finally{await visitor.close();}
});
for(const mode of ["login","register"] as const)test(`visitante escolhe uma vaga e entra após ${mode}`,async({page,browser})=>{
  await lobby(page);
  const visitor=await browser.newContext();
  try{
    const view=await visitor.newPage();
    await view.route(`**/api/v1/auth/${mode}`,async route=>{
      await visitor.addCookies([{name:"croebet-session",value:"game-fixture-beto",url:"http://127.0.0.1:3100"}]);
      await route.fulfill({json:{user:matchUsers[1]}});
    });
    await view.goto("/jogos/flip7");
    await expect(view.getByLabel("Apresentação do jogo")).toBeVisible();
    await expect(view.getByLabel("Apresentação do jogo").getByRole("heading",{name:"Flip da comunidade",exact:true})).toBeVisible();
    await expect(view.getByLabel("Apresentação do jogo").getByText("Texto cadastrado no painel para jogar com os amigos.",{exact:true})).toBeVisible();
    await expect(view.getByText("Você",{exact:true})).toHaveCount(0);
    const list=view.getByLabel("Lobbies abertos");
    await expect(list.getByText(/vagas? disponíve/)).toHaveCount(0);
    await expect(list.getByRole("button",{name:"Ver lobby",exact:true})).toHaveCount(0);
    await expect(list.getByRole("button",{name:/Entrar na sala de Marco, vaga/})).toHaveCount(5);
    await list.getByRole("button",{name:"Entrar na sala de Marco, vaga 3",exact:true}).click();
    await expect(view).toHaveURL(page.url());
    const dialog=view.getByRole("dialog");
    await expect(dialog.getByRole("heading",{name:"Entrar na Croebet"})).toBeVisible();
    expect([...fixture.states.values()][0].room.participants).toHaveLength(1);
    if(mode==="register")await dialog.getByRole("button",{name:"Cadastre-se",exact:true}).click();
    await dialog.getByLabel("Nome de usuário").fill("Beto");
    await dialog.getByLabel("Senha",{exact:true}).fill("senha-teste-123");
    await dialog.getByRole("button",{name:mode==="register"?"Criar conta":"Entrar",exact:true}).click();
    await expect(dialog).toHaveCount(0);
    await expect(view).toHaveURL(page.url());
    await expect(view.getByRole("button",{name:"Aguardando o host",exact:true})).toBeVisible();
    await expect.poll(()=>[...fixture.states.values()][0].room.participants.length).toBe(2);
    expect(fixture.states.size).toBe(1);
    await expect(page.getByRole("button",{name:"Jogar",exact:true})).toBeEnabled();
  }finally{await visitor.close();}
});
test("visitante vê vagas e acompanha uma partida sem controles",async({page,browser})=>{
  const peer=await start(page,browser);
  const visitor=await browser.newContext();
  try {
    const view=await visitor.newPage();
    await view.goto("/jogos/flip7");
    await view.getByRole("button",{name:"Visualizar",exact:true}).click();
    await expect(view.getByText("Espectador",{exact:true})).toBeVisible();
    await expect(view.getByRole("button",{name:"Comprar",exact:true})).toHaveCount(0);
    await expect(view.getByRole("button",{name:"Abandonar partida",exact:true})).toHaveCount(0);
    await page.getByRole("button",{name:"Parar",exact:true}).click();
    await expect(view.getByText("Vez de Beto",{exact:true})).toBeVisible();
    await view.reload();
    await expect(view.getByText("Espectador",{exact:true})).toBeVisible();
  } finally { await visitor.close(); await peer.context.close(); }
});


test("entrada e aumentos exigem confirmação e o pote acompanha o início",async({page,browser})=>{
  await page.goto("/jogos/flip7");
  await page.getByRole("button",{name:"Jogar",exact:true}).click();
  const create=page.getByRole("dialog");
  await create.getByRole("switch",{name:"Jogar apostando"}).click();
  await expect(create.getByRole("switch",{name:"Jogar apostando"})).toBeChecked();
  await expect(create.getByLabel("Entrada por jogador",{exact:true})).toHaveValue("5");
  await expect(page.getByText("Vencedores dividem o pote, sem taxa. Prêmios de vagas com bot vão para a casa.",{exact:true})).toHaveCount(0);
  await create.getByRole("button",{name:"Criar sala",exact:true}).click();
  await expect(page).toHaveURL(/partida=[A-F0-9]{12}/);
  const peer=await second(browser);
  try{
    await peer.page.goto(page.url());
    await expect(peer.page.getByRole("button",{name:"Confirmar entrada de 5 Croins"})).toHaveCount(0);
    await expect(page.getByRole("button",{name:"Jogar",exact:true})).toBeEnabled();
    await page.getByRole("button",{name:"Editar",exact:true}).click();
    const edit=page.getByRole("dialog");
    await edit.getByLabel("Entrada por jogador",{exact:true}).fill("10");
    await edit.getByLabel("Entrada por jogador",{exact:true}).blur();
    await expect(peer.page.getByRole("button",{name:"Confirmar entrada de 10 Croins"})).toBeVisible();
    await expect(page.getByRole("button",{name:"Confirmar entrada de 10 Croins"})).toHaveCount(0);
    await edit.getByRole("button",{name:"Concluir",exact:true}).click();
    await expect(page.getByRole("button",{name:"Jogar",exact:true})).toBeDisabled();
    await peer.page.getByRole("button",{name:"Confirmar entrada de 10 Croins"}).click();
    await expect(page.getByRole("button",{name:"Jogar",exact:true})).toBeEnabled();
    await page.getByRole("button",{name:"Jogar",exact:true}).click();
    const pot = page.getByRole("banner").getByText(/Pote: 20 Croins/);
    await expect(pot).toBeVisible();
    await expect(page.locator("[data-game-actions]").getByText(/Pote:/)).toHaveCount(0);
    await expect(pot.locator("..").getByText("Clássico", { exact: true })).toBeVisible();
  }finally{await peer.context.close();}
});
test("campo de aposta reutilizável soma, subtrai e seleciona valores sugeridos",async({page})=>{
  await page.goto("/jogos/flip7");
  await page.getByRole("button",{name:"Jogar",exact:true}).click();
  const box=page.getByRole("dialog").getByRole("group",{name:"Aposta da partida",exact:true});
  await box.getByRole("switch",{name:"Jogar apostando"}).check();
  const input=box.getByLabel("Entrada por jogador",{exact:true});
  await expect(input).toHaveValue("5");
  const presets=box.getByRole("group",{name:"Valores de aposta sugeridos"});
  await expect(presets.getByRole("button")).toHaveCount(5);
  await box.getByRole("button",{name:"Aumentar aposta",exact:true}).click();
  await expect(input).toHaveValue("6");
  await box.getByRole("button",{name:"Diminuir aposta",exact:true}).click();
  await expect(input).toHaveValue("5");
  await presets.getByRole("button",{name:"Apostar 25 Croins",exact:true}).click();
  await expect(input).toHaveValue("25");
  await expect(presets.getByRole("button",{name:"Apostar 25 Croins",exact:true})).toHaveAttribute("aria-pressed","true");
  await input.fill("12");await input.press("Enter");
  await expect(input).toHaveValue("12");
  await input.fill("0");await input.blur();
  await expect(input).toHaveValue("12");
  await input.fill("1");await input.blur();
  await expect(box.getByRole("button",{name:"Diminuir aposta",exact:true})).toBeDisabled();
  await box.getByRole("switch",{name:"Jogar apostando"}).uncheck();
  await expect(input).toHaveCount(0);
});

for (const value of [7, 9]) test(`par 6 e ${value} começa somente após a entrega`, async ({ page }) => {
  const code = "ABCDEF123456";
  const privateState = createGame(matchUsers.map(user => ({ name: user.username, kind: "human" as const })), 42, { mode: "classic", brutal: false });
  const state = flip7Driver.project(privateState);
  const deck = createDeck("classic");
  const take = (value: number) => deck.splice(deck.findIndex(card => card.type === "number" && card.value === value), 1)[0];
  state.players[0].cards = [take(6)];
  state.players[1].cards = [take(6)];
  state.players.forEach(player => { player.hasDrawn = true; });
  const room = matchSchema.parse({ id: "93089d02-0b34-4b78-9d3e-f2679c190b5e", code, game: "flip7", rulesVersion: 1, version: 1, status: "playing", state, hostId: matchUsers[0].id, capacity: 2, options: { mode: "classic", brutal: false }, participants: matchUsers.map((user, seat) => ({ userId: user.id, username: user.username, displayName: user.displayName, avatarUrl: null, seat })) });
  privateState.players = structuredClone(state.players);
  const next = take(value);
  privateState.deck = [...deck, next];
  fixture.states.set(code, { room, privateState, frames: [] });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto(`/jogos/flip7?partida=${code}`);
  const six = page.locator(`[data-hand-card="${state.players[0].cards[0].id}"]`);
  await expect(six).toBeVisible();

  await page.getByRole("button", { name: "Comprar", exact: true }).click();
  await expect(page.locator("[data-flying-card]")).toBeVisible();
  expect(await six.evaluate(element => element.getAnimations({ subtree: true }).length)).toBe(0);
  await expect(page.locator("[data-flying-card]")).toHaveCount(0);
  await expect.poll(() => six.evaluate(element => element.getAnimations({ subtree: true }).map(animation => (animation as CSSAnimation).animationName))).toEqual([value === 7 ? "flip-six-seven" : "flip-six-nine"]);
});

test("six seven oscila em sentidos opostos apenas com o par e respeita movimento reduzido", async ({ page }, testInfo) => {
  const code = "ABCDEF123456";
  const privateState = createGame(matchUsers.map(user => ({ name: user.username, kind: "human" as const })), 42, { mode: "classic", brutal: false });
  const state = flip7Driver.project(privateState);
  const deck = createDeck("classic");
  const take = (value: number) => deck.splice(deck.findIndex(card => card.type === "number" && card.value === value), 1)[0];
  state.players[0].cards = [take(6), take(7), take(8)];
  state.players[1].cards = [take(6)];
  state.players.forEach(player => { player.hasDrawn = true; });
  const room = matchSchema.parse({ id: "93089d02-0b34-4b78-9d3e-f2679c190b5e", code, game: "flip7", rulesVersion: 1, version: 1, status: "playing", state, hostId: matchUsers[0].id, capacity: 2, options: { mode: "classic", brutal: false }, participants: matchUsers.map((user, seat) => ({ userId: user.id, username: user.username, displayName: user.displayName, avatarUrl: null, seat })) });
  privateState.players = structuredClone(state.players);
  const next = take(9);
  privateState.deck = [...deck, next];
  fixture.states.set(code, { room, privateState, frames: [] });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto(`/jogos/flip7?partida=${code}`);
  const six = page.locator(`[data-hand-card="${state.players[0].cards[0].id}"]`);
  await expect(six).toBeVisible();
  await expect.poll(() => six.evaluate(element => element.getAnimations({ subtree: true }).length)).toBe(1);
  const offsets = await page.locator("[data-hand-card]").evaluateAll(elements => elements.map(element => {
    const animation = element.getAnimations({ subtree: true })[0];
    if (!animation) return 0;
    animation.pause(); animation.currentTime = 0;
    const target = (animation.effect as KeyframeEffect).target as HTMLElement;
    return new DOMMatrix(getComputedStyle(target).transform).m42;
  }));
  expect(offsets).toEqual([-4, 4, 0, 0]);
  await page.screenshot({ path: testInfo.outputPath("six-seven.png"), fullPage: true });
  const animation = await six.evaluateHandle(element => {
    const animation = element.getAnimations({ subtree: true })[0];
    animation.play();
    return animation;
  });
  await page.getByRole("button", { name: "Comprar", exact: true }).click();
  await expect(page.locator("[data-flying-card]")).toBeVisible();
  expect(await six.evaluate((element, original) => element.getAnimations({ subtree: true }).includes(original), animation)).toBe(true);
  await expect(page.locator("[data-flying-card]")).toHaveCount(0);
  expect(await six.evaluate((element, original) => element.getAnimations({ subtree: true }).includes(original), animation)).toBe(true);
  await animation.dispose();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(() => six.evaluate(element => element.getAnimations({ subtree: true }).length)).toBe(0);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  if (room.status !== "playing") throw Error("Partida não iniciada");
  const savedRoom = fixture.states.get(code)!.room;
  if (savedRoom.status !== "playing") throw Error("Partida encerrada");
  savedRoom.state.players[0].cards = savedRoom.state.players[0].cards.filter(card => card.value !== 7);
  await page.reload();
  await expect(six).toBeVisible();
  expect(await six.evaluate(element => element.getAnimations({ subtree: true }).length)).toBe(0);
});

test("six nine gira continuamente enquanto adjacente e para ao comprar um número entre o par", async ({ page }) => {
  const code = "ABCDEF123456";
  const privateState = createGame(matchUsers.map(user => ({ name: user.username, kind: "human" as const })), 42, { mode: "classic", brutal: false });
  const deck = createDeck("classic");
  const take = (value: number) => deck.splice(deck.findIndex(card => card.type === "number" && card.value === value), 1)[0];
  privateState.players[0].cards = [take(6), take(9)];
  privateState.players[1].cards = [take(5)];
  privateState.players[1].status = "stayed";
  privateState.players.forEach(player => { player.hasDrawn = true; });
  const eight = take(8), ten = take(10);
  privateState.deck = [...deck, eight, ten];
  const state = flip7Driver.project(privateState);
  const room = matchSchema.parse({ id: "93089d02-0b34-4b78-9d3e-f2679c190b5e", code, game: "flip7", rulesVersion: 1, version: 1, status: "playing", state, hostId: matchUsers[0].id, capacity: 2, options: { mode: "classic", brutal: false }, participants: matchUsers.map((user, seat) => ({ userId: user.id, username: user.username, displayName: user.displayName, avatarUrl: null, seat })) });
  fixture.states.set(code, { room, privateState, frames: [] });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto(`/jogos/flip7?partida=${code}`);
  const six = page.locator(`[data-hand-card="${state.players[0].cards[0].id}"]`);
  const nine = page.locator(`[data-hand-card="${state.players[0].cards[1].id}"]`);
  await expect.poll(() => six.evaluate(element => element.getAnimations({ subtree: true }).map(animation => (animation as CSSAnimation).animationName))).toEqual(["flip-six-nine"]);
  for (const card of [six, nine]) {
    expect(await card.evaluate(element => element.getAnimations({ subtree: true })[0].effect!.getTiming().iterations)).toBe(Infinity);
  }
  const rotation = await page.locator('[data-player-hand="0"] [data-hand-card]').evaluateAll(elements => elements.map(element => {
    const animation = element.getAnimations({ subtree: true })[0];
    animation.pause(); animation.currentTime = 0;
    return new DOMMatrix(getComputedStyle((animation.effect as KeyframeEffect).target as HTMLElement).transform).b;
  }));
  expect(rotation[0]).toBeLessThan(0);
  expect(rotation[1]).toBeGreaterThan(0);
  const original = await six.evaluateHandle(element => {
    const animation = element.getAnimations({ subtree: true })[0];
    animation.play(); return animation;
  });
  await page.getByRole("button", { name: "Comprar", exact: true }).click();
  await expect(page.locator(`[data-hand-card="${ten.id}"]`)).toBeVisible();
  await expect(page.locator("[data-flying-card]")).toHaveCount(0);
  expect(await six.evaluate((element, animation) => element.getAnimations({ subtree: true }).includes(animation), original)).toBe(true);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(() => six.evaluate(element => element.getAnimations({ subtree: true }).length)).toBe(0);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.getByRole("button", { name: "Comprar", exact: true }).click();
  await expect(page.locator(`[data-hand-card="${eight.id}"]`)).toBeVisible();
  for (const card of [six, nine]) {
    await expect.poll(() => card.evaluate(element => element.getAnimations({ subtree: true }).length)).toBe(0);
    expect(await card.locator(":scope > div").evaluate(element => getComputedStyle(element).translate)).toBe("none");
  }
  await original.dispose();
});

test("resultado apresenta vencedor, duração, rodadas, prêmio e placar com avatares", async ({ page }) => {
  const code="ABCDEF123456";
  const state=flip7Driver.project(createGame(matchUsers.map(user=>({name:user.username,kind:"human" as const})),42,{mode:"classic",brutal:false}));
  state.phase="over";state.round=7;state.players[0].total=214;state.players[1].total=166;
  const room=matchSchema.parse({id:"93089d02-0b34-4b78-9d3e-f2679c190b5e",code,game:"flip7",rulesVersion:1,version:20,status:"finished",state,hostId:matchUsers[0].id,capacity:2,options:{mode:"classic",brutal:false},participants:matchUsers.map((user,seat)=>({userId:user.id,username:user.username,displayName:user.displayName,avatarUrl:null,seat})),durationSeconds:754,entryAmount:5,potTotal:10,payouts:[{seat:0,amount:10,house:false}],settlement:"paid"});
  fixture.states.set(code,{room,frames:[]});
  await page.goto(`/jogos/flip7?partida=${code}`);
  const dialog=page.getByRole("dialog",{name:"Resultado da partida"});
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("venceu a partida!",{exact:false})).toBeVisible();
  await expect(dialog.getByText("12 min 34 s",{exact:true})).toBeVisible();
  await expect(dialog.locator("dl").getByText("7",{exact:true})).toBeVisible();
  await expect(dialog.getByText("Prêmio (Pote)",{exact:true})).toBeVisible();
  await expect(dialog.getByRole("list",{name:"Classificação final"}).getByRole("listitem")).toHaveCount(2);
  await expect(dialog.locator("[data-slot=avatar]")).toHaveCount(3);
  await expect(dialog.getByText("Flip 7",{exact:true})).toHaveCount(0);
  await dialog.getByRole("button",{name:"Fechar",exact:true}).first().click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole("button",{name:"Ver resultado",exact:true}).click();
  await expect(dialog.getByText("12 min 34 s",{exact:true})).toBeVisible();
});

test("resultado mantém o fechar e as ações fixos enquanto o placar rola", async ({ page }) => {
  const code="ABCDEF123456";
  const names=["Marco",...Array.from({length:7},(_,index)=>`Bot ${index+1}`)];
  const state=flip7Driver.project(createGame(names.map(name=>({name,kind:"human" as const})),42,{mode:"classic",brutal:false}));
  state.phase="over";state.round=10;
  state.players.forEach((player,seat)=>{player.total=210-seat*4;});
  const participants=names.map((name,seat)=>({userId:seat===0?matchUsers[0].id:`93089d02-0b34-4b78-9d3e-f2679c190c0${seat}`,username:name,displayName:name,avatarUrl:null,seat}));
  const room=matchSchema.parse({id:"93089d02-0b34-4b78-9d3e-f2679c190b5e",code,game:"flip7",rulesVersion:1,version:20,status:"finished",state,hostId:matchUsers[0].id,capacity:8,options:{mode:"classic",brutal:false},participants,durationSeconds:26*3600+13*60,entryAmount:0,potTotal:0,payouts:[],settlement:"paid"});
  fixture.states.set(code,{room,frames:[]});
  await page.goto(`/jogos/flip7?partida=${code}`);
  const dialog=page.getByRole("dialog",{name:"Resultado da partida"});
  await expect(dialog).toBeVisible({timeout:10000});
  await dialog.evaluate(element=>Promise.all(element.getAnimations({subtree:true}).map(animation=>animation.finished)));
  await page.evaluate(()=>document.fonts.ready);
  const body=dialog.locator("[data-slot=dialog-body]");
  await expect(body).toHaveCount(1);
  const scroll=await body.evaluate(element=>({scrollHeight:element.scrollHeight,clientHeight:element.clientHeight}));
  expect(scroll.scrollHeight).toBeGreaterThan(scroll.clientHeight);
  const close=dialog.getByRole("button",{name:"Fechar",exact:true}).last();
  const footer=dialog.locator("[data-slot=dialog-footer]");
  const playAgain=footer.getByRole("button",{name:"Jogar novamente",exact:true});
  const footerClose=footer.getByRole("button",{name:"Fechar",exact:true});
  const replay=footer.getByRole("button",{name:"Replay",exact:true});
  const dialogBefore=await dialog.boundingBox();
  const closeBefore=await close.boundingBox();
  const footerBefore=await footer.boundingBox();
  expect(closeBefore).not.toBeNull();
  expect(footerBefore).not.toBeNull();
  await body.evaluate(element=>{element.scrollTop=element.scrollHeight;});
  await expect(playAgain).toBeVisible();
  await expect(footerClose).toBeVisible();
  await expect(replay).toBeVisible();
  const dialogAfter=await dialog.boundingBox();
  const closeAfter=await close.boundingBox();
  const footerAfter=await footer.boundingBox();
  expect(closeAfter!.y-dialogAfter!.y).toBeCloseTo(closeBefore!.y-dialogBefore!.y,0);
  expect(footerAfter!.y-dialogAfter!.y).toBeCloseTo(footerBefore!.y-dialogBefore!.y,0);
  const viewport=page.viewportSize()!;
  for(const box of [closeAfter!,footerAfter!]){
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y+box.height).toBeLessThanOrEqual(viewport.height);
  }
  await footerClose.click();
  await expect(dialog).not.toBeVisible();
});

test("controles da mesa persistem som e volume e sincronizam efeitos com cartas", async ({ page, browser }, testInfo) => {
  await instrumentAudio(page);
  const peer = await start(page, browser);
  try {
    await openMatchOptions(page);
    const controls = page.getByLabel("Controles da partida", { exact: true });
    const options = matchOptions(page);
    const exit = controls.getByRole("button", { name: "Abandonar partida", exact: true });
    await expect(exit).toHaveText("");
    await expect(controls.getByRole("button", { name: "Ajustar volume", exact: true })).toHaveCount(0);
    const sound = options.getByRole("button", { name: "Silenciar som", exact: true });
    const volumeGroup = options.getByRole("group", { name: "Volume", exact: true });
    const volume = options.getByRole("slider", { name: "Volume dos efeitos" });
    await expect(volume).toBeVisible();
    await sound.focus();
    await expect(volume).toBeVisible();
    await volume.focus();
    await expect(volume).toBeFocused();
    await volume.press("Home");
    for (let step = 0; step < 6; step++) await volume.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expect(volume).toHaveValue("35");
    await volume.press("ArrowLeft");
    await expect(volume).toHaveAttribute("aria-valuetext", "30%");
    await expect(volumeGroup.getByRole("button")).toHaveCount(1);
    await options.getByRole("button", { name: "Silenciar som", exact: true }).click();
    await expect(options.getByRole("button", { name: "Ativar som", exact: true })).toHaveAttribute("aria-pressed", "false");
    await page.reload();
    await openMatchOptions(page);
    await expect(options.getByRole("button", { name: "Ativar som", exact: true })).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { playedEffects: number }).playedEffects)).toBe(0);
    await options.getByRole("button", { name: "Ativar som", exact: true }).focus();
    await expect(volume).toHaveValue("30");
    await expect.poll(() => page.evaluate(() => (window as unknown as { decodedEffects: number }).decodedEffects)).toBe(14);
    await options.getByRole("button", { name: "Ativar som", exact: true }).click();
    await expect(options.getByRole("button", { name: "Silenciar som", exact: true })).toHaveAttribute("aria-pressed", "true");
    await closeMatchOptions(page);
    if (testInfo.project.name === "desktop") {
      const fullscreen = controls.getByRole("button", { name: "Tela cheia", exact: true });
      await fullscreen.click();
      await expect(controls.getByRole("button", { name: "Sair da tela cheia", exact: true })).toHaveAttribute("aria-pressed", "true");
      await controls.getByRole("button", { name: "Sair da tela cheia", exact: true }).click();
      await expect(fullscreen).toBeVisible();
    }
    await page.getByRole("button", { name: "Comprar", exact: true }).click();
    await checkControlsDuringFlight(page);
    await expect.poll(() => page.evaluate(() => (window as unknown as { playedEffects: number }).playedEffects)).toBeGreaterThan(0);
    await expect(exit).toBeEnabled();
    await exit.click();
    await expect(page.getByRole("dialog", { name: "Sair da partida?" })).toBeVisible();
    await page.getByRole("button", { name: "Continuar jogando", exact: true }).click();
  } finally { await peer.context.close(); }
});

test("som de vez toca quando a mesa entrega o controle, não na confirmação", async ({ page, browser }) => {
  const code = "ABCDEF123456";
  // Beto encerra a vez dele; a primeira carta de Marco é comprada automaticamente
  // e a mesa só libera comprar/parar depois que ela chega.
  const game = createGame(matchUsers.map(user => ({ name: user.username, kind: "human" as const })), 42, { mode: "classic", brutal: false });
  const deck = createDeck("classic");
  const take = (value: number) => deck.splice(deck.findIndex(card => card.type === "number" && card.value === value), 1)[0];
  const drawn = take(5);
  game.players[0].cards = [];
  game.players[1].cards = [take(3)];
  game.players[1].hasDrawn = true;
  game.deck = [...deck, drawn];
  game.turn = 1;
  const room = matchSchema.parse({ id: "93089d02-0b34-4b78-9d3e-f2679c190b5e", code, game: "flip7", rulesVersion: 1, version: 1, status: "playing", state: flip7Driver.project(game), hostId: matchUsers[0].id, capacity: 2, options: { mode: "classic", brutal: false }, participants: matchUsers.map((user, seat) => ({ userId: user.id, username: user.username, displayName: user.displayName, avatarUrl: null, seat })) });
  fixture.states.set(code, { room, privateState: game, frames: [] });
  await recordTurnCue(page);
  const peer = await second(browser);
  try {
    await page.goto(`/jogos/flip7?partida=${code}`);
    const board = page.getByRole("region", { name: "Mesa de Flip7", exact: true });
    await expect(board).toBeVisible();
    // Libera e decodifica o áudio da mesa antes de a vez chegar.
    await board.click({ position: { x: 5, y: 5 } });
    await expect(page.locator("html")).toHaveAttribute("data-turn-audio", "ready");
    await page.waitForTimeout(500);
    await peer.page.goto(`/jogos/flip7?partida=${code}`);
    await peer.page.getByRole("button", { name: "Parar", exact: true }).click();
    await expect(page.getByRole("button", { name: "Comprar", exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(() => (window as unknown as { turnCues: unknown[] }).turnCues.length)).toBe(1);
    const [cue] = await page.evaluate(() => (window as unknown as { turnCues: { deckEnabled: boolean; flying: boolean }[] }).turnCues);
    // O aviso acompanha a apresentação: nada em voo e comprar/parar já liberados.
    expect(cue.flying).toBe(false);
    expect(cue.deckEnabled).toBe(true);
  } finally { await peer.context.close(); }
});

test("permite abandonar durante a animação da jogada de outra pessoa", async ({ page, browser }) => {
  const peer = await start(page, browser);
  try {
    const code = new URL(page.url()).searchParams.get("partida")!;
    await page.getByRole("button", { name: "Parar", exact: true }).click();
    await peer.page.getByRole("button", { name: "Comprar", exact: true }).click();
    await expect(page.locator("[data-flying-card]")).toBeVisible();
    await openMatchOptions(page);
    await page.getByRole("button", { name: "Abandonar partida", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Sair da partida?", exact: true });
    await expect(page.locator("[data-flying-card]")).toBeVisible();
    await dialog.getByRole("button", { name: "Abandonar sozinho", exact: true }).click();
    await expect(page).not.toHaveURL(/partida=/);
    const room = fixture.states.get(code)!.room;
    expect(room.participants.some(person => person.userId === matchUsers[0].id)).toBe(true);
    if (room.status !== "playing") throw Error("Partida não iniciada");
    expect(room.state.players[0].kind).toBe("normal");
  } finally { await peer.context.close(); }
});

async function instrumentAudio(page: Page) {
  await page.addInitScript(() => {
    const state = window as unknown as { playedEffects: number; decodedEffects: number; cueEvents: { time: number; offset: number; duration: number; fileDuration: number }[] };
    state.playedEffects = 0;
    state.cueEvents = [];
    state.decodedEffects = 0;
    const decode = AudioContext.prototype.decodeAudioData;
    AudioContext.prototype.decodeAudioData = function (data, success, error) {
      return decode.call(this, data, success, error).then(buffer => { state.decodedEffects++; return buffer; });
    };
    const original = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args: Parameters<typeof original>) {
      state.playedEffects++;
      state.cueEvents.push({ time: performance.now(), offset: args[1] ?? 0, duration: args[2] ?? 0, fileDuration: this.buffer?.duration ?? 0 });
      return original.apply(this, args);
    };
  });
}

// The turn cue belongs to the table: record when notification.mp3 starts and
// whether the deck was already actionable at that instant.
async function recordTurnCue(page: Page) {
  await page.addInitScript(() => {
    const state = window as unknown as { turnCues: { time: number; deckEnabled: boolean; flying: boolean }[] };
    state.turnCues = [];
    const data = new WeakSet<ArrayBuffer>();
    const buffers = new WeakSet<AudioBuffer>();
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      if (String(args[0]).endsWith("/audio/notification.mp3")) {
        const read = response.arrayBuffer.bind(response);
        response.arrayBuffer = async () => { const bytes = await read(); data.add(bytes); return bytes; };
      }
      return response;
    };
    const decode = AudioContext.prototype.decodeAudioData;
    AudioContext.prototype.decodeAudioData = async function (bytes) {
      const buffer = await decode.call(this, bytes);
      if (data.has(bytes)) { buffers.add(buffer); document.documentElement.dataset.turnAudio = "ready"; }
      return buffer;
    };
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args: Parameters<typeof start>) {
      if (this.buffer && buffers.has(this.buffer)) {
        const deck = document.querySelector<HTMLButtonElement>('[aria-label="Comprar carta do baralho"]');
        state.turnCues.push({ time: performance.now(), deckEnabled: !!deck && !deck.disabled, flying: !!document.querySelector("[data-flying-card]") });
      }
      return start.apply(this, args);
    };
  });
}

async function checkControlsDuringFlight(page: Page) {
  await openMatchOptions(page);
  const controls = page.getByLabel("Controles da partida", { exact: true });
  const options = matchOptions(page);
  const history = options.getByRole("button", { name: "Esconder histórico", exact: true });
  const views = options.getByRole("group", { name: "Interface da mesa", exact: true }).getByRole("button");
  await expect(page.locator("[data-flying-card]")).toBeVisible();
  // Layout changes stay locked during the flight without dimming every move.
  for (const button of [history, ...await views.all()]) {
    await expect(button).toBeDisabled();
    await expect(button).toHaveCSS("opacity", "1");
  }
  for (const exit of await controls.getByRole("button", { name: "Abandonar partida", exact: true }).all()) {
    await expect(exit).toBeEnabled();
    await expect(exit).toHaveCSS("opacity", "1");
  }
  await expect(options.getByRole("button", { name: /^(Ativar som|Silenciar som)$/ })).toBeEnabled();
  await expect(page.locator("[data-flying-card]")).toHaveCount(0);
  await expect(history).toBeEnabled();
  for (const button of await views.all()) await expect(button).toBeEnabled();
}

test("replay anima e toca cartas, pausa sem avançar e centraliza o reprodutor", async ({ page }, testInfo) => {
  await instrumentAudio(page);
  const code = "ABCDEF123456";
  const before = createGame(matchUsers.map(user => ({ name: user.username, kind: "human" as const })), 42, { mode: "classic", brutal: false });
  const after = transition(before, { type: "draw" });
  const state = flip7Driver.project(after);
  const finalState = { ...state, phase: "over", round: 2 };
  const room = matchSchema.parse({ id: "93089d02-0b34-4b78-9d3e-f2679c190b5e", code, game: "flip7", rulesVersion: 1, version: 3, status: "finished", state: finalState, hostId: matchUsers[0].id, capacity: 2, options: { mode: "classic", brutal: false }, participants: matchUsers.map((user, seat) => ({ userId: user.id, username: user.username, displayName: user.displayName, avatarUrl: null, seat })) });
  fixture.states.set(code, { room, frames: [] });
  await page.route(`**/api/v1/me/matches/${code}?*`, route => route.fulfill({ json: {
    match: { id: room.id, code, gameId: "93089d02-0b34-4b78-9d3e-f2679c190b5c", rulesVersion: 1, status: "finished", options: room.options, startedAt: "2026-11-20T12:00:00.000Z", endedAt: "2026-11-20T12:01:00.000Z", players: matchUsers.map((user, seat) => ({ seat, userId: user.id, name: user.username, avatarUrl: null, score: 0, winner: true, bot: false })), frameCount: 3, entryAmount: 0, potTotal: 0, payouts: [], settlement: "paid" },
    finalState, frames: [{ version: 1, action: { type: "start" }, state: flip7Driver.project(before) }, { version: 2, action: { type: "draw" }, state }, { version: 3, action: { type: "next" }, state: finalState }], offset: 0, hasMore: false,
  } }));
  await page.goto(`/jogos/flip7?partida=${code}`);
  await page.getByRole("dialog", { name: "Resultado da partida" }).getByRole("button", { name: "Replay", exact: true }).click();
  const controls = page.getByLabel("Controles de reprodução", { exact: true });
  await expect(controls.getByText("Jogada 1 de 3", { exact: true })).toBeVisible();
  await controls.getByRole("button", { name: "Pausar", exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { decodedEffects: number }).decodedEffects)).toBeGreaterThanOrEqual(11);
  const effectsBeforeMove = await page.evaluate(() => (window as unknown as { playedEffects: number }).playedEffects);
  await controls.getByRole("button", { name: "Próxima jogada", exact: true }).click();
  await expect(controls.getByRole("button", { name: "Próxima jogada", exact: true })).toBeDisabled();
  await checkControlsDuringFlight(page);
  await expect(controls.getByText("Jogada 2 de 3", { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as unknown as { playedEffects: number }).playedEffects)).toBeGreaterThan(0);
  await expect(page.locator("[data-flying-card]")).toHaveCount(0);
  const cues = await page.evaluate(() => (window as unknown as { cueEvents: { time: number; offset: number; duration: number; fileDuration: number }[] }).cueEvents.slice(-1));
  expect(cues).toHaveLength(1);
  // A single card movement emits one effect, with no additional landing impact.
  expect(await page.evaluate(() => (window as unknown as { playedEffects: number }).playedEffects)).toBe(effectsBeforeMove + 1);
  for (const cue of cues) {
    expect(cue.offset).toBeGreaterThan(0);
    expect(cue.duration).toBeLessThan(cue.fileDuration);
  }
  // Backward seek restores a snapshot and cancels any pending presentation.
  await controls.getByRole("button", { name: "Jogada anterior", exact: true }).click();
  await expect(controls.getByText("Jogada 1 de 3", { exact: true })).toBeVisible();
  await expect(page.locator("[data-flying-card]")).toHaveCount(0);
  const [box, speed, play, position] = await Promise.all([
    controls.boundingBox(), controls.getByLabel("Velocidade da reprodução").boundingBox(),
    controls.getByRole("button", { name: "Reproduzir", exact: true }).boundingBox(),
    controls.getByText("Jogada 1 de 3", { exact: true }).boundingBox(),
  ]);
  expect(Math.abs(play!.x + play!.width / 2 - box!.x - box!.width / 2)).toBeLessThan(2);
  expect(speed!.x).toBeLessThan(position!.x);
  if (testInfo.project.name === "desktop") expect(Math.abs(speed!.y - position!.y)).toBeLessThan(12);
  const slider = controls.getByRole("slider", { name: "Ir para jogada" });
  const sliderNode = await slider.elementHandle();
  const soundsBeforeScrub = await page.evaluate(() => (window as unknown as { playedEffects: number }).playedEffects);
  // Even a one-frame slider change is a silent snapshot, never a card flight.
  await slider.fill("1");
  await expect(controls.getByText("Jogada 2 de 3", { exact: true })).toBeVisible();
  await expect(controls.getByRole("button", { name: "Próxima jogada", exact: true })).toBeEnabled();
  await expect(page.locator("[data-flying-card], [data-moving-card]")).toHaveCount(0);
  await slider.press("ArrowRight");
  await expect(controls.getByText("Jogada 3 de 3", { exact: true })).toBeVisible();
  await slider.fill("0");
  await expect(controls.getByText("Jogada 1 de 3", { exact: true })).toBeVisible();
  expect(await sliderNode!.evaluate(element => element.isConnected)).toBe(true);
  expect(await page.evaluate(() => (window as unknown as { playedEffects: number }).playedEffects)).toBe(soundsBeforeScrub);

});


test("mesa de teste leva badges e controles para a navbar e preserva suas ações",async({page})=>{
 const code="ABCDEF991122";
 const state=flip7Driver.project(createGame(matchUsers.map(u=>({name:u.username,kind:"human" as const})),42,{mode:"vengeance",brutal:true}));
 const room=matchSchema.parse({id:"93089d02-0b34-4b78-9d3e-f2679c190b5e",code,development:true,game:"flip7",rulesVersion:1,version:1,status:"playing",state,hostId:matchUsers[0].id,capacity:2,options:{mode:"vengeance",brutal:true},participants:matchUsers.map((u,seat)=>({userId:u.id,username:u.username,displayName:u.displayName,avatarUrl:null,seat}))});
 fixture.states.set(code,{room,frames:[]});
 await page.goto(`/jogos/flip7?partida=${code}`);
 await expect(page.getByRole("region",{name:"Mesa de Flip7"})).toBeVisible();
 await expect(page.getByLabel("Apresentação do jogo")).toHaveCount(0);
 await expect(page.getByRole("button",{name:"Voltar às salas",exact:true})).toHaveCount(0);
 const navbar = page.getByRole("banner");
 await expect(navbar.getByText("Desenvolvimento",{exact:true})).toBeVisible();
 await expect(navbar.getByText("Vingança · Brutal",{exact:true})).toBeVisible();
 const table = page.getByRole("region",{name:"Mesa de Flip7"});
 await expect(table.getByText("Desenvolvimento",{exact:true})).toHaveCount(0);
 await expect(table.getByLabel("Controles da partida")).toHaveCount(0);
 const controls = page.getByLabel("Controles da partida");
 await expect(controls.getByRole("button",{name:"Sair da partida",exact:true})).toBeVisible();
 const options = navbar.getByRole("button",{name:"Opções da partida",exact:true});
 await options.click();
 const menu = matchOptions(page);
 await menu.getByRole("button",{name:"Silenciar som",exact:true}).click();
 await expect(menu.getByRole("button",{name:"Ativar som",exact:true})).toBeVisible();
 await menu.getByRole("button",{name:"Esconder histórico",exact:true}).click();
 await expect(page.getByRole("complementary",{name:"Histórico da partida"})).toBeHidden();
 await menu.getByRole("button",{name:"Mostrar histórico",exact:true}).click();
 await expect(page.getByRole("complementary",{name:"Histórico da partida"})).toBeVisible();
 await expect(navbar.getByLabel("Controles da partida")).toBeVisible();
 const before = await controls.boundingBox();
 const bonus = navbar.getByRole("button",{name:"Bônus diário",exact:true});
 if (await bonus.count()) expect(before!.x + before!.width).toBeLessThanOrEqual((await bonus.boundingBox())!.x);
 await page.keyboard.press("Escape");
 await expect(options).toBeFocused();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.goto("/jogos/flip7");
 await expect(navbar.locator("[data-match-identity]")).toHaveCount(0);
 await expect(navbar.locator("[data-match-controls]")).toHaveCount(0);
 await expect(page.getByLabel("Apresentação do jogo")).toBeVisible();
});


test("testes em andamento reutilizam card de lobby sem estado vazio adicional",async({page})=>{
 await close?.();
 close=await startPublicApi(req=>{const user=fixtureUser(req);return user?{...user,role:"admin"}:null;},fixture.handler,fixture.attach);
 const code="ABCDEF778899";
 const state=flip7Driver.project(createGame(matchUsers.map(u=>({name:u.username,kind:"human" as const})),42,{mode:"vengeance",brutal:true}));
 const room=matchSchema.parse({id:"93089d02-0b34-4b78-9d3e-f2679c190b5e",code,development:true,game:"flip7",rulesVersion:1,version:1,status:"playing",state,hostId:matchUsers[0].id,capacity:2,options:{mode:"vengeance",brutal:true},participants:matchUsers.map((u,seat)=>({userId:u.id,username:u.username,displayName:u.displayName,avatarUrl:null,seat}))});
 fixture.states.set(code,{room,frames:[]});
 await page.goto("/jogos/flip7?teste=1");
 const list=page.getByLabel("Lobbies abertos");
 await expect(list.getByText("Em andamento",{exact:true})).toBeVisible();
 await expect(list.getByText("Sala de Marco",{exact:true})).toBeVisible();
 await expect(list.getByLabel("Vagas do lobby").getByRole("listitem")).toHaveCount(2);
 await expect(list.getByRole("button",{name:"Visualizar",exact:true})).toBeVisible();
 await expect(list.getByRole("button",{name:"Cancelar",exact:true})).toBeVisible();
 await expect(list.locator('[data-slot="empty-state"]')).toHaveCount(0);
 await expect(list.getByText(code,{exact:false})).toHaveCount(0);
 await list.getByRole("button",{name:"Cancelar",exact:true}).click();
 const exit=page.getByRole("dialog");
 await expect(exit.getByRole("button",{name:"Propor abandono coletivo",exact:true})).toHaveCount(0);
 await expect(exit.getByRole("button",{name:"Abandonar sozinho",exact:true})).toBeVisible();
 await expect(exit.getByRole("button",{name:"Cancelar partida",exact:true})).toBeVisible();
 await exit.getByRole("button",{name:"Continuar",exact:true}).click();
});

test("porta do teste com bots pede confirmação e não encerra ao abrir ou desistir do modal",async({page})=>{
 await close?.();close=await startPublicApi(req=>{const user=fixtureUser(req);return user?{...user,role:'admin'}:null;},fixture.handler,fixture.attach);
 const code='ABCDEF445566';
 const state=flip7Driver.project(flip7Driver.create({setup:[{name:'Bot 1',kind:'normal'},{name:'Bot 2',kind:'normal'}],options:{mode:'classic',brutal:false},onlyBots:true},'Marco'));
 const room=matchSchema.parse({id:'93089d02-0b34-4b78-9d3e-f2679c190b5e',code,development:true,onlyBots:true,bots:2,game:'flip7',rulesVersion:1,version:1,status:'playing',state,hostId:matchUsers[0].id,capacity:2,options:{mode:'classic',brutal:false},participants:[]});
 fixture.states.set(code,{room,frames:[]});let ended=0;
 await page.route(`**/api/v1/matches/${code}/end-test`,async route=>{ended++;fixture.states.delete(code);await route.fulfill({json:{ok:true}});});
 await page.goto(`/jogos/flip7?teste=1&partida=${code}`);
 await openMatchOptions(page);
 await page.getByRole('button',{name:'Encerrar teste',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Encerrar partida de teste?'});await expect(dialog).toBeVisible();expect(ended).toBe(0);
 await dialog.getByRole('button',{name:'Continuar',exact:true}).click();expect(ended).toBe(0);
 await openMatchOptions(page);
 await page.getByRole('button',{name:'Encerrar teste',exact:true}).click();await dialog.getByRole('button',{name:'Cancelar partida',exact:true}).click();await expect.poll(()=>ended).toBe(1);
});


test("limite de assinatura preserva o lobby e recupera os controles sem piscar",async({page})=>{
  // Shorten only the subscription cooldown; leave Socket.IO heartbeat timers real.
  await page.addInitScript(()=>{
    const original=window.setTimeout.bind(window);
    window.setTimeout=((handler:TimerHandler,delay?:number,...args:unknown[])=>original(handler,delay===60000?1500:delay,...args)) as typeof window.setTimeout;
  });
  await page.goto("/jogos/flip7");
  const createRoom=async()=>{await page.getByRole("button",{name:"Jogar",exact:true}).click();await page.getByRole("dialog").getByRole("button",{name:"Criar sala",exact:true}).click();};
  await createRoom();
  const cancel=page.getByRole("button",{name:"Cancelar",exact:true});
  await expect(cancel).toBeEnabled();
  const url=page.url();
  const before=fixture.watches.length;
  fixture.rejectNextWatch();
  fixture.disconnectUser(matchUsers[0].id);
  await expect(page.getByText("Muitas alterações de sala. Reconectando em até um minuto.",{exact:true})).toBeVisible();
  await expect(cancel).toBeVisible();
  await expect(cancel).toBeDisabled();
  expect(page.url()).toBe(url);
  await expect(cancel).toBeEnabled();
  await expect(page.getByText(/Muitas alterações de sala/)).toHaveCount(0);
  expect(fixture.watches.length-before).toBe(2);
  await cancel.click();
  await createRoom();
  await expect(cancel).toBeEnabled();
});

for (const input of ["deck", "Enter", "Escape"] as const) {
  test(`deck e atalhos respeitam o turno e bloqueiam interferências: ${input}`, async ({ page }) => {
    const code = "ABCDEF102030";
    const state = createGame(matchUsers.map(user => ({ name: user.username, kind: "human" as const })), 42, { mode: "classic", brutal: false });
    const deck = createDeck("classic");
    const take = (value: number) => deck.splice(deck.findIndex(card => card.type === "number" && card.value === value), 1)[0];
    state.players[0].cards = [take(2)];
    state.players[1].cards = [take(3)];
    state.players.forEach(player => { player.hasDrawn = true; });
    state.turn = 0;
    const next = take(4);
    state.deck = [...deck, next];
    const room = matchSchema.parse({ id: "93089d02-0b34-4b78-9d3e-f2679c190b5e", code, game: "flip7", rulesVersion: 1, version: 1, status: "playing", state: flip7Driver.project(state), hostId: matchUsers[0].id, capacity: 2, options: { mode: "classic", brutal: false }, participants: matchUsers.map((user, seat) => ({ userId: user.id, username: user.username, displayName: user.displayName, avatarUrl: null, seat })) });
    fixture.states.set(code, { room, privateState: state, frames: [] });
    await page.goto(`/jogos/flip7?partida=${code}`);
    const pile = page.getByRole("button", { name: "Comprar carta do baralho", exact: true });
    await expect(pile).toBeEnabled();
    await openMatchOptions(page);
    await page.getByRole("button", { name: "Abandonar partida", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Sair da partida?" });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await closeMatchOptions(page);
    await expect(page.getByRole("menu", { name: "Opções da partida", exact: true })).toHaveCount(0);
    expect(fixture.commands).toHaveLength(0);
    await page.evaluate(() => {
      const field = document.createElement("input");
      field.id = "shortcut-field";
      document.body.append(field);
      field.focus();
    });
    await page.keyboard.press("Enter");
    await page.keyboard.press("Escape");
    expect(fixture.commands).toHaveLength(0);
    await page.locator("#shortcut-field").evaluate(element => element.remove());
    await expect(page.getByRole("menu", { name: "Opções da partida", exact: true })).toHaveCount(0);
    // Holding Enter must not issue repeated purchases.
    await page.evaluate(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", repeat: true, bubbles: true })));
    expect(fixture.commands).toHaveLength(0);
    if (input === "deck") await pile.click();
    else await page.keyboard.press(input);
    await expect.poll(() => fixture.commands.length).toBe(1);
    expect(fixture.commands[0]).toEqual(expect.objectContaining({ action: expect.objectContaining({ type: input === "Escape" ? "stay" : "draw" }) }));
    await expect(pile).toBeDisabled();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Escape");
    expect(fixture.commands).toHaveLength(1);
  });
}

for (const type of ["steal", "swap"] as const) {
  test(`mesa 3D usa a própria mão para escolher cartas: ${type}`, async ({ page }, testInfo) => {
    const code = "ABCDEF303030";
    const options = { mode: "vengeance" as const, brutal: false };
    const state = createGame(matchUsers.map(user => ({ name: user.username, kind: "human" as const })), 42, options);
    const deck = createDeck("vengeance");
    const take = (type: typeof deck[number]["type"], value?: number) => deck.splice(deck.findIndex(card => card.type === type && (value === undefined || card.value === value)), 1)[0];
    const own = take("number", 2), other = take("number", 3), extra = take("number", 4), actionCard = take(type);
    state.players[0].cards = [own]; state.players[1].cards = [other, extra];
    state.players.forEach(player => { player.hasDrawn = true; });
    state.pending = { source: 0, card: actionCard, resolving: true }; state.turn = 0;
    const spent = take("number", 10);
    state.deck = deck; state.discard = [spent]; state.queue = []; state.forced = null;
    const room = matchSchema.parse({ id: "93089d02-0b34-4b78-9d3e-f2679c190b5e", code, game: "flip7", rulesVersion: 1, version: 1, status: "playing", state: flip7Driver.project(state), hostId: matchUsers[0].id, capacity: 2, options, participants: matchUsers.map((user, seat) => ({ userId: user.id, username: user.username, displayName: user.displayName, avatarUrl: null, seat })) });
    fixture.states.set(code, { room, privateState: state, frames: [] });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`/jogos/flip7?partida=${code}`);
    await openMatchOptions(page);
    await page.getByRole("button", { name: "3D", exact: true }).click();
    await closeMatchOptions(page);
    const scene = page.getByTestId("flip-table-scene");
    await expect(scene.locator("canvas")).toBeVisible();
    const header = page.getByRole("banner");
    await expect(header).toContainText("Flip da comunidade");
    await expect(scene.getByLabel("Controles da partida", { exact: true })).toHaveCount(0);
    if (testInfo.project.name === "desktop") {
      const box = await scene.boundingBox();
      expect(Math.abs(box!.y + box!.height - (page.viewportSize()!.height - 16))).toBeLessThanOrEqual(2);
    }
    await expect(scene).toHaveAttribute("data-choice", "true");
    await expect(scene).toHaveAttribute("data-hand-layout", "spread");
    await expect(scene).toHaveAttribute("data-discard-count", "0");
    await expect(scene).toHaveAttribute("data-staging-count", "1");
    const discardMove = scene.getByRole("button", { name: "Mover descarte", exact: true });
    await expect(discardMove).toBeVisible();
    const before = (await discardMove.boundingBox())!;
    await discardMove.focus(); await discardMove.press("ArrowRight");
    await expect.poll(async () => (await discardMove.boundingBox())!.x).toBeGreaterThan(before.x);
    await expect(scene.getByRole("button", { name: "Rotacionar descarte", exact: true })).toBeEnabled();
    await expect(scene.locator("[data-game-actions]")).toBeVisible();
    expect(fixture.commands).toHaveLength(0);
    expect(fixture.states.get(code)!.privateState!.players[1].cards.map(card => card.id)).toContain(other.id);
    if (type === "swap") {
      const first = scene.getByRole("button", { name: `Selecionar 2 de ${matchUsers[0].displayName}`, exact: true });
      await first.focus(); await first.press("Enter");
    }
    const candidate = scene.getByRole("button", { name: `Selecionar 3 de ${matchUsers[1].displayName}`, exact: true });
    await candidate.focus(); await candidate.press("Enter");
    if (type === "swap") {
      expect(fixture.commands).toHaveLength(0);
      await scene.getByRole("button", { name: "Confirmar", exact: true }).click();
    }
    await expect.poll(() => fixture.commands.length).toBe(1);
    expect(fixture.commands[0]).toEqual(expect.objectContaining({ action: { type: "cards", cards: type === "swap" ? [own.id, other.id] : [other.id] } }));
    await expect(scene).toHaveAttribute("data-choice", "false");
    await expect(scene).toHaveAttribute("data-staging-count", "0");
    await expect(scene).toHaveAttribute("data-discard-count", "0");
    expect(fixture.states.get(code)!.privateState!.discard.some(card => card.id === spent.id)).toBe(true);
    await expect.poll(() => fixture.states.get(code)!.privateState!.players[0].cards.some(card => card.id === other.id)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`table-3d-${type}.png`), fullPage: true });
    const address = page.url();
    await openMatchOptions(page);
    await page.getByRole("button", { name: "Atual", exact: true }).click();
    await expect(scene).toHaveCount(0); expect(page.url()).toBe(address);
    await openMatchOptions(page);
    await page.getByRole("button", { name: "3D", exact: true }).click();
    await closeMatchOptions(page);
    await page.reload();
    await expect(page.getByTestId("flip-table-scene").locator("canvas")).toBeVisible();
    expect(fixture.commands).toHaveLength(1);
  });
}

test("mesa 3D aguarda a revelação e entrega antes de liberar outra ação", async ({ page }) => {
  const code = "ABCDEF404040";
  const options = { mode: "classic" as const, brutal: false };
  const state = createGame(matchUsers.map(user => ({ name: user.username, kind: "human" as const })), 42, options);
  const deck = createDeck("classic");
  const take = (value: number) => deck.splice(deck.findIndex(card => card.type === "number" && card.value === value), 1)[0];
  state.players[0].cards = [take(2)]; state.players[1].cards = [take(3)];
  state.players.forEach(player => { player.hasDrawn = true; });
  const next = take(4);
  state.deck = [...deck, next]; state.turn = 0;
  const room = matchSchema.parse({ id: "93089d02-0b34-4b78-9d3e-f2679c190b5e", code, game: "flip7", rulesVersion: 1, version: 1, status: "playing", state: flip7Driver.project(state), hostId: matchUsers[0].id, capacity: 2, options, participants: matchUsers.map((user, seat) => ({ userId: user.id, username: user.username, displayName: user.displayName, avatarUrl: null, seat })) });
  fixture.states.set(code, { room, privateState: state, frames: [] });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto(`/jogos/flip7?partida=${code}`);
  await openMatchOptions(page);
  const toggle = page.getByRole("button", { name: "3D", exact: true });
  await toggle.click();
  await closeMatchOptions(page);
  const scene = page.getByTestId("flip-table-scene");
  await expect(scene.locator("canvas")).toBeVisible();
  const draw = scene.getByRole("button", { name: "Comprar", exact: false });
  await expect(draw.last()).toBeEnabled();
  await draw.last().click();
  await expect.poll(() => fixture.commands.length).toBe(1);
  await openMatchOptions(page);
  await expect(toggle).toBeDisabled();
  await closeMatchOptions(page);
  await page.waitForTimeout(350);
  await openMatchOptions(page);
  await expect(toggle).toBeDisabled();
  await closeMatchOptions(page);
  await openMatchOptions(page);
  await expect(toggle).toBeEnabled({ timeout: 5000 });
});

for (const view of ["classic", "3d"] as const) {
  test(`histórico acompanha a mesa e empilha em telas estreitas ${view}`, async ({ page }) => {
    const code = "ABCDEF343434";
    const options = { mode: "classic" as const, brutal: false };
    const state = createGame(matchUsers.map(user => ({ name: user.username, kind: "human" as const })), 42, options);
    state.log = Array.from({ length: 60 }, (_, index) => ({ message: `Jogada ${index + 1} de Marco.`, player: 0 }));
    const room = matchSchema.parse({ id: "93089d02-0b34-4b78-9d3e-f2679c190b5e", code, game: "flip7", rulesVersion: 1, version: 1, status: "playing", state: flip7Driver.project(state), hostId: matchUsers[0].id, capacity: 2, options, participants: matchUsers.map((user, seat) => ({ userId: user.id, username: user.username, displayName: user.displayName, avatarUrl: null, seat })) });
    fixture.states.set(code, { room, privateState: state, frames: [] });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`/jogos/flip7?partida=${code}`);
    if (view === "3d") {
      await openMatchOptions(page);
      await page.getByRole("button", { name: "3D", exact: true }).click();
      await closeMatchOptions(page);
    }
    const layout = page.locator("[data-game-table-layout]");
    const table = layout.locator("[data-game-table-content]");
    const aside = layout.locator("[data-game-table-aside]");
    const users = page.getByLabel("Usuários da partida");
    const history = page.getByRole("complementary", { name: "Histórico da partida", exact: true });
    const verify = async () => {
      await expect(history).toBeVisible();
      const stacked = (await layout.boundingBox())!.width < 768;
      await expect.poll(async () => {
        const left = (await table.boundingBox())!, right = (await aside.boundingBox())!;
        return stacked
          ? Math.max(Math.abs(left.x - right.x), Math.abs(left.width - right.width))
          : Math.abs(left.y - right.y);
      }).toBeLessThanOrEqual(1);
      const left = (await table.boundingBox())!, right = (await aside.boundingBox())!;
      if (stacked) {
        expect(right.y).toBeGreaterThanOrEqual(left.y + left.height);
      } else {
        expect(right.x).toBeGreaterThanOrEqual(left.x + left.width);
        expect(right.y + right.height).toBeLessThanOrEqual(page.viewportSize()!.height);
      }
      if (view === "classic") {
        // Participantes no topo do aside, imediatamente antes do histórico.
        const players = (await users.boundingBox())!, panel = (await history.boundingBox())!;
        expect(players.y + players.height).toBeLessThanOrEqual(panel.y);
      }
      // O histórico mantém rolagem própria na coluna; a página conserva a
      // rolagem que a interface do jogo já tinha.
      expect(await history.evaluate(element => element.scrollHeight)).toBeGreaterThan(await history.evaluate(element => element.clientHeight));
      await history.evaluate(element => { element.scrollTop = 150; });
      expect(await history.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
      expect(await table.evaluate(element => element.scrollTop)).toBe(0);
      expect(await table.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
      if (view === "classic") {
        const seat = table.getByRole("region", { name: "Mesa de Marco", exact: true });
        const viewport = (await table.boundingBox())!, bounds = (await seat.boundingBox())!;
        // The active seat's 2px outer shadow must fit inside the scroll clip.
        expect(bounds.x - 2).toBeGreaterThanOrEqual(viewport.x);
        expect(bounds.x + bounds.width + 2).toBeLessThanOrEqual(viewport.x + viewport.width);
      }
    };
    await verify();
    for (const width of [320, 600, 900]) {
      await page.setViewportSize({ width, height: 560 });
      await verify();
    }
    await openMatchOptions(page);
    await page.getByRole("button", { name: "Esconder histórico", exact: true }).click();
    await expect(history).toBeHidden();
    if (view === "classic") await expect(users).toBeVisible();
    await page.getByRole("button", { name: "Mostrar histórico", exact: true }).click();
    await verify();
  });
}
