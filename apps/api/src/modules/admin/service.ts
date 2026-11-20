import { createHash } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import type { z } from "zod";
import { adminUserSchema, adminUsersSchema, auditPageSchema, couponSchema, couponsSchema, redemptionsSchema,
  type adminUserIdentitySchema, type adminQuerySchema, type userChangeSchema, type balanceAdjustmentSchema, type couponWriteSchema, type couponsQuerySchema } from "@croebet/shared";
import { avatarUrl } from "../avatars/storage.ts";
import { transferCroinsInTransaction } from "../wallet/service.ts";
import { issuanceAccountId } from "../economy/config.ts";

export class ManagementError extends Error {
  public status: number;
  public code: string;
  constructor(status: number, code: string, message: string) { super(message); this.status = status; this.code = code; }
}
export const governanceLock = "select pg_advisory_xact_lock(47851234)";
export async function protectLastAdmin(client: PoolClient, user: { role: string; status: string }, next: { role: string; status: string }) {
  if (user.role !== "admin" || user.status !== "active" || (next.role === "admin" && next.status === "active")) return;
  const count = await client.query("select count(*)::int as total from users where role='admin' and status='active'");
  if (count.rows[0].total <= 1) throw new ManagementError(409, "LAST_ADMIN", "Não é possível remover ou suspender o último administrador ativo.");
}
export async function adminTransaction<T>(pool: Pool, actorId: string, sessionHash: string, targetId: string | null, run: (client: PoolClient, target?: Record<string, unknown>) => Promise<T>) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    // All permission/status writes and admin deletion share this lock. User rows precede sessions/accounts.
    await client.query(governanceLock);
    const users = await client.query("select id, role, status from users where id=any($1::uuid[]) order by id for update", [[...new Set([actorId, ...(targetId ? [targetId] : [])])]]);
    const actor = users.rows.find(row => row.id === actorId);
    const session = await client.query("select 1 from sessions where user_id=$1 and token_hash=$2 and expires_at > clock_timestamp() and idle_expires_at > clock_timestamp() for update", [actorId, sessionHash]);
    if (!actor || actor.role !== "admin" || actor.status !== "active" || !session.rows.length) throw new ManagementError(404, "NOT_FOUND", "Recurso não encontrado.");
    const target = targetId ? users.rows.find(row => row.id === targetId) : undefined;
    if (targetId && !target) throw new ManagementError(404, "NOT_FOUND", "Usuário não encontrado.");
    const result = await run(client, target);
    await client.query("commit");
    return result;
  } catch (error) { await client.query("rollback"); throw error; }
  finally { client.release(); }
}
export async function audit(client: PoolClient, actorId: string, targetId: string, action: string, reason: string, details: unknown) {
  await client.query("insert into admin_audit (actor_id,target_id,action,reason,details) values ($1,$2,$3,$4,$5)", [actorId, targetId, action, reason, JSON.stringify(details)]);
}
export async function readAudit(pool: Pool, targetId: string, offset = 0, limit = 20) {
  const result = await pool.query(`select a.*, u.username from admin_audit a left join users u on u.id=a.actor_id
    where a.target_id=$1 order by a.created_at desc,a.id desc limit $2 offset $3`, [targetId, limit + 1, offset]);
  return auditPageSchema.parse({ items: result.rows.slice(0, limit).map(row => ({ id: row.id, actorId: row.actor_id, actorUsername: row.username ?? null,
    action: row.action, reason: row.reason, details: row.details, createdAt: row.created_at.toISOString() })), hasMore: result.rows.length > limit });
}
const userProjection = "select u.id,u.username,u.display_name,u.avatar_key,u.role,u.status,u.deletion_scheduled_at,u.created_at,coalesce(a.balance,0) as balance from users u left join wallet_accounts a on a.user_id=u.id";
function userData(row: Record<string, unknown>) {
  return adminUserSchema.parse({ id: row.id, username: row.username, displayName: row.display_name, avatarUrl: avatarUrl(row.avatar_key as string | null),
    role: row.role, status: row.status, deletionScheduledAt: row.deletion_scheduled_at ? (row.deletion_scheduled_at as Date).toISOString() : null, createdAt: (row.created_at as Date).toISOString(), balance: Number(row.balance) });
}
export async function readAdminUser(pool: Pool, id: string) {
  const result = await pool.query(`${userProjection} where u.id=$1`, [id]);
  if (!result.rows[0]) throw new ManagementError(404, "NOT_FOUND", "Usuário não encontrado.");
  return userData(result.rows[0]);
}
export async function readAdminUsers(pool: Pool, query: z.infer<typeof adminQuerySchema>) {
  const where = "where (u.username ilike $1 or u.display_name ilike $1) and ($2='all' or u.status=$2)";
  const params = [`%${query.q}%`, query.status];
  const [rows, count] = await Promise.all([
    pool.query(`${userProjection} ${where} order by u.created_at desc,u.id desc limit $3 offset $4`, [...params, query.limit + 1, query.offset]),
    pool.query(`select count(*)::int as "all", count(*) filter (where u.status='active')::int as active,
      count(*) filter (where u.status='suspended')::int as suspended from users u where (u.username ilike $1 or u.display_name ilike $1)`, [params[0]]),
  ]);
  const counts = count.rows[0];
  return adminUsersSchema.parse({ items: rows.rows.slice(0, query.limit).map(userData), hasMore: rows.rows.length > query.limit, total: counts[query.status], counts });
}
export async function changeUser(pool: Pool, actorId: string, hash: string, targetId: string, input: z.infer<typeof userChangeSchema>) {
  await adminTransaction(pool, actorId, hash, targetId, async (client, target) => {
    if (target!.role !== input.expectedRole || target!.status !== input.expectedStatus) throw new ManagementError(409, "VERSION_CONFLICT", "O usuário foi alterado. Recarregue antes de salvar.");
    await protectLastAdmin(client, target as { role: string; status: string }, input);
    if (target!.role === input.role && target!.status === input.status) return;
    await client.query("update users set role=$1,status=$2,deletion_scheduled_at=case when $2='active' then null else deletion_scheduled_at end where id=$3", [input.role, input.status, targetId]);
    if (input.status === "suspended") await client.query("delete from sessions where user_id=$1", [targetId]);
    await audit(client, actorId, targetId, "user.permissions", input.reason, { before: { role: target!.role, status: target!.status }, after: { role: input.role, status: input.status } });
  });
}
export async function changeUserIdentity(pool: Pool, actorId: string, hash: string, targetId: string, input: z.infer<typeof adminUserIdentitySchema>) {
  await adminTransaction(pool, actorId, hash, targetId, async client => {
    // adminTransaction holds the account locks through validation, update and audit.
    const before = (await client.query("select username,display_name from users where id=$1", [targetId])).rows[0];
    if (before.username !== input.expectedUsername || before.display_name !== input.expectedDisplayName) {
      throw new ManagementError(409, "VERSION_CONFLICT", "O usuário foi alterado. Recarregue antes de salvar.");
    }
    if (before.username === input.username && before.display_name === input.displayName) return;
    try {
      await client.query(`update users set display_name=$1,
        username_changed_at=case when username<>$2 then clock_timestamp() else username_changed_at end,
        username=$2 where id=$3`, [input.displayName, input.username, targetId]);
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "23505") {
        throw new ManagementError(409, "USERNAME_TAKEN", "Este nome de usuário já está em uso.");
      }
      throw error;
    }
    await audit(client, actorId, targetId, "user.identity", "", {
      before: { displayName: before.display_name, username: before.username },
      after: { displayName: input.displayName, username: input.username },
    });
  });
}
export async function adjustBalance(pool: Pool, actorId: string, hash: string, targetId: string, input: z.infer<typeof balanceAdjustmentSchema>) {
  return adminTransaction(pool, actorId, hash, targetId, async client => {
    const payloadHash = createHash("sha256").update(JSON.stringify([targetId, input.direction, input.amount, input.reason])).digest("hex");
    const prior = await client.query("select details from admin_audit where actor_id=$1 and action='wallet.adjustment' and details->>'requestId'=$2", [actorId, input.requestId]);
    if (prior.rows.length) {
      if (prior.rows[0].details.payloadHash !== payloadHash) throw new ManagementError(409, "IDEMPOTENCY_CONFLICT", "Este pedido já foi usado para outro ajuste.");
      return;
    }
    const accounts = await client.query("select id,user_id from wallet_accounts where user_id=any($1::uuid[])", [[actorId, targetId]]);
    const target = accounts.rows.find(row => row.user_id === targetId);
    const actor = accounts.rows.find(row => row.user_id === actorId);
    if (!target || !actor) throw new ManagementError(409, "ACCOUNT_UNAVAILABLE", "Carteira indisponível.");
    const adding = input.direction === "add";
    const receipt = await transferCroinsInTransaction(client, { scope: `adjustment:${actorId}`, idempotencyKey: input.requestId,
      from: adding ? issuanceAccountId : target.id, to: adding ? target.id : issuanceAccountId, actorAccountId: actor.id,
      amount: input.amount, reason: adding ? "Ajuste administrativo · Crédito" : "Ajuste administrativo · Retirada", reference: input.reason || "Ajuste administrativo" });
    await audit(client, actorId, targetId, "wallet.adjustment", input.reason, { requestId: input.requestId, payloadHash, direction: input.direction, amount: input.amount, operationId: receipt.operationId });
  });
}
const couponProjection = `select c.*, r.redeemed,r.distributed,clock_timestamp() as now from coupons c
  cross join lateral (select count(*)::int as redeemed,coalesce(sum(amount),0)::text as distributed from coupon_redemptions where coupon_id=c.id) r`;
