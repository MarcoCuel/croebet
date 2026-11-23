"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import Image from "next/image";

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type AppInstallState = {
  visible: boolean;
  installing: boolean;
  install: () => Promise<void>;
};

const AppInstallContext = createContext<AppInstallState | null>(null);
const defaultInstructions = "Abra a Croebet no Chrome, Edge ou Safari e use a opção de instalar app no menu do navegador.";

export function AppInstallProvider({ children }: { children: ReactNode }) {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [instructions, setInstructions] = useState(defaultInstructions);
  const [hidden, setHidden] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)");
    const isApp = () => Boolean(standalone.matches || (navigator as Navigator & { standalone?: boolean }).standalone);
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isSafari = /Version\/\d+.*Safari/.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(navigator.userAgent);
    const isMacSafari = !isIos && /Macintosh/.test(navigator.userAgent) && isSafari && Number(navigator.userAgent.match(/Version\/(\d+)/)?.[1]) >= 17;
    const manualInstructions = !window.isSecureContext
      ? "Abra a Croebet pelo endereço HTTPS para instalar o app."
      : isIos
        ? 'No Safari, toque em Compartilhar e depois em “Adicionar à Tela de Início”. Ative “Abrir como App da Web”, se aparecer.'
        : isMacSafari
          ? 'No Safari, abra o menu Arquivo e escolha “Adicionar ao Dock”.'
          : /Chrome\/|Chromium\/|Edg\//.test(navigator.userAgent)
            ? /Android/.test(navigator.userAgent)
              ? 'No menu do navegador, escolha “Instalar app” ou “Adicionar à tela inicial”.'
              : 'Use o ícone de instalação na barra de endereço ou a opção de instalar no menu do navegador.'
            : defaultInstructions;

    const timer = window.setTimeout(() => {
      setInstructions(manualInstructions);
      setHidden(isApp());
    }, 0);
    const onPrompt = (event: Event) => {
      event.preventDefault();
      if (isApp()) return;
      setPrompt(event as InstallPrompt);
    };
    const onInstalled = () => {
      window.clearTimeout(timer);
      setHidden(true);
      setPrompt(null);
      setHelpOpen(false);
    };
    const onDisplayChange = () => {
      if (isApp()) onInstalled();
      else setHidden(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    standalone.addEventListener("change", onDisplayChange);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      standalone.removeEventListener("change", onDisplayChange);
    };
  }, []);

  async function install() {
    if (!prompt) {
      setHelpOpen(true);
      return;
    }
    setInstalling(true);
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === "accepted") setHidden(true);
    } catch {
      setHelpOpen(true);
    } finally {
      setPrompt(null);
      setInstalling(false);
    }
  }

  return (
    <AppInstallContext.Provider value={{ visible: !hidden, installing, install }}>
      {children}
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent>
          <DialogTitle>Baixar app</DialogTitle>
          <DialogDescription>{instructions}</DialogDescription>
        </DialogContent>
      </Dialog>
    </AppInstallContext.Provider>
  );
}

export function AppInstall() {
  const state = useContext(AppInstallContext);
  if (!state?.visible) return null;

  return (
    <aside aria-label="App do Croebet" className="shrink-0 @max-[8rem]/sidebar:hidden">
      <Card className="bg-linear-[-160deg] from-surface from-30% to-quaternary to-200% p-4 text-white relative z-1">
        <p className="text-lg leading-tight font-extrabold tracking-tight">Jogue <br/>pelo App</p>
        <Image src="/orb.png" alt="" width={100} height={100} unoptimized sizes="100px" className="w-32 h-32 shrink-0 object-cover absolute right-0 -top-8 -z-1" />
        <Button className="mt-4 w-full bg-quaternary" size="sm" loading={state.installing} onClick={state.install}>
          Baixar app
        </Button>
      </Card>
    </aside>
  );
}
