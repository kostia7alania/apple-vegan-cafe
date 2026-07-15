import { DEFAULT_LOCALE, LOCALES, type Locale, type Localized } from './i18n';

/** Ensure a leading and trailing slash (site uses trailingSlash: 'always'). */
export function normalizePath(path: string): string {
  let p = path.trim();
  if (!p.startsWith('/')) p = `/${p}`;
  if (!p.endsWith('/')) p = `${p}/`;
  return p;
}

/**
 * Build a site-relative URL for a path in a given locale.
 * The default locale (EN) lives at the root without a prefix.
 * `localePath('th', '/menu/')` → `/th/menu/`
 */
export function localePath(locale: Locale, path = '/'): string {
  const normalized = normalizePath(path);
  if (locale === DEFAULT_LOCALE) return normalized;
  return `/${locale}${normalized}`;
}

/** Absolute URL from a site-relative path. */
export function absoluteUrl(site: URL | string, path: string): string {
  return new URL(normalizePath(path), site).href;
}

/**
 * Alternate URLs for a structural page that exists in all locales
 * (same English slug everywhere): `/menu/` → { en: '/menu/', th: '/th/menu/', ru: '/ru/menu/' }
 */
export function structuralAlternates(path: string): Localized {
  return Object.fromEntries(LOCALES.map((l) => [l, localePath(l, path)])) as Localized;
}

/** Strip the locale prefix from a pathname, returning [locale, restPath]. */
export function splitLocaleFromPath(pathname: string): [Locale, string] {
  const normalized = normalizePath(pathname);
  for (const locale of LOCALES) {
    if (locale === DEFAULT_LOCALE) continue;
    if (normalized === `/${locale}/` || normalized.startsWith(`/${locale}/`)) {
      return [locale, normalized.slice(locale.length + 1) || '/'];
    }
  }
  return [DEFAULT_LOCALE, normalized];
}
