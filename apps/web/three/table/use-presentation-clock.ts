"use client";

import { useCallback, useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";

/** A frame finishes only after its reading time AND its actual scene motions. */
export function usePresentationClock(frame: number, duration: number, onAnimating?: (busy: boolean) => void, paused = false, timeScale = 1) {
  const callback = useRef(onAnimating);
  const motion = useRef(false);
  const reading = useRef(false);
  const timeline = useRef<gsap.core.Timeline | null>(null);
  useLayoutEffect(() => { callback.current = onAnimating; }, [onAnimating]);
  useLayoutEffect(() => {
    reading.current = duration > 0 && !matchMedia("(prefers-reduced-motion: reduce)").matches;
    callback.current?.(reading.current || motion.current);
    if (!reading.current) return;
    const clock = gsap.timeline({ onComplete: () => {
      reading.current = false;
      callback.current?.(motion.current);
    } }).to({}, { duration });
    timeline.current = clock;
    return () => { clock.kill(); timeline.current = null; reading.current = false; };
  }, [frame, duration]);
  useLayoutEffect(() => { timeline.current?.timeScale(timeScale).paused(paused); }, [frame, duration, paused, timeScale]);
  return useCallback((busy: boolean) => {
    motion.current = busy;
    callback.current?.(busy || reading.current);
  }, []);
}
