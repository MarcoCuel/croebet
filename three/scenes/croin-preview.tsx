"use client";

import dynamic from "next/dynamic";
import { Component, type ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const Scene = dynamic(() => import("./croin-preview-scene"), {
  ssr: false,
  loading: () => (
    <div className="size-full" role="status">
      <span className="sr-only">Carregando visualização 3D…</span>
      <Skeleton className="size-full" />
    </div>
  ),
});

class SceneBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <p className="p-4 text-sm text-muted" role="status">
        A visualização 3D não está disponível neste navegador.
      </p>
    ) : (
      this.props.children
    );
  }
}

/** Opt-in example. Rendering this component is the only operation that loads Three.js. */
export function CroinPreview({ className }: { className?: string }) {
  return (
    <div
      className={cn("aspect-square overflow-hidden rounded-panel", className)}
      role="img"
      aria-label="Modelo 3D de uma Croin"
      data-lenis-prevent
    >
      <SceneBoundary>
        <Scene />
      </SceneBoundary>
    </div>
  );
}
