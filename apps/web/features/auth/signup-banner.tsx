"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useDemoSession } from "@/features/auth/session-context";
import { CroinBanner } from "@/three/scenes/croin-banner";

export function SignupBanner() {
  const { openRegister, openLogin } = useDemoSession();

  return (
    <div className="shrink-0 @max-[8rem]/sidebar:hidden">
      <Card className="relative isolate overflow-hidden bg-(image:--background-image-signup-banner) p-4 text-white sm:p-4">
        <h2 className="relative z-10 text-xl leading-tight font-extrabold tracking-tight">
          Sua sorte <br/>começa aqui
        </h2>
        <CroinBanner className="top-auto -right-8 -bottom-3 z-0 w-36" />
        <Button
          className="relative z-10 mt-10"
          size="sm"
          aria-haspopup="dialog"
          onClick={openRegister}
        >
          Criar conta
        </Button>
      </Card>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-1.5 text-xs text-muted">
        <span>Já tem uma conta?</span>
        <Button
          variant="link"
          className="min-h-8 px-1 text-xs text-foreground"
          aria-haspopup="dialog"
          aria-label="Entrar na Croebet"
          onClick={openLogin}
        >
          Entrar
        </Button>
      </div>
    </div>
  );
}
