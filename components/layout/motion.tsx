"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { gsap } from "gsap";
import Lenis from "lenis";

export function Motion() {
  const pathname = usePathname();
  const previousPathname = useRef(pathname);
  const lenisRef = useRef<Lenis | null>(null);

  useLayoutEffect(() => {
    if (previousPathname.current === pathname) return;
    previousPathname.current = pathname;

    // Stop the previous route's momentum before Next's new page is painted.
    const lenis = lenisRef.current;
    lenis?.stop();
    lenis?.start();
    // Let Next handle anchor destinations instead of overriding them with zero.
    if (window.location.hash) return;

    if (lenis) {
      lenis.scrollTo(0, { immediate: true, force: true });
    } else {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }
  }, [pathname]);

  useEffect(() => {
    const media = gsap.matchMedia();

    media.add("(prefers-reduced-motion: no-preference)", () => {
      const lenis = new Lenis({ autoRaf: false, anchors: true });
      lenisRef.current = lenis;
      const tick = (seconds: number) => lenis.raf(seconds * 1000);
      gsap.ticker.add(tick);

      return () => {
        lenisRef.current = null;
        gsap.ticker.remove(tick);
        lenis.destroy();
      };
    });

    return () => media.revert();
  }, []);

  return null;
}
