import type { Flip7View } from "@croebet/shared";
import type { GameResultSummary } from "../game-result";

export function flip7Result(state: Flip7View): GameResultSummary {
  const best = Math.max(...state.players.map(player => player.total));
  return { round: state.round, scoreLabel: "pts", players: state.players.map((player, seat) => ({ seat, name: player.name, score: player.total, winner: player.total === best })) };
}
