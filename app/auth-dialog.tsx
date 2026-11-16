"use client";

import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import { useState, type RefObject } from "react";

const labelClass = "grid gap-1.5 text-sm font-semibold";
const inputClass = "min-h-[46px] w-full rounded-[10px] border border-field-border bg-background px-3 py-2 text-base font-normal text-foreground";

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
      className="m-auto max-h-[calc(100%-24px)] w-[min(420px,calc(100%-24px))] rounded-panel border border-dialog-border bg-surface text-foreground backdrop:bg-black/70"
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
      <div className="relative p-[clamp(20px,5vw,32px)]">
        <button className="absolute top-3 right-3 grid size-9 cursor-pointer place-items-center rounded-[10px] bg-control hover:bg-control-hover" type="button" aria-label="Fechar" onClick={() => dialogRef.current?.close()}>
          <XIcon className="size-5" aria-hidden="true" />
        </button>
        <h2 className="pr-9 text-[27px] font-bold tracking-[-.035em]" id="auth-title">
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
          <button className="button mt-1 min-h-[46px] cursor-pointer rounded-[14px] px-[22px] py-2" type="submit">{isRegistering ? "Criar conta" : "Entrar"}</button>
        </form>
        <p className="mt-[18px] text-sm text-muted">
          {isRegistering ? "Já tem conta?" : "Ainda não tem conta?"}{" "}
          <button className="cursor-pointer text-accent underline" type="button" onClick={() => setIsRegistering(!isRegistering)}>
            {isRegistering ? "Entrar" : "Cadastre-se"}
          </button>
        </p>
      </div>
    </dialog>
  );
}
