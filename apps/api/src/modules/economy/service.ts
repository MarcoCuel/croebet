import type { Pool, PoolClient } from "pg";
import { dailyStatusSchema, type DailyStatus } from "@croebet/shared";
import { economy, issuanceAccountId } from "./config.ts";
import { readBonusWindowSettings } from "./settings.ts";
import { dailyClaimLimit, bonusWindowState } from "./window.ts";
import { transferCroinsInTransaction, WalletError } from "../wallet/service.ts";

export class RewardError extends Error {
  public code: "UNAUTHENTICATED" | "DAILY_COOLDOWN";

  constructor(code: RewardError["code"]) {
    super(code);
    this.code = code;
  }
}

export function dailyStatus(input: {
  balance: number; lastClaimAt: Date | null; now: Date; nextClaimAt: Date | null;
  windowActive: boolean; nextWindowAt: Date | null;
}): DailyStatus {
  return dailyStatusSchema.parse({
    balance: input.balance,
    lastClaimAt: input.lastClaimAt?.toISOString() ?? null,
    nextClaimAt: input.nextClaimAt?.toISOString() ?? null,
    eligible: !input.nextClaimAt || input.nextClaimAt <= input.now,
    serverNow: input.now.toISOString(),
    windowActive: input.windowActive,
    nextWindowAt: input.nextWindowAt?.toISOString() ?? null,
  });
}

export async function readDailyStatus(client: Pick<Pool, "query"> | Pick<PoolClient, "query">, userId: string) {
  // PostgreSQL resolves calendar boundaries in the product timezone, independently of host/browser timezone.
  // The window limit only applies to claims made on the current local day.
  const result = await client.query(`select a.balance, c.last_claim_at, c.claims_today,
    (((c.last_claim_at at time zone $2)::date + 1)::timestamp at time zone $2) as next_claim_at,
    clock_timestamp() as now from wallet_accounts a
    cross join lateral (select max(d.claimed_at) as last_claim_at,
      count(*) filter (where (d.claimed_at at time zone $2)::date = (clock_timestamp() at time zone $2)::date) as claims_today
      from daily_claims d where d.account_id=a.id) c
    where a.user_id=$1`, [userId, economy.dailyResetTimeZone]);
  const row = result.rows[0];
  if (!row) throw new WalletError("ACCOUNT_UNAVAILABLE");
  const settings = await readBonusWindowSettings(client);
  const now = row.now as Date;
  const window = bonusWindowState(settings, now, economy.dailyResetTimeZone);
  const eligible = Number(row.claims_today) < dailyClaimLimit(window);
  return dailyStatus({
    balance: Number(row.balance), lastClaimAt: row.last_claim_at, now,
    nextClaimAt: eligible ? null : row.next_claim_at,
    windowActive: window.active, nextWindowAt: window.nextStartAt,
  });
}

// Called inside the registration transaction; failure rolls back user, session and credit.
export async function grantInitialBalance(client: PoolClient, userId: string) {
  const account = await client.query("insert into wallet_accounts (user_id, kind) values ($1, 'user') returning id", [userId]);
  await transferCroinsInTransaction(client, {
    scope: "registration", idempotencyKey: userId, from: issuanceAccountId, to: account.rows[0].id,
    actorAccountId: issuanceAccountId, amount: economy.initialBalance, reason: "Bônus de cadastro", reference: "Cadastro",
  });
}

export async function claimDailyReward(pool: Pool, userId: string, sessionHash: string, requestId: string) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    // Revalidate and lock auth before economic accounts (same order as account deletion).
    const active = await client.query(`select u.id from users u join sessions s on s.user_id=u.id
      where u.id=$1 and s.token_hash=$2 and u.status='active' and s.expires_at > clock_timestamp()
      and s.idle_expires_at > clock_timestamp() for update of u, s`, [userId, sessionHash]);
    if (!active.rows.length) throw new RewardError("UNAUTHENTICATED");
    // Lock both accounts in the ledger's canonical order before checking cooldown.
    const accounts = await client.query(`select id, kind, balance from wallet_accounts
      where user_id=$1 or id=$2 order by id for update`, [userId, issuanceAccountId]);
    const account = accounts.rows.find(row => row.kind === "user");
    if (!account || accounts.rows.length !== 2) throw new WalletError("ACCOUNT_UNAVAILABLE");
    const replay = await client.query("select operation_id from daily_claims where account_id=$1 and request_id=$2", [account.id, requestId]);
    const status = await readDailyStatus(client, userId);
    if (replay.rows.length) { await client.query("commit"); return status; }
    if (!status.eligible) throw new RewardError("DAILY_COOLDOWN");
    // The window claim is deliberately indistinguishable in the statement; kind keeps the origin internal.
    const receipt = await transferCroinsInTransaction(client, {
      scope: `daily:${account.id}`, idempotencyKey: requestId, from: issuanceAccountId, to: account.id,
      actorAccountId: account.id, amount: economy.dailyReward,
      reason: "Resgate diário", reference: "Resgate diário",
    });
    // Record the effective credit time; the next local midnight starts a new claim day.
    await client.query("insert into daily_claims (account_id, request_id, operation_id, claimed_at, kind) values ($1,$2,$3,clock_timestamp(),$4)",
      [account.id, requestId, receipt.operationId, status.windowActive ? "window" : "daily"]);
    const next = await readDailyStatus(client, userId);
    await client.query("commit");
    return next;
  } catch (error) { await client.query("rollback"); throw error; }
  finally { client.release(); }
}
