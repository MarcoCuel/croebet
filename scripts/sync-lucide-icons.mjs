// Refresh the shared allowlist after updating lucide-react in apps/web.
import { readFile, readdir, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const library = new URL("apps/web/node_modules/lucide-react/", root);
const { version } = JSON.parse(await readFile(new URL("package.json", library), "utf8"));
const license = await readFile(new URL("LICENSE", library), "utf8");
const directory = new URL("dist/esm/icons/", library);
const names = [];
const nodes = {};
for (const file of (await readdir(directory)).sort()) {
  if (!file.endsWith(".mjs")) continue;
  const source = await readFile(new URL(file, directory), "utf8");
  const name = source.match(/const __iconData = \{\s*name: "([a-z0-9-]+)"/u)?.[1];
  if (name) {
    const { __iconData } = await import(new URL(file, directory).href);
    if (__iconData.size !== 24) throw new Error(`Dimensão inesperada: ${name}`);
    names.push(name);
    nodes[name] = __iconData.node;
  }
}
if (!names.length) throw new Error("Catálogo Lucide vazio.");
const unique = [...new Set(names)].sort();
await writeFile(new URL("packages/shared/src/lucide-icon-names.ts", root),
  `// Generated from lucide-react ${version}; run node scripts/sync-lucide-icons.mjs.\nexport const lucideIconNames = ${JSON.stringify(unique, null, 2)} as const;\n`);
await writeFile(new URL("packages/shared/src/lucide-icon-nodes.ts", root),
  `// Generated from lucide-react ${version}; run node scripts/sync-lucide-icons.mjs.\n/*\n${license}*/\nimport type { IconNode } from "./icons.js";\nexport const lucideIconNodes: Record<string, IconNode> = ${JSON.stringify(nodes)};\n`);
console.log(`${unique.length} ícones Lucide sincronizados.`);
