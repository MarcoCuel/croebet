/** Mechanics only: drawing consequences belong to the game engine. */
export function shuffleItems<T>(items: readonly T[], randomIndex: (upperBound: number) => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    if (!Number.isInteger(j) || j < 0 || j > i) throw new Error("Invalid random index");
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
