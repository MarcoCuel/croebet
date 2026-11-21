import type { Pool } from "pg";
import { matchLifecycleLock } from "./service.ts";

/** Persist deadlines so restarts and multiple API instances share the same policy. */
export async function maintainLobbies(pool: Pool) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(matchLifecycleLock);
    const rooms = await client.query<{ id: string; owner_id: string; development: boolean; expired: boolean; offline_expired: boolean }>(`
      select id,owner_id,development,
        lobby_expires_at<=clock_timestamp() as expired,
        lobby_offline_since<=clock_timestamp()-case when development then interval '30 minutes' else interval '5 minutes' end as offline_expired
      from game_matches where status='lobby' order by id for update`);
    for (const room of rooms.rows) {
      const people = await client.query<{ user_id: string; online: boolean; expired: boolean }>(`
        select p.user_id,
          exists(select 1 from match_presence s where s.match_id=p.match_id and s.user_id=p.user_id and s.expires_at>clock_timestamp()) as online,
          p.lobby_offline_since<=clock_timestamp()-interval '2 minutes' as expired
        from game_match_players p where p.match_id=$1 and p.user_id is not null order by p.joined_at,p.seat`, [room.id]);
      // An observer host also keeps a development lobby with only bots alive.
      const hostOnline = room.development && (await client.query("select 1 from match_presence where match_id=$1 and user_id=$2 and expires_at>clock_timestamp() limit 1", [room.id, room.owner_id])).rows.length > 0;
      const online = hostOnline || people.rows.some(person => person.online);
      const reason = !room.development && room.expired ? "expired" : !online && room.offline_expired ? "offline" : null;
      if (reason) {
        await client.query("update game_matches set status='abandoned',lobby_closed_reason=$2,version=version+1,updated_at=clock_timestamp() where id=$1", [room.id, reason]);
        await client.query("delete from game_match_invitations where match_id=$1", [room.id]);
        await client.query("delete from match_presence where match_id=$1", [room.id]);
        continue;
      }
      await client.query(`update game_matches set lobby_offline_since=case when $2 then null else clock_timestamp() end
        where id=$1 and (lobby_offline_since is null)<>$2`, [room.id, online]);
      for (const person of people.rows) {
        // Keep the whole group during the five-minute all-offline grace period.
        if (!room.development && online && !person.online && person.expired) {
          await client.query("delete from game_match_players where match_id=$1 and user_id=$2", [room.id, person.user_id]);
        } else {
          await client.query(`update game_match_players set lobby_offline_since=case when $3 then null else clock_timestamp() end
            where match_id=$1 and user_id=$2 and (lobby_offline_since is null)<>$3`, [room.id, person.user_id, person.online]);
        }
      }
      if (!room.development && online && !people.rows.some(person => person.user_id === room.owner_id && (person.online || !person.expired))) {
        const nextHost = people.rows.find(person => person.online)!;
        await client.query("update game_matches set owner_id=$2,version=version+1,updated_at=clock_timestamp() where id=$1", [room.id, nextHost.user_id]);
      } else if (!room.development && online && people.rows.some(person => !person.online && person.expired)) {
        await client.query("update game_matches set version=version+1,updated_at=clock_timestamp() where id=$1", [room.id]);
      }
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally { client.release(); }
}
