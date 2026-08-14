/**
 * Content sanity checks that go beyond the Zod schemas (which `astro build`
 * already enforces): cross-entity rules — slug uniqueness, category existence,
 * category/dish anchor safety, article translation-set reciprocity, redirect safety.
 * Runs in CI before the build.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { parse as parseYaml } from 'yaml';

const LOCALES = ['en', 'th', 'ru'] as const;
type Locale = (typeof LOCALES)[number];

const root = resolve(import.meta.dirname, '..');
const contentDir = resolve(root, 'src/content');
const publicDir = resolve(root, 'public');
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

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function calendarDateInBangkok(date = new Date()): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(date)
      .map(({ type, value }) => [type, value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
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
  lineMan: ['lineman.line.me', 'lineman.onelink.me', 'wongnai.com', 'www.wongnai.com'],
  googleMaps: ['maps.app.goo.gl', 'google.com', 'www.google.com'],
  googleProfile: ['maps.app.goo.gl', 'g.page', 'google.com', 'www.google.com'],
  googleReview: ['g.page', 'search.google.com', 'google.com', 'www.google.com'],
  happycow: ['happycow.net', 'www.happycow.net'],
  instagram: ['instagram.com', 'www.instagram.com'],
  tripadvisor: ['tripadvisor.com', 'www.tripadvisor.com'],
  whatsapp: ['wa.me', 'api.whatsapp.com'],
  line: ['line.me', 'lin.ee'],
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
  switch (provider) {
    case 'GrabFood':
      return allowedExternalHosts.grab;
    case 'LINE MAN':
      return allowedExternalHosts.lineMan;
    default:
      return undefined;
  }
}

function validateOrderingUrl(label: string, provider: string, value: string | undefined) {
  const hosts = allowedOrderingHosts(provider);
  if (!hosts) {
    fail(`${label}: unsupported provider "${provider}"`);
    return;
  }
  if (!hasText(value)) {
    fail(`${label}.url: missing URL`);
    return;
  }

  validateExternalUrl(`${label}.url`, value, hosts);

  if (provider !== 'LINE MAN') return;
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    if (
      (hostname === 'wongnai.com' || hostname === 'www.wongnai.com') &&
      !/\/delivery\/.+\/order\/?$/.test(url.pathname)
    ) {
      fail(`${label}.url: Wongnai LINE MAN links must use a /delivery/.../order path`);
    }
  } catch {
    // The shared URL validator reports malformed absolute URLs.
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
  dietaryTags?: string[];
  foodFacts?: {
    spicyLevel?: number | null;
    allergens?: { status?: string; contains?: string[] };
    noGlutenIngredients?: string;
    jainFriendly?: string;
    verifiedBy?: string | null;
    verifiedAt?: string | null;
  };
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
  if (
    dish.dietaryTags?.length !== 2 ||
    !dish.dietaryTags.includes('vegan') ||
    !dish.dietaryTags.includes('jay')
  ) {
    fail(`${label}: dietaryTags must contain only the restaurant-wide vegan and jay claims`);
  }

  const facts = dish.foodFacts;
  if (!facts) {
    fail(`${label}: missing fail-closed foodFacts`);
  } else {
    const spicyLevel = facts.spicyLevel;
    if (
      spicyLevel !== null &&
      !(
        typeof spicyLevel === 'number' &&
        Number.isInteger(spicyLevel) &&
        spicyLevel >= 0 &&
        spicyLevel <= 3
      )
    ) {
      fail(`${label}: foodFacts.spicyLevel must be null or an integer from 0 to 3`);
    }
    const allergenStatus = facts.allergens?.status;
    const contains = facts.allergens?.contains ?? [];
    if (!['unknown', 'verified'].includes(allergenStatus ?? '')) {
      fail(`${label}: foodFacts.allergens.status must be unknown or verified`);
    }
    if (allergenStatus === 'unknown' && contains.length > 0) {
      fail(`${label}: unknown allergen status cannot list contains values`);
    }
    for (const allergen of contains) {
      if (!allergenIds.has(allergen)) fail(`${label}: unknown allergen "${allergen}"`);
    }
    if (!['unknown', 'yes', 'no'].includes(facts.noGlutenIngredients ?? '')) {
      fail(`${label}: foodFacts.noGlutenIngredients must be unknown, yes or no`);
    }
    if (!['unknown', 'yes', 'no'].includes(facts.jainFriendly ?? '')) {
      fail(`${label}: foodFacts.jainFriendly must be unknown, yes or no`);
    }

    const hasVerifiedFact =
      spicyLevel !== null ||
      allergenStatus === 'verified' ||
      facts.noGlutenIngredients !== 'unknown' ||
      facts.jainFriendly !== 'unknown';
    if (hasVerifiedFact && (!hasText(facts.verifiedBy) || !hasText(facts.verifiedAt))) {
      fail(`${label}: verified food facts require verifiedBy and verifiedAt`);
    }
    if (!hasVerifiedFact && (hasText(facts.verifiedBy) || hasText(facts.verifiedAt))) {
      fail(`${label}: verification metadata requires at least one verified food fact`);
    }
    if (hasText(facts.verifiedAt)) {
      const verifiedAt = new Date(`${facts.verifiedAt}T00:00:00.000Z`);
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(facts.verifiedAt) ||
        Number.isNaN(verifiedAt.valueOf()) ||
        verifiedAt.toISOString().slice(0, 10) !== facts.verifiedAt
      ) {
        fail(`${label}: foodFacts.verifiedAt must be a real YYYY-MM-DD date`);
      } else if (facts.verifiedAt > calendarDateInBangkok()) {
        fail(`${label}: foodFacts.verifiedAt must not be in the future`);
      }
    }
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
    whatsappUrl?: string | null;
    lineUrl?: string | null;
    primaryContact?: 'phone' | 'line' | 'whatsapp';
    social?: { platform?: string; url?: string }[];
    orderingLinks?: { provider?: 'GrabFood' | 'LINE MAN'; url?: string }[];
    reviewLinks?: {
      googleProfile?: string | null;
      googleReview?: string | null;
      happycow?: string | null;
      tripadvisor?: string | null;
    };
  };
}
const settings = JSON.parse(readFileSync(join(contentDir, 'settings.json'), 'utf8')) as Settings;

validateExternalUrl(
  'settings.json site.whatsappUrl',
  settings.site?.whatsappUrl,
  allowedExternalHosts.whatsapp,
);
validateExternalUrl(
  'settings.json site.lineUrl',
  settings.site?.lineUrl,
  allowedExternalHosts.line,
);
if (settings.site?.primaryContact === 'line' && !settings.site.lineUrl) {
  fail('settings.json site.primaryContact is line but site.lineUrl is empty');
}
if (settings.site?.primaryContact === 'whatsapp' && !settings.site.whatsappUrl) {
  fail('settings.json site.primaryContact is whatsapp but site.whatsappUrl is empty');
}

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

const orderingProvidersSeen = new Set<string>();
for (const [index, link] of (settings.site?.orderingLinks ?? []).entries()) {
  const label = `settings.json site.orderingLinks[${index}]`;
  if (!link.provider) {
    fail(`${label}: missing provider`);
    continue;
  }
  if (orderingProvidersSeen.has(link.provider)) {
    fail(`${label}: duplicate provider "${link.provider}"`);
  }
  orderingProvidersSeen.add(link.provider);
  validateOrderingUrl(label, link.provider, link.url);
}

validateExternalUrl(
  'settings.json site.reviewLinks.googleProfile',
  settings.site?.reviewLinks?.googleProfile,
  allowedExternalHosts.googleProfile,
);
validateExternalUrl(
  'settings.json site.reviewLinks.googleReview',
  settings.site?.reviewLinks?.googleReview,
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

interface Operations {
  [id: string]: {
    pricePolicy?:
      | 'same_everywhere'
      | 'website_matches_counter'
      | 'website_matches_grab'
      | 'channels_differ'
      | null;
    dietaryQuestionsContact?: 'phone' | 'line' | 'whatsapp' | null;
    halalGuidance?: {
      certificationStatus?: 'not-certified' | 'certified';
      certificationDetail?: Partial<Record<Locale, string>> | null;
      cookingAlcohol?: 'used' | 'not-used';
      note?: Partial<Record<Locale, string>>;
      verifiedBy?: string;
      verifiedAt?: string;
    } | null;
    pickup?: {
      enabled?: boolean;
      contact?: 'phone' | 'line' | 'whatsapp' | null;
      leadTime?: Partial<Record<Locale, string>> | null;
      priceNote?: Partial<Record<Locale, string>> | null;
    } | null;
    reservations?: {
      status?: 'not-accepted' | 'accepted' | 'large-groups-only';
      contact?: 'phone' | 'line' | 'whatsapp' | null;
    } | null;
  };
}
const operations = JSON.parse(
  readFileSync(join(contentDir, 'operations.json'), 'utf8'),
) as Operations;
for (const [id, operation] of Object.entries(operations)) {
  const hasGrab =
    settings.site?.orderingLinks?.some((link) => link.provider === 'GrabFood') ?? false;
  if (operation.pricePolicy === 'website_matches_grab' && !hasGrab) {
    fail(`operations.json ${id}.pricePolicy website_matches_grab requires a Grab ordering link`);
  }
  if (operation.dietaryQuestionsContact === 'line' && !settings.site?.lineUrl) {
    fail(`operations.json ${id}.dietaryQuestionsContact requires site.lineUrl`);
  }
  if (operation.dietaryQuestionsContact === 'whatsapp' && !settings.site?.whatsappUrl) {
    fail(`operations.json ${id}.dietaryQuestionsContact requires site.whatsappUrl`);
  }
  const halalGuidance = operation.halalGuidance;
  if (halalGuidance) {
    const label = `operations.json ${id}.halalGuidance`;
    if (!['not-certified', 'certified'].includes(halalGuidance.certificationStatus ?? '')) {
      fail(`${label}.certificationStatus must be not-certified or certified`);
    }
    if (!['used', 'not-used'].includes(halalGuidance.cookingAlcohol ?? '')) {
      fail(`${label}.cookingAlcohol must be used or not-used`);
    }
    for (const locale of LOCALES) {
      if (!hasText(halalGuidance.note?.[locale])) {
        fail(`${label}.note.${locale} is required`);
      }
    }
    if (halalGuidance.certificationStatus === 'certified') {
      for (const locale of LOCALES) {
        if (!hasText(halalGuidance.certificationDetail?.[locale])) {
          fail(`${label}.certificationDetail.${locale} is required when certified`);
        }
      }
    } else if (halalGuidance.certificationDetail != null) {
      fail(`${label}.certificationDetail belongs only to certified status`);
    }
    if (!hasText(halalGuidance.verifiedBy)) {
      fail(`${label}.verifiedBy is required`);
    }
    if (!halalGuidance.verifiedAt || !/^\d{4}-\d{2}-\d{2}$/.test(halalGuidance.verifiedAt)) {
      fail(`${label}.verifiedAt must be a YYYY-MM-DD date`);
    } else {
      const verifiedAt = new Date(`${halalGuidance.verifiedAt}T00:00:00.000Z`);
      if (
        Number.isNaN(verifiedAt.valueOf()) ||
        verifiedAt.toISOString().slice(0, 10) !== halalGuidance.verifiedAt
      ) {
        fail(`${label}.verifiedAt must be a real calendar date`);
      } else if (halalGuidance.verifiedAt > calendarDateInBangkok()) {
        fail(`${label}.verifiedAt must not be in the future in Bangkok`);
      }
    }
  }
  const pickupValue = operation.pickup as unknown;
  if (pickupValue !== null && pickupValue !== undefined) {
    const label = `operations.json ${id}.pickup`;
    if (typeof pickupValue !== 'object' || Array.isArray(pickupValue)) {
      fail(`${label} must be an object or null`);
    } else {
      const pickup = pickupValue as Record<string, unknown>;
      const enabled = pickup.enabled;
      const contact = pickup.contact === '' || pickup.contact === undefined ? null : pickup.contact;
      if (typeof enabled !== 'boolean') {
        fail(`${label}.enabled must be a boolean`);
      }
      if (contact !== null && !['phone', 'line', 'whatsapp'].includes(String(contact))) {
        fail(`${label}.contact must be phone, line, whatsapp or null`);
      }
      for (const field of ['leadTime', 'priceNote'] as const) {
        const value = pickup[field];
        if (value === null || value === undefined) continue;
        if (typeof value !== 'object' || Array.isArray(value)) {
          fail(`${label}.${field} must be a complete EN/TH/RU object or null`);
          continue;
        }
        const localizedValue = value as Record<string, unknown>;
        for (const locale of LOCALES) {
          if (!hasText(localizedValue[locale])) {
            fail(`${label}.${field}.${locale} is required when ${field} is provided`);
          }
        }
      }
      if (enabled === true) {
        if (contact === null) {
          fail(`${label} enabled pickup requires a contact`);
        } else if (contact === 'line' && !settings.site?.lineUrl) {
          fail(`${label} requires site.lineUrl`);
        } else if (contact === 'whatsapp' && !settings.site?.whatsappUrl) {
          fail(`${label} requires site.whatsappUrl`);
        }
      } else if (enabled === false) {
        if (contact !== null) {
          fail(`${label} disabled pickup must not have a contact`);
        }
        if (pickup.leadTime !== null && pickup.leadTime !== undefined) {
          fail(`${label} disabled pickup must not have leadTime`);
        }
        if (pickup.priceNote !== null && pickup.priceNote !== undefined) {
          fail(`${label} disabled pickup must not have priceNote`);
        }
      }
    }
  }
  if (operation.reservations && operation.reservations.status !== 'not-accepted') {
    if (operation.reservations.contact === 'line' && !settings.site?.lineUrl) {
      fail(`operations.json ${id}.reservations requires site.lineUrl`);
    }
    if (operation.reservations.contact === 'whatsapp' && !settings.site?.whatsappUrl) {
      fail(`operations.json ${id}.reservations requires site.whatsappUrl`);
    }
  }
}

// --- approved public media -------------------------------------------------
interface ApprovedMediaAsset {
  src?: string;
  srcSmall?: string | null;
  srcLarge?: string | null;
  srcSmallWidth?: number | null;
  srcLargeWidth?: number | null;
  width?: number;
  height?: number;
  origin?: string;
  rightsHolder?: string;
  permission?: string;
  permissionScope?: string;
  confirmedBy?: string;
  confirmedAt?: string;
  peopleVisibility?: string;
  peopleConsent?: string;
  credit?: string | null;
  grabItemId?: string;
  capturedAt?: string;
}
interface SiteMediaAsset extends ApprovedMediaAsset {
  kind?: string;
  alt?: Partial<Record<Locale, string>>;
}
interface SiteMedia {
  site?: { assets?: SiteMediaAsset[] };
}
const siteMedia = JSON.parse(
  readFileSync(join(contentDir, 'site-media.json'), 'utf8'),
) as SiteMedia;
const grabItemMap = JSON.parse(
  readFileSync(join(root, 'scripts/data/grab-item-map.json'), 'utf8'),
) as { items?: Record<string, string> };
const mediaKinds = new Set<string>();
const approvedMediaKinds = new Set(['hero', 'exterior', 'family', 'interior']);
const mediaPathPattern = /^\/uploads\/[A-Za-z0-9][A-Za-z0-9._/-]*\.(?:avif|webp|jpe?g|png)$/i;
const referencedMediaPaths = new Set<string>();

function validateApprovedMedia(
  label: string,
  asset: ApprovedMediaAsset,
  allowedOrigins: readonly string[],
) {
  for (const [field, path] of [
    ['src', asset.src],
    ['srcSmall', asset.srcSmall],
    ['srcLarge', asset.srcLarge],
  ] as const) {
    if (path === null || path === undefined || path === '') continue;
    if (!mediaPathPattern.test(path) || path.split('/').includes('..') || /[?#\\]/.test(path)) {
      fail(`${label}.${field} must be a safe supported image path inside /uploads/`);
      continue;
    }
    if (!existsSync(join(publicDir, path))) {
      fail(`${label}.${field} points to a missing public file: ${path}`);
    }
    referencedMediaPaths.add(path);
  }

  if (!asset.src) fail(`${label}.src is required`);
  if (!allowedOrigins.includes(asset.origin ?? '')) {
    fail(`${label}.origin must be ${allowedOrigins.join(' or ')}`);
  }
  if (!hasText(asset.rightsHolder)) fail(`${label}.rightsHolder is required`);
  if (asset.permission !== 'granted') {
    fail(`${label}.permission must be granted before a file enters public/uploads`);
  }
  if (asset.permissionScope !== 'website-and-derivatives') {
    fail(`${label}.permissionScope must cover website-and-derivatives`);
  }
  if (!hasText(asset.confirmedBy)) fail(`${label}.confirmedBy is required`);

  if (!asset.confirmedAt || !/^\d{4}-\d{2}-\d{2}$/.test(asset.confirmedAt)) {
    fail(`${label}.confirmedAt must be a YYYY-MM-DD date`);
  } else {
    const confirmedAt = new Date(`${asset.confirmedAt}T00:00:00.000Z`);
    if (
      Number.isNaN(confirmedAt.valueOf()) ||
      confirmedAt.toISOString().slice(0, 10) !== asset.confirmedAt
    ) {
      fail(`${label}.confirmedAt must be a real calendar date`);
    } else if (asset.confirmedAt > calendarDateInBangkok()) {
      fail(`${label}.confirmedAt must not be in the future`);
    }
  }

  if (!['none-confirmed', 'recognisable-present'].includes(asset.peopleVisibility ?? '')) {
    fail(`${label}.peopleVisibility must be explicitly reviewed`);
  }
  const expectedPeopleConsent =
    asset.peopleVisibility === 'recognisable-present' ? 'granted' : 'not-applicable';
  if (asset.peopleConsent !== expectedPeopleConsent) {
    fail(`${label}.peopleConsent must be ${expectedPeopleConsent}`);
  }
  if (asset.origin === 'licensed' && !hasText(asset.credit)) {
    fail(`${label}.credit is required for licensed media`);
  }
  if (Boolean(asset.srcSmall) !== Boolean(asset.srcSmallWidth)) {
    fail(`${label}.srcSmall and srcSmallWidth must be provided together`);
  }
  if (Boolean(asset.srcLarge) !== Boolean(asset.srcLargeWidth)) {
    fail(`${label}.srcLarge and srcLargeWidth must be provided together`);
  }
}

function grabItemIdFromMediaUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (
      url.protocol !== 'https:' ||
      url.hostname !== 'food-cms.grab.com' ||
      url.port ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !/\.(?:webp|jpe?g|png)$/i.test(url.pathname)
    ) {
      return null;
    }
    return url.pathname.match(/THITE\d{19}/)?.[0] ?? null;
  } catch {
    return null;
  }
}

function validateGrabCatalogueMedia(label: string, asset: ApprovedMediaAsset, dishFile: string) {
  if (!asset.grabItemId || !/^THITE\d{19}$/.test(asset.grabItemId)) {
    fail(`${label}.grabItemId must be an exact Grab ItemID`);
    return;
  }
  if (grabItemMap.items?.[asset.grabItemId] !== dishFile) {
    fail(`${label}.grabItemId must map to ${dishFile} in grab-item-map.json`);
  }
  if (!Number.isInteger(asset.width) || (asset.width ?? 0) <= 0) {
    fail(`${label}.width must be a positive integer`);
  }
  if (!Number.isInteger(asset.height) || (asset.height ?? 0) <= 0) {
    fail(`${label}.height must be a positive integer`);
  }

  const sources = [
    { field: 'src', url: asset.src, width: asset.width },
    { field: 'srcSmall', url: asset.srcSmall, width: asset.srcSmallWidth },
    { field: 'srcLarge', url: asset.srcLarge, width: asset.srcLargeWidth },
  ] as const;
  const widths: number[] = [];
  for (const source of sources) {
    if (Boolean(source.url) !== Boolean(source.width)) {
      fail(`${label}.${source.field} and its width must be provided together`);
      continue;
    }
    if (!source.url || !source.width) continue;
    if (grabItemIdFromMediaUrl(source.url) !== asset.grabItemId) {
      fail(`${label}.${source.field} must be a public Grab CDN URL for ${asset.grabItemId}`);
    }
    if (!Number.isInteger(source.width) || source.width <= 0) {
      fail(`${label}.${source.field} width must be a positive integer`);
    }
    widths.push(source.width);
  }
  if (
    new Set(widths).size !== widths.length ||
    widths.some((width, index) => index > 0 && width <= widths[index - 1]!)
  ) {
    fail(`${label} responsive candidate widths must be unique and strictly increasing`);
  }
  if (!asset.capturedAt || !/^\d{4}-\d{2}-\d{2}$/.test(asset.capturedAt)) {
    fail(`${label}.capturedAt must be a YYYY-MM-DD date`);
  } else {
    const capturedAt = new Date(`${asset.capturedAt}T00:00:00.000Z`);
    if (
      Number.isNaN(capturedAt.valueOf()) ||
      capturedAt.toISOString().slice(0, 10) !== asset.capturedAt ||
      asset.capturedAt > calendarDateInBangkok()
    ) {
      fail(`${label}.capturedAt must be a real non-future date`);
    }
  }
  if (asset.credit !== null && asset.credit !== undefined) {
    fail(`${label}.credit must stay null for Grab catalogue images`);
  }
}

for (const [index, asset] of (siteMedia.site?.assets ?? []).entries()) {
  const label = `site-media.json site.assets[${index}]`;
  if (!asset.kind || !approvedMediaKinds.has(asset.kind)) {
    fail(`${label}.kind must be hero, exterior, family or interior`);
  } else if (mediaKinds.has(asset.kind)) {
    fail(`${label}.kind duplicates the ${asset.kind} slot`);
  } else {
    mediaKinds.add(asset.kind);
  }

  for (const locale of LOCALES) {
    if (!hasText(asset.alt?.[locale])) fail(`${label}.alt.${locale} is required`);
  }
  validateApprovedMedia(label, asset, ['owner-original', 'licensed']);
}

for (const fileName of readdirSync(dishesDir).filter((file) => file.endsWith('.json'))) {
  const dish = JSON.parse(readFileSync(join(dishesDir, fileName), 'utf8')) as {
    images?: ApprovedMediaAsset[];
  };
  for (const [index, image] of (dish.images ?? []).entries()) {
    const label = `dishes/${fileName}.images[${index}]`;
    if (image.origin === 'grab-merchant-catalogue') {
      validateGrabCatalogueMedia(label, image, fileName);
    } else {
      validateApprovedMedia(label, image, ['owner-original', 'licensed']);
    }
  }
}

function listUploadFiles(directory: string, relative = ''): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const childRelative = relative ? `${relative}/${entry.name}` : entry.name;
    const childPath = join(directory, entry.name);
    return entry.isDirectory() ? listUploadFiles(childPath, childRelative) : [childRelative];
  });
}

for (const relativePath of listUploadFiles(join(publicDir, 'uploads'))) {
  if (relativePath === '.gitkeep') continue;
  const publicPath = `/uploads/${relativePath}`;
  if (!referencedMediaPaths.has(publicPath)) {
    fail(
      `public/uploads/${relativePath}: orphan upload is not referenced by approved site or dish media`,
    );
  }
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

const todayBangkok = new Date(`${calendarDateInBangkok()}T00:00:00.000Z`);

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
    if (publishedAt && publishedAt > todayBangkok) {
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
const pageLocalesByKey = new Map<string, Set<Locale>>();
for (const fileName of readdirSync(pagesDir).filter((f) => f.endsWith('.md'))) {
  const label = `pages/${fileName}`;
  const fm = readFrontmatter(join(pagesDir, fileName));

  if (!hasText(fm.translationKey)) {
    fail(`${label}: missing frontmatter field "translationKey"`);
  }
  if (!hasText(fm.locale)) {
    fail(`${label}: missing frontmatter field "locale"`);
  } else if (!isLocale(fm.locale)) {
    fail(`${label}: locale "${fm.locale}" must be one of ${LOCALES.join(', ')}`);
  } else if (!fileName.endsWith(`-${fm.locale}.md`)) {
    fail(`${label}: filename must end with "-${fm.locale}.md"`);
  }
  if (!hasText(fm.title)) {
    fail(`${label}: missing frontmatter field "title"`);
  }
  if (!hasText(fm.description)) {
    fail(`${label}: missing frontmatter field "description"`);
  }

  if (hasText(fm.translationKey) && hasText(fm.locale) && isLocale(fm.locale)) {
    const key = `${fm.translationKey}:${fm.locale}`;
    if (pageKeySeen.has(key)) fail(`${label}: duplicate page for ${key}`);
    pageKeySeen.add(key);

    const locales = pageLocalesByKey.get(fm.translationKey) ?? new Set<Locale>();
    locales.add(fm.locale);
    pageLocalesByKey.set(fm.translationKey, locales);
  }
}

for (const [translationKey, locales] of pageLocalesByKey.entries()) {
  for (const locale of LOCALES) {
    if (!locales.has(locale)) {
      fail(`pages translationKey "${translationKey}": missing ${locale} version`);
    }
  }
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
