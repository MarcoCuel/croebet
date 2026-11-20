"use client";

import dynamic from "next/dynamic";
import type { RichTextDocument } from "@/lib/rich-text";

export type RichTextEditorProps = {
  initialValue: RichTextDocument;
  onChange: (value: RichTextDocument) => void;
  label: string;
};

// BlockNote depends on the DOM; keep its renderer out of server rendering.
export const RichTextEditor = dynamic<RichTextEditorProps>(
  () => import("@/components/ui/blocknote-editor").then(module => module.BlockNoteEditor),
  { ssr: false, loading: () => <div role="status" className="min-h-[32rem] rounded-lg border-(length:--border-width-hairline) border-transparent bg-contrast/6 p-5 text-sm text-muted">Carregando editor…</div> },
);
