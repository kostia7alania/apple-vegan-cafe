import type { Locale } from './i18n';
import { t } from './ui';

export type OrderingProvider = 'GrabFood' | 'LINE MAN';

export function orderingCtaLabel(locale: Locale, provider: OrderingProvider): string {
  return t(locale, 'ordering.orderOn').replace('{provider}', provider);
}

export function orderingAnalyticsProvider(provider: OrderingProvider): string {
  return provider === 'GrabFood' ? 'grabfood' : 'line_man';
}
