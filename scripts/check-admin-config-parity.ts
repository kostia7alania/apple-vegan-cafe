import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

/**
 * The owner's Thai-first admin (/admin) and the developer's English admin
 * (/admin/en) must stay structurally identical — only presentation strings
 * (label, label_singular, hint, summary) may differ. Catches the drift where
 * a field is added to one config and forgotten in the other. Key order must
 * match too (both files are authored in the same order; the diff below points
 * at the first divergence).
 */
const PRESENTATION_KEYS = new Set(['label', 'label_singular', 'hint', 'summary']);

function stripPresentation(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(stripPresentation);
  if (node && typeof node === 'object') {
    return Object.fromEntries(
      Object.entries(node as Record<string, unknown>)
        .filter(([key]) => !PRESENTATION_KEYS.has(key))
        .map(([key, value]) => [key, stripPresentation(value)]),
    );
  }
  return node;
}

const [thai, english] = ['public/admin/config.yml', 'public/admin/en/config.yml'].map((path) =>
  JSON.stringify(stripPresentation(parse(readFileSync(path, 'utf8'))), null, 2),
);

if (thai !== english) {
  const thaiLines = thai!.split('\n');
  const englishLines = english!.split('\n');
  const max = Math.max(thaiLines.length, englishLines.length);
  for (let i = 0; i < max; i += 1) {
    if (thaiLines[i] !== englishLines[i]) {
      console.error(`Admin config parity FAILED — first structural difference (line ${i + 1}):`);
      console.error(`  /admin:    ${thaiLines[i] ?? '<missing>'}`);
      console.error(`  /admin/en: ${englishLines[i] ?? '<missing>'}`);
      process.exit(1);
    }
  }
  process.exit(1);
}
console.log(`Admin config parity OK (/admin ↔ /admin/en)`);
