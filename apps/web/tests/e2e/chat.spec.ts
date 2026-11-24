import { expect, test } from "@playwright/test";
import { Server } from "socket.io";
import type { ChatMessage } from "@croebet/shared";
import { startPublicApi } from "../public-api-fixture";

const id="93089d02-0b34-4b78-9d3e-f2679c190b5b";
const otherId="93089d02-0b34-4b78-9d3e-f2679c190b5c";
const user={id,username:"Tonho",displayName:"Tonho",role:"admin",avatarUrl:null,usernameChangeAvailableAt:null,onboarding:{nameProvided:true,remindAt:"2099-01-01T00:00:00.000Z"}};
let closeApi:(()=>Promise<void>)|undefined;
let sockets:Server;
let messages:ChatMessage[]=[];
let events:{id:string;kind:"message"|"delete"|"mute";message:ChatMessage|null}[]=[];
let mutedUntil:string|null=null;
let failReceipt=false;
let requests=new Map<string,string>();
const makeMessage=(text:string,userId=otherId):ChatMessage=>({id:String(messages.length+1),userId,username:userId===id?"Tonho":"Ana",name:userId===id?"Tonho":"Ana da comunidade",avatarUrl:null,text,createdAt:new Date().toISOString(),deleted:false});
function publish(message:ChatMessage,kind:"message"|"delete"="message") {
  if(kind==="message")messages.push(message);
  else messages=messages.map(item=>item.id===message.id?message:item);
  events.push({id:String(events.length+1),kind,message});sockets.emit("chat:changed");
}
test.beforeAll(async()=>{
  closeApi=await startPublicApi(request=>request.headers.cookie?.includes("chat-test")?user:null,async(request,response)=>{
    const url=new URL(request.url??"/","http://fixture");
    const path=url.pathname;
    if(path!=="/api/v1/auth/csrf" && !path.startsWith("/api/v1/chat"))return false;
    response.setHeader("content-type","application/json");
    const send=(data:unknown)=>{response.end(JSON.stringify(data));return true;};
    if(path==="/api/v1/auth/csrf")return send({token:"fixture"});
    if(path==="/api/v1/chat/sync") {
      const selected=events.filter(event=>BigInt(event.id)>BigInt(url.searchParams.get("after")??"0"));
      return send({events:selected,cursor:String(events.length),hasMore:false,mutedUntil});
    }
    if(request.method==="GET") {
      const before=url.searchParams.get("before");
      const selected=messages.filter(message=>!before || BigInt(message.id)<BigInt(before));
      return send({items:selected.slice(-50),hasMore:selected.length>50,cursor:String(events.length),mutedUntil});
    }
    let body="";for await(const chunk of request)body+=chunk;
    if(request.method==="POST") {
      const input=JSON.parse(body);
      let messageId=requests.get(input.requestId);
      if(!messageId){const message=makeMessage(input.text,id);messageId=message.id;requests.set(input.requestId,messageId);publish(message);}
      if(failReceipt){failReceipt=false;response.statusCode=503;return send({error:{message:"Confirmação indisponível. Tente novamente."}});}
      return send({id:messageId});
    }
    if(request.method==="DELETE") {
      const message=messages.find(item=>item.id===path.split("/").at(-1))!;
      publish({...message,deleted:true,text:null},"delete");return send({ok:true});
    }
    if(request.method==="PATCH") {
      mutedUntil=JSON.parse(body).minutes?new Date(Date.now()+600000).toISOString():null;
      events.push({id:String(events.length+1),kind:"mute",message:null});sockets.emit("chat:changed");return send({ok:true});
    }
    return false;
  },server=>{
    sockets=new Server(server,{path:"/api/v1/realtime",addTrailingSlash:false,transports:["websocket"]});
    sockets.on("connection",socket=>{socket.emit("personal-matches",{items:[]});socket.emit("invitations",{items:[]});});
    return ()=>{sockets.disconnectSockets(true);sockets.engine.close();};
  });
});
test.afterAll(async()=>{await closeApi?.();});
test.beforeEach(async({context})=>{
  messages=[];events=[];mutedUntil=null;requests=new Map();failReceipt=false;
  for(let index=0;index<55;index++)messages.push(makeMessage(`Mensagem anterior ${index+1}`));
  await context.addCookies([{name:"croebet-session",value:"chat-test",url:"http://127.0.0.1:3100"}]);
});
test("chat compartilha conexão, recupera eventos e preserva texto e histórico",async({page})=>{
  await page.goto("/");
  await expect.poll(()=>sockets.sockets.sockets.size).toBe(1);
  await expect.poll(async()=>page.getByRole("button",{name:"Chat geral",exact:true}).filter({visible:true}).count()).toBe(1);
  // Wait for the initial history before generating an unread event.
  await page.getByRole("button",{name:"Chat geral",exact:true}).filter({visible:true}).click();
  const dialog=page.getByRole("complementary",{name:"Chat geral"});
  await expect(dialog.getByText("Mensagem anterior 55",{exact:true})).toBeVisible();
  await dialog.getByRole("button",{name:"Fechar chat",exact:true}).click();
  publish(makeMessage("Cheguei na conversa"));
  await expect(page.getByRole("button",{name:"Chat geral, 1 mensagens não lidas"}).filter({visible:true})).toBeVisible();
  await page.getByRole("button",{name:"Chat geral, 1 mensagens não lidas"}).filter({visible:true}).click();
  await expect(dialog.getByText("Cheguei na conversa")).toBeVisible();
  const scroll=dialog.getByLabel("Mensagens do chat");
  await scroll.evaluate(element=>{element.scrollTop=0;});
  await dialog.getByRole("button",{name:"Carregar anteriores"}).click();
  await scroll.evaluate(element=>{element.scrollTop=0;});
  await expect(dialog.getByText("Mensagem anterior 1",{exact:true})).toBeVisible();
  publish(makeMessage("Mensagem enquanto leio antigas"));
  await expect(dialog.getByRole("button",{name:/Novas mensagens/})).toBeVisible();
  expect(await scroll.evaluate(element=>element.scrollTop)).toBeLessThan(1000);
  await dialog.getByRole("button",{name:/Novas mensagens/}).click();
  failReceipt=true;
  const input=dialog.getByLabel("Mensagem",{exact:true});
  await input.fill("Olá <script>texto seguro</script>");await input.press("Enter");
  await expect(dialog.getByRole("alert")).toHaveText("Confirmação indisponível. Tente novamente.");
  await expect(input).toHaveValue("Olá <script>texto seguro</script>");
  await input.press("Enter");await expect(input).toHaveValue("");
  await expect(dialog.getByText("Olá <script>texto seguro</script>",{exact:true})).toHaveCount(1);
  expect(requests.size).toBe(1);
  for(const socket of sockets.sockets.sockets.values())socket.conn.close();
  publish(makeMessage("Mensagem durante reconexão"));
  await expect(dialog.getByText("Mensagem durante reconexão",{exact:true})).toBeVisible();
  await expect.poll(()=>sockets.sockets.sockets.size).toBe(1);
  const last=dialog.locator("li").filter({hasText:"Mensagem durante reconexão"});
  await last.focus();
  await last.getByRole("button",{name:"Moderar mensagem de Ana da comunidade"}).click();
  await page.getByRole("menuitem",{name:"Remover mensagem",exact:true}).click();
  await expect(last).toHaveCount(0);
  await expect(dialog.getByText("Mensagem removida",{exact:true})).toBeVisible();
  await dialog.getByRole("button",{name:"Fechar chat",exact:true}).click();
  await expect(page.getByRole("button",{name:"Chat geral",exact:true}).filter({visible:true})).toBeFocused();
});
test("chat flutuante mantém a página disponível e cabe na tela",async({page,context,isMobile})=>{
  await page.goto("/");
  const panel=page.getByRole("complementary",{name:"Chat geral"});
  const content=page.locator("#page-content");
  await page.getByRole("button",{name:"Chat geral",exact:true}).filter({visible:true}).click();
  await expect(panel).toBeVisible();
  await expect(page.locator("#general-chat-title")).toBeFocused();
  await expect(page.locator('[data-slot="dialog-overlay"]')).toHaveCount(0);
  await expect(page.locator("body")).not.toHaveAttribute("data-scroll-locked", "1");
  await expect(content).toHaveCSS("padding-right","0px");
  await expect(page.locator("header")).toHaveCSS("right","0px");
  const box=await panel.boundingBox();
  const viewport=page.viewportSize()!;
  expect(box!.width).toBeLessThan(viewport.width);
  expect(box!.height).toBeLessThan(viewport.height);
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x+box!.width).toBeLessThanOrEqual(viewport.width);
  expect(box!.y+box!.height).toBeLessThanOrEqual(viewport.height);
  if(!isMobile) {
    const row=panel.locator("li").last();
    const menu=row.getByRole("button",{name:/Moderar mensagem/});
    await row.hover();
    await expect(menu).toHaveCSS("opacity","1");
    await page.locator("header").getByRole("link",{name:"Ver carteira"}).first().focus();
    await expect(panel).toBeVisible();
  }
  await panel.getByRole("button",{name:"Fechar chat",exact:true}).click();
  await expect(page.locator("#general-chat-sidebar")).toHaveAttribute("inert", "");
  await expect(page.getByRole("button",{name:"Chat geral",exact:true}).filter({visible:true})).toBeFocused();
  await context.clearCookies();await page.reload();
  await expect(page.getByRole("button",{name:/^Chat geral/})).toHaveCount(0);
});


