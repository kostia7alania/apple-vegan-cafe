import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const distDir = join(root, 'dist');
const siteOrigin = 'https://apple-vegan-cafe.com';
const lowInboundThreshold = 3;
const servicePathPattern = /^\/(?:404\.html|admin|uploads)(?:\/|$)/;

const errors: string[] = [];
const warnings: string[] = [];

interface Page {
  file: string;
  html: string;
  path: string;
  anchors: Set<string>;
}

function fail(message: string) {
  errors.push(message);
}

function warn(message: string) {
  warnings.push(message);
}

function walk(dir: string, out: string[] = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(path, out);
    } else if (entry.name.endsWith('.html')) {
      out.push(path);
    }
  }
  return out;
}

function decodePathname(pathname: string) {
  try {
    return decodeURI(pathname);
  } catch {
    return pathname;
  }
}

function routeForFile(file: string) {
  const rel = relative(distDir, file).split(sep).join('/');
  if (rel === 'index.html') return '/';
  if (rel.endsWith('/index.html')) return `/${rel.slice(0, -'index.html'.length)}`;
  return `/${rel}`;
}

function normalizeSitePath(pathname: string) {
  const decoded = decodePathname(pathname);
  if (decoded === '') return '/';
  if (decoded.endsWith('/')) return decoded;
  if (decoded.includes('.')) return decoded;
  return `${decoded}/`;
}

function isPublicPage(pathname: string) {
  return !servicePathPattern.test(pathname);
}

function parseAttrs(html: string, attr: 'href' | 'id' | 'name') {
  return [...html.matchAll(new RegExp(`\\s${attr}=(["'])(.*?)\\1`, 'g'))].map((m) => m[2] ?? '');
}

function parseInternalHref(rawHref: string) {
  if (
    rawHref === '' ||
    rawHref.startsWith('#') ||
    rawHref.startsWith('mailto:') ||
    rawHref.startsWith('tel:') ||
    rawHref.startsWith('javascript:')
  ) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(rawHref, siteOrigin);
  } catch {
    return null;
  }

  if (url.origin !== siteOrigin) return null;

  const decodedPath = decodePathname(url.pathname);
  if (/\.[a-z0-9]+$/i.test(decodedPath) && !decodedPath.endsWith('.html')) {
    return null;
  }

  return {
    path: normalizeSitePath(decodedPath),
    hash: url.hash ? decodeURIComponent(url.hash.slice(1)) : '',
  };
}

if (!existsSync(distDir)) {
  fail('dist is missing; run `pnpm build` before `pnpm audit:links`');
} else {
  const pages = walk(distDir).map<Page>((file) => {
    const html = readFileSync(file, 'utf8');
    return {
      file,
      html,
      path: routeForFile(file),
      anchors: new Set([...parseAttrs(html, 'id'), ...parseAttrs(html, 'name')]),
    };
  });

  const pageByPath = new Map(pages.map((page) => [page.path, page]));
  const inbound = new Map<string, Set<string>>();
  for (const page of pages) inbound.set(page.path, new Set());

  for (const page of pages.filter((p) => isPublicPage(p.path))) {
    for (const rawHref of parseAttrs(page.html, 'href')) {
      const href = parseInternalHref(rawHref);
      if (!href) continue;

      const target = pageByPath.get(href.path);
      if (!target) {
        fail(`${page.path}: broken internal link ${rawHref} -> ${href.path}`);
        continue;
      }

      if (href.hash && !target.anchors.has(href.hash)) {
        fail(`${page.path}: broken anchor ${rawHref} -> ${href.path}#${href.hash}`);
      }

      inbound.get(href.path)?.add(page.path);
    }
  }

  for (const page of pages.filter((p) => isPublicPage(p.path))) {
    const count = inbound.get(page.path)?.size ?? 0;
    if (count < lowInboundThreshold) {
      warn(`${page.path}: low inbound internal links (${count})`);
    }
  }
}

for (const message of warnings) console.warn(`warning: ${message}`);

if (errors.length > 0) {
  for (const message of errors) console.error(`error: ${message}`);
  process.exit(1);
}

console.log(`link audit passed${warnings.length ? ` with ${warnings.length} warning(s)` : ''}`);
