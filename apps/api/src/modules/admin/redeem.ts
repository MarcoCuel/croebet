import type { Pool } from "pg";
import type { z } from "zod";
import type { redeemCouponSchema } from "@croebet/shared";
import { ManagementError, couponAvailability } from "./service.ts";
import { issuanceAccountId } from "../economy/config.ts";
import { transferCroinsInTransaction } from "../wallet/service.ts";
import { readDailyStatus } from "../economy/service.ts";

export async function redeemCoupon(pool: Pool, userId: string, hash: string, input: z.infer<typeof redeemCouponSchema>) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const user = await client.query(`select u.id from users u join sessions s on s.user_id=u.id where u.id=$1 and s.token_hash=$2
      and u.status='active' and s.expires_at > clock_timestamp() and s.idle_expires_at > clock_timestamp() for update of u,s`, [userId, hash]);
    if (!user.rows.length) throw new ManagementError(401, "UNAUTHENTICATED", "Entre novamente.");
    const account = (await client.query("select id from wallet_accounts where user_id=$1", [userId])).rows[0];
    if (!account) throw new ManagementError(409, "ACCOUNT_UNAVAILABLE", "Carteira indisponível.");
    const replay = (await client.query("select code_snapshot from coupon_redemptions where account_id=$1 and request_id=$2", [account.id, input.requestId])).rows[0];
    if (replay) {
      if (replay.code_snapshot !== input.code) throw new ManagementError(409, "IDEMPOTENCY_CONFLICT", "Este pedido já foi usado para outro cupom.");
      const status = await readDailyStatus(client, userId); await client.query("commit"); return status;
    }
    const coupon = (await client.query("select * from coupons where code=$1 for update", [input.code])).rows[0];
    if (!coupon) throw new ManagementError(404, "COUPON_NOT_FOUND", "Cupom não encontrado.");
    const previous = await client.query("select 1 from coupon_redemptions where coupon_id=$1 and account_id=$2", [coupon.id, account.id]);
    if (previous.rows.length) throw new ManagementError(409, "ALREADY_REDEEMED", "Você já resgatou este cupom.");
    // Obtain ledger locks before checking dates: waiting for another credit cannot bypass expiry.
    await client.query("select id from wallet_accounts where id=any($1::uuid[]) order by id for update", [[issuanceAccountId, account.id]]);
    const count = await client.query("select count(*)::int as total,clock_timestamp() as now from coupon_redemptions where coupon_id=$1", [coupon.id]);
    const availability = couponAvailability({ startsAt: coupon.starts_at?.toISOString() ?? null, endsAt: coupon.ends_at?.toISOString() ?? null,
      paused: coupon.paused, limit: coupon.redemption_limit === null ? null : Number(coupon.redemption_limit), redeemed: count.rows[0].total }, count.rows[0].now);
    if (availability !== "Ativo") throw new ManagementError(409, "COUPON_UNAVAILABLE", `Cupom ${availability.toLowerCase()}.`);
    const receipt = await transferCroinsInTransaction(client, { scope: `coupon:${coupon.id}`, idempotencyKey: account.id,
      from: issuanceAccountId, to: account.id, actorAccountId: account.id, amount: Number(coupon.amount), reason: "Cupom resgatado", reference: input.code });
    await client.query("insert into coupon_redemptions (coupon_id,code_snapshot,account_id,request_id,amount,operation_id) values ($1,$2,$3,$4,$5,$6)",
      [coupon.id, input.code, account.id, input.requestId, coupon.amount, receipt.operationId]);
    const status = await readDailyStatus(client, userId);
    await client.query("commit"); return status;
  } catch (error) { await client.query("rollback"); throw error; }
  finally { client.release(); }
}
