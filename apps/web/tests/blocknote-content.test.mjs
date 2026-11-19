import assert from "node:assert/strict";
import { test } from "node:test";
import { fromEditorBlocks, toEditorBlocks } from "../lib/blocknote-content.ts";
import { isRichTextDocument, richTextPlainText } from "../lib/rich-text.ts";

test("BlockNote preserva títulos, listas aninhadas, citações e quebras de linha", () => {
  const document = [
    { tag: "h1", children: ["Título"] },
    { tag: "p", children: ["Texto", { tag: "br", children: [] }, "seguinte"] },
    { tag: "ul", children: [
      { tag: "li", children: ["Primeiro", { tag: "ol", children: [{ tag: "li", children: ["Subitem"] }] }] },
      { tag: "li", children: ["Segundo"] },
    ] },
    { tag: "blockquote", children: [{ tag: "h2", children: ["Destaque"] }, { tag: "p", children: ["Citação"] }] },
  ];
  assert.deepEqual(fromEditorBlocks(toEditorBlocks(document)), document);
});

test("BlockNote mantém formatação combinada e texto literal sem interpretar HTML", () => {
  const document = [{ tag: "p", children: [{ tag: "strong", children: [{ tag: "em", children: [{ tag: "u", children: ["<script>alert(1)</script>"] }] }] }] }];
  const blocks = toEditorBlocks(document);
  assert.deepEqual(blocks[0].content[0].styles, { bold: true, italic: true, underline: true });
  const saved = fromEditorBlocks(blocks);
  assert.equal(isRichTextDocument(saved), true);
  assert.equal(richTextPlainText(saved), "<script>alert(1)</script>");
  assert.deepEqual(toEditorBlocks(saved)[0].content, blocks[0].content);
});

test("BlockNote agrupa itens consecutivos e mantém documentos vazios como rascunhos", () => {
  const saved = fromEditorBlocks([
    { type: "bulletListItem", content: [{ type: "text", text: "Um", styles: {} }], children: [] },
    { type: "bulletListItem", content: [{ type: "text", text: "Dois", styles: {} }], children: [] },
    { type: "paragraph", content: [], children: [] },
    { type: "bulletListItem", content: [{ type: "text", text: "Três", styles: {} }], children: [] },
  ]);
  assert.equal(saved.length, 3);
  assert.equal(saved[0].children.length, 2);
  assert.deepEqual(toEditorBlocks([]), []);
  assert.equal(richTextPlainText(fromEditorBlocks([{ type: "paragraph", content: [], children: [] }])), "");
  assert.equal(isRichTextDocument(saved), true);
});
