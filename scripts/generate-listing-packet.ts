/**
 * Generates a copy-ready local-listing packet from the site's public source of truth.
 * Missing facts stay explicit so they cannot be mistaken for approved listing data.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const sourcePaths = {
  settings: 'src/content/settings.json',
  locations: 'src/content/locations.json',
  siteConfig: 'astro.config.ts',
} as const;
const targetPath = 'docs/LOCAL-LISTING-PACKET.md';
const target = resolve(root, targetPath);
const notConfirmed = 'NOT CONFIRMED — DO NOT PUBLISH';

type Locale = 'en' | 'th' | 'ru';
type Day = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

interface SettingsFile {
  site: {
    name: string;
    phone: string;
    orderingLinks: Array<{ provider: string; url: string }>;
    reviewLinks: {
      googleProfile: string | null;
      googleReview: string | null;
      happycow: string | null;
      tripadvisor: string | null;
    };
  };
}

interface LocationsFile {
  pattaya: {
    address: Record<Locale, string>;
    geo: { lat: number; lng: number } | null;
    mapsUrl: string | null;
    hours: Array<{ days: Day[]; open: string; close: string }>;
  };
}

interface Provider {
  name: string;
  listingUrl: string | null;
  directReviewUrl: string | null;
}

const dayLabels: Record<Day, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};
const dayOrder = Object.keys(dayLabels) as Day[];

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(resolve(root, path), 'utf8')) as T;
}

function present(value: string | null | undefined): string {
  const normalized = value?.replace(/\s+/g, ' ').trim();
  return normalized || notConfirmed;
}

function readSiteOrigin(): string | null {
  const source = readFileSync(resolve(root, sourcePaths.siteConfig), 'utf8');
  const match = source.match(/\bsite:\s*(['"`])([^'"`]+)\1/);
  if (!match?.[2]) return null;

  try {
    const url = new URL(match[2]);
    return url.protocol === 'https:' ? url.origin : null;
  } catch {
    return null;
  }
}

function absoluteUrl(origin: string | null, path: string): string {
  return origin ? new URL(path, `${origin}/`).href : notConfirmed;
}

function regularHours(
  hours: LocationsFile['pattaya']['hours'],
): Array<{ day: string; value: string }> {
  const byDay = new Map<Day, string>();

  for (const period of hours) {
    const value = `${period.open}–${period.close}`;
    for (const day of period.days) {
      if (byDay.has(day)) {
        throw new Error(`regular hours contain more than one period for ${day}`);
      }
      byDay.set(day, value);
    }
  }

  return dayOrder.map((day) => ({
    day: dayLabels[day],
    value: byDay.get(day) ?? notConfirmed,
  }));
}

function renderProvider(
  provider: Provider,
  facts: {
    name: string;
    phone: string;
    addresses: Record<Locale, string>;
    hours: Array<{ day: string; value: string }>;
    websiteUrl: string;
    menuUrl: string;
    orderLinks: SettingsFile['site']['orderingLinks'];
    mapsUrl: string | null;
    geo: LocationsFile['pattaya']['geo'];
  },
): string {
  const orderLines =
    facts.orderLinks.length > 0
      ? facts.orderLinks.map((link) => `  - ${present(link.provider)}: ${present(link.url)}`)
      : [`  - ${notConfirmed}`];
  const hoursLines = facts.hours.map(({ day, value }) => `  - ${day}: ${value}`);
  const coordinates = facts.geo ? `${facts.geo.lat}, ${facts.geo.lng}` : notConfirmed;

  return [
    `## ${provider.name}`,
    '',
    `- Business name: ${present(facts.name)}`,
    '- Address:',
    `  - English: ${present(facts.addresses.en)}`,
    `  - Thai: ${present(facts.addresses.th)}`,
    `  - Russian: ${present(facts.addresses.ru)}`,
    `- Phone: ${present(facts.phone)}`,
    '- Regular hours (Asia/Bangkok):',
    ...hoursLines,
    `- Website URL: ${facts.websiteUrl}`,
    `- Menu URL: ${facts.menuUrl}`,
    '- Order URLs:',
    ...orderLines,
    `- Listing/profile URL: ${present(provider.listingUrl)}`,
    `- Direct review URL: ${present(provider.directReviewUrl)}`,
    `- Confirmed Maps/pin URL: ${present(facts.mapsUrl)}`,
    `- Confirmed coordinates: ${coordinates}`,
    '',
  ].join('\n');
}

const settings = readJson<SettingsFile>(sourcePaths.settings).site;
const location = readJson<LocationsFile>(sourcePaths.locations).pattaya;
const siteOrigin = readSiteOrigin();
const facts = {
  name: settings.name,
  phone: settings.phone,
  addresses: location.address,
  hours: regularHours(location.hours),
  websiteUrl: absoluteUrl(siteOrigin, '/'),
  menuUrl: absoluteUrl(siteOrigin, '/menu/'),
  orderLinks: settings.orderingLinks,
  mapsUrl: location.mapsUrl,
  geo: location.geo,
};
const providers: Provider[] = [
  {
    name: 'Google Business Profile',
    listingUrl: settings.reviewLinks.googleProfile,
    directReviewUrl: settings.reviewLinks.googleReview,
  },
  {
    name: 'HappyCow',
    listingUrl: settings.reviewLinks.happycow,
    directReviewUrl: null,
  },
  {
    name: 'Tripadvisor',
    listingUrl: settings.reviewLinks.tripadvisor,
    directReviewUrl: null,
  },
  { name: 'Bing Places', listingUrl: null, directReviewUrl: null },
  { name: 'Apple Business Connect', listingUrl: null, directReviewUrl: null },
];

const header = [
  '# Local listing packet',
  '',
  '<!-- GENERATED FILE — run `pnpm generate:listing-packet`; do not edit by hand. -->',
  '',
  'Copy only confirmed values into external listings. Any `NOT CONFIRMED — DO NOT PUBLISH` marker must stay out of provider profiles until the owner supplies and approves that fact.',
  '',
  '## Source files',
  '',
  `- Business identity, phone, order and review links: \`${sourcePaths.settings}\``,
  `- Address, regular hours, Maps URL and coordinates: \`${sourcePaths.locations}\``,
  `- Canonical website origin: \`${sourcePaths.siteConfig}\``,
  '',
  'The packet reflects the repository source of truth; it does not prove that an external listing has been claimed or synchronized.',
  '',
].join('\n');
const packet = `${header}\n${providers.map((provider) => renderProvider(provider, facts)).join('\n')}`;

writeFileSync(target, packet);
console.log(`wrote ${providers.length} provider section(s) to ${targetPath}`);
