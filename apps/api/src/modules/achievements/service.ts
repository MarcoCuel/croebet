import type { Pool, PoolClient } from "pg";
import { achievementDefinitionSchema, achievementDefinitionsSchema, achievementsSchema, type AchievementWrite, type AchievementDefinition } from "@croebet/shared";
import { lucideIconNodes } from "@croebet/shared/lucide-icon-nodes";
import { adminTransaction, audit, ManagementError } from "../admin/service.ts";
import { validateMediaReferences } from "../media/service.ts";
import { readAchievementMetrics } from "./metrics.ts";

const selection = `select d.*, coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'target',l.target,'description',l.description,'color',l.color,'imageUrl',l.image_url,
  'locked',exists(select 1 from achievement_unlocks u where u.level_id=l.id)) order by l.target,l.id)
  from achievement_levels l where l.achievement_id=d.id),'[]'::jsonb) as levels from achievement_definitions d`;
const project = (row: Record<string, unknown>) => achievementDefinitionSchema.parse({ ...row, order: row.sort_order, imageUrl: row.image_url });
export async function readAchievementDefinitions(client: Pick<Pool | PoolClient, "query">) {
  const result = await client.query(`${selection} order by d.sort_order,d.id`);
  return achievementDefinitionsSchema.parse({ items: result.rows.map(project) });
}
export async function readAchievementDefinition(client: Pool, id: string) {
  const result = await client.query(`${selection} where d.id=$1`, [id]);
  if (!result.rows[0]) throw new ManagementError(404, "NOT_FOUND", "Conquista não encontrada.");
  return project(result.rows[0]);
}
export function validateAchievementChanges(before: AchievementDefinition, input: AchievementWrite) {
  if (input.metric !== before.metric && before.levels.some(level => level.locked)) throw new ManagementError(409, "AWARDED_METRIC", "Esta conquista já foi liberada. Crie outra para usar um critério diferente.");
  for (const level of before.levels) {
    const next = input.levels.find(item => item.id === level.id);
    if (level.locked && (!next || next.target !== level.target)) throw new ManagementError(409, "AWARDED_LEVEL", "Não é possível remover ou alterar a meta de um nível já conquistado.");
  }
}
export async function saveAchievement(pool: Pool, actorId: string, hash: string, id: string | null, input: AchievementWrite) {
  return adminTransaction(pool, actorId, hash, null, async client => {
    // Catalog writes and reconciliations use the same lock, so an award cannot race a goal edit.
    await client.query("select pg_advisory_xact_lock(47851235)");
    let before: AchievementDefinition | undefined;
    if (id) {
      const row = (await client.query(`${selection} where d.id=$1 for update of d`, [id])).rows[0];
      if (!row) throw new ManagementError(404, "NOT_FOUND", "Conquista não encontrada.");
      before = project(row);
      if (before.version !== input.version) throw new ManagementError(409, "VERSION_CONFLICT", "A conquista foi alterada. Recarregue antes de salvar.");
      validateAchievementChanges(before, input);
    } else if (input.version !== 0) throw new ManagementError(409, "VERSION_CONFLICT", "Recarregue antes de criar a conquista.");
    await validateMediaReferences(client, [input.imageUrl, ...input.levels.map(level=>level.imageUrl)]);
    const row = id ? (await client.query("update achievement_definitions set name=$2,icon=$3,metric=$4,active=$5,sort_order=$6,image_url=$7,color=$8,version=version+1 where id=$1 returning id", [id,input.name,input.icon,input.metric,input.active,input.order,input.imageUrl ?? "",input.color ?? null])).rows[0]
      : (await client.query("insert into achievement_definitions(name,icon,metric,active,sort_order,image_url,color) values($1,$2,$3,$4,$5,$6,$7) returning id", [input.name,input.icon,input.metric,input.active,input.order,input.imageUrl ?? "",input.color ?? null])).rows[0];
    const definitionId: string = row.id;
    // Existing level identities cannot be moved between achievements.
    const existing = await client.query("select id from achievement_levels where id=any($1::uuid[]) and achievement_id<>$2", [input.levels.map(level=>level.id), definitionId]);
    if (existing.rows.length) throw new ManagementError(409, "LEVEL_CONFLICT", "Um dos níveis pertence a outra conquista.");
    // Delete only unawarded omitted/edited levels; stable IDs preserve earned levels and their dates.
    await client.query("delete from achievement_levels where achievement_id=$1 and not (id=any($2::uuid[]))", [definitionId,input.levels.map(level=>level.id)]);
    // Release unique targets for unawarded edits/swaps before reinserting them atomically.
    const editable = input.levels.filter(level => !before?.levels.find(old => old.id===level.id)?.locked);
    if (editable.length) await client.query("delete from achievement_levels where achievement_id=$1 and id=any($2::uuid[])", [definitionId, editable.map(level=>level.id)]);
    await client.query(`insert into achievement_levels(id,achievement_id,target,description,color,image_url)
      select x.id,$1,x.target,x.description,x.color,coalesce(x."imageUrl",'') from jsonb_to_recordset($2::jsonb) as x(id uuid,target bigint,description text,color text,"imageUrl" text)
      on conflict(id) do update set description=excluded.description,color=excluded.color,image_url=excluded.image_url`, [definitionId,JSON.stringify(input.levels)]);
    const after = project((await client.query(`${selection} where d.id=$1`, [definitionId])).rows[0]);
    await audit(client, actorId, definitionId, id ? "achievement.updated" : "achievement.created", "", { before, after });
    return after;
  });
}

