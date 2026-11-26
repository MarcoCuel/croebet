"use client";

import dynamic from "next/dynamic";
import { Component, useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const Scene = dynamic(() => import("./croin-banner-scene"), { ssr: false });

/** Decoration only: a failed scene leaves the banner intact. */
class SceneBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** Three.js loads after the page is interactive; the banner never waits for it. */
function useIdle() {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    if (typeof window.requestIdleCallback !== "function") {
      const timer = window.setTimeout(() => setIdle(true), 300);
      return () => window.clearTimeout(timer);
    }
    const request = window.requestIdleCallback(() => setIdle(true), {
      timeout: 1500,
    });
    return () => window.cancelIdleCallback(request);
  }, []);
  return idle;
}

/** Decorative Croin inside the home bonus banner, hidden from assistive tech. */
export function CroinBanner({ className }: { className?: string }) {
  const idle = useIdle();
  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none select-none", className)}
      data-testid="croin-banner"
    >
      {idle && (
        <div className="aspect-square w-full">
          <SceneBoundary>
            <Scene />
          </SceneBoundary>
        </div>
      )}
    </div>
  );
}
