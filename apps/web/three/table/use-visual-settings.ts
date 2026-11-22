"use client";
import { useEffect, useState } from "react";
import { defaultSettings, parseSettings } from "./model";
export const tableSettingsKey = "croebet:table-laboratory:v1";
export const tableSettingsEvent = "croebet:table-visual-settings";
/** Only visual preferences are shared: game seats, turn, hands and visibility are authoritative. */
export function useTableVisualSettings() {
  const [settings, setSettings] = useState(defaultSettings);
  useEffect(() => {
    const read = () => {
      try {
        const raw = localStorage.getItem(tableSettingsKey);
        const parsed = parseSettings(raw ? JSON.parse(raw) : null);
        if (parsed) {
          const { players: _players, counts: _counts, viewer: _viewer, turn: _turn, reveal: _reveal, dealCount: _dealCount, ...visual } = parsed;
          void [_players, _counts, _viewer, _turn, _reveal, _dealCount];
          setSettings({ ...defaultSettings, ...visual });
        }
      } catch { /* Keep the shared defaults when browser storage is unavailable. */ }
    };
    read(); window.addEventListener("storage", read); window.addEventListener(tableSettingsEvent, read);
    return () => { window.removeEventListener("storage", read); window.removeEventListener(tableSettingsEvent, read); };
  }, []);
  return settings;
}
