import assert from "node:assert/strict";
import { test } from "node:test";
import { cn } from "../lib/utils.ts";

test("tamanhos de tipografia personalizados coexistem com cores no conteúdo do editor", () => {
  for (const size of ["display", "section", "banner", "cover", "wordmark", "auth-title"]) {
    assert.equal(
      cn(`[&_h1]:text-${size}`, "[&_h1]:text-foreground"),
      `[&_h1]:text-${size} [&_h1]:text-foreground`,
    );
  }
});

test("override de tamanho preserva a cor e substitui o tamanho personalizado", () => {
  assert.equal(
    cn("[&_h1]:text-display [&_h1]:text-foreground", "[&_h1]:text-xl"),
    "[&_h1]:text-foreground [&_h1]:text-xl",
  );
});
