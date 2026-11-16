"use client";

import { CaretDownIcon } from "@phosphor-icons/react/dist/csr/CaretDown";
import { PlusIcon } from "@phosphor-icons/react/dist/csr/Plus";
import { SignOutIcon } from "@phosphor-icons/react/dist/csr/SignOut";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AuthDialog } from "./auth-dialog";

const usernameStorageKey = "croebet:demo-username";

const formatBalance = new Intl.NumberFormat("pt-BR");
const initialBalance = 1067;
const accountAction = "flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-control-hover";

const navLink = "rounded-xl px-4 py-[9px] text-muted hover:bg-control-hover hover:text-foreground aria-[current]:bg-control-hover aria-[current]:text-foreground max-[420px]:px-[9px]";

export function Navigation() {
  const pathname = usePathname();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const balanceDialogRef = useRef<HTMLDialogElement>(null);
  const accountTriggerRef = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [balance, setBalance] = useState(initialBalance);

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
    setBalance(initialBalance);
  }

  return (
    <>
      <header className="fixed top-(--header-top) left-1/2 z-10 flex min-h-(--header-height) w-max -translate-x-1/2 items-center gap-[clamp(8px,2.5vw,28px)] rounded-[18px] bg-control py-2 pr-[9px] pl-4 max-[420px]:pr-2 max-[420px]:pl-2.5">
        <Link className="text-[23px] leading-[.86] font-semibold tracking-[-.07em] text-brand max-[420px]:text-[21px]" href="/" aria-label="Croebet, início">
          <span>Croebet</span>
        </Link>
        <nav className="flex gap-1" aria-label="Navegação principal">
          <Link className={username ? navLink + " max-[420px]:hidden" : navLink} href="/" aria-current={pathname === "/" ? "page" : undefined}>Início</Link>
          <Link className={navLink} href="/jogos" aria-current={pathname === "/jogos" ? "page" : pathname.startsWith("/jogos/") ? "location" : undefined}>
            Jogos
          </Link>
        </nav>
        {username ? (
          <div className="flex items-center gap-2 max-[420px]:gap-1.5">
            <div className="flex min-h-[42px] items-center gap-1.5 rounded-xl bg-brand/20 px-2 font-semibold tabular-nums max-[420px]:text-sm" aria-live="polite">
              <span className="grid size-7 shrink-0 place-items-center rounded-full border-2 border-accent/60 bg-brand text-sm font-black text-white" aria-hidden="true">C</span>
              <span className="sr-only">Saldo fictício: </span>{formatBalance.format(balance)}<span className="sr-only"> {balance === 1 ? "Croin" : "Croins"}</span>
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
                className="flex min-h-[42px] cursor-pointer items-center gap-2 rounded-xl bg-control-hover px-3 font-semibold max-[420px]:gap-1 max-[420px]:px-2 max-[420px]:text-sm"
                type="button"
                aria-expanded={menuOpen}
                aria-controls="account-actions"
                onClick={() => setMenuOpen(!menuOpen)}
              >
                <span className="max-w-24 truncate max-[420px]:max-w-12">{username}</span>
                <CaretDownIcon className={menuOpen ? "size-4 shrink-0 rotate-180 text-muted" : "size-4 shrink-0 text-muted"} aria-hidden="true" />
              </button>
              <div id="account-actions" hidden={!menuOpen} className="absolute top-full right-0 mt-2 w-max rounded-xl border border-dialog-border bg-surface p-1.5 shadow-lg">
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
          <button className="button min-h-[42px] cursor-pointer rounded-xl px-[clamp(10px,3vw,20px)] py-2" type="button" aria-haspopup="dialog" onClick={() => dialogRef.current?.showModal()}>
            Entrar
          </button>
        )}
      </header>
      <AuthDialog dialogRef={dialogRef} onSignIn={updateSession} />
      <dialog
        ref={balanceDialogRef}
        className="m-auto w-[min(360px,calc(100%-24px))] rounded-panel border border-dialog-border bg-surface p-6 text-foreground backdrop:bg-black/70"
        aria-labelledby="balance-title"
        data-lenis-prevent
        onClose={(event) => event.currentTarget.querySelector("form")?.reset()}
      >
        <h2 id="balance-title" className="text-xl font-bold">Adicionar Croins</h2>
        <form className="mt-4 grid gap-4" onSubmit={(event) => {
          event.preventDefault();
          const amount = Number(new FormData(event.currentTarget).get("amount"));
          setBalance((currentBalance) => currentBalance + amount);
          balanceDialogRef.current?.close();
        }}>
          <label className="grid gap-1.5 text-sm font-semibold">
            Quantidade de Croins
            <input className="min-h-[46px] rounded-xl border border-field-border bg-background px-3 text-base" type="number" name="amount" min="1" max="999999" step="1" required autoFocus />
          </label>
          <div className="flex justify-end gap-2">
            <button className="cursor-pointer rounded-xl px-3 py-2 hover:bg-control-hover" type="button" onClick={() => balanceDialogRef.current?.close()}>Cancelar</button>
            <button className="button cursor-pointer rounded-xl px-4 py-2" type="submit">Adicionar</button>
          </div>
        </form>
      </dialog>
    </>
  );
}
