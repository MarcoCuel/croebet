"use client";

import type { CSSProperties } from "react";
import { BlockNoteSchema, defaultBlockSpecs, defaultInlineContentSpecs, defaultStyleSpecs } from "@blocknote/core";
import { pt } from "@blocknote/core/locales";
import { BasicTextStyleButton, BlockTypeSelect, FormattingToolbar, FormattingToolbarController, useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/ariakit";
import "@blocknote/ariakit/style.css";
import { fromEditorBlocks, toEditorBlocks } from "@/lib/blocknote-content";
import type { RichTextEditorProps } from "@/components/ui/rich-text-editor";

// Expose only formatting that the page contract and public renderer support.
const schema = BlockNoteSchema.create({
  blockSpecs: {
    paragraph: defaultBlockSpecs.paragraph,
    heading: defaultBlockSpecs.heading,
    bulletListItem: defaultBlockSpecs.bulletListItem,
    numberedListItem: defaultBlockSpecs.numberedListItem,
    quote: defaultBlockSpecs.quote,
  },
  inlineContentSpecs: { text: defaultInlineContentSpecs.text },
  styleSpecs: { bold: defaultStyleSpecs.bold, italic: defaultStyleSpecs.italic, underline: defaultStyleSpecs.underline },
});

const theme = {
  "--bn-colors-editor-text": "var(--color-foreground)",
  "--bn-colors-editor-background": "var(--color-background)",
  "--bn-colors-menu-text": "var(--color-foreground)",
  "--bn-colors-menu-background": "var(--color-surface)",
  "--bn-colors-tooltip-text": "var(--color-foreground)",
  "--bn-colors-tooltip-background": "var(--color-surface)",
  "--bn-colors-hovered-text": "var(--color-foreground)",
  "--bn-colors-hovered-background": "var(--color-selected)",
  "--bn-colors-selected-text": "var(--color-foreground)",
  "--bn-colors-selected-background": "var(--color-selected)",
  "--bn-colors-disabled-text": "var(--color-muted)",
  "--bn-colors-disabled-background": "var(--color-surface)",
  "--bn-colors-border": "var(--color-field-border)",
  "--bn-colors-side-menu": "var(--color-muted)",
  "--bn-font-family": "var(--font-sans)",
  "--bn-border-radius": "0.5rem",
} as CSSProperties;

export function BlockNoteEditor({ initialValue, onChange, label }: RichTextEditorProps) {
  const editor = useCreateBlockNote({
    schema,
    dictionary: { ...pt, placeholders: { ...pt.placeholders, default: "Escreva ou digite / para inserir um bloco" } },
    initialContent: initialValue.length ? toEditorBlocks(initialValue) : undefined,
    domAttributes: { editor: { role: "textbox", "aria-label": label, "aria-multiline": "true", lang: "pt-BR" } },
  });
  return <BlockNoteView
    editor={editor}
    theme="dark"
    style={theme}
    className="rounded-panel py-5 [&_.bn-editor]:min-h-[32rem] [&_.bn-editor]:px-10 [&_.bn-editor]:outline-none"
    data-lenis-prevent
    formattingToolbar={false}
    onChange={() => onChange(fromEditorBlocks(editor.document))}
  >
    <FormattingToolbarController formattingToolbar={() => <FormattingToolbar>
      <BlockTypeSelect />
      <BasicTextStyleButton basicTextStyle="bold" />
      <BasicTextStyleButton basicTextStyle="italic" />
      <BasicTextStyleButton basicTextStyle="underline" />
    </FormattingToolbar>} />
  </BlockNoteView>;
}
