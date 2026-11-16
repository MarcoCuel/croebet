"use client";

import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import { useState, type RefObject } from "react";

const labelClass = "grid gap-1.5 text-sm font-semibold";
const inputClass = "min-h-12 w-full rounded-xl border-(length:--border-width-hairline) border-field-border bg-background px-3 py-2 text-base font-normal text-foreground";

export function AuthDialog({
  dialogRef,
  onSignIn,
}: {
  dialogRef: RefObject<HTMLDialogElement | null>;
  onSignIn: (username: string) => void;
}) {
  const [isRegistering, setIsRegistering] = useState(false);

  return (
    <dialog
      ref={dialogRef}
      className="m-auto max-h-[calc(100%-1.5rem)] w-[min(26.25rem,calc(100%-1.5rem))] rounded-panel bg-surface text-foreground backdrop:bg-black/70"
      aria-labelledby="auth-title"
      data-lenis-prevent
      onClose={() => {
        dialogRef.current?.querySelector("form")?.reset();
        setIsRegistering(false);
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
    >
      <div className="relative p-[clamp(1.25rem,5vw,2rem)]">
        <button className="absolute top-3 right-3 grid size-9 cursor-pointer place-items-center rounded-xl bg-control hover:bg-control-hover" type="button" aria-label="Fechar" onClick={() => dialogRef.current?.close()}>
          <XIcon className="size-5" aria-hidden="true" />
        </button>
        <h2 className="pr-9 text-[1.75rem] font-bold tracking-[-.035em]" id="auth-title">
          {isRegistering ? "Criar conta" : "Entrar na Croebet"}
        </h2>
        <form
          className="mt-5 grid gap-3.5"
          key={String(isRegistering)}
          onSubmit={(event) => {
            event.preventDefault();
            const field = event.currentTarget.elements.namedItem("username") as HTMLInputElement;
            const name = field.value.trim();

            if (!name) {
              field.setCustomValidity("Digite um nome de usuário.");
              field.reportValidity();
              return;
            }

            onSignIn(name);
          }}
        >
          <label className={labelClass}>
            Nome de usuário
            <input className={inputClass} name="username" autoComplete="username" required autoFocus onInput={(event) => event.currentTarget.setCustomValidity("")} />
          </label>
          <label className={labelClass}>
            Senha
            <input className={inputClass} type="password" autoComplete="off" required />
          </label>
          <button className="button mt-1 min-h-12 cursor-pointer rounded-2xl px-6 py-2" type="submit">{isRegistering ? "Criar conta" : "Entrar"}</button>
        </form>
        <p className="mt-4 text-sm text-muted">
          {isRegistering ? "Já tem conta?" : "Ainda não tem conta?"}{" "}
          <button className="cursor-pointer text-accent underline" type="button" onClick={() => setIsRegistering(!isRegistering)}>
            {isRegistering ? "Entrar" : "Cadastre-se"}
          </button>
        </p>
      </div>
    </dialog>
  );
}
