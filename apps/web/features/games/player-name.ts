export function playerName(person?: { displayName?: string | null; username: string }) {
  return person?.displayName?.trim() || person?.username || "";
}

