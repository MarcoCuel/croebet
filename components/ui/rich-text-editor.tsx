"use client";

import { useEffect, useRef, useState } from "react";
import { Bold, Italic, List, ListOrdered, Redo2, Undo2 } from "lucide-react";
import { richTextStyles } from "@/components/ui/rich-text-content";
import { Button } from "@/components/ui/button";
import {
  richTextTags,
  type RichTextDocument,
  type RichTextTag,
} from "@/lib/rich-text";

// Read only supported formatting. Pasted HTML, attributes and executable nodes
// never become part of the saved document or the public page.
export function readRichText(root: Node): RichTextDocument {
  return Array.from(root.childNodes).flatMap((node): RichTextDocument => {
    if (node.nodeType === Node.TEXT_NODE) return [node.textContent ?? ""];
    if (!(node instanceof HTMLElement)) return [];
    const name = node.tagName.toLowerCase();
    if (
      [
        "script",
        "style",
        "iframe",
        "object",
        "svg",
        "math",
        "img",
        "video",
        "audio",
      ].includes(name)
    )
      return [];
    const aliases: Record<string, RichTextTag> = {
      div: "p",
      b: "strong",
      i: "em",
    };
    const tag = aliases[name] ?? name;
    const children = readRichText(node);
    return richTextTags.includes(tag as RichTextTag)
      ? [{ tag: tag as RichTextTag, children }]
      : children;
  });
}

function createNodes(nodes: RichTextDocument): DocumentFragment {
  const fragment = document.createDocumentFragment();
  nodes.forEach((node) => {
    if (typeof node === "string")
      fragment.append(document.createTextNode(node));
    else {
      const element = document.createElement(node.tag);
      element.append(createNodes(node.children));
      fragment.append(element);
    }
  });
  return fragment;
}

export function RichTextEditor({
  initialValue,
  onChange,
  label,
}: {
  initialValue: RichTextDocument;
  onChange: (value: RichTextDocument) => void;
  label: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const initial = useRef(initialValue);
  const range = useRef<Range | null>(null);
  const [active, setActive] = useState<string[]>([]);
  useEffect(() => {
    root.current?.replaceChildren(createNodes(initial.current));
  }, []);

  function selection() {
    const current = window.getSelection();
    if (current?.rangeCount && root.current?.contains(current.anchorNode)) {
      range.current = current.getRangeAt(0).cloneRange();
      setActive(
        ["bold", "italic", "insertUnorderedList", "insertOrderedList"].filter(
          (command) => document.queryCommandState(command),
        ),
      );
    }
  }
  function command(name: string, value?: string) {
    const element = root.current;
    if (!element) return;
    element.focus();
    const current = window.getSelection();
    if (
      range.current &&
      element.contains(range.current.commonAncestorContainer)
    ) {
      current?.removeAllRanges();
      current?.addRange(range.current);
    }
    // Native editing commands preserve the browser's undo history and selection.
    document.execCommand(name, false, value);
    onChange(readRichText(element));
    selection();
  }
  const tools = [
    { name: "bold", label: "Negrito", Icon: Bold },
    { name: "italic", label: "Itálico", Icon: Italic },
    { name: "insertUnorderedList", label: "Lista com marcadores", Icon: List },
    { name: "insertOrderedList", label: "Lista numerada", Icon: ListOrdered },
    { name: "undo", label: "Desfazer", Icon: Undo2 },
    { name: "redo", label: "Refazer", Icon: Redo2 },
  ];
  return (
    <div className="overflow-hidden rounded-panel border border-field-border bg-background focus-within:border-brand">
      <div
        role="group"
        aria-label="Formatação do texto"
        className="flex flex-wrap items-center gap-1 border-b border-contrast/6 bg-contrast/6 p-2"
      >
        {(
          [
            ["p", "Texto"],
            ["h1", "Título"],
            ["h2", "Subtítulo"],
          ] as const
        ).map(([tag, title]) => (
          <Button
            key={tag}
            size="sm"
            variant="ghost"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => command("formatBlock", tag)}
          >
            {title}
          </Button>
        ))}
        <span className="mx-1 h-5 border-l border-contrast/6" aria-hidden="true" />
        {tools.map(({ name, label, Icon }) => (
          <Button
            key={name}
            size="icon-sm"
            variant={active.includes(name) ? "secondary" : "ghost"}
            aria-label={label}
            title={label}
            aria-pressed={
              name === "undo" || name === "redo"
                ? undefined
                : active.includes(name)
            }
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => command(name)}
          >
            <Icon className="size-4" aria-hidden="true" />
          </Button>
        ))}
      </div>
      <div
        ref={root}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-label={label}
        aria-multiline="true"
        spellCheck
        lang="pt-BR"
        className={`${richTextStyles} min-h-[32rem] px-5 py-6 outline-none sm:px-8`}
        onInput={() => {
          if (root.current) onChange(readRichText(root.current));
          selection();
        }}
        onKeyUp={selection}
        onMouseUp={selection}
        onBlur={selection}
        onPaste={(event) => {
          event.preventDefault();
          // Paste plain text; the toolbar controls the document's visual formatting.
          command("insertText", event.clipboardData.getData("text/plain"));
        }}
      />
    </div>
  );
}
