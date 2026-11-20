"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const dismissedKey = "croebet:app-install-dismissed";
const reminderDelay = 7 * 24 * 60 * 60 * 1000;

export function AppInstall() {
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

  if (hidden) return null;

  return (
    <aside aria-label="App do Croebet" className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 mx-auto max-w-sm rounded-panel border border-contrast/6 bg-surface p-4 shadow-xl sm:left-auto sm:mx-0">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">Instalar Croebet</p>
          <p className="mt-1 text-sm text-muted">
            {ios ? 'No Safari, toque em Compartilhar e depois em “Adicionar à Tela de Início”. Ative “Abrir como App da Web”, se aparecer.' : "Adicione à tela inicial e acesse os jogos pelo app."}
          </p>
        </div>
        <Button variant="ghost" size="icon-sm" aria-label="Fechar aviso do app" onClick={dismiss}><X className="size-4" aria-hidden="true" /></Button>
      </div>
      {!ios && prompt && <Button className="mt-3 w-full" loading={installing} onClick={install}><Download className="size-4" aria-hidden="true" />Instalar app</Button>}
      {error && <p role="status" className="mt-2 text-sm text-muted">Use a opção de instalar app no menu do navegador.</p>}
    </aside>
  );
}
