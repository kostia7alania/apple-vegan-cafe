/**
 * Generates public/_redirects (Cloudflare Workers Static Assets format)
 * from src/content/redirects.json. Runs automatically before every build.
 *
 * www/apex and defensive-domain redirects are handled at the Cloudflare zone
 * level, not here — this file only covers moved slugs within the site.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface Redirect {
  from: string;
  to: string;
  code?: number;
}

const root = resolve(import.meta.dirname, '..');
const source = resolve(root, 'src/content/redirects.json');
const target = resolve(root, 'public/_redirects');

const redirects = JSON.parse(readFileSync(source, 'utf8')) as Redirect[];

const problems: string[] = [];
const seen = new Set<string>();
for (const r of redirects) {
  if (!r.from.startsWith('/') || !r.to.startsWith('/')) {
    problems.push(`paths must be site-relative: ${r.from} -> ${r.to}`);
  }
  if (r.from === r.to) problems.push(`redirect to itself: ${r.from}`);
  if (seen.has(r.from)) problems.push(`duplicate source: ${r.from}`);
  seen.add(r.from);
}
if (problems.length > 0) {
  console.error('redirects.json is invalid:');
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

const header =
  '# GENERATED from src/content/redirects.json — do not edit by hand.\n# Run `pnpm generate:redirects` after changing the collection.\n';
const body = redirects.map((r) => `${r.from} ${r.to} ${r.code ?? 301}`).join('\n');
writeFileSync(target, body ? `${header}${body}\n` : header);
console.log(`wrote ${redirects.length} redirect(s) to public/_redirects`);
