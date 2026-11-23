"use client";
import { Card } from "@/components/ui/card";
import { MediaBrowser } from "@/features/media/media-browser";
export function AdminMedia() {
  return <Card className="min-w-0"><h1 className="sr-only">Biblioteca de mídia</h1><MediaBrowser /></Card>;
}
