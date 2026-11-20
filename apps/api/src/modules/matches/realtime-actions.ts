import type { Pool } from "pg";
import type { RealtimeRequest } from "@croebet/shared";
import { commandMatch, createMatch, declineInvitation, inviteLobbyPlayer, kickMatch, lobbyAction, refreshPresence } from "./service.ts";

/** Every transport uses the same transactional domain operations. */
export function applyRealtimeRequest(pool: Pool, actor: string, session: string, request: RealtimeRequest) {
  switch (request.type) {
    case "create": return createMatch(pool, actor, session, request.input);
    case "join": case "leave": case "start": case "update": return lobbyAction(pool, actor, session, request.code, request.type, request.input);
    case "kick": return kickMatch(pool, actor, session, request.code, request.input);
    case "command": return commandMatch(pool, actor, session, request.code, request.input);
    case "abandon": return commandMatch(pool, actor, session, request.code, request.input, true);
    case "invite": return inviteLobbyPlayer(pool, actor, session, request.code, request.input.targetUserId);
    case "decline": return declineInvitation(pool, actor, session, request.code);
    case "presence": return refreshPresence(pool, actor, session);
  }
}
