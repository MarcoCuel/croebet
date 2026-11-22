import type { TableArtwork } from "@/three/table/artwork";

export const loveArtwork: Record<"classic" | "modern", TableArtwork> = {
  modern: { back: { src: "/games/love-letter/card.png" }, faces: Object.fromEntries(Array.from({ length: 9 }, (_, i) => [i + 1, { src: `/games/love-letter/${i + 1}.png` }])) },
  classic: { back: { src: "/games/love-letter/card.png" }, faces: Object.fromEntries(Array.from({ length: 8 }, (_, i) => {
    const value = i + 1;
    return [value, { src: `/games/love-letter/${value >= 6 ? value + 1 : value}.png`, ...(value >= 6 ? { valueOverride: value } : {}) }];
  })) },
};
