import type { CollectionEntry } from 'astro:content';
import type { Locale } from './i18n';

type DishData = CollectionEntry<'dishes'>['data'];
type DishDescription = DishData['description'];
type DishDescriptionInput = Pick<DishData, 'description' | 'reviewedAt'>;

// Names and prices come from the owner's Grab export and stay public. Editorial
// descriptions need a separate owner review before they can influence guests or search.
export function getPublicDishDescription(dish: DishDescriptionInput): DishDescription;
export function getPublicDishDescription(
  dish: DishDescriptionInput,
  locale: Locale,
): string | undefined;
export function getPublicDishDescription(dish: DishDescriptionInput, locale?: Locale) {
  if (!dish.reviewedAt) return undefined;
  return locale ? dish.description?.[locale] : dish.description;
}
