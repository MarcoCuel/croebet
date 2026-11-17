"use client";

import { CaretDownIcon } from "@phosphor-icons/react/dist/csr/CaretDown";
import { PlusIcon } from "@phosphor-icons/react/dist/csr/Plus";
import { SignOutIcon } from "@phosphor-icons/react/dist/csr/SignOut";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AuthDialog } from "./auth-dialog";

const usernameStorageKey = "croebet:demo-username";

const formatBalance = new Intl.NumberFormat("pt-BR");
const initialBalance = 1067;
type Prediction = { market: string; outcome: string; stake: number; odds: number };
const initialWallet = { balance: initialBalance, predictions: [] as Prediction[] };
const DemoSession = createContext<{
  username: string | null;
  balance: number;
  predictions: Prediction[];
  openLogin: () => void;
  placePrediction: (prediction: Prediction) => void;
} | null>(null);

export function useDemoSession() {
  const session = useContext(DemoSession);
  if (!session) throw new Error("Demo session provider is missing");
  return session;
}

const accountAction = "flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-control-hover";

const navControl = "min-h-10 items-center rounded-xl";
const navLink = `${navControl} flex px-4 text-muted hover:bg-control-hover hover:text-foreground aria-[current]:bg-control-hover aria-[current]:text-foreground max-[26.25rem]:px-2`;

