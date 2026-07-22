/**
 * Content sanity checks that go beyond the Zod schemas (which `astro build`
 * already enforces): cross-entity rules — slug uniqueness, category existence,
 * category/dish anchor safety, article translation-set reciprocity, redirect safety.
 * Runs in CI before the build.
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

function isSafeRouteSegment(slug: string): boolean {
  return (
    slug.trim() === slug &&
    slug.length > 0 &&
    slug !== '.' &&
    slug !== '..' &&
    !/[/?#%\s]/.test(slug)
  );
}

function validateExternalUrl(
  label: string,
  value: string | null | undefined,
  allowedHosts: readonly string[],
) {
  if (value === null || value === undefined) return;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    fail(`${label}: must be a valid absolute URL`);
    return;
  }

  if (url.protocol !== 'https:') {
    fail(`${label}: must use https`);
  }
  if (url.username || url.password) {
    fail(`${label}: must not include embedded credentials`);
  }
  if (!allowedHosts.includes(url.hostname.toLowerCase())) {
    fail(`${label}: unexpected host "${url.hostname}"`);
  }
}

const allowedExternalHosts = {
  grab: ['r.grab.com', 'grab.com', 'food.grab.com', 'www.grab.com'],
  googleMaps: ['maps.app.goo.gl', 'google.com', 'www.google.com'],
  googleReview: ['g.page', 'search.google.com', 'google.com', 'www.google.com'],
  happycow: ['happycow.net', 'www.happycow.net'],
  instagram: ['instagram.com', 'www.instagram.com'],
  tripadvisor: ['tripadvisor.com', 'www.tripadvisor.com'],
} as const;

function allowedSocialHosts(platform: string): readonly string[] | undefined {
  switch (platform.toLowerCase()) {
    case 'instagram':
      return allowedExternalHosts.instagram;
    default:
      return undefined;
  }
}

function allowedOrderingHosts(provider: string): readonly string[] | undefined {
  switch (provider.toLowerCase()) {
    case 'grabfood':
    case 'grab':
      return allowedExternalHosts.grab;
    default:
      return undefined;
  }
}

// --- categories ---------------------------------------------------------
const categories = JSON.parse(readFileSync(join(contentDir, 'categories.json'), 'utf8')) as {
  id: string;
  slug: Partial<Record<Locale, string>>;
}[];
const categoryIds = new Set(categories.map((c) => c.id));
if (categoryIds.size !== categories.length) fail('categories.json: duplicate ids');
const categorySlugSeen: Record<Locale, Map<string, string>> = {
  en: new Map(),
  th: new Map(),
  ru: new Map(),
};
for (const [index, category] of categories.entries()) {
  const label = `categories.json[${index}]`;
  for (const locale of LOCALES) {
    const slug = category.slug?.[locale];
    if (!slug) {
      fail(`${label}: missing slug.${locale}`);
      continue;
    }
    if (!isSafeAnchorSlug(slug)) {
      fail(`${label}: slug.${locale} must be a safe anchor slug without /, ?, # or spaces`);
    }
    const previous = categorySlugSeen[locale].get(slug);
    if (previous) fail(`${label}: slug.${locale} "${slug}" already used by ${previous}`);
    categorySlugSeen[locale].set(slug, label);
  }
}

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
    const categoryOwner = categorySlugSeen[locale].get(slug);
    if (categoryOwner) {
      fail(`${label}: slug.${locale} "${slug}" conflicts with category anchor in ${categoryOwner}`);
    }
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

// --- settings + locations --------------------------------------------------
interface Settings {
  site?: {
    social?: { platform?: string; url?: string }[];
    orderingLinks?: { provider?: string; url?: string }[];
    reviewLinks?: {
      google?: string | null;
      happycow?: string | null;
      tripadvisor?: string | null;
    };
  };
}
const settings = JSON.parse(readFileSync(join(contentDir, 'settings.json'), 'utf8')) as Settings;

for (const [index, link] of (settings.site?.social ?? []).entries()) {
  const label = `settings.json site.social[${index}]`;
  if (!link.platform) {
    fail(`${label}: missing platform`);
    continue;
  }
  const hosts = allowedSocialHosts(link.platform);
  if (!hosts) {
    fail(`${label}: unsupported platform "${link.platform}"`);
    continue;
  }
  validateExternalUrl(`${label}.url`, link.url, hosts);
}

for (const [index, link] of (settings.site?.orderingLinks ?? []).entries()) {
  const label = `settings.json site.orderingLinks[${index}]`;
  if (!link.provider) {
    fail(`${label}: missing provider`);
    continue;
  }
  const hosts = allowedOrderingHosts(link.provider);
  if (!hosts) {
    fail(`${label}: unsupported provider "${link.provider}"`);
    continue;
  }
  validateExternalUrl(`${label}.url`, link.url, hosts);
}

validateExternalUrl(
  'settings.json site.reviewLinks.google',
  settings.site?.reviewLinks?.google,
  allowedExternalHosts.googleReview,
);
validateExternalUrl(
  'settings.json site.reviewLinks.happycow',
  settings.site?.reviewLinks?.happycow,
  allowedExternalHosts.happycow,
);
validateExternalUrl(
  'settings.json site.reviewLinks.tripadvisor',
  settings.site?.reviewLinks?.tripadvisor,
  allowedExternalHosts.tripadvisor,
);

interface Locations {
  [id: string]: {
    geo?: { lat?: number; lng?: number } | null;
    mapsUrl?: string | null;
  };
}
const locations = JSON.parse(readFileSync(join(contentDir, 'locations.json'), 'utf8')) as Locations;
for (const [id, location] of Object.entries(locations)) {
  const label = `locations.json ${id}`;
  if (location.geo) {
    const { lat, lng } = location.geo;
    if (typeof lat !== 'number' || !Number.isFinite(lat)) {
      fail(`${label}.geo.lat must be a finite number`);
    } else if (lat < -90 || lat > 90) {
      fail(`${label}.geo.lat must be between -90 and 90`);
    }

    if (typeof lng !== 'number' || !Number.isFinite(lng)) {
      fail(`${label}.geo.lng must be a finite number`);
    } else if (lng < -180 || lng > 180) {
      fail(`${label}.geo.lng must be between -180 and 180`);
    }

    if (lat === 0 && lng === 0) {
      fail(`${label}.geo must not use the 0,0 placeholder`);
    }
  }
  validateExternalUrl(`${label}.mapsUrl`, location.mapsUrl, allowedExternalHosts.googleMaps);
}

// --- articles: frontmatter + translation sets ------------------------------
interface ArticleFrontmatter {
  translationKey?: string;
  locale?: string;
  title?: string;
  description?: string;
  slug?: string;
  publishedAt?: unknown;
  updatedAt?: unknown;
  draft?: boolean;
}
function readFrontmatter(path: string): ArticleFrontmatter {
  const raw = readFileSync(path, 'utf8');
  const match = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  return parseYaml(match[1] as string) as ArticleFrontmatter;
}

function parseArticleDate(label: string, field: 'publishedAt' | 'updatedAt', value: unknown) {
  if (value === undefined || value === null || value === '') {
    fail(`${label}: missing frontmatter field "${field}"`);
    return null;
  }
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    fail(`${label}: ${field} must be a YYYY-MM-DD date`);
    return null;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    fail(`${label}: ${field} must be a real calendar date`);
    return null;
  }

  return parsed;
}

const today = new Date();
const todayUtc = new Date(
  Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
);

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
    const publishedAt = parseArticleDate(label, 'publishedAt', fm.publishedAt);
    const updatedAt =
      fm.updatedAt === undefined ? null : parseArticleDate(label, 'updatedAt', fm.updatedAt);
    if (publishedAt && publishedAt > todayUtc) {
      fail(`${label}: publishedAt must not be in the future`);
    }
    if (publishedAt && updatedAt && updatedAt < publishedAt) {
      fail(`${label}: updatedAt must not be earlier than publishedAt`);
    }
    if (fm.locale && fm.locale !== locale) {
      fail(`${label}: frontmatter locale "${fm.locale}" does not match folder "${locale}"`);
    }
    if (fm.slug) {
      if (!isSafeRouteSegment(fm.slug)) {
        fail(
          `${label}: slug must be a safe URL segment without /, ?, #, %, spaces or dot segments`,
        );
      }
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
