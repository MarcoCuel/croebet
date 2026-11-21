"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const dismissedKey = "croebet:app-install-dismissed";
const reminderDelay = 7 * 24 * 60 * 60 * 1000;

type AppInstallState = {
  visible: boolean;
  ios: boolean;
  canInstall: boolean;
  installing: boolean;
  error: boolean;
  dismiss: () => void;
  install: () => Promise<void>;
};

const AppInstallContext = createContext<AppInstallState | null>(null);

export function AppInstallProvider({ children }: { children: ReactNode }) {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [ios, setIos] = useState(false);
  const [hidden, setHidden] = useState(true);
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)");
    const isApp = () => standalone.matches || (navigator as Navigator & { standalone?: boolean }).standalone;
    if (!window.isSecureContext || isApp()) return;

    let dismissed = false;
    try {
      const timestamp = Number(localStorage.getItem(dismissedKey));
      dismissed = timestamp > 0 && Date.now() - timestamp < reminderDelay;
    } catch { /* Storage may be disabled. */ }

    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    // In-app browsers cannot expose the system's Add to Home Screen menu.
    const isSafari = /Safari/.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(navigator.userAgent);
    const timer = window.setTimeout(() => {
      if (isIos && isSafari && !dismissed && !isApp()) {
        setIos(true);
        setHidden(false);
      }
    }, 1500);

    const onPrompt = (event: Event) => {
      event.preventDefault();
      window.clearTimeout(timer);
      if (dismissed || isApp()) return;
      setIos(false);
      setPrompt(event as InstallPrompt);
      setHidden(false);
    };
    const onInstalled = () => {
      window.clearTimeout(timer);
      setHidden(true);
      setPrompt(null);
    };
    const onDisplayChange = () => { if (isApp()) onInstalled(); };
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

  function dismiss() {
    try { localStorage.setItem(dismissedKey, String(Date.now())); } catch { /* Optional preference. */ }
    setHidden(true);
  }

  async function install() {
    if (!prompt) return;
    setInstalling(true);
    setError(false);
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === "dismissed") dismiss();
      else setHidden(true);
    } catch {
      setError(true);
    } finally {
      setPrompt(null);
      setInstalling(false);
    }
  }

  return (
    <AppInstallContext.Provider value={{ visible: !hidden, ios, canInstall: Boolean(prompt), installing, error, dismiss, install }}>
      {children}
    </AppInstallContext.Provider>
  );
}

export function AppInstall() {
  const state = useContext(AppInstallContext);
  if (!state?.visible) return null;
  const { ios, canInstall, installing, error, dismiss, install } = state;

  return (
    <aside aria-label="App do Croebet" className="shrink-0 @max-[8rem]/sidebar:hidden">
      <Card className="bg-(image:--background-image-signup-banner) p-4 text-white sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xl leading-tight font-extrabold tracking-tight">Instalar Croebet</p>
            <p className="mt-2 text-sm text-white/80">
              {ios ? 'No Safari, toque em Compartilhar e depois em “Adicionar à Tela de Início”. Ative “Abrir como App da Web”, se aparecer.' : "Adicione à tela inicial e acesse os jogos pelo app."}
            </p>
          </div>
          <Button variant="ghost" size="icon-sm" className="shrink-0 text-white hover:bg-white/10 hover:text-white" aria-label="Fechar aviso do app" onClick={dismiss}><X className="size-4" aria-hidden="true" /></Button>
        </div>
        {!ios && canInstall && <Button className="mt-3 w-full" loading={installing} onClick={install}><Download className="size-4" aria-hidden="true" />Instalar app</Button>}
        {error && <p role="status" className="mt-2 text-sm text-white/80">Use a opção de instalar app no menu do navegador.</p>}
      </Card>
    </aside>
  );
}
