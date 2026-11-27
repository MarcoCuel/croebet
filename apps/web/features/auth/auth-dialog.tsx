"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Field } from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
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
  onSignIn: (username: string, password: string) => Promise<void>;
  onCloseAutoFocus: (event: Event) => void;
}) {
  const [pending, setPending] = useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <DialogTitle>
          {isRegistering ? "Criar conta" : "Entrar na Croebet"}
        </DialogTitle>
        <form
          className="mt-5 grid gap-4"
          key={String(isRegistering)}
          onSubmit={async (event) => {
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
            if (pending) return;
            const form = event.currentTarget;
            const data = new FormData(form);
            const password = String(data.get("password") ?? "");
            if (isRegistering) {
              const confirmation = form.elements.namedItem(
                "confirmPassword",
              ) as HTMLInputElement;
              if (String(data.get("confirmPassword") ?? "") !== password) {
                confirmation.setCustomValidity("As senhas não coincidem.");
                confirmation.reportValidity();
                return;
              }
              confirmation.setCustomValidity("");
            }
            setPending(true);
            try { await onSignIn(name, password); }
            catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível entrar."); }
            finally { setPending(false); }
          }}
        >
          <Field>
            Nome de usuário
            <Input
              name="username"
              autoComplete="username"
              minLength={3}
              maxLength={24}
              disabled={pending}
              required
              onInput={(event) => event.currentTarget.setCustomValidity("")}
            />
          </Field>
          <div className="grid gap-1.5">
            <Field htmlFor="auth-password">Senha</Field>
            <PasswordInput
              id="auth-password"
              name="password"
              autoComplete={isRegistering ? "new-password" : "current-password"}
              minLength={isRegistering ? 8 : 1}
              maxLength={128}
              disabled={pending}
              required
              onInput={(event) => {
                // Ajustar a senha invalida a comparação anterior com a confirmação.
                const confirmation = event.currentTarget.form?.elements.namedItem(
                  "confirmPassword",
                ) as HTMLInputElement | null;
                confirmation?.setCustomValidity("");
              }}
            />
          </div>
          {isRegistering && (
            <div className="grid gap-1.5">
              <Field htmlFor="auth-password-confirmation">Confirmar senha</Field>
              <PasswordInput
                id="auth-password-confirmation"
                name="confirmPassword"
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                disabled={pending}
                required
                onInput={(event) => event.currentTarget.setCustomValidity("")}
              />
            </div>
          )}
          <Button className="mt-1" type="submit" loading={pending}>
            {isRegistering ? "Criar conta" : "Entrar"}
          </Button>
        </form>
        <Button
          disabled={pending}
          variant="secondary"
          className="mt-3 w-full"
          onClick={() => setIsRegistering(!isRegistering)}
        >
          {isRegistering ? "Entrar" : "Cadastre-se"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
