import type { Locale, Localized } from './i18n';

/**
 * JSON-LD builders. Policy notes (Google, verified 2026-07-15):
 * - NEVER emit aggregateRating/review for our own business — the self-serving
 *   reviews rule makes such pages ineligible and risks manual actions.
 * - No FAQPage markup: Google retired FAQ rich results entirely in May 2026.
 */

export interface HoursSpec {
  days: readonly string[];
  open: string;
  close: string;
}

export interface RestaurantInput {
  name: string;
  url: string;
  menuUrl: string;
  telephone: string;
  address: string;
  geo: { lat: number; lng: number } | null;
  images: string[];
  sameAs: string[];
  hours: HoursSpec[];
}

const DAY_MAP: Record<string, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};

export function buildRestaurant(input: RestaurantInput): Record<string, unknown> {
  const jsonld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    name: input.name,
    url: input.url,
    menu: input.menuUrl,
    telephone: input.telephone,
    servesCuisine: ['Thai', 'Vegan'],
    priceRange: '฿',
    address: input.address,
    openingHoursSpecification: input.hours.map((h) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: h.days.map((d) => DAY_MAP[d] ?? d),
      opens: h.open,
      closes: h.close,
    })),
  };
  if (input.geo) {
    jsonld.geo = {
      '@type': 'GeoCoordinates',
      latitude: input.geo.lat,
      longitude: input.geo.lng,
    };
  }
  if (input.images.length > 0) jsonld.image = input.images;
  if (input.sameAs.length > 0) jsonld.sameAs = input.sameAs;
  return jsonld;
}

export interface BreadcrumbItem {
  name: string;
  url: string;
}

export function buildBreadcrumb(items: BreadcrumbItem[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export interface ArticleInput {
  title: string;
  description: string;
  url: string;
  locale: Locale;
  authorName: string;
  publishedAt: Date;
  updatedAt?: Date;
  image?: string;
}

export function buildArticle(input: ArticleInput): Record<string, unknown> {
  const jsonld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: input.title,
    description: input.description,
    url: input.url,
    inLanguage: input.locale,
    author: { '@type': 'Person', name: input.authorName },
    datePublished: input.publishedAt.toISOString(),
  };
  if (input.updatedAt) jsonld.dateModified = input.updatedAt.toISOString();
  if (input.image) jsonld.image = input.image;
  return jsonld;
}

/** Helper used by pages to pick a localized string. */
export function pick(locale: Locale, value: Localized): string {
  return value[locale];
}
