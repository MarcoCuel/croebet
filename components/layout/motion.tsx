"use client";

import { useEffect } from "react";
import { gsap } from "gsap";
import Lenis from "lenis";

export function Motion() {
  useEffect(() => {
    const media = gsap.matchMedia();

    media.add("(prefers-reduced-motion: no-preference)", () => {
      const lenis = new Lenis({ autoRaf: false, anchors: true });
      const tick = (seconds: number) => lenis.raf(seconds * 1000);
      gsap.ticker.add(tick);

      return () => {
        gsap.ticker.remove(tick);
        lenis.destroy();
      };
    });

    return () => media.revert();
  }, []);

  return null;
}
