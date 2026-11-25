import type { TableArtwork } from "@/three/table/artwork";

export const loveArtwork: Record<"classic" | "modern", TableArtwork> = {
  modern: { back: { src: "/games/love-letter/card.webp" }, faces: Object.fromEntries(Array.from({ length: 10 }, (_, value) => [value, { src: `/games/love-letter/${value}.webp` }])) },
  classic: { back: { src: "/games/love-letter/card.webp" }, faces: Object.fromEntries(Array.from({ length: 8 }, (_, i) => {
    const value = i + 1;
    return [value, { src: `/games/love-letter/${value >= 6 ? value + 1 : value}.webp`, ...(value >= 6 ? { valueOverride: value } : {}) }];
  })) },
};
