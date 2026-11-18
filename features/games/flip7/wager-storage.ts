import { readUsername, readWalletStrict, writeWalletStrict } from "@/features/auth/session-storage";
import type { Wallet } from "@/features/wallet/wallet";
import { announceDemoData, withDemoLock } from "@/lib/demo-storage";
import { decodeMatch, matchStorageKey, readMatch, saveMatch, type SavedMatch } from "./match-storage.ts";
import type { Game } from "./types";
import { wagerPayouts } from "./wager.ts";

function owner(match: SavedMatch) {
  const username = match.wager?.username;
  if (!username || readUsername()?.toLowerCase() !== username.toLowerCase())
    throw new Error("Entre na conta que iniciou esta partida para continuar.");
  return username;
}

function paidMatch(code: string) {
  const match = readMatch();
  if (!match || match.code !== code || !match.wager)
    throw new Error("A partida mudou em outra aba. Atualize a página.");
  owner(match);
  return match;
}

function transaction(wallet: Wallet, id: string, amount: number, description: string): Wallet {
  const balance = wallet.balance + amount;
  if (!Number.isSafeInteger(balance) || balance < 0)
    throw new Error("Saldo insuficiente ou limite de Croins excedido.");
  return { ...wallet, balance, transactions: [
    { id, createdAt: new Date().toISOString(), description, amount, balance },
    ...wallet.transactions,
  ] };
}

function entryId(match: SavedMatch) { return `flip7:${match.code}:entry`; }

function requireEntry(match: SavedMatch, wallet: Wallet) {
  if (!wallet.transactions.some(tx => tx.id === entryId(match) && tx.amount === -match.wager!.stake))
    throw new Error("A entrada desta partida ainda não foi paga.");
}

function checkEntryBalance(match: SavedMatch, wallet: Wallet) {
  const stake = match.wager!.stake;
  if (wallet.balance < stake) throw new Error("Saldo insuficiente para pagar a entrada.");
  if (!Number.isSafeInteger(wallet.balance - stake + stake * match.game.players.length))
    throw new Error("O prêmio ultrapassaria o limite de Croins da carteira.");
}

function payEntry(match: SavedMatch) {
  const username = owner(match);
  const wallet = readWalletStrict(username);
  const receipt = wallet.transactions.find(tx => tx.id === entryId(match));
  if (receipt) { requireEntry(match, wallet); return; }
  // The saved initial snapshot acts as a recoverable intent if the wallet write fails.
  if (match.game.phase !== "playing" || match.game.round !== 1 || match.game.history.length || match.game.players.some(p => p.hasDrawn))
    throw new Error("Não foi possível confirmar a entrada desta partida.");
  const stake = match.wager!.stake;
  checkEntryBalance(match, wallet);
  writeWalletStrict(username, transaction(wallet, entryId(match), -stake, `Flip7 · Entrada · ${match.code}`));
  announceDemoData();
}

function payPrize(match: SavedMatch) {
  const username = owner(match);
  const wallet = readWalletStrict(username);
  requireEntry(match, wallet);
  const payout = wagerPayouts(match.game, match.wager!.stake)[0];
  const id = `flip7:${match.code}:prize`;
  const receipt = wallet.transactions.find(tx => tx.id === id);
  if (receipt && receipt.amount !== payout) throw new Error("O prêmio salvo não corresponde ao resultado.");
  if (payout > 0 && !receipt) {
    writeWalletStrict(username, transaction(wallet, id, payout, `Flip7 · Prêmio · ${match.code}`));
    announceDemoData();
  }
  return payout;
}

/** Save the initial intent before charging, so every debited entry has a resumable match. */
export async function startLocalMatch(match: SavedMatch) {
  return withDemoLock(() => {
    if (readMatch()) throw new Error("Já existe uma partida salva. Atualize a página para retomá-la.");
    if (!decodeMatch(JSON.stringify(match), match.code)) throw new Error("Configuração da partida inválida.");
    if (match.wager) {
      const wallet = readWalletStrict(owner(match));
      checkEntryBalance(match, wallet);
      if (wallet.transactions.some(tx => tx.id === entryId(match)))
        throw new Error("Este código de partida já foi utilizado. Tente novamente.");
    }
    saveMatch(match);
    if (match.wager) payEntry(match);
    return match;
  });
}

export async function prepareWagerMatch(code: string) {
  return withDemoLock(() => {
    const match = paidMatch(code);
    payEntry(match);
    return match.game.phase === "over" ? payPrize(match) : null;
  });
}

/** Save before presenting a move; stale tabs cannot overwrite another turn or result. */
export async function saveWagerProgress(code: string, previous: Game, next: Game) {
  return withDemoLock(() => {
    const match = paidMatch(code);
    requireEntry(match, readWalletStrict(owner(match)));
    if (JSON.stringify(match.game) !== JSON.stringify(previous) || previous.phase === "over")
      throw new Error("A partida mudou em outra aba. Atualize a página.");
    const saved = { ...match, game: next };
    if (!decodeMatch(JSON.stringify(saved), code)) throw new Error("Não foi possível validar a próxima jogada.");
    saveMatch(saved);
  });
}

export async function leaveLocalMatch(code: string) {
  return withDemoLock(() => {
    const match = readMatch();
    if (!match || match.code !== code) throw new Error("A partida mudou. Atualize a página.");
    if (match.wager) {
      owner(match);
      if (match.game.phase === "over") payPrize(match);
    }
    localStorage.removeItem(matchStorageKey);
  });
}
