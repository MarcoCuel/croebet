"use client";
import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

export class TableSceneBoundary extends Component<{ children: ReactNode; fallback?: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? this.props.fallback ?? <div role="alert" className="grid gap-3 p-6"><p>Não foi possível abrir a mesa 3D. Verifique se a aceleração gráfica está disponível.</p><Button onClick={() => this.setState({ failed: false })}>Tentar novamente</Button></div> : this.props.children;
  }
}
