"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";

const key = "croebet:game-audio";
const defaults = { muted: false, volume: 45 };
let preferences = defaults;
const listeners = new Set<() => void>();
function readPreferences() {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "null");
    if (value && typeof value.muted === "boolean" && Number.isFinite(value.volume)) {
      preferences = { muted: value.muted, volume: Math.max(0, Math.min(100, value.volume)) };
    }
  } catch { /* Storage may be unavailable. Keep the in-memory preference. */ }
  listeners.forEach(listener => listener());
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  readPreferences();
  window.addEventListener("storage", readPreferences);
  return () => { listeners.delete(listener); window.removeEventListener("storage", readPreferences); };
}

const sounds = {
  slide: Array.from({ length: 8 }, (_, i) => `card-slide-${i + 1}`),
  place: Array.from({ length: 4 }, (_, i) => `card-place-${i + 1}`),
  discard: Array.from({ length: 4 }, (_, i) => `card-shove-${i + 1}`),
  shuffle: ["card-shuffle"],
  entry: ["chip-lay-1", "chip-lay-2", "chip-lay-3"],
  prize: Array.from({ length: 6 }, (_, i) => `chips-stack-${i + 1}`),
};
type Sound = keyof typeof sounds;

export function useGameAudio() {
  const settings = useSyncExternalStore(subscribe, () => preferences, () => defaults);
  const engine = useRef<{ context: AudioContext; gain: GainNode } | null>(null);
  const buffers = useRef(new Map<string, AudioBuffer>());
  const previous = useRef<Partial<Record<Sound, number>>>({});

  useEffect(() => {
    let disposed = false;
    const controller = new AbortController();
    function unlock() {
      if (!engine.current) {
        if (!window.AudioContext) return;
        const context = new AudioContext();
        const gain = context.createGain();
        gain.connect(context.destination);
        engine.current = { context, gain };
        gain.gain.value = preferences.muted ? 0 : preferences.volume / 100;
        // Fetch only after interaction. Playback never waits for a download,
        // so a delayed load cannot make an old action sound later.
        for (const name of Object.values(sounds).flat()) {
          void fetch(`/audio/cards/Audio/${name}.ogg`, { signal: controller.signal })
            .then(response => { if (!response.ok) throw new Error("Audio unavailable"); return response.arrayBuffer(); })
            .then(data => context.decodeAudioData(data))
            .then(buffer => { if (!disposed) buffers.current.set(name, buffer); })
            .catch(() => { /* An unavailable effect must not interrupt the game. */ });
        }
      }
      if (engine.current.context.state === "suspended") void engine.current.context.resume().catch(() => {});
    }
    function visibility() {
      const audio = engine.current;
      if (audio) audio.gain.gain.value = document.hidden || preferences.muted ? 0 : preferences.volume / 100;
    }
    if (navigator.userActivation?.hasBeenActive) unlock();
    document.addEventListener("pointerdown", unlock);
    document.addEventListener("keydown", unlock);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      disposed = true;
      controller.abort();
      document.removeEventListener("pointerdown", unlock);
      document.removeEventListener("keydown", unlock);
      document.removeEventListener("visibilitychange", visibility);
      const audio = engine.current;
      engine.current = null;
      if (audio) void audio.context.close().catch(() => {});
    };
  }, []);

  useEffect(() => {
    const audio = engine.current;
    if (audio) audio.gain.gain.value = document.hidden || settings.muted ? 0 : settings.volume / 100;
  }, [settings]);

  const play = useCallback((sound: Sound) => {
    const audio = engine.current;
    if (!audio || audio.context.state !== "running" || document.hidden || preferences.muted || !preferences.volume) return;
    const variants = sounds[sound];
    let index = Math.floor(Math.random() * variants.length);
    if (index === previous.current[sound]) index = (index + 1) % variants.length;
    previous.current[sound] = index;
    const buffer = buffers.current.get(variants[index]);
    if (!buffer) return;
    const source = audio.context.createBufferSource();
    source.buffer = buffer;
    source.connect(audio.gain);
    source.onended = () => source.disconnect();
    source.start();
  }, []);

  function update(value: Partial<typeof defaults>) {
    preferences = { ...preferences, ...value };
    try { localStorage.setItem(key, JSON.stringify(preferences)); } catch { /* In-memory fallback. */ }
    listeners.forEach(listener => listener());
  }
  return { ...settings, play, toggle: () => update({ muted: !preferences.muted }), setVolume: (volume: number) => update({ volume, muted: volume === 0 }) };
}
