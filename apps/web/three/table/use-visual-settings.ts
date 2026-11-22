"use client";
import { useCallback, useEffect, useState } from "react";
import type { PileTransform } from "./pile-transform";
import { defaultSettings } from "./model";
import { readTableVisualPreset, tableSettingsEvent } from "./visual-settings-api";
export { tableSettingsKey, tableSettingsEvent } from "./visual-settings-api";
/** Only presentation is global. Active games retain their authoritative state. */
export function useTableVisualSettings() {
  const [settings, setSettings] = useState(defaultSettings);
  useEffect(() => {
    let disposed = false, request = 0, version = -1;
    const read = async () => {
      const current = ++request;
      try {
        const preset = await readTableVisualPreset();
        if (disposed || current !== request || preset.version === version) return;
        version = preset.version;
        setSettings({ ...defaultSettings, ...preset.settings });
      } catch { /* Keep the last confirmed preset during temporary connection failures. */ }
    };
    const refresh = () => { if (document.visibilityState === "visible") void read(); };
    void read();
    const interval = window.setInterval(refresh, 15000);
    window.addEventListener("storage", refresh); window.addEventListener(tableSettingsEvent, refresh);
    window.addEventListener("focus", refresh); document.addEventListener("visibilitychange", refresh);
    return () => {
      disposed = true; window.clearInterval(interval);
      window.removeEventListener("storage", refresh); window.removeEventListener(tableSettingsEvent, refresh);
      window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  const onDeckChange = useCallback((point: PileTransform) => setSettings(current => ({ ...current, deckX: point.x, deckZ: point.z, deckRotation: point.rotation, deckScale: point.scale })), []);
  const onDiscardChange = useCallback((point: PileTransform) => setSettings(current => ({ ...current, discardX: point.x, discardZ: point.z, discardRotation: point.rotation, discardScale: point.scale })), []);
  return { settings, onDeckChange, onDiscardChange };
}
