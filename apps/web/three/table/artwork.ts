/** Assets are presentation only; card values always come from the confirmed game state. */
export type CardArtwork = { src: string; valueOverride?: number };
export type TableArtwork = { faces: Partial<Record<number, CardArtwork>>; back: CardArtwork };
