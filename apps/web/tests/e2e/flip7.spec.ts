import { test, expect, type Page, type Browser } from "@playwright/test";
import { startPublicApi } from "../public-api-fixture";
import { matchesFixture, fixtureUser, matchUsers } from "../matches-api-fixture";

let fixture:ReturnType<typeof matchesFixture>;
let close:(()=>Promise<void>)|undefined;
test.beforeEach(async({context})=>{
  fixture=matchesFixture();close=await startPublicApi(fixtureUser,fixture.handler,fixture.attach);
  await context.addCookies([{name:"croebet-session",value:"game-fixture-marco",url:"http://127.0.0.1:3100"}]);
});
test.afterEach(async({context})=>{await context.close();await close?.();});
test("header e três colunas mantêm configuração, vagas e lobbies ao criar e retomar",async({page,context},testInfo)=>{
  await page.goto("/jogos/flip7");
  const settings=page.getByLabel("Configuração e regras"),players=page.getByLabel("Jogadores e vagas"),list=page.getByLabel("Lobbies abertos");
  await expect(settings.getByLabel("Modo do Flip7")).toBeEnabled();
  await expect(players.getByRole("listitem")).toHaveCount(2);
  const header=page.getByLabel("Apresentação do jogo");
  await expect(header.getByRole("heading",{name:"Flip da comunidade",exact:true})).toBeVisible();
  await expect(header.getByRole("button",{name:"Entrar para jogar",exact:true})).toHaveCount(0);
  const headerBox=await header.boundingBox();
  const mainBox=await page.getByRole("main").boundingBox();
  const boxes=await Promise.all([settings.boundingBox(),players.boundingBox(),list.boundingBox()]);
  expect(boxes.every(Boolean)).toBe(true);
  expect(headerBox!.width).toBeCloseTo(mainBox!.width,0);
  expect(boxes[0]!.y).toBeGreaterThanOrEqual(headerBox!.y+headerBox!.height);
  if(testInfo.project.name==="desktop"){
    expect(boxes[0]!.x+boxes[0]!.width).toBeLessThan(boxes[1]!.x);
    expect(boxes[1]!.x+boxes[1]!.width).toBeLessThan(boxes[2]!.x);
    expect(boxes[0]!.y).toBe(boxes[1]!.y);
    expect(boxes[1]!.y).toBe(boxes[2]!.y);
    expect(boxes[2]!.x+boxes[2]!.width).toBeCloseTo(headerBox!.x+headerBox!.width,0);
  }else{
    expect(boxes[1]!.y).toBeGreaterThanOrEqual(boxes[0]!.y+boxes[0]!.height);
    expect(boxes[2]!.y).toBeGreaterThanOrEqual(boxes[1]!.y+boxes[1]!.height);
  }
  await expect(list.locator('[data-slot="empty-state"]')).toHaveText("Nenhum lobby aberto por enquanto.");
  const originalSettings=await settings.elementHandle();
  const originalAvatar=await players.locator('[data-slot="avatar"]').first().elementHandle();
  const serverNavigations:string[]=[];
  page.on("request",request=>{if(request.headers().rsc==="1")serverNavigations.push(request.url());});
  await page.getByRole("button",{name:"Jogar",exact:true}).click();
  await expect(page).toHaveURL(/partida=[A-F0-9]{12}/);
  await expect(page.getByRole("button",{name:"Cancelar",exact:true})).toBeVisible();
  await expect(list.getByRole("button",{name:"Voltar ao lobby",exact:true})).toHaveCount(0);
  await expect(list.getByText("1 vaga disponível")).toHaveCount(0);
  await expect(list.getByRole("button",{name:"Ver lobby",exact:true})).toHaveCount(0);
  await expect(list.getByRole("button",{name:"Sala de Marco",exact:true})).toBeVisible();
  await expect(list.locator('[data-slot="empty-state"]')).toHaveCount(0);
  await expect(page.getByLabel("Modo do Flip7")).toBeEnabled();
  expect(await originalSettings!.evaluate(element=>element.isConnected)).toBe(true);
  expect(await originalAvatar!.evaluate(element=>element.isConnected)).toBe(true);
  expect(serverNavigations).toEqual([]);
  await expect(players.getByText(/ · \d+\/\d+ jogadores$/)).toHaveCount(0);
  const play=await page.getByRole("button",{name:"Jogar",exact:true}).boundingBox();
  const cancel=await page.getByRole("button",{name:"Cancelar",exact:true}).boundingBox();
  expect(play!.y).toBe(cancel!.y);expect(play!.width).toBeGreaterThan(cancel!.width);
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:testInfo.outputPath("lobby.png"),fullPage:true});
  const other=await context.newPage();
  try{
    await other.goto("/jogos/flip7");
    await expect(other.getByRole("button",{name:"Cancelar",exact:true})).toBeVisible();
    await expect(other.getByRole("button",{name:"Jogar",exact:true})).toBeDisabled();
    await page.goto("/jogos/flip7");await page.reload();
    await expect(page.getByRole("button",{name:"Cancelar",exact:true})).toBeVisible();
    expect(fixture.states.size).toBe(1);
    await page.getByRole("button",{name:"Cancelar",exact:true}).click();
    await expect(page.getByRole("button",{name:"Jogar",exact:true})).toBeVisible();
    await expect(list.getByText("Nenhum lobby aberto por enquanto.")).toBeVisible();
    const setupAfterLeave=await settings.elementHandle();
    await expect(other.getByRole("button",{name:"Jogar",exact:true})).toBeVisible();
    await page.getByRole("button",{name:"Jogar",exact:true}).click();
    await expect(page.getByRole("button",{name:"Cancelar",exact:true})).toBeVisible();
    expect(await setupAfterLeave!.evaluate(element=>element.isConnected)).toBe(true);
    expect(fixture.states.size).toBe(1);
    const reopened=[...fixture.states.values()][0].room;
    for(const client of [page,other])await expect(client).toHaveURL(new RegExp("partida="+reopened.code));
  }finally{await other.close();}
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
    await expect(page).toHaveURL(/partida=[A-F0-9]{12}/);
    expect(completed).toBe(1);
  }finally{release();}
});
async function lobby(page:Page){
  await page.goto("/jogos/flip7");
  await page.getByLabel("Número de jogadores").selectOption("6");
  await page.getByRole("button",{name:"Jogar",exact:true}).click();
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
  await expect(peer.page.getByRole("button",{name:"Jogar",exact:true})).toHaveCount(0);
  await expect(page.getByRole("button",{name:"Jogar",exact:true})).toBeEnabled();
  await page.getByRole("button",{name:"Jogar",exact:true}).click();
  await expect(page.getByRole("button",{name:"Comprar",exact:true})).toBeVisible();
  return peer;
}
test("vários lobbies aceitam a mesma conta e o primeiro início cancela as outras filas",async({page,browser})=>{
  await lobby(page);const firstCode=new URL(page.url()).searchParams.get("partida")!;
  const peer=await second(browser);
  try{
    await peer.page.goto(page.url());
    await expect(peer.page.getByRole("button",{name:"Aguardando o host",exact:true})).toBeVisible();
    await peer.page.getByRole("button",{name:"Criar meu lobby",exact:true}).click();
    await expect(peer.page).not.toHaveURL(page.url());
    await expect(peer.page.getByRole("button",{name:"Cancelar",exact:true})).toBeVisible();
    expect(fixture.states.size).toBe(2);
    await page.getByRole("button",{name:"Entrar na sala de Beto, vaga 2",exact:true}).click();
    await expect(page).toHaveURL(peer.page.url());
    await page.reload();
    await expect(page.getByRole("button",{name:"Aguardando o host",exact:true})).toBeVisible();
    for(const saved of fixture.states.values())expect(saved.room.participants).toHaveLength(2);
    await page.getByRole("button",{name:"Meu lobby",exact:true}).click();
    await expect(page).toHaveURL(new RegExp("partida="+firstCode));
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
    await expect(peer.page.getByLabel("Configuração e regras")).toHaveCount(0);
    await expect(peer.page.getByLabel("Número de jogadores")).toHaveCount(0);
    await expect(peer.page.getByLabel("Modo da sala").getByText("Clássico",{exact:true})).toBeVisible();
    await page.getByLabel("Modo do Flip7").selectOption("vengeance");
    await page.getByRole("switch",{name:"Modo Brutal"}).click();
    await page.getByLabel("Número de jogadores").selectOption("3");
    await expect(page.getByLabel("Número de jogadores")).toHaveValue("3");
    await expect(page.getByRole("switch",{name:"Modo Brutal"})).toBeChecked();
    await expect(peer.page.getByLabel("Modo da sala").getByText("Vingança",{exact:true})).toBeVisible();
    await expect(peer.page.getByLabel("Modo da sala").getByText("Brutal",{exact:true})).toBeVisible();
    await expect(peer.page.getByLabel("Vagas da sala").getByRole("listitem")).toHaveCount(3);
    await page.reload();await expect(page.getByLabel("Número de jogadores")).toHaveValue("3");await expect(page.getByRole("switch",{name:"Modo Brutal"})).toBeChecked();
    await page.getByRole("button",{name:"Jogar",exact:true}).click();
    await expect(page.getByRole("button",{name:"Comprar",exact:true})).toBeVisible();
    const room=[...fixture.states.values()][0].room;
    expect(room.options).toEqual({mode:"vengeance",brutal:true});
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
    await expect(page.getByRole("list",{name:"Vagas da sala"}).getByText("Beto",{exact:true})).toHaveCount(0);
    await expect(peer.page.getByRole("button",{name:"Jogar",exact:true})).toBeVisible();
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
    await page.getByRole("button",{name:"Abandonar partida",exact:true}).click();
    await expect(page.getByRole("dialog")).toContainText("Um bot assumirá suas cartas e seus pontos");
    await page.getByRole("dialog").getByRole("button",{name:"Abandonar partida",exact:true}).click();
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
test("não oferece bots nem jogadores locais e mantém Croins opcionais",async({page})=>{
  await page.goto("/jogos/flip7");
  await expect(page.getByRole("button",{name:/Adicionar jogador/})).toHaveCount(0);
  await expect(page.getByRole("switch",{name:"Jogar apostando"})).not.toBeChecked();
  expect(fixture.states.size).toBe(0);
});


test("vagas ficam lado a lado e apenas a próxima permite convidar Online e Offline",async({page})=>{
  await page.goto("/jogos/flip7");
  await page.getByLabel("Número de jogadores").selectOption("6");
  const slots=page.getByRole("list",{name:"Vagas da sala"});
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
  const slots=page.getByRole("list",{name:"Vagas da sala"});
  await expect(slots.getByRole("listitem").filter({hasText:"Beto"})).toHaveClass(/opacity-40/);
  await expect(page.getByRole("button",{name:"Jogar",exact:true})).toBeDisabled();
  const peer=await second(browser);
  try{
    await peer.page.goto("/jogos/flip7");
    await peer.page.getByRole("alert").filter({hasText:"Marco convidou"}).getByRole("button",{name:"Recusar",exact:true}).click();
    await expect(slots.getByText("Beto",{exact:true})).toHaveCount(0);
    await invite();
    await peer.page.getByRole("alert").filter({hasText:"Marco convidou"}).getByRole("button",{name:"Aceitar",exact:true}).click();
    await expect(peer.page.getByRole("button",{name:"Aguardando o host",exact:true})).toBeVisible();
    await expect(slots.getByRole("listitem").filter({hasText:"Beto"})).not.toHaveClass(/opacity-40/);
    await expect(page.getByRole("button",{name:"Jogar",exact:true})).toBeEnabled();
    await peer.page.goto("/");
    await expect(page.getByRole("button",{name:"Jogar",exact:true})).toBeDisabled();
    await peer.page.goto(page.url());
    await expect(page.getByRole("button",{name:"Jogar",exact:true})).toBeEnabled();
  }finally{await peer.context.close();}
});

test("visitante abre o convite sem configurações e recebe os badges da sala",async({page,browser})=>{
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
    await expect(view.getByLabel("Vagas da sala").getByText("Marco",{exact:true})).toBeVisible();
    await expect(view.getByLabel("Configuração e regras")).toHaveCount(0);
    await expect(view.getByLabel("Número de jogadores")).toHaveCount(0);
    await expect(view.getByLabel("Modo da sala").getByText("Clássico",{exact:true})).toBeVisible();
    await page.getByLabel("Modo do Flip7").selectOption("vengeance");
    await page.getByRole("switch",{name:"Modo Brutal"}).click();
    await expect(view.getByLabel("Modo da sala").getByText("Vingança",{exact:true})).toBeVisible();
    await expect(view.getByLabel("Modo da sala").getByText("Brutal",{exact:true})).toBeVisible();
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
    if(mode==="register")await dialog.getByRole("button",{name:"Criar conta",exact:true}).click();
    await dialog.getByLabel("Nome de usuário").fill("Beto");
    await dialog.getByLabel("Senha",{exact:true}).fill("senha-teste-123");
    await dialog.getByRole("button",{name:mode==="register"?"Criar conta":"Entrar",exact:true}).click();
    await expect(dialog).toHaveCount(0);
    await expect(view).toHaveURL(page.url());
    await expect(view.getByRole("button",{name:"Aguardando o host",exact:true})).toBeVisible();
    await expect.poll(()=>[...fixture.states.values()][0].room.participants.length).toBe(2);
    expect(fixture.states.size).toBe(1);
    await expect(view.getByLabel("Configuração e regras")).toHaveCount(0);
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


test("host confirma automaticamente e demais participantes reconfirmam alterações da entrada",async({page,browser})=>{
  await page.goto("/jogos/flip7");
  await page.getByRole("switch",{name:"Jogar apostando"}).check();
  await expect(page.getByLabel("Entrada por jogador",{exact:true})).toHaveValue("5");
  const prize=page.getByText("Prêmio (Pote)",{exact:true}).locator("..");
  await expect(prize).toContainText("5 Croins");
  await expect(page.getByText("Vencedores dividem o pote, sem taxa. Prêmios de vagas com bot vão para a casa.",{exact:true})).toHaveCount(0);
  await page.getByRole("button",{name:"Jogar",exact:true}).click();
  await expect(page).toHaveURL(/partida=[A-F0-9]{12}/);
  const peer=await second(browser);
  try{
    await peer.page.goto(page.url());
    await expect(peer.page.getByRole("button",{name:"Confirmar entrada de 5 Croins"})).toBeVisible();
    await expect(prize).toContainText("10 Croins");
    await expect(page.getByRole("button",{name:"Jogar",exact:true})).toBeDisabled();
    await expect(page.getByRole("button",{name:"Confirmar entrada de 5 Croins"})).toHaveCount(0);
    await peer.page.getByRole("button",{name:"Confirmar entrada de 5 Croins"}).click();
    await expect(page.getByRole("button",{name:"Jogar",exact:true})).toBeEnabled();
    await page.getByLabel("Entrada por jogador",{exact:true}).fill("10");
    await page.getByLabel("Entrada por jogador",{exact:true}).blur();
    await expect(page.getByRole("button",{name:"Confirmar entrada de 10 Croins"})).toHaveCount(0);
    await expect(peer.page.getByRole("button",{name:"Confirmar entrada de 10 Croins"})).toBeVisible();
    await expect(page.getByRole("button",{name:"Jogar",exact:true})).toBeDisabled();

    await peer.page.getByRole("button",{name:"Confirmar entrada de 10 Croins"}).click();
    await expect(page.getByRole("button",{name:"Jogar",exact:true})).toBeEnabled();
    await page.getByRole("button",{name:"Jogar",exact:true}).click();
    await expect(page.getByText("Pote: 20 Croins",{exact:true})).toBeVisible();
  }finally{await peer.context.close();}
});


test("campo de aposta reutilizável soma, subtrai e seleciona valores sugeridos",async({page})=>{
  await page.goto("/jogos/flip7");
  const box=page.getByRole("group",{name:"Aposta da partida",exact:true});
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