export function Navigation({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const balanceDialogRef = useRef<HTMLDialogElement>(null);
  const accountTriggerRef = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [wallet, setWallet] = useState(initialWallet);

  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    try {
      setUsername(window.localStorage.getItem(usernameStorageKey));
    } catch {
      // The demo can still run in memory when storage is unavailable.
    }
  }, []);

  function updateSession(name: string | null) {
    try {
      if (name === null) {
        window.localStorage.removeItem(usernameStorageKey);
      } else {
        window.localStorage.setItem(usernameStorageKey, name);
      }
    } catch {
      // Keep the session usable until the page is reloaded.
    }

    dialogRef.current?.close();
    setUsername(name);
    setMenuOpen(false);
    setWallet(initialWallet);
  }

  function openLogin() {
    dialogRef.current?.showModal();
  }

  function placePrediction(prediction: Prediction) {
    if (!username || !Number.isSafeInteger(prediction.stake) || prediction.stake < 1) return;

    setWallet((current) => {
      if (prediction.stake > current.balance) return current;
      return {
        balance: current.balance - prediction.stake,
        predictions: [prediction, ...current.predictions],
      };
    });
  }

  return (
    <DemoSession.Provider value={{ username, ...wallet, openLogin, placePrediction }}>
      <header className="fixed top-4 left-1/2 z-10 flex min-h-(--header-height) w-max -translate-x-1/2 items-center gap-x-4 gap-y-1 rounded-2xl bg-control py-2 pr-2 pl-4 max-[38rem]:w-[calc(100%-2rem)] max-[38rem]:flex-wrap max-[38rem]:justify-between max-[38rem]:px-2.5">
        <Link className="text-[1.5rem] leading-[.86] font-semibold tracking-[-.07em] text-brand max-[26.25rem]:text-[1.25rem]" href="/" aria-label="Croebet, início">
          <span className="brand-wordmark">Croebet</span>
        </Link>
        <nav className="flex gap-1 max-[38rem]:order-last max-[38rem]:w-full max-[38rem]:justify-center" aria-label="Navegação principal">
          <Link className={navLink} href="/jogos" aria-current={pathname === "/jogos" ? "page" : pathname.startsWith("/jogos/") ? "location" : undefined}>
            Jogos
          </Link>
          <Link className={navLink} href="/apostas" aria-current={pathname === "/apostas" ? "page" : undefined}>Apostas</Link>
          <Link className={navLink} href="/sobre" aria-current={pathname === "/sobre" ? "page" : undefined}>Sobre</Link>
        </nav>
        {username ? (
          <div className="flex items-center gap-2 max-[26.25rem]:gap-1.5">
            <div className={`${navControl} flex gap-1.5 px-2 font-semibold tabular-nums max-[26.25rem]:text-sm`} aria-live="polite">
              <span className="grid size-6 shrink-0 place-items-center rounded-full border-[0.125rem] border-accent/60 bg-brand bg-primary-button text-sm font-black text-white inset-shadow-primary-button" aria-hidden="true">C</span>
              <span className="sr-only">Saldo fictício: </span>{formatBalance.format(wallet.balance)}<span className="sr-only"> {wallet.balance === 1 ? "Croin" : "Croins"}</span>
            </div>
            <div
              className="relative"
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setMenuOpen(false);
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape" && menuOpen) {
                  setMenuOpen(false);
                  accountTriggerRef.current?.focus();
                }
              }}
            >
              <button
                ref={accountTriggerRef}
                className={`${navControl} flex cursor-pointer gap-2 bg-control-hover px-3 font-semibold max-[26.25rem]:gap-1 max-[26.25rem]:px-2 max-[26.25rem]:text-sm`}
                type="button"
                aria-expanded={menuOpen}
                aria-controls="account-actions"
                onClick={() => setMenuOpen(!menuOpen)}
              >
                <span className="max-w-24 truncate max-[26.25rem]:max-w-10">{username}</span>
                <CaretDownIcon className={menuOpen ? "size-4 shrink-0 rotate-180 text-muted" : "size-4 shrink-0 text-muted"} aria-hidden="true" />
              </button>
              <div id="account-actions" hidden={!menuOpen} className="absolute top-full right-0 z-10 mt-2 w-max rounded-xl bg-surface p-1.5 shadow-lg">
                <button className={accountAction} type="button" aria-haspopup="dialog" onClick={() => {
                  accountTriggerRef.current?.focus();
                  setMenuOpen(false);
                  balanceDialogRef.current?.showModal();
                }}>
                  <PlusIcon className="size-4" aria-hidden="true" /> Adicionar Croins
                </button>
                <button className={accountAction} type="button" onClick={() => updateSession(null)}>
                  <SignOutIcon className="size-4" aria-hidden="true" /> Sair da conta
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button className={`${navControl} button cursor-pointer px-[clamp(0.5rem,3vw,1.25rem)]`} type="button" aria-haspopup="dialog" onClick={openLogin}>
            Entrar
          </button>
        )}
      </header>
      <AuthDialog dialogRef={dialogRef} onSignIn={updateSession} />
      <dialog
        ref={balanceDialogRef}
        className="m-auto w-[min(22.5rem,calc(100%-1.5rem))] rounded-panel bg-surface p-6 text-foreground backdrop:bg-black/70"
        aria-labelledby="balance-title"
        data-lenis-prevent
        onClose={(event) => event.currentTarget.querySelector("form")?.reset()}
      >
        <h2 id="balance-title" className="text-xl font-bold">Adicionar Croins</h2>
        <form className="mt-4 grid gap-4" onSubmit={(event) => {
          event.preventDefault();
          const amount = Number(new FormData(event.currentTarget).get("amount"));
          setWallet((current) => ({ ...current, balance: current.balance + amount }));
          balanceDialogRef.current?.close();
        }}>
          <label className="grid gap-1.5 text-sm font-semibold">
            Quantidade de Croins
            <input className="min-h-12 rounded-xl border-(length:--border-width-hairline) border-field-border bg-background px-3 text-base" type="number" name="amount" min="1" max="999999" step="1" required autoFocus />
          </label>
          <div className="flex justify-end gap-2">
            <button className="cursor-pointer rounded-xl px-3 py-2 hover:bg-control-hover" type="button" onClick={() => balanceDialogRef.current?.close()}>Cancelar</button>
            <button className="button cursor-pointer rounded-xl px-4 py-2" type="submit">Adicionar</button>
          </div>
        </form>
      </dialog>
      {children}
    </DemoSession.Provider>
  );
}
