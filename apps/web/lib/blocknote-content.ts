import type { RichTextDocument, RichTextNode } from "./rich-text.ts";

type TextStyles = { bold?: boolean; italic?: boolean; underline?: boolean };
type EditorText = { type: "text"; text: string; styles: TextStyles };
type EditorInline = EditorText | { type: "link"; href: string; content: readonly EditorText[] };
type BlockContent = { content: EditorText[]; children: EditorBlock[] };
export type EditorBlock = BlockContent & (
  | { type: "paragraph" | "quote" | "bulletListItem" | "numberedListItem" }
  | { type: "heading"; props: { level: 1 | 2 | 3 } }
);
type ReadableBlock = { type: string; props?: { [key: string]: unknown; level?: number }; content?: readonly EditorInline[]; children?: readonly ReadableBlock[] };
const inlineTags = new Set(["strong", "em", "u", "br"]);

function inlineContent(nodes: RichTextDocument, styles: TextStyles = {}): EditorText[] {
  return nodes.flatMap(node => {
    if (typeof node === "string") return node ? [{ type: "text" as const, text: node, styles }] : [];
    if (node.tag === "br") return [{ type: "text" as const, text: "\n", styles }];
    const style = node.tag === "strong" ? "bold" : node.tag === "em" ? "italic" : node.tag === "u" ? "underline" : null;
    return inlineContent(node.children, style ? { ...styles, [style]: true } : styles);
  });
}

/** Map the editor's basic blocks to the validated page document, without HTML. */
export function toEditorBlocks(document: RichTextDocument): EditorBlock[] {
  const blocks: EditorBlock[] = [];
  let inline: RichTextDocument = [];
  function flush() {
    if (inline.length) blocks.push({ type: "paragraph", content: inlineContent(inline), children: [] });
    inline = [];
  }
  for (const node of document) {
    if (typeof node === "string" || inlineTags.has(node.tag)) { inline.push(node); continue; }
    flush();
    if (node.tag === "ul" || node.tag === "ol") {
      for (const item of node.children) {
        if (typeof item === "string" || item.tag !== "li") { blocks.push(...toEditorBlocks([item])); continue; }
        const content: RichTextDocument = [];
        const nested: RichTextDocument = [];
        for (const child of item.children) {
          if (typeof child !== "string" && (child.tag === "ul" || child.tag === "ol")) nested.push(child);
          else content.push(child);
        }
        blocks.push({ type: node.tag === "ul" ? "bulletListItem" : "numberedListItem", content: inlineContent(content), children: toEditorBlocks(nested) });
      }
    } else if (node.tag === "blockquote") {
      const hasBlocks = node.children.some(child => typeof child !== "string" && !inlineTags.has(child.tag));
      blocks.push({ type: "quote", content: hasBlocks ? [] : inlineContent(node.children), children: hasBlocks ? toEditorBlocks(node.children) : [] });
    } else if (node.tag === "h1" || node.tag === "h2" || node.tag === "h3") {
      blocks.push({ type: "heading", props: { level: node.tag === "h1" ? 1 : node.tag === "h2" ? 2 : 3 }, content: inlineContent(node.children), children: [] });
    } else {
      blocks.push({ type: "paragraph", content: inlineContent(node.children), children: [] });
    }
  }
  flush();
  return blocks;
}

function readInline(content: readonly EditorInline[]): RichTextDocument {
  return content.flatMap(item => {
    // The page contract supports formatted text, without hyperlink destinations.
    if (item.type === "link") return readInline(item.content);
    const lines = item.text.split("\n");
    let nodes: RichTextDocument = lines.flatMap((line, index): RichTextDocument => [...(index ? [{ tag: "br" as const, children: [] }] : []), ...(line ? [line] : [])]);
    for (const [style, tag] of [["bold", "strong"], ["italic", "em"], ["underline", "u"]] as const) {
      if (item.styles[style]) nodes = [{ tag, children: nodes }];
    }
    return nodes;
  });
}

export function fromEditorBlocks(blocks: readonly ReadableBlock[]): RichTextDocument {
  const document: RichTextDocument = [];
  for (const block of blocks) {
    const content = readInline(block.content ?? []);
    const children = fromEditorBlocks(block.children ?? []);
    if (block.type === "bulletListItem" || block.type === "numberedListItem") {
      const tag = block.type === "bulletListItem" ? "ul" : "ol";
      const item: RichTextNode = { tag: "li", children: [...content, ...children] };
      const last = document.at(-1);
      if (last && typeof last !== "string" && last.tag === tag) last.children.push(item);
      else document.push({ tag, children: [item] });
    } else if (block.type === "quote") {
      document.push({ tag: "blockquote", children: [...content, ...children] });
    } else {
      const tag = block.type === "heading" ? block.props?.level === 1 ? "h1" : block.props?.level === 2 ? "h2" : "h3" : "p";
      document.push({ tag, children: content }, ...children);
    }
  }
  return document;
}
