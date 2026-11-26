"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

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

/** Match controls keep only the primary actions in the navbar; the game renders the rest in its options menu. */
export function MatchNavbarControls() {
  const { active, hasHeader, setControls } = useMatchNavbar() ?? {};
  if (!active || !hasHeader) return null;
  return <div ref={setControls} data-match-controls className="flex shrink-0 items-center gap-1" />;
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
