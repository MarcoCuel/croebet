import assert from "node:assert/strict";
import { test } from "node:test";
import { isRichTextDocument, richTextPlainText } from "../lib/rich-text.ts";

test("documento visual aceita títulos, formatação e listas sem transformar texto em HTML", () => {
  const document = [
    { tag: "h1", children: ["A casa"] },
    {
      tag: "p",
      children: [
        { tag: "strong", children: ["Croins"] },
        " <script>alert(1)</script>",
      ],
    },
    { tag: "ul", children: [{ tag: "li", children: ["Primeiro"] }] },
  ];
  assert.equal(isRichTextDocument(document), true);
  assert.equal(
    richTextPlainText(document),
    "A casaCroins <script>alert(1)</script>Primeiro",
  );
});

test("documento rejeita tags executáveis, estruturas inválidas e profundidade excessiva", () => {
  for (const invalid of [
    null,
    {},
    [null],
    [{ tag: "script", children: ["alert(1)"] }],
    [{ tag: "iframe", children: [] }],
    [{ tag: "p", children: "inválido" }],
  ]) {
    assert.equal(isRichTextDocument(invalid), false);
  }
  let nested = ["fim"];
  for (let i = 0; i < 40; i++) nested = [{ tag: "strong", children: nested }];
  assert.equal(isRichTextDocument(nested), false);
});
