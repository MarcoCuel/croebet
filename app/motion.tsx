"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { gsap } from "gsap";
import Lenis from "lenis";

export function Motion() {
  const pathname = usePathname();

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

  useEffect(() => {
    const media = gsap.matchMedia();

    media.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.from("[data-enter]", {
        y: "1rem",
        opacity: 0,
        duration: 0.48,
        stagger: 0.06,
        ease: "power2.out",
        clearProps: "opacity,transform",
      });
    });

    return () => media.revert();
  }, [pathname]);

  return null;
}
