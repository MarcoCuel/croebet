import { createServer, type IncomingMessage, type ServerResponse, type Server } from "node:http";
import { fixedMenuPages } from "@croebet/shared";

// HTTP fixtures support both Server Components and browser requests. Account
// state never comes from localStorage; each spec owns its fixture lifetime.
export async function startPublicApi(session: (request: IncomingMessage) => unknown, handler?: (request: IncomingMessage, response: ServerResponse) => Promise<boolean>, attach?: (server: Server) => () => void) {
  const main = Object.entries(fixedMenuPages).map(([fixed, item], index) => ({
    id: `93089d02-0b34-4b78-9d3e-f2679c190b${60 + index}`,
    ...item, fixed, newTab: false,
  }));
  const about = {
    id: "93089d02-0b34-4b78-9d3e-f2679c190b70", slug: "sobre", title: "Sobre",
    document: Array.from({ length: 30 }, () => ({ tag: "p", children: ["A Croebet leva os jogos a sério e os apostadores na brincadeira."] })),
    published: true, status: "published", publishAt: null, authorId: null, authorName: null,
    showInMenu: false, version: 1, createdAt: null, updatedAt: null, publishedAt: null, lastEditedBy: null,
  };
  const game = { id: "93089d02-0b34-4b78-9d3e-f2679c190b5c", slug: "flip7", name: "Flip da comunidade", description: "Texto cadastrado no painel para jogar com os amigos.", enabled: true, imageUrl: null, version: 1 };
  const server = createServer(async (request, response) => {
    if (handler && await handler(request, response)) return;
    const path = new URL(request.url ?? "/", "http://fixture").pathname;
    response.setHeader("content-type", "application/json");
    const body = path === "/api/v1/matches" ? { items: [] } : path === "/api/v1/me" ? { user: session(request) }
      : path === "/api/v1/matches/lobbies" ? { items: [], joined: [], owned: null, active: null }
      : path === "/api/v1/games" ? { items: [game] }
      : path === "/api/v1/games/flip7" ? game
      : path === "/api/v1/navigation" ? { main, footer: [] }
      : path === "/api/v1/pages/sobre" ? about
      : path === "/api/v1/economy" ? { initialBalance: 30, dailyReward: 10, dailyResetTimeZone: "America/Sao_Paulo", suggestedBets: [1,5,10,50], defaultBet: 5 }
      : path === "/api/v1/rewards/daily" ? { balance: 30, eligible: true, lastClaimAt: null, nextClaimAt: null, serverNow: new Date().toISOString() }
      : path === "/api/v1/pages" ? { items: [{ slug: about.slug, title: about.title, showInMenu: false }] }
      : null;
    if (body === null) response.statusCode = 404;
    response.end(JSON.stringify(body));
  });
  const detach = attach?.(server);
  await new Promise<void>((resolve,reject) => { server.once("error",reject); server.listen(3201,"127.0.0.1",resolve); });
  return () => new Promise<void>((resolve,reject) => { detach?.(); server.closeAllConnections(); server.close(error => error ? reject(error) : resolve()); });
}
