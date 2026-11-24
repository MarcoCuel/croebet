import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { socialIds, socialSettings, gameDefinitions } from "@croebet/shared";
import { createDatabase } from "../../dist/db/client.js";
import { tokenHash } from "../../dist/modules/auth/security.js";
import { gameDriver } from "../../dist/modules/games/registry.js";
import { transferCroins } from "../../dist/modules/wallet/service.js";
import {
  createMatch,
  getMatch,
  lobbyAction,
  commandMatch,
  inviteLobbyPlayer,
} from "../../dist/modules/matches/service.js";

for (const game of socialIds) {
  test(
    "PostgreSQL catálogo: sala oficial, recibos e replay público de " + game,
    async (t) => {
      assert.ok(process.env.TEST_DATABASE_URL);
      const { pool } = createDatabase(process.env.TEST_DATABASE_URL);
      t.after(() => pool.end());
      assert.equal(
        (
          await pool.query(
            "select environment from application_environment where id=1",
          )
        ).rows[0]?.environment,
        "test",
      );
      const actors = [],
        sessions = [];
      const entryAmount = game === "coup" ? 5 : 0;
      for (let seat = 0; seat < socialSettings[game].min; seat++) {
        const name = "Mesa_" + randomUUID().slice(0, 8);
        const id = (
          await pool.query(
            "insert into users(username,display_name,password_hash) values($1,$1,'test') returning id",
            [name],
          )
        ).rows[0].id;
        const hash = tokenHash(randomUUID());
        await pool.query(
          "insert into sessions(token_hash,user_id,expires_at,idle_expires_at) values($1,$2,now()+interval '1 day',now()+interval '1 day')",
          [hash, id],
        );
        actors.push(id);
        sessions.push(hash);
        if (entryAmount) {
          const account = (
            await pool.query(
              "insert into wallet_accounts(user_id,kind) values($1,'user') returning id",
              [id],
            )
          ).rows[0].id;
          await transferCroins(pool, {
            scope: "catalogo-test",
            idempotencyKey: randomUUID(),
            from: "00000000-0000-4000-8000-000000000001",
            to: account,
            actorAccountId: account,
            amount: 30,
            reason: "Crédito de teste",
            reference: id,
          });
        }
      }
      const room = await createMatch(pool, actors[0], sessions[0], {
        requestId: randomUUID(),
        game,
        capacity: actors.length,
        options: gameDefinitions[game].defaults,
        entryAmount,
      });
      for (let seat = 0; seat < actors.length; seat++) {
        if (seat) {
          await inviteLobbyPlayer(
            pool,
            actors[0],
            sessions[0],
            room.code,
            actors[seat],
          );
          await lobbyAction(
            pool,
            actors[seat],
            sessions[seat],
            room.code,
            "join",
            { commandId: randomUUID() },
          );
        }
        await pool.query(
          "insert into match_presence(id,match_id,user_id,expires_at) values($1,$2,$3,now()+interval '1 hour')",
          [randomUUID(), room.id, actors[seat]],
        );
      }
      const ready = await getMatch(pool, actors[0], room.code);
      await lobbyAction(pool, actors[0], sessions[0], room.code, "start", {
        commandId: randomUUID(),
        expectedVersion: ready.version,
      });
      const driver = gameDriver(game);
      for (let step = 0; step < 420; step++) {
        const { state, version } = (
          await pool.query(
            "select state,version from game_matches where id=$1",
            [room.id],
          )
        ).rows[0];
        if (driver.finished(state)) break;
        const seat = state.turn;
        // The decision policy selects a legal input. The real room keeps every seat human.
        const policy = structuredClone(state);
        policy.players[seat].kind = "normal";
        const action = driver.automatic(policy);
        assert.ok(action);
        const input = {
          action,
          commandId: randomUUID(),
          expectedVersion: version,
        };
        if (!step) {
          const other = (seat + 1) % actors.length;
          await assert.rejects(
            commandMatch(
              pool,
              actors[other],
              sessions[other],
              room.code,
              input,
            ),
            { code: "NOT_YOUR_TURN" },
          );
        }
        await commandMatch(
          pool,
          actors[seat],
          sessions[seat],
          room.code,
          input,
        );
        if (!step)
          await commandMatch(
            pool,
            actors[seat],
            sessions[seat],
            room.code,
            input,
          );
      }
      const ended = await getMatch(pool, actors[0], room.code);
      assert.equal(ended.status, "finished");
      if (entryAmount) {
        assert.equal(ended.settlement, "paid");
        assert.equal(ended.potTotal, entryAmount * actors.length);
      }
      const archive = (
        await pool.query("select status from game_match_archives where id=$1", [
          room.id,
        ])
      ).rows[0];
      assert.equal(archive?.status, "finished");
      const frames = (
        await pool.query(
          "select event from game_match_archive_frames where match_id=$1 order by version",
          [room.id],
        )
      ).rows;
      assert.ok(frames.length > 2);
      for (const { event } of frames) {
        assert.deepEqual(event.state.notes, []);
        assert.deepEqual(event.state.hand, []);
        assert.deepEqual(event.state.choices, []);
        assert.ok(!("key" in event.action));
      }
    },
  );
}
