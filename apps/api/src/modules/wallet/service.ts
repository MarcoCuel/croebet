import { createHash, randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { walletSchema, transactionsSchema } from "@croebet/shared";

export class WalletError extends Error {
  public code: "INVALID_TRANSFER" | "IDEMPOTENCY_CONFLICT" | "INSUFFICIENT_FUNDS" | "ACCOUNT_UNAVAILABLE";

  constructor(code: WalletError["code"]) {
    super(code);
    this.code = code;
  }
}
export type Transfer = {
  scope: string; idempotencyKey: string; from: string; to: string;
  actorAccountId: string; amount: number; reason: string; reference: string;
};
// Internal service only. No client-controlled balance or transfer endpoint.
function validateTransfer(input: Transfer) {
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0 || input.from === input.to ||
      ![input.scope, input.idempotencyKey, input.reason, input.reference].every(value => value.length > 0 && value.length <= 256))
    throw new WalletError("INVALID_TRANSFER");
}
export async function transferCroins(pool: Pool, input: Transfer) {
  validateTransfer(input);
  const client = await pool.connect();
  try {
    await client.query("begin");
    const receipt = await transferCroinsInTransaction(client, input);
    await client.query("commit");
    return receipt;
  } catch (error) { await client.query("rollback"); throw error; }
  finally { client.release(); }
}

// The caller owns BEGIN/COMMIT/ROLLBACK and must roll back on any error.
// Authorize and lock the domain resource before calling; receipts are provisional until commit.
export async function transferCroinsInTransaction(client: PoolClient, input: Transfer) {
  validateTransfer(input);
  const payloadHash = createHash("sha256").update(JSON.stringify([
    input.from, input.to, input.actorAccountId, input.amount, input.reason, input.reference,
  ])).digest("hex");
    // Serializes retries even before an operation exists. Collisions only serialize unrelated work.
    await client.query("select pg_advisory_xact_lock(hashtextextended($1, 0))", [JSON.stringify([input.scope, input.idempotencyKey])]);
    const receipt = await client.query("select id, payload_hash from wallet_operations where scope=$1 and idempotency_key=$2", [input.scope, input.idempotencyKey]);
    if (receipt.rows[0]) {
      if (receipt.rows[0].payload_hash !== payloadHash) throw new WalletError("IDEMPOTENCY_CONFLICT");
      return { operationId: receipt.rows[0].id as string };
    }
    const accounts = await client.query("select id, kind, user_id, balance from wallet_accounts where id = any($1::uuid[]) order by id for update", [[input.from, input.to]]);
    if (accounts.rows.length !== 2 || accounts.rows.some(row => row.kind === "user" && !row.user_id)) throw new WalletError("ACCOUNT_UNAVAILABLE");
    const source = accounts.rows.find(row => row.id === input.from)!;
    const target = accounts.rows.find(row => row.id === input.to)!;
    const amount = BigInt(input.amount);
    if (source.kind !== "issuance" && BigInt(source.balance) < amount) throw new WalletError("INSUFFICIENT_FUNDS");
    const sourceBalance = BigInt(source.balance) - amount;
    const targetBalance = BigInt(target.balance) + amount;
    const maximum = BigInt(Number.MAX_SAFE_INTEGER);
    if (sourceBalance < -maximum || targetBalance > maximum) throw new WalletError("INVALID_TRANSFER");
    const id = randomUUID();
    await client.query(`insert into wallet_operations (id, scope, idempotency_key, payload_hash, actor_account_id, reason, reference)
      values ($1,$2,$3,$4,$5,$6,$7)`, [id, input.scope, input.idempotencyKey, payloadHash, input.actorAccountId, input.reason, input.reference]);
    // Database triggers apply balances and check conservation at commit.
    await client.query("insert into wallet_entries (operation_id, account_id, amount, balance) values ($1,$2,$3,$4),($1,$5,$6,$7)",
      [id, input.from, (-amount).toString(), sourceBalance.toString(), input.to, amount.toString(), targetBalance.toString()]);
    return { operationId: id };
}

export async function readWallet(pool: Pool, userId: string) {
  const result = await pool.query("select balance from wallet_accounts where user_id=$1", [userId]);
  if (!result.rows[0]) throw new WalletError("ACCOUNT_UNAVAILABLE");
  return walletSchema.parse({ balance: Number(result.rows[0].balance) });
}
// Older extra-claim rows stored an event label; the player always sees the standard daily text.
export function publicTransactionText(reason: string, reference: string) {
  return reason === "Resgate diário (horário bugado)"
    ? { description: "Resgate diário", reference: "Resgate diário" }
    : { description: reason, reference };
}
export async function readTransactions(pool: Pool, userId: string, limit: number, offset: number, direction: "all" | "income" | "expense" = "all") {
  const result = await pool.query(`select e.id, o.created_at, o.reason, o.reference, e.amount, e.balance from wallet_entries e
    join wallet_accounts a on a.id=e.account_id join wallet_operations o on o.id=e.operation_id
    where a.user_id=$1 and ($4 = 'all' or ($4 = 'income' and e.amount > 0) or ($4 = 'expense' and e.amount < 0)) order by e.sequence desc limit $2 offset $3`, [userId, limit + 1, offset, direction]);
  return transactionsSchema.parse({ items: result.rows.slice(0, limit).map(row => {
    const text = publicTransactionText(row.reason, row.reference);
    return { id: row.id, createdAt: row.created_at.toISOString(), description: text.description, reference: text.reference, amount: Number(row.amount), balance: Number(row.balance) };
  }), hasMore: result.rows.length > limit });
}