test("agrupa mensagens consecutivas por pessoa nas duas visualizações", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Chat geral", exact: true }).filter({ visible: true }).click();
  let panel = page.getByRole("complementary", { name: "Chat geral" });
  await expect(panel.getByText("Mensagem anterior 55", { exact: true })).toBeVisible();
  const first = panel.locator('li[data-message-id="6"]');
  const second = panel.locator('li[data-message-id="7"]');
  await expect(first.getByText("Ana da comunidade")).toBeVisible();
  await expect(second.getByText("Ana da comunidade")).toHaveCount(0);
  const group = first.locator("xpath=../..");
  const avatar = group.locator('[data-slot="avatar"]');
  await expect(avatar).toHaveCount(1);
  await expect(avatar).toHaveCSS("position", "sticky");
  await expect(avatar).toHaveCSS("bottom", "0px");
  publish(makeMessage("Outra pessoa", id));
  publish(makeMessage("Ana voltou"));
  await expect(panel.getByText("Ana voltou")).toBeVisible();
  await expect(panel.locator("li").filter({ hasText: "Ana voltou" }).getByText("Ana da comunidade")).toBeVisible();
  await panel.getByRole("link", { name: "Expandir chat" }).click();
  panel = page.getByRole("complementary", { name: "Chat geral" });
  await expect(panel.locator('li[data-message-id="7"]').getByText("Ana da comunidade")).toHaveCount(0);
  await expect(panel.locator("li").filter({ hasText: "Ana voltou" }).getByText("Ana da comunidade")).toBeVisible();
});


