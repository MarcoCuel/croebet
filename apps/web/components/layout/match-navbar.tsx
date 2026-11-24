"use client";

import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Ellipsis } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type Navbar = {
  active: boolean;
  hasHeader: boolean;
  setHasHeader: (visible: boolean) => void;
  identity: HTMLDivElement | null;
  controls: HTMLDivElement | null;
  setIdentity: (node: HTMLDivElement | null) => void;
  setControls: (node: HTMLDivElement | null) => void;
};
const MatchNavbarContext = createContext<Navbar | null>(null);

export function MatchNavbarProvider({ active, children }: { active: boolean; children: ReactNode }) {
  const [hasHeader, setHasHeader] = useState(false);
  const [identity, setIdentity] = useState<HTMLDivElement | null>(null);
  const [controls, setControls] = useState<HTMLDivElement | null>(null);
  return <MatchNavbarContext.Provider value={{ active, hasHeader, setHasHeader, identity, controls, setIdentity, setControls }}>{children}</MatchNavbarContext.Provider>;
}

export function useMatchNavbar() { return useContext(MatchNavbarContext); }

export function MatchNavbarIdentity() {
  const { active, setIdentity } = useMatchNavbar() ?? {};
  return active ? <div ref={setIdentity} data-match-identity className="flex min-w-0 items-center gap-2 ml-4 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&_[data-game-title]]:hidden [&>*]:shrink-0" /> : null;
}

const query = "(min-width: 80rem)";
function subscribe(callback: () => void) {
  const media = window.matchMedia(query);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}
function desktopSnapshot() { return window.matchMedia(query).matches; }

export function MatchNavbarControls() {
  const { active, hasHeader, setControls } = useMatchNavbar() ?? {};
  const desktop = useSyncExternalStore(subscribe, desktopSnapshot, () => false);
  if (!active || !hasHeader) return null;
  if (desktop) return <div ref={setControls} data-match-controls className="shrink-0" />;
  const keepOpenForDialog = (event: Event) => {
    if (event.target instanceof Element && event.target.closest('[role="dialog"]')) event.preventDefault();
  };
  return <DropdownMenu modal={false}>
    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label="Opções da partida"><Ellipsis className="size-4" aria-hidden="true" /></Button></DropdownMenuTrigger>
    <DropdownMenuContent forceMount align="end" className="max-w-[calc(100vw-2rem)] data-[state=closed]:hidden" onInteractOutside={keepOpenForDialog} onFocusOutside={keepOpenForDialog}>
      <div ref={setControls} data-match-controls className="p-1" />
    </DropdownMenuContent>
  </DropdownMenu>;
}

/** Portals preserve the table's contexts and event handlers in the navbar. */
export function MatchHeader({ identity, controls, children }: { identity: ReactNode; controls: ReactNode; children: ReactNode }) {
  const navbar = useMatchNavbar();
  const active = navbar?.active;
  const setHasHeader = navbar?.setHasHeader;
  useEffect(() => {
    if (!active || !setHasHeader) return;
    setHasHeader(true);
    return () => setHasHeader(false);
  }, [active, setHasHeader]);
  if (!navbar?.active) return children;
  return <>
    {navbar.identity && createPortal(identity, navbar.identity)}
    {navbar.controls && createPortal(controls, navbar.controls)}
  </>;
}