export function couponAvailability(coupon: { endsAt: string | null; startsAt: string | null; limit: number | null; redeemed: number; paused: boolean }, now: Date) {
  if (coupon.endsAt && Date.parse(coupon.endsAt) <= now.getTime()) return "Expirado";
  if (coupon.limit !== null && coupon.redeemed >= coupon.limit) return "Esgotado";
  if (coupon.paused) return "Pausado";
  if (coupon.startsAt && Date.parse(coupon.startsAt) > now.getTime()) return "Agendado";
  return "Ativo";
}
function couponData(row: Record<string, unknown>) {
  const value = { id: row.id, code: row.code, amount: Number(row.amount), limit: row.redemption_limit === null ? null : Number(row.redemption_limit),
    startsAt: row.starts_at ? (row.starts_at as Date).toISOString() : null, endsAt: row.ends_at ? (row.ends_at as Date).toISOString() : null,
    paused: row.paused as boolean, version: row.version, redeemed: Number(row.redeemed), distributed: Number(row.distributed) };
  return couponSchema.parse({ ...value, status: couponAvailability(value, row.now as Date) });
}
export async function readCoupon(pool: Pool, id: string) {
  const result = await pool.query(`${couponProjection} where c.id=$1`, [id]);
  if (!result.rows[0]) throw new ManagementError(404, "NOT_FOUND", "Cupom não encontrado.");
  return couponData(result.rows[0]);
}
export async function readCoupons(pool: Pool, query: z.infer<typeof couponsQuerySchema>) {
  // Status predicates are evaluated by PostgreSQL before pagination, using one server instant.
  const base = `with listed as (select p.*, case when ends_at <= now then 'Expirado'
    when redemption_limit is not null and redeemed >= redemption_limit then 'Esgotado' when paused then 'Pausado'
    when starts_at > now then 'Agendado' else 'Ativo' end as state from (${couponProjection}) p)
    `;
  const where = "where code ilike $1 and ($2='Todos' or state=$2)";
  const params = [`%${query.q}%`, query.status];
  const [rows, count] = await Promise.all([
    pool.query(`${base} select * from listed ${where} order by created_at desc,id desc limit $3 offset $4`, [...params, query.limit + 1, query.offset]),
    pool.query(`${base} select state, count(*)::int as total from listed where code ilike $1 group by state`, [params[0]]),
  ]);
  const counts = { Todos: 0, Ativo: 0, Agendado: 0, Pausado: 0, Expirado: 0, Esgotado: 0 };
  for (const row of count.rows) {
    counts[row.state as keyof typeof counts] = row.total;
    counts.Todos += row.total;
  }
  return couponsSchema.parse({ items: rows.rows.slice(0, query.limit).map(couponData), hasMore: rows.rows.length > query.limit, total: counts[query.status], counts });
}
export async function readRedemptions(pool: Pool, couponId: string, q = "", offset = 0, limit = 20) {
  const result = await pool.query(`select r.id,r.amount,r.created_at,u.username from coupon_redemptions r
    join wallet_accounts a on a.id=r.account_id left join users u on u.id=a.user_id
    where r.coupon_id=$1 and ($2='' or u.username ilike $3) order by r.created_at desc,r.id desc limit $4 offset $5`, [couponId, q, `%${q}%`, limit + 1, offset]);
  return redemptionsSchema.parse({ items: result.rows.slice(0, limit).map(row => ({ id: row.id, username: row.username ?? null, amount: Number(row.amount), createdAt: row.created_at.toISOString() })), hasMore: result.rows.length > limit });
}
export async function saveCoupon(pool: Pool, actorId: string, hash: string, id: string | null, input: z.infer<typeof couponWriteSchema>) {
  return adminTransaction(pool, actorId, hash, null, async client => {
    let before;
    if (id) {
      const locked = await client.query("select * from coupons where id=$1 for update", [id]); before = locked.rows[0];
      if (!before) throw new ManagementError(404, "NOT_FOUND", "Cupom não encontrado.");
      if (before.version !== input.version) throw new ManagementError(409, "VERSION_CONFLICT", "O cupom foi alterado. Recarregue antes de salvar.");
      const count = await client.query("select count(*)::int as total from coupon_redemptions where coupon_id=$1", [id]);
      if (input.limit !== null && input.limit < count.rows[0].total) throw new ManagementError(409, "INVALID_LIMIT", "O limite não pode ser menor que os resgates realizados.");
    } else if (input.version !== 0) throw new ManagementError(400, "INVALID_INPUT", "Versão inválida.");
    const params = [input.code, input.amount, input.limit, input.startsAt, input.endsAt, input.paused];
    const result = id
      ? await client.query("update coupons set code=$1,amount=$2,redemption_limit=$3,starts_at=$4,ends_at=$5,paused=$6,version=version+1 where id=$7 returning id", [...params, id])
      : await client.query("insert into coupons (code,amount,redemption_limit,starts_at,ends_at,paused) values ($1,$2,$3,$4,$5,$6) returning id", params);
    const couponId = result.rows[0].id as string;
    await audit(client, actorId, couponId, id ? "coupon.updated" : "coupon.created", input.reason, { before: before ? { code: before.code, amount: String(before.amount), limit: before.redemption_limit === null ? null : String(before.redemption_limit), startsAt: before.starts_at, endsAt: before.ends_at, paused: before.paused, version: before.version } : null, after: input });
    return couponId;
  });
}

// Repeated requests preserve the original deadline. Reactivation cancels it.
export async function scheduleUserDeletion(pool: Pool, actorId: string, hash: string, targetId: string) {
  await adminTransaction(pool, actorId, hash, targetId, async (client, target) => {
    await protectLastAdmin(client, target as { role: string; status: string }, { role: "user", status: "suspended" });
    const result = await client.query(`update users set status='suspended', deletion_scheduled_at=clock_timestamp()+interval '30 days'
      where id=$1 and deletion_scheduled_at is null returning deletion_scheduled_at`, [targetId]);
    await client.query("delete from sessions where user_id=$1", [targetId]);
    if (result.rows.length) await audit(client, actorId, targetId, "user.deletion_scheduled", "", { deletionScheduledAt: result.rows[0].deletion_scheduled_at.toISOString() });
  });
}
