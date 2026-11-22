import type { Pool, PoolClient } from "pg";
import { gameDefinitions, gameIdSchema } from "@croebet/shared";
import { gameDriver } from "../games/registry.ts";

/** Read-only gate: never reinterpret an active match with different rules. */
export async function validateDeploymentMatches(client: Pick<Pool | PoolClient, "query">) {
  const { rows } = await client.query("select game_slug,rules_version,status,options,state from game_matches where status in ('lobby','playing')");
  for (const row of rows) {
    try {
      const game = gameIdSchema.parse(row.game_slug);
      const driver = gameDriver(game);
      if (driver.rulesVersion !== row.rules_version) throw Error("rules version");
      gameDefinitions[game].options.parse(row.options);
      if (row.status === "playing") {
        const state = driver.parse(row.state);
        gameDefinitions[game].view.parse(driver.projectFor(state, null));
      }
    } catch {
      // Do not expose private state, cards, session information or SQL errors.
      throw Error("A release não é compatível com uma sala ativa. Preserve o driver e a versão de regras anteriores antes de publicar.");
    }
  }
  return rows.length;
}
