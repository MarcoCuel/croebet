/** Assets are presentation only; card values always come from the confirmed game state. */
export type CardArtwork = { src?: string; valueOverride?: number; text?: string; caption?: string; color?: string; backgroundColor?: string; textColor?: string; layout?: "numeric" | "symbol"; finish?: "orbit" };
export type TableArtwork = { faces: Partial<Record<string, CardArtwork>>; back: CardArtwork };

export const numberNames = ["Zero", "Um", "Dois", "Três", "Quatro", "Cinco", "Seis", "Sete", "Oito", "Nove", "Dez", "Onze", "Doze", "Treze"];
