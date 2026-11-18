export const richTextTags = [
  "p",
  "h1",
  "h2",
  "h3",
  "strong",
  "em",
  "u",
  "ul",
  "ol",
  "li",
  "blockquote",
  "br",
] as const;
export type RichTextTag = (typeof richTextTags)[number];
export type RichTextNode =
  | string
  | { tag: RichTextTag; children: RichTextNode[] };
export type RichTextDocument = RichTextNode[];

export function isRichTextDocument(value: unknown): value is RichTextDocument {
  let count = 0;
  function valid(nodes: unknown, depth: number): boolean {
    return (
      depth < 30 &&
      Array.isArray(nodes) &&
      nodes.every((node) => {
        if (++count > 10000) return false;
        if (typeof node === "string") return node.length <= 50000;
        return (
          !!node &&
          typeof node === "object" &&
          richTextTags.includes(node.tag) &&
          valid(node.children, depth + 1)
        );
      })
    );
  }
  return valid(value, 0);
}

export function richTextPlainText(nodes: RichTextDocument): string {
  return nodes
    .map((node) =>
      typeof node === "string" ? node : richTextPlainText(node.children),
    )
    .join("");
}
