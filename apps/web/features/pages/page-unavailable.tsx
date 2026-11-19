"use client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
export function PageUnavailable() {
  const router = useRouter();
  return <div className="grid justify-items-center gap-4 py-12 text-center"><p role="alert">Não foi possível carregar esta página.</p><Button variant="secondary" onClick={() => router.refresh()}>Tentar novamente</Button></div>;
}
