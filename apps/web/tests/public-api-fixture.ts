import { createServer } from "node:http";

// HTTP fixtures support both Server Components and browser requests. Account
// state never comes from localStorage; each spec owns its fixture lifetime.
export async function startPublicApi(session: () => unknown) {
  const game = { id: "93089d02-0b34-4b78-9d3e-f2679c190b5c", slug: "flip7", name: "Flip 7", enabled: true, imageUrl: null, version: 1 };
  const server = createServer((request, response) => {
    const path = new URL(request.url ?? "/", "http://fixture").pathname;
    response.setHeader("content-type", "application/json");
    const body = path === "/api/v1/me" ? { user: session() }
      : path === "/api/v1/games" ? { items: [game] }
      : path === "/api/v1/games/flip7" ? game
      : path === "/api/v1/navigation" ? { main: [], footer: [] }
      : path === "/api/v1/economy" ? { initialBalance: 30, dailyReward: 10, dailyResetTimeZone: "America/Sao_Paulo", suggestedBets: [1,5,10,50], defaultBet: 5 }
      : path === "/api/v1/rewards/daily" ? { balance: 30, eligible: true, lastClaimAt: null, nextClaimAt: null, serverNow: new Date().toISOString() }
      : { items: [] };
    response.end(JSON.stringify(body));
  });
  await new Promise<void>((resolve,reject) => { server.once("error",reject); server.listen(3201,"127.0.0.1",resolve); });
  return () => new Promise<void>((resolve,reject) => server.close(error => error ? reject(error) : resolve()));
}
