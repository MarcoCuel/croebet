import type { Pool } from "pg";
import { catalogMarketSchema, catalogMarketsSchema, type CatalogMarket } from "@croebet/shared";
import { adminTransaction, audit, ManagementError } from "../admin/service.ts";

function project(row: Record<string, unknown>) {
  return catalogMarketSchema.parse({ id: row.id, question: row.question, criterion: row.criterion, type: row.type,
    options: row.options, unit: row.unit, status: row.status, endsAt: row.ends_at instanceof Date ? row.ends_at.toISOString() : row.ends_at, version: row.version });
}
export async function readMarkets(pool: Pool) {
  return catalogMarketsSchema.parse({ items: (await pool.query("select * from markets order by question,id")).rows.map(project) });
}
export async function readMarket(pool: Pool, id: string) {
  const row = (await pool.query("select * from markets where id=$1", [id])).rows[0];
  if (!row) throw new ManagementError(404, "NOT_FOUND", "Aposta não encontrada.");
  return project(row);
}
export async function saveMarket(pool: Pool, actorId: string, hash: string, id: string | null, input: Omit<CatalogMarket, "id">) {
  return adminTransaction(pool, actorId, hash, null, async client => {
    const before = id ? (await client.query("select * from markets where id=$1 for update", [id])).rows[0] : null;
    if (id && !before) throw new ManagementError(404, "NOT_FOUND", "Aposta não encontrada.");
    if ((before?.version ?? 0) !== input.version) throw new ManagementError(409, "VERSION_CONFLICT", "A aposta foi alterada. Recarregue antes de salvar.");
    const values = [input.question, input.criterion, input.type, JSON.stringify(input.options), input.unit, input.status, input.endsAt];
    const result = id
      ? await client.query("update markets set question=$1,criterion=$2,type=$3,options=$4,unit=$5,status=$6,ends_at=$7,version=version+1 where id=$8 returning *", [...values, id])
      : await client.query("insert into markets (question,criterion,type,options,unit,status,ends_at) values ($1,$2,$3,$4,$5,$6,$7) returning *", values);
    const market = project(result.rows[0]);
    await audit(client, actorId, market.id, id ? "market.updated" : "market.created", id ? "Edição de aposta" : "Criação de aposta", { before: before ? project(before) : null, after: market });
    return market;
  });
}
export async function deleteMarket(pool: Pool, actorId: string, hash: string, id: string, version: number) {
  return adminTransaction(pool, actorId, hash, null, async client => {
    const row = (await client.query("select * from markets where id=$1 for update", [id])).rows[0];
    if (!row) throw new ManagementError(404, "NOT_FOUND", "Aposta não encontrada.");
    if (row.version !== version) throw new ManagementError(409, "VERSION_CONFLICT", "A aposta foi alterada. Recarregue antes de excluir.");
    await client.query("delete from markets where id=$1", [id]);
    await audit(client, actorId, id, "market.deleted", "Exclusão de aposta", { before: project(row) });
    return { ok: true };
  });
}
