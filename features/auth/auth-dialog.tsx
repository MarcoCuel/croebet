"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

export function AuthDialog({
  open,
  onOpenChange,
  isRegistering,
  setIsRegistering,
  onSignIn,
  onCloseAutoFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isRegistering: boolean;
  setIsRegistering: (registering: boolean) => void;
  onSignIn: (username: string) => void;
  onCloseAutoFocus: (event: Event) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-5 sm:p-8" onCloseAutoFocus={onCloseAutoFocus}>
        <DialogTitle className="text-auth-title font-bold tracking-tight">
          {isRegistering ? "Criar conta" : "Entrar na Croebet"}
        </DialogTitle>
        <DialogDescription>
          Sessão de demonstração. Use uma senha de teste.
        </DialogDescription>
        <form
          className="mt-5 grid gap-3.5"
          key={String(isRegistering)}
          onSubmit={(event) => {
            event.preventDefault();
            const field = event.currentTarget.elements.namedItem(
              "username",
            ) as HTMLInputElement;
            const name = field.value.trim();
            if (!name) {
              field.setCustomValidity("Digite um nome de usuário.");
              field.reportValidity();
              return;
            }
            onSignIn(name);
          }}
        >
          <Field>
            Nome de usuário
            <Input
              name="username"
              autoComplete="username"
              required
              onInput={(event) => event.currentTarget.setCustomValidity("")}
            />
          </Field>
          <Field>
            Senha
            <Input type="password" autoComplete="off" required />
          </Field>
          <Button className="mt-1" type="submit">
            {isRegistering ? "Criar conta" : "Entrar"}
          </Button>
        </form>
        <p className="mt-4 text-sm text-muted">
          {isRegistering ? "Já tem conta?" : "Ainda não tem conta?"}{" "}
          <Button
            variant="link"
            size="sm"
            className="min-h-0 p-0 font-normal text-sm underline"
            onClick={() => setIsRegistering(!isRegistering)}
          >
            {isRegistering ? "Entrar" : "Cadastre-se"}
          </Button>
        </p>
      </DialogContent>
    </Dialog>
  );
}