test("expandir mantém a conversa e o rascunho na página de chat", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Chat geral", exact: true }).filter({ visible: true }).click();
  const floating = page.getByRole("complementary", { name: "Chat geral" });
  await expect(floating.getByText("Mensagem anterior 55", { exact: true })).toBeVisible();
  await floating.getByLabel("Mensagem", { exact: true }).fill("Rascunho da conversa");
  await floating.getByRole("link", { name: "Expandir chat" }).click();
  await expect(page).toHaveURL(/\/chat$/);
  await expect(page.locator("header").getByText("Chat geral", { exact: true })).toBeVisible();
  const expanded = page.getByRole("complementary", { name: "Chat geral" });
  await expect(expanded.getByRole("heading", { name: "Chat geral" })).toHaveCount(0);
  await expect(page.locator("footer")).toHaveCount(0);
  const bounds = await expanded.boundingBox();
  const viewport = page.viewportSize()!;
  expect(bounds!.y + bounds!.height).toBeLessThan(viewport.height);
  expect(viewport.height - (bounds!.y + bounds!.height)).toBeLessThanOrEqual(40);
  await expect(expanded).toHaveClass(/rounded-panel/);
  await expect(expanded.getByLabel("Mensagens do chat")).toHaveCSS("overflow-y", "auto");
  await expect(expanded.getByText("Mensagem anterior 55", { exact: true })).toBeVisible();
  await expect(expanded.getByLabel("Mensagem", { exact: true })).toHaveValue("Rascunho da conversa");
  await expect(expanded.getByRole("button", { name: "Enviar mensagem" })).toHaveCount(0);
  await expanded.getByLabel("Mensagem", { exact: true }).press("Enter");
  await expect(expanded.getByText("Rascunho da conversa", { exact: true })).toBeVisible();
  await expect.poll(() => sockets.sockets.sockets.size).toBe(1);
});


test("título acompanha notificações sem perder metadata da página", async ({ page }) => {
  await page.goto("/");
  await expect.poll(() => sockets.sockets.sockets.size).toBeGreaterThan(0);
  const original = await page.title();
  sockets.emit("invitations", { items: [
    { code: "ABCDEF123456", username: "Ana", avatarUrl: null },
    { code: "ABCDEF123457", username: "Bia", avatarUrl: null },
  ] });
  await expect(page).toHaveTitle(`(2) ${original}`);
  await page.evaluate(() => { document.title = "Outra página | Croebet"; });
  await expect(page).toHaveTitle("(2) Outra página | Croebet");
  sockets.emit("invitations", { items: [{ code: "ABCDEF123456", username: "Ana", avatarUrl: null }] });
  await expect(page).toHaveTitle("(1) Outra página | Croebet");
  sockets.emit("invitations", { items: [] });
  await expect(page).toHaveTitle("Outra página | Croebet");
});
