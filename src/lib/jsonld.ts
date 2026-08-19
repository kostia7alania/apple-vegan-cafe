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

export interface SpecialHoursSpec {
  date: string;
  open: string | null;
  close: string | null;
}

export interface RestaurantInput {
  name: string;
  url: string;
  menuUrl: string;
  telephone: string;
  address: string;
  geo: { lat: number; lng: number } | null;
  hasMap?: string | null;
  images: string[];
  sameAs: string[];
  hours: HoursSpec[];
  specialHours?: SpecialHoursSpec[];
  /** direct ordering URL (e.g. GrabFood); emits a machine-actionable OrderAction */
  orderUrl?: string | null;
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
    // Primary type stays the single most-specific one Google consumes;
    // the cafe identity rides along via additionalType (ADR 0005).
    '@type': 'Restaurant',
    additionalType: 'https://schema.org/CafeOrCoffeeShop',
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
    ...(input.specialHours && input.specialHours.length > 0
      ? {
          specialOpeningHoursSpecification: input.specialHours.map((h) => ({
            '@type': 'OpeningHoursSpecification',
            validFrom: h.date,
            validThrough: h.date,
            opens: h.open ?? '00:00',
            closes: h.close ?? '00:00',
          })),
        }
      : {}),
  };
  if (input.geo) {
    jsonld.geo = {
      '@type': 'GeoCoordinates',
      latitude: input.geo.lat,
      longitude: input.geo.lng,
    };
  }
  if (input.hasMap) jsonld.hasMap = input.hasMap;
  if (input.images.length > 0) jsonld.image = input.images;
  if (input.sameAs.length > 0) jsonld.sameAs = input.sameAs;
  if (input.orderUrl) {
    jsonld.potentialAction = { '@type': 'OrderAction', target: input.orderUrl };
  }
  return jsonld;
}

export interface MenuSectionInput {
  name: string;
  items: {
    name: string;
    price: number;
    description?: string;
    url?: string;
    suitableForDiet?: string;
  }[];
}

/**
 * schema.org Menu markup. No documented rich result today — emitted as a
 * no-risk experiment (see plan §5); prices mirror the owner's Grab catalog.
 */
export function buildMenu(input: {
  url: string;
  locale: Locale;
  sections: MenuSectionInput[];
}): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Menu',
    url: input.url,
    inLanguage: input.locale,
    hasMenuSection: input.sections.map((section) => ({
      '@type': 'MenuSection',
      name: section.name,
      hasMenuItem: section.items.map((item) => ({
        '@type': 'MenuItem',
        name: item.name,
        ...(item.description ? { description: item.description } : {}),
        ...(item.url ? { url: item.url } : {}),
        ...(item.suitableForDiet ? { suitableForDiet: item.suitableForDiet } : {}),
        offers: { '@type': 'Offer', price: item.price, priceCurrency: 'THB' },
      })),
    })),
  };
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
  authorType: 'Person' | 'Organization';
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
    author: { '@type': input.authorType, name: input.authorName },
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
