"use client";
import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";

const preferenceEvent = "croebet:table-view";
function subscribe(notify: () => void) {
  window.addEventListener("storage", notify); window.addEventListener(preferenceEvent, notify);
  return () => { window.removeEventListener("storage", notify); window.removeEventListener(preferenceEvent, notify); };
}
export function useTableView(game: string) {
  const [fallback, setFallback] = useState<"classic" | "3d" | null>(null);
  const stored = useSyncExternalStore<"classic" | "3d">(subscribe, (): "classic" | "3d" => {
    try { return localStorage.getItem(`croebet:table-view:${game}`) === "3d" ? "3d" : "classic"; } catch { return "classic"; }
  }, () => "classic");
  return { view: fallback ?? stored, setView: (next: "classic" | "3d") => {
    try { localStorage.setItem(`croebet:table-view:${game}`, next); window.dispatchEvent(new Event(preferenceEvent)); }
    catch { setFallback(next); }
  } };
}
export function TableViewToggle({ view, onChange, disabled }: { view: "classic" | "3d"; onChange: (view: "classic" | "3d") => void; disabled?: boolean }) {
  return <div role="group" aria-label="Interface da mesa" className="flex gap-1">{(["classic", "3d"] as const).map(option => <Button key={option} size="sm" variant="ghost" disabled={disabled} aria-pressed={view === option} onClick={() => onChange(option)}>{option === "3d" ? "3D" : "Atual"}</Button>)}</div>;
}
