"use client";

import { gameMedia } from "@croebet/shared";
import { defaultCardSound, isGameAudioFile } from "./game-audio-catalog";
import { createGameAudioPlayer, prepareAudioCue } from "./game-audio-player";
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";

const key = "croebet:game-audio";
const defaults = { muted: false, volume: 45, cardSound: defaultCardSound };
let preferences = defaults;
const listeners = new Set<() => void>();
function readPreferences() {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "null");
    if (value && typeof value.muted === "boolean" && Number.isFinite(value.volume)) {
      preferences = { muted: value.muted, volume: Math.max(0, Math.min(100, value.volume)), cardSound: process.env.NODE_ENV === "development" && isGameAudioFile(value.cardSound) ? value.cardSound : defaultCardSound };
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

// Standard slots. A game overrides availability through the shared registry;
// the runtime only decides which file plays.
const sounds = {
  turn: ["notification"],
  invite: ["notification"],
  card: [defaultCardSound],
  discard: ["card-shove-4"],
  entry: ["chip-lay-1", "chip-lay-2", "chip-lay-3"],
  prize: Array.from({ length: 6 }, (_, i) => `chips-stack-${i + 1}`),
};
type Sound = keyof typeof sounds;
// Catch-up bursts must not turn into a machine gun; normal actions are seconds apart.
const cooldown: Record<Sound, number> = { turn: 400, invite: 400, card: 120, discard: 160, entry: 200, prize: 200 };

export function useGameAudio(scope: "game" | "notifications" = "game", game?: string | null) {
  const settings = useSyncExternalStore(subscribe, () => preferences, () => defaults);
  const engine = useRef<{ context: AudioContext; gain: GainNode; player: ReturnType<typeof createGameAudioPlayer> } | null>(null);
  const buffers = useRef(new Map<string, ReturnType<typeof prepareAudioCue>>());
  const previewRevision = useRef(0);
  const previewMode = useRef(false);
  const stop = useCallback(() => { previewRevision.current++; engine.current?.player.stop(); }, []);
  const setPreviewMode = useCallback((value: boolean) => { previewMode.current = value; stop(); }, [stop]);
  const previous = useRef<Partial<Record<Sound, number>>>({});
  const playedAt = useRef<Partial<Record<Sound, number>>>({});
  const media = gameMedia(game);
  const mediaRef = useRef(media);
  useEffect(() => { mediaRef.current = media; }, [media]);

  useEffect(() => {
    let disposed = false;
    const controller = new AbortController();
    function unlock() {
      if (!engine.current) {
        if (!window.AudioContext) return;
        const context = new AudioContext({ latencyHint: "interactive" });
        const gain = context.createGain();
        gain.connect(context.destination);
        engine.current = { context, gain, player: createGameAudioPlayer(context, gain) };
        gain.gain.value = preferences.muted ? 0 : preferences.volume / 100;
        // Fetch only after interaction. Playback never waits for a download,
        // so a delayed load cannot make an old action sound later.
        for (const name of new Set(scope === "notifications" ? [...sounds.turn, ...sounds.invite] : [...Object.values(sounds).flat(), preferences.cardSound])) {
          const url = name === "notification" ? "/audio/notification.mp3" : `/audio/cards/Audio/${name}.ogg`;
          void fetch(url, { signal: controller.signal })
            .then(response => { if (!response.ok) throw new Error("Audio unavailable"); return response.arrayBuffer(); })
            .then(data => context.decodeAudioData(data))
            .then(buffer => { if (!disposed) buffers.current.set(name, prepareAudioCue(buffer)); })
            .catch(() => { /* An unavailable effect must not interrupt the game. */ });
        }
      }
      if (engine.current.context.state === "suspended") void engine.current.context.resume().catch(() => {});
    }
    if (navigator.userActivation?.hasBeenActive) unlock();
    document.addEventListener("pointerdown", unlock);
    document.addEventListener("keydown", unlock);
    return () => {
      disposed = true;
      controller.abort();
      document.removeEventListener("pointerdown", unlock);
      document.removeEventListener("keydown", unlock);
      const audio = engine.current;
      stop();
      engine.current = null;
      if (audio) void audio.context.close().catch(() => {});
    };
  }, [stop, scope]);

  useEffect(() => {
    const audio = engine.current;
    if (audio) {
      if (settings.muted || !settings.volume) stop();
      audio.gain.gain.value = settings.muted ? 0 : settings.volume / 100;
    }
  }, [settings, stop]);

  // Sounds are event-driven. Visibility never silences the tab: a hidden page
  // still receives confirmed events and plays their cue once, in real time.
  const play = useCallback((sound: Sound) => {
    const audio = engine.current;
    if (previewMode.current || !audio) return;
    const allowed = mediaRef.current;
    if (scope === "game" && (((sound === "card" || sound === "discard") && !allowed.card) || (sound === "turn" && !allowed.turn))) return;
    if (audio.context.state === "suspended") { void audio.context.resume().catch(() => {}); return; }
    if (audio.context.state !== "running" || preferences.muted || !preferences.volume) return;
    const now = performance.now();
    if (now - (playedAt.current[sound] ?? -Infinity) < cooldown[sound]) return;
    playedAt.current[sound] = now;
    const variants = sound === "card" ? [preferences.cardSound] : sounds[sound];
    let index = Math.floor(Math.random() * variants.length);
    if (index === previous.current[sound]) index = (index + 1) % variants.length;
    previous.current[sound] = index;
    audio.player.play(buffers.current.get(variants[index]) ?? null);
  }, [scope]);

  async function preview(name: string, original = false) {
    if (process.env.NODE_ENV !== "development" || !isGameAudioFile(name)) throw new Error("Áudio indisponível.");
    stop();
    const revision = previewRevision.current;
    const audio = engine.current;
    if (!audio) throw new Error("Áudio indisponível neste navegador.");
    if (preferences.muted || !preferences.volume) throw new Error("Ative o som e ajuste o volume para ouvir.");
    await audio.context.resume();
    // Preview loads on demand. A newer click, closing the panel or hiding the
    // tab invalidates this request so an old download never starts playing.
    let cue = buffers.current.get(name);
    if (!cue) {
      const response = await fetch(`/audio/cards/Audio/${name}.ogg`);
      if (!response.ok) throw new Error("Não foi possível carregar este áudio.");
      const buffer = await audio.context.decodeAudioData(await response.arrayBuffer());
      cue = prepareAudioCue(buffer);
      if (engine.current === audio) buffers.current.set(name, cue);
    }
    if (revision !== previewRevision.current || engine.current !== audio || document.hidden || preferences.muted || !preferences.volume) return;
    audio.player.play(original && cue ? { buffer: cue.buffer, offset: 0, duration: cue.buffer.duration } : cue ?? null);
  }

  function setCardSound(name: string) {
    if (process.env.NODE_ENV !== "development" || !isGameAudioFile(name)) return;
    stop();
    update({ cardSound: name });
    // Selecting an auditioned sound is instant; otherwise prepare it silently.
    const audio = engine.current;
    if (audio && !buffers.current.has(name)) {
      void fetch(`/audio/cards/Audio/${name}.ogg`).then(response => {
        if (!response.ok) throw new Error("Audio unavailable");
        return response.arrayBuffer();
      }).then(data => audio.context.decodeAudioData(data)).then(buffer => {
        if (engine.current === audio) buffers.current.set(name, prepareAudioCue(buffer));
      }).catch(() => {});
    }
  }

  function update(value: Partial<typeof defaults>) {
    preferences = { ...preferences, ...value };
    try { localStorage.setItem(key, JSON.stringify(preferences)); } catch { /* In-memory fallback. */ }
    listeners.forEach(listener => listener());
  }
  return { ...settings, play, stop, preview, setPreviewMode, setCardSound, toggle: () => update({ muted: !preferences.muted }), setVolume: (volume: number) => update({ volume, muted: volume === 0 }) };
}
