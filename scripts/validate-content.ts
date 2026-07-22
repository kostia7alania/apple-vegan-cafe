/**
 * Content sanity checks that go beyond the Zod schemas (which `astro build`
 * already enforces): cross-entity rules — slug uniqueness, category existence,
 * article translation-set reciprocity, redirect safety. Runs in CI before the build.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { parse as parseYaml } from 'yaml';

const LOCALES = ['en', 'th', 'ru'] as const;
type Locale = (typeof LOCALES)[number];

const root = resolve(import.meta.dirname, '..');
const contentDir = resolve(root, 'src/content');
const errors: string[] = [];
const servicePathPattern = /^\/(?:admin|uploads)(?:\/|$)/;

function fail(message: string) {
  errors.push(message);
}

function isSafeSitePath(path: string): boolean {
  return path.startsWith('/') && !path.startsWith('//') && !/[?#]/.test(path);
}

function isSafeAnchorSlug(slug: string): boolean {
  return slug.trim() === slug && slug.length > 0 && !/[/?#\s]/.test(slug);
}

// --- categories ---------------------------------------------------------
const categories = JSON.parse(readFileSync(join(contentDir, 'categories.json'), 'utf8')) as {
  id: string;
}[];
const categoryIds = new Set(categories.map((c) => c.id));
if (categoryIds.size !== categories.length) fail('categories.json: duplicate ids');

// --- allergens -----------------------------------------------------------
const allergens = JSON.parse(readFileSync(join(contentDir, 'allergens.json'), 'utf8')) as {
  id: string;
}[];
const allergenIds = new Set(allergens.map((a) => a.id));

// --- dishes ---------------------------------------------------------------
interface Dish {
  category: string;
  price_thb: number;
  name: Partial<Record<Locale, string>>;
  slug: Partial<Record<Locale, string>>;
  previousSlugs?: string[];
  allergens?: string[];
}
const dishesDir = join(contentDir, 'dishes');
const slugSeen: Record<Locale, Map<string, string>> = {
  en: new Map(),
  th: new Map(),
  ru: new Map(),
};
const previousSlugSeen = new Map<string, string>();
for (const fileName of readdirSync(dishesDir).filter((f) => f.endsWith('.json'))) {
  const dish = JSON.parse(readFileSync(join(dishesDir, fileName), 'utf8')) as Dish;
  const label = `dishes/${fileName}`;

  if (!(typeof dish.price_thb === 'number' && dish.price_thb > 0)) {
    fail(`${label}: price_thb must be a number > 0`);
  }
  if (!categoryIds.has(dish.category)) {
    fail(`${label}: unknown category "${dish.category}"`);
  }
  for (const allergen of dish.allergens ?? []) {
    if (!allergenIds.has(allergen)) fail(`${label}: unknown allergen "${allergen}"`);
  }
  for (const locale of LOCALES) {
    if (!dish.name[locale]) fail(`${label}: missing name.${locale}`);
    const slug = dish.slug?.[locale];
    if (!slug) {
      fail(`${label}: missing slug.${locale}`);
      continue;
    }
    if (!isSafeAnchorSlug(slug)) {
      fail(`${label}: slug.${locale} must be a safe anchor slug without /, ?, # or spaces`);
    }
    const previous = slugSeen[locale].get(slug);
    if (previous) fail(`${label}: slug.${locale} "${slug}" already used by ${previous}`);
    slugSeen[locale].set(slug, fileName);
  }
}

for (const fileName of readdirSync(dishesDir).filter((f) => f.endsWith('.json'))) {
  const dish = JSON.parse(readFileSync(join(dishesDir, fileName), 'utf8')) as Dish;
  const label = `dishes/${fileName}`;

  for (const previousSlug of dish.previousSlugs ?? []) {
    if (!isSafeAnchorSlug(previousSlug)) {
      fail(`${label}: previousSlugs "${previousSlug}" must be a safe anchor slug`);
      continue;
    }
    const liveSlugOwner = LOCALES.map((locale) => slugSeen[locale].get(previousSlug)).find(Boolean);
    if (liveSlugOwner) {
      fail(
        `${label}: previousSlugs "${previousSlug}" conflicts with live slug in ${liveSlugOwner}`,
      );
    }
    const duplicateOwner = previousSlugSeen.get(previousSlug);
    if (duplicateOwner) {
      fail(`${label}: previousSlugs "${previousSlug}" already used by ${duplicateOwner}`);
    }
    previousSlugSeen.set(previousSlug, fileName);
  }
}

// --- articles: frontmatter + translation sets ------------------------------
interface ArticleFrontmatter {
  translationKey?: string;
  locale?: string;
  title?: string;
  description?: string;
  slug?: string;
  draft?: boolean;
}
function readFrontmatter(path: string): ArticleFrontmatter {
  const raw = readFileSync(path, 'utf8');
  const match = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  return parseYaml(match[1] as string) as ArticleFrontmatter;
}

const articlesDir = join(contentDir, 'articles');
const byKey = new Map<string, Map<string, string>>(); // translationKey -> locale -> file
const articleSlugSeen = new Map<string, string>(); // `${locale}:${slug}` -> file
for (const locale of LOCALES) {
  const dir = join(articlesDir, locale);
  for (const fileName of readdirSync(dir).filter((f) => f.endsWith('.md'))) {
    const label = `articles/${locale}/${fileName}`;
    const fm = readFrontmatter(join(dir, fileName));
    for (const field of ['translationKey', 'locale', 'title', 'description', 'slug'] as const) {
      if (!fm[field]) fail(`${label}: missing frontmatter field "${field}"`);
    }
    if (fm.locale && fm.locale !== locale) {
      fail(`${label}: frontmatter locale "${fm.locale}" does not match folder "${locale}"`);
    }
    if (fm.slug) {
      const key = `${locale}:${fm.slug}`;
      const previous = articleSlugSeen.get(key);
      if (previous) fail(`${label}: slug "${fm.slug}" already used by ${previous}`);
      articleSlugSeen.set(key, label);
    }
    if (fm.translationKey) {
      const locales = byKey.get(fm.translationKey) ?? new Map<string, string>();
      const previous = locales.get(locale);
      if (previous) {
        fail(
          `${label}: translationKey "${fm.translationKey}" already has a ${locale} version (${previous})`,
        );
      }
      locales.set(locale, label);
      byKey.set(fm.translationKey, locales);
    }
  }
}

// --- pages ------------------------------------------------------------------
const pagesDir = join(contentDir, 'pages');
const pageKeySeen = new Set<string>();
for (const fileName of readdirSync(pagesDir).filter((f) => f.endsWith('.md'))) {
  const label = `pages/${fileName}`;
  const fm = readFrontmatter(join(pagesDir, fileName));
  if (!fm.translationKey || !fm.locale) {
    fail(`${label}: missing translationKey/locale`);
    continue;
  }
  const key = `${fm.translationKey}:${fm.locale}`;
  if (pageKeySeen.has(key)) fail(`${label}: duplicate page for ${key}`);
  pageKeySeen.add(key);
}

// --- redirects --------------------------------------------------------------
interface Redirect {
  from?: string;
  to?: string;
  code?: number;
}
const redirectStatusCodes = new Set([301, 302, 307, 308]);
const redirects = JSON.parse(
  readFileSync(join(contentDir, 'redirects.json'), 'utf8'),
) as Redirect[];
const redirectSources = new Set<string>();
for (const [index, redirect] of redirects.entries()) {
  const label = `redirects.json[${index}]`;
  const { from, to, code = 301 } = redirect;

  if (!from) fail(`${label}: missing from`);
  if (!to) fail(`${label}: missing to`);

  if (from && !isSafeSitePath(from)) {
    fail(`${label}: from must be a site-relative path without query/hash: ${from}`);
  }
  if (to && !isSafeSitePath(to)) {
    fail(`${label}: to must be a site-relative path without query/hash: ${to}`);
  }
  if (from && servicePathPattern.test(from)) {
    fail(`${label}: from must not target a service path: ${from}`);
  }
  if (to && servicePathPattern.test(to)) {
    fail(`${label}: to must not target a service path: ${to}`);
  }
  if (from && to && from === to) fail(`${label}: redirects to itself: ${from}`);
  if (!redirectStatusCodes.has(code)) {
    fail(`${label}: code must be one of ${[...redirectStatusCodes].join(', ')}`);
  }
  if (from) {
    if (redirectSources.has(from)) fail(`${label}: duplicate source: ${from}`);
    redirectSources.add(from);
  }
}

// --- result -------------------------------------------------------------------
if (errors.length > 0) {
  console.error(`content validation FAILED (${errors.length} problem(s)):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log('content validation passed');
