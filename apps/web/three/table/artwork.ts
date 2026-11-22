/** Assets are presentation only; card values always come from the confirmed game state. */
export type CardArtwork = { src?: string; valueOverride?: number; text?: string; caption?: string; color?: string };
export type TableArtwork = { faces: Partial<Record<string, CardArtwork>>; back: CardArtwork };
