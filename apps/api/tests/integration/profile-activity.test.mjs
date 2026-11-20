import { test } from "node:test";
import assert from "node:assert/strict";
import { createDatabase } from "../../dist/db/client.js";
import { readProfileActivity } from "../../dist/modules/auth/profile-activity.js";

test("PostgreSQL: atividade pública agrega fontes sem duplicar vitórias, respeita fuso, período e participação", async t => {
  if (!process.env.TEST_DATABASE_URL) throw Error("Configure TEST_DATABASE_URL com banco exclusivo identificado como test.");
  const { pool } = createDatabase(process.env.TEST_DATABASE_URL);
  t.after(() => pool.end());
  assert.equal((await pool.query("select environment from application_environment where id=1")).rows[0]?.environment, "test");
  const user = "93089d02-0b34-4b78-9d3e-f2679c190b5b";
  const other = "93089d02-0b34-4b78-9d3e-f2679c190b5c";
  const participants = [{ seat: 0, userId: user }, { seat: 1, userId: other }];
  const state = { phase: "over", players: [{ total: 200, kind: "human" }, { total: 150, kind: "human" }] };
  const archive = (status, ended_at, extra = {}) => ({ status, ended_at, participants, state, ...extra });
  // CTE fixtures exercise the production SQL on PostgreSQL without writing any records.
  const fixtures = {
    accounts: [{ id: "own", user_id: user }, { id: "other", user_id: other }],
    claims: [
      { account_id: "own", claimed_at: "2026-11-20T02:59:59Z" },
      { account_id: "own", claimed_at: "2026-11-20T03:00:00Z" },
      { account_id: "own", claimed_at: "2025-10-26T03:00:00Z" },
      { account_id: "own", claimed_at: "2025-10-26T02:59:59Z" },
      { account_id: "own", claimed_at: "2026-11-21T03:00:00Z" },
      { account_id: "other", claimed_at: "2026-11-20T12:00:00Z" },
    ],
    coupons: [{ account_id: "own", created_at: "2026-11-20T12:00:00Z" }, { account_id: "other", created_at: "2026-11-20T12:00:00Z" }],
    archives: [
      archive("finished", "2026-11-20T12:00:00Z"),
      archive("finished", "2026-11-20T12:00:00Z", { state: { ...state, players: [{ total: 200, kind: "human" }, { total: 200, kind: "human" }] } }),
      archive("finished", "2026-11-20T02:00:00Z", { state: { ...state, players: [{ total: 100, kind: "bot" }, { total: 50, kind: "human" }] } }),
      archive("abandoned", "2026-11-20T12:00:00Z"), archive("playing", null),
      archive("finished", "2026-11-20T12:00:00Z", { participants: [{ seat: 0, userId: other }] }),
      archive("finished", "2025-10-26T02:59:59Z"), archive("finished", "2026-11-21T03:00:00Z"),
    ],
  };
  function adapter(now, data = fixtures) {
    return { query: (sql, params) => pool.query(sql.replace("with bounds as (", `with
      wallet_accounts as (select * from jsonb_to_recordset($2::jsonb) as x(id text,user_id uuid)),
      daily_claims as (select * from jsonb_to_recordset($3::jsonb) as x(account_id text,claimed_at timestamptz)),
      coupon_redemptions as (select * from jsonb_to_recordset($4::jsonb) as x(account_id text,created_at timestamptz)),
      game_match_archives as (select * from jsonb_to_recordset($5::jsonb) as x(status text,ended_at timestamptz,participants jsonb,state jsonb)),
      bounds as (`).replace("now()", "$6::timestamptz"), [...params, JSON.stringify(data.accounts), JSON.stringify(data.claims), JSON.stringify(data.coupons), JSON.stringify(data.archives), now]) };
  }
  const result = await readProfileActivity(adapter("2026-11-20T15:00:00Z"), user);
  assert.equal(result.timeZone, "America/Sao_Paulo");
  assert.equal(result.days.length, 391);
  assert.deepEqual(result.days[0], { date: "2025-10-26", games: 0, wins: 0, dailyBonuses: 1, coupons: 0 });
  assert.deepEqual(result.days.at(-2), { date: "2026-11-19", games: 1, wins: 0, dailyBonuses: 1, coupons: 0 });
  assert.deepEqual(result.days.at(-1), { date: "2026-11-20", games: 2, wins: 2, dailyBonuses: 1, coupons: 1 });
  assert.equal(result.days.reduce((sum, d) => sum + d.games + d.dailyBonuses + d.coupons, 0), 7);
  assert.ok(result.days.some(d => d.games + d.dailyBonuses + d.coupons === 0));
  const empty = { accounts: [], claims: [], coupons: [], archives: [] };
  const leap = await readProfileActivity(adapter("2024-03-01T01:00:00Z", empty), user);
  assert.equal(leap.days.length, 397);
  assert.equal(leap.days[0].date, "2023-01-29");
  assert.equal(leap.days.at(-1).date, "2024-02-29");
  assert.ok(leap.days.every(d => d.games + d.wins + d.dailyBonuses + d.coupons === 0));
});
