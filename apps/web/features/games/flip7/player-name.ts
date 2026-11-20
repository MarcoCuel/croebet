import type { Flip7View, MatchParticipant } from "@croebet/shared";

export function playerName(person?: { displayName?: string | null; username: string }) {
  return person?.displayName?.trim() || person?.username || "";
}

export function gameWithPlayerNames(game: Flip7View, participants: MatchParticipant[]): Flip7View {
  return {
    ...game,
    players: game.players.map((player, seat) => {
      const person = participants.find(person => person.seat === seat);
      return person && player.kind === "human" ? { ...player, name: playerName(person) } : player;
    }),
  };
}
