import type { LoveView } from "@croebet/shared";

/** Public playback must not conceal the viewer's own confirmed hand. */
export function lovePlaybackView(frame: LoveView, confirmed: LoveView, viewer?: number): LoveView {
  const player = viewer === undefined ? undefined : confirmed.players[viewer];
  const hand = player?.hand;
  if (viewer === undefined || frame.round !== confirmed.round || !hand) return frame;
  return {
    ...frame,
    players: frame.players.map((publicPlayer, seat) => seat === viewer
      ? { ...publicPlayer, hand: hand.slice(0, publicPlayer.handCount) }
      : publicPlayer),
  };
}