export async function readOwnAchievements(pool: Pool, userId: string, hash: string) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    // Account/session precede catalog locks, matching adminTransaction and deletion paths.
    const user = await client.query("select id from users where id=$1 and status='active' for share", [userId]);
    const session = await client.query("select 1 from sessions where user_id=$1 and token_hash=$2 and expires_at>clock_timestamp() and idle_expires_at>clock_timestamp() for share", [userId,hash]);
    if (!user.rows.length || !session.rows.length) throw new ManagementError(401, "UNAUTHENTICATED", "Entre para consultar suas conquistas.");
    // Shared lock allows different accounts to reconcile in parallel, exclusive catalog edits wait.
    await client.query("select pg_advisory_xact_lock_shared(47851235)");
    await client.query("select pg_advisory_xact_lock(hashtextextended($1,47851235))", [userId]);
    const { items } = await readAchievementDefinitions(client);
    const { metrics, stats } = await readAchievementMetrics(client, userId);
    const active = items.filter(item=>item.active);
    const eligible = active.flatMap(item=>item.levels.filter(level=>metrics[item.metric]>=level.target).map(level=>level.id));
    if (eligible.length) await client.query("insert into achievement_unlocks(user_id,level_id) select $1,unnest($2::uuid[]) on conflict(user_id,level_id) do nothing", [userId,eligible]);
    const unlocked = await client.query<{level_id: string; unlocked_at: Date}>("select level_id,unlocked_at from achievement_unlocks where user_id=$1", [userId]);
    const dates = new Map(unlocked.rows.map(row=>[row.level_id,row.unlocked_at.toISOString()]));
    const result = achievementsSchema.parse({ stats, items: active.map(item=>({
      id:item.id, name:item.name, icon:item.icon, imageUrl:item.imageUrl, color:item.color, iconNode:lucideIconNodes[item.icon], metric:item.metric, current:metrics[item.metric],
      levels:item.levels.map(({id,target,description,color,imageUrl})=>({id,target,description,color,imageUrl,unlockedAt:dates.get(id)??null})),
    })) });
    await client.query("commit");
    return result;
  } catch(error) { await client.query("rollback"); throw error; } finally { client.release(); }
}
