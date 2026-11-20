import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeSlug, pageWriteSchema, pageSlugSchema, gameCreateSchema, gameSlugSchema } from "../dist/index.js";

test("normaliza maiúsculas, acentos, espaços e separadores sem hífens repetidos nas escritas", () => {
  const fields = { slug: "  Minha Página — AÇÃO!  ", title: "Minha página", document: [], published: false, showInMenu: false, version: 0 };
  const cases = [
    ["  Minha Página — AÇÃO!  ", "minha-pagina-acao"],
    ["Nome   com\t espaços", "nome-com-espacos"],
    ["--Já__Existe---", "ja-existe"],
    ["ac\u0327a\u0303o", "acao"],
    ["flip7", "flip7"], ["123", "123"],
  ];
  for (const [raw, expected] of cases) {
    assert.equal(normalizeSlug(raw), expected);
    assert.equal(normalizeSlug(expected), expected);
    assert.equal(pageWriteSchema.parse({ ...fields, slug: raw }).slug, expected);
    assert.equal(gameCreateSchema.parse({ name: "Jogo", slug: raw, enabled: true, imageUrl: null }).slug, expected);
  }
});

test("normalização mantém validação de reservados/vazios/limite; URLs públicas exigem o slug canônico", () => {
  const fields = { title: "Página", document: [], published: false, showInMenu: false, version: 0 };
  for (const slug of [" ADMIN ", "Cárteira", "API", "  ", "!?!", "a".repeat(101)]) {
    assert.equal(pageWriteSchema.safeParse({ ...fields, slug }).success, false);
  }
  for (const slug of ["!?!", "", "a".repeat(101)]) {
    assert.equal(gameCreateSchema.safeParse({ name: "Jogo", slug, enabled: true, imageUrl: null }).success, false);
  }
  assert.equal(pageSlugSchema.safeParse("Minha Página").success, false);
  assert.equal(gameSlugSchema.safeParse("Meu Jogo").success, false);
});
