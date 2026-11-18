import { createElement, type ReactNode } from "react";
import { cn } from "@/lib/utils";

import type { RichTextDocument } from "@/lib/rich-text";

export const richTextStyles =
  "text-base leading-relaxed text-muted [&_h1]:mb-4 [&_h1]:text-display [&_h1]:leading-tight [&_h1]:font-bold [&_h1]:tracking-display [&_h1]:text-foreground [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:text-section [&_h2]:leading-tight [&_h2]:font-bold [&_h2]:tracking-tight [&_h2]:text-foreground [&_h3]:mt-7 [&_h3]:mb-3 [&_h3]:text-xl [&_h3]:font-bold [&_h3]:text-foreground [&_p]:my-3 [&_strong]:font-semibold [&_strong]:text-foreground [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1 [&_blockquote]:my-7 [&_blockquote]:rounded-panel [&_blockquote]:bg-surface [&_blockquote]:p-5 [&_blockquote_h2]:mt-0 [&_blockquote_h2]:text-xl [&_blockquote_p]:mb-0 [&>:first-child]:mt-0";

export function RichTextContent({
  document,
  className,
}: {
  document: RichTextDocument;
  className?: string;
}) {
  function render(nodes: RichTextDocument): ReactNode {
    return nodes.map((node, index) =>
      typeof node === "string"
        ? node
        : createElement(
            node.tag,
            { key: index },
            node.tag === "br" ? undefined : render(node.children),
          ),
    );
  }
  return (
    <div className={cn(richTextStyles, className)}>{render(document)}</div>
  );
}
