import type { IncomingMessage, ServerResponse } from "node:http";
import { createMatchSchema, matchCommandSchema, matchResultSchema, type Match } from "@croebet/shared";
import { flip7Driver } from "../../api/src/modules/games/flip7/driver";
import { createGame, type Game } from "../../api/src/modules/games/flip7/engine";
import { execute } from "../../api/src/modules/matches/execution";

export function matchesFixture() {
  const states = new Map<string, { match: Match; privateState: Game }>();
  const receipts = new Map<string, unknown>();
  const commands: unknown[] = [];
  let failAfterCommit = false;
  return {
    commands, states,
    failNextResponse() { failAfterCommit = true; },
    async handler(request: IncomingMessage, response: ServerResponse) {
      const path = new URL(request.url ?? "/", "http://fixture").pathname;
      if (!path.startsWith("/api/v1/matches") && path !== "/api/v1/auth/csrf") return false;
      response.setHeader("content-type", "application/json");
      const send = (body: unknown, status = 200) => { response.statusCode = status; response.end(JSON.stringify(body)); return true; };
      if (path === "/api/v1/auth/csrf") return send({ token: "test-csrf" });
      if (request.method === "GET" && path === "/api/v1/matches") return send({ items: [...states.values()].map(item => item.match).filter(match => match.status === "playing") });
      const code = path.split("/")[4];
      if (request.method === "GET") return states.has(code) ? send(states.get(code)!.match) : send({ error: { message: "Partida não encontrada." } },404);
      let raw = "";
      for await (const chunk of request) raw += String(chunk);
      const body = JSON.parse(raw);
      if (path === "/api/v1/matches") {
        const input = createMatchSchema.parse(body);
        if (receipts.has(input.requestId)) return send(receipts.get(input.requestId));
        const game = createGame(input.setup,42,input.options);
        // Known initial cards make UI assertions deterministic without exposing the deck.
        for (const value of [11,10]) {
          const index = game.deck.findIndex(card => card.type === "number" && card.value === value);
          game.deck.push(...game.deck.splice(index,1));
        }
        const result = execute(flip7Driver,game,1);
        const code = (states.size+1).toString(16).padStart(12,"0").toUpperCase();
        const match: Match = { id: crypto.randomUUID(), code, game: "flip7", rulesVersion: 1, version: result.version, status: result.status, state: flip7Driver.project(result.state) };
        states.set(code,{ match, privateState: result.state });
        const reply = matchResultSchema.parse({ match, before: result.before, frames: result.frames });
        receipts.set(input.requestId,reply); return send(reply);
      }
      const saved = states.get(code);
      if (!saved) return send({ error: { message: "Partida não encontrada." } },404);
      commands.push(body);
      if (receipts.has(body.commandId)) return send(receipts.get(body.commandId));
      if (body.expectedVersion !== saved.match.version) return send({ error: { message: "A partida mudou. Recarregue para continuar." } },409);
      const result = path.endsWith("/abandon") ? { state: saved.privateState, before: saved.match.state, frames: [], version: saved.match.version+1, status: "abandoned" as const } : execute(flip7Driver,saved.privateState,saved.match.version,matchCommandSchema.parse(body).action);
      saved.privateState = result.state;
      saved.match = { ...saved.match, version: result.version, status: result.status, state: flip7Driver.project(result.state) };
      const reply = matchResultSchema.parse({ match: saved.match, before: result.before, frames: result.frames });
      receipts.set(body.commandId,reply);
      if (failAfterCommit) { failAfterCommit = false; return send({ error: { message: "Resposta indisponível." } },503); }
      return send(reply);
    },
  };
}
