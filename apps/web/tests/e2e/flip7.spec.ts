import { test, expect, type Page, type Browser } from "@playwright/test";
import { startPublicApi } from "../public-api-fixture";
import { matchesFixture, fixtureUser } from "../matches-api-fixture";

let fixture:ReturnType<typeof matchesFixture>;
let close:(()=>Promise<void>)|undefined;
test.beforeEach(async({context})=>{
  fixture=matchesFixture();close=await startPublicApi(fixtureUser,fixture.handler);
  await context.addCookies([{name:"croebet-session",value:"game-fixture-marco",url:"http://127.0.0.1:3100"}]);
});
test.afterEach(async()=>{await close?.();});
async function lobby(page:Page){
  await page.goto("/jogos/flip7");
  await page.getByLabel("Limite de jogadores").selectOption("6");
  await page.getByRole("button",{name:"Criar lobby",exact:true}).click();
  await expect(page).toHaveURL(/partida=[A-F0-9]{12}/);
  await expect(page.getByRole("button",{name:"Iniciar partida",exact:true})).toBeDisabled();
}
async function second(browser:Browser){
  const context=await browser.newContext();
  await context.addCookies([{name:"croebet-session",value:"game-fixture-beto",url:"http://127.0.0.1:3100"}]);
  const page=await context.newPage();return {context,page};
}
async function start(page:Page,browser:Browser){
  await lobby(page);const peer=await second(browser);
  await peer.page.goto("/jogos/flip7");
  await peer.page.getByRole("button",{name:"Entrar",exact:true}).click();
  await expect(peer.page).toHaveURL(page.url());
  await expect(peer.page.getByRole("button",{name:"Iniciar partida",exact:true})).toHaveCount(0);
  await expect(page.getByText("2/6 jogadores",{exact:false})).toBeVisible();
  await page.getByRole("button",{name:"Iniciar partida",exact:true}).click();
  await expect(page.getByRole("button",{name:"Comprar",exact:true})).toBeVisible();
  return peer;
}
test("sala de seis começa com duas contas e sincroniza turnos e retorno após reload",async({page,browser})=>{
  const peer=await start(page,browser);
  try{
    expect([...fixture.states.values()][0].room.participants).toHaveLength(2);
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
test("saída do host transfere a sala para o outro participante",async({page,browser})=>{
  await lobby(page);const peer=await second(browser);
  try{
    await peer.page.goto(page.url());await peer.page.getByRole("button",{name:"Entrar na sala",exact:true}).click();
    await expect(page.getByRole("button",{name:"Iniciar partida",exact:true})).toBeEnabled();
    await page.getByRole("button",{name:"Sair do lobby",exact:true}).click();
    await expect(peer.page.getByRole("button",{name:"Iniciar partida",exact:true})).toBeDisabled();
    expect([...fixture.states.values()][0].room.hostId).toBe("93089d02-0b34-4b78-9d3e-f2679c190b5d");
  }finally{await peer.context.close();}
});
test("resposta perdida permite repetir o mesmo comando sem comprar duas vezes",async({page,browser})=>{
  const peer=await start(page,browser);
  try{
    fixture.failNextResponse();await page.getByRole("button",{name:"Comprar",exact:true}).click();
    await expect(page.getByRole("alert")).toContainText("Resposta indisponível");
    await page.getByRole("button",{name:"Tentar novamente",exact:true}).click();
    await expect(page.getByRole("button",{name:"Comprar",exact:true})).toBeVisible();
    const room=[...fixture.states.values()][0].room;if(room.status==="lobby")throw Error("Partida não iniciada");
    expect(room.state.players[0].cards).toHaveLength(2);
  }finally{await peer.context.close();}
});
test("não oferece bots, jogadores locais nem entrada com Croins",async({page})=>{
  await page.goto("/jogos/flip7");
  await expect(page.getByRole("button",{name:/Adicionar jogador/})).toHaveCount(0);
  await expect(page.getByRole("switch",{name:"Jogar com Croins"})).toHaveCount(0);
  expect(fixture.states.size).toBe(0);
});
