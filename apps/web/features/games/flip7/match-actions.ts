import { decodeMatch, readMatch, removeMatch, saveMatch, type SavedMatch } from "./match-storage.ts";

export async function withMatchLock<T>(operation: () => T): Promise<T> {
  if (!navigator.locks) throw new Error("Este navegador não oferece o bloqueio necessário para atualizar os dados com segurança.");
  return navigator.locks.request("croebet:flip7:matches", operation);
}

export async function startLocalMatch(match: SavedMatch) {
  return withMatchLock(() => {
    if (match.wager) throw new Error("Partidas com Croins ainda não estão disponíveis.");
    if (readMatch(window.localStorage, match.code)) throw new Error("Já existe uma partida com este código.");
    if (!decodeMatch(JSON.stringify(match), match.code)) throw new Error("Configuração da partida inválida.");
    saveMatch(match);
    return match;
  });
}

export async function leaveLocalMatch(code: string) {
  return withMatchLock(() => {
    const match = readMatch(window.localStorage, code);
    if (!match || match.wager) throw new Error("A partida mudou. Atualize a página.");
    removeMatch(code);
  });
}
