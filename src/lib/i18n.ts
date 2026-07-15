export const LOCALES = ['en', 'th', 'ru'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  th: 'ไทย',
  ru: 'Русский',
};

/** BCP-47 → Open Graph locale values */
export const OG_LOCALES: Record<Locale, string> = {
  en: 'en_US',
  th: 'th_TH',
  ru: 'ru_RU',
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/**
 * Resolve the locale from the `[...lang]` rest param.
 * `undefined` (no prefix) means the default locale (EN at the site root).
 */
export function localeFromParam(param: string | undefined): Locale {
  if (param === undefined) return DEFAULT_LOCALE;
  if (isLocale(param)) return param;
  throw new Error(`Unknown locale param: ${param}`);
}

/** getStaticPaths helper for structural pages that exist in every locale. */
export function localeStaticPaths() {
  return LOCALES.map((locale) => ({
    params: { lang: locale === DEFAULT_LOCALE ? undefined : locale },
    props: { locale },
  }));
}

/** A value translated into every launch locale. */
export type Localized<T = string> = Record<Locale, T>;

/** A value that may be translated into a subset of locales. */
export type PartiallyLocalized<T = string> = Partial<Record<Locale, T>>;
