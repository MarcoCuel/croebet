import type { Flip7View, MatchParticipant } from "@croebet/shared";
import {playerName} from "../player-name.ts";
export {playerName};
export function gameWithPlayerNames(game: Flip7View, participants: MatchParticipant[]): Flip7View {
  return {
    ...game,
    players: game.players.map((player, seat) => {
      const person = participants.find(person => person.seat === seat);
      return person && player.kind === "human" ? { ...player, name: playerName(person) } : player;
    }),
  };
}
