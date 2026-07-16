import { defineCollection, reference } from 'astro:content';
import { z } from 'astro:schema';
import { file, glob } from 'astro/loaders';

/**
 * Single source of truth for the content model.
 * i18n policy: single-file entities — translatable fields are {en,th,ru} objects;
 * non-translatable facts (price, availability, photos) exist exactly once.
 */

const localized = z.object({ en: z.string().min(1), th: z.string().min(1), ru: z.string().min(1) });
const partiallyLocalized = z.object({
  en: z.string().optional(),
  th: z.string().optional(),
  ru: z.string().optional(),
});
const localeEnum = z.enum(['en', 'th', 'ru']);

/** "HH:MM" 24h time */
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'expected HH:MM');
const dayEnum = z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);

const settings = defineCollection({
  loader: file('./src/content/settings.json'),
  schema: z.object({
    name: z.string(),
    nameLocalized: localized,
    tagline: localized,
    phone: z.string(),
    whatsapp: z.string().url().nullable(),
    lineId: z.string().nullable(),
    email: z.string().email().nullable(),
    social: z.array(z.object({ platform: z.string(), url: z.string().url() })).default([]),
    orderingLinks: z.array(z.object({ provider: z.string(), url: z.string().url() })).default([]),
    reviewLinks: z.object({
      google: z.string().url().nullable(),
      happycow: z.string().url().nullable(),
      tripadvisor: z.string().url().nullable(),
    }),
  }),
});

const locations = defineCollection({
  loader: file('./src/content/locations.json'),
  schema: z.object({
    address: localized,
    // Filled from the owner's exact pin — do NOT guess coordinates.
    geo: z.object({ lat: z.number(), lng: z.number() }).nullable(),
    mapsUrl: z.string().url().nullable(),
    hours: z.array(z.object({ days: z.array(dayEnum).min(1), open: time, close: time })),
    specialHours: z
      .array(
        z.object({
          date: z.string(),
          open: time.nullable(),
          close: time.nullable(),
          note: z.string().optional(),
        }),
      )
      .default([]),
  }),
});

const categories = defineCollection({
  loader: file('./src/content/categories.json'),
  schema: z.object({
    order: z.number().int(),
    name: localized,
    slug: localized,
  }),
});

const allergens = defineCollection({
  loader: file('./src/content/allergens.json'),
  schema: z.object({ name: localized }),
});

const dishes = defineCollection({
  // one JSON file per dish; the filename is the stable entity id.
  // generateId is required: the default glob behavior would use the `slug`
  // data property as the id, and dish slugs are localized OBJECTS — every
  // dish would collapse into a single "[object Object]" entry.
  loader: glob({
    pattern: '*.json',
    base: './src/content/dishes',
    generateId: ({ entry }) => entry.replace(/\.json$/, ''),
  }),
  schema: z.object({
    category: reference('categories'),
    price_thb: z.number().positive(),
    name: localized,
    description: partiallyLocalized.optional(),
    slug: localized,
    previousSlugs: z.array(z.string()).default([]),
    images: z.array(z.string()).default([]),
    dietaryTags: z
      .array(z.enum(['vegan', 'jay', 'gluten-free', 'raw', 'nut-free']))
      .default(['vegan']),
    allergens: z.array(reference('allergens')).default([]),
    spicyLevel: z.number().int().min(0).max(3).default(0),
    available: z.boolean().default(true),
    featured: z.boolean().default(false),
    source: z.enum(['grab_export', 'owner', 'retyped']),
    reviewedAt: z.coerce.date().nullable().default(null),
  }),
});

const articles = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/articles' }),
  schema: z.object({
    translationKey: z.string(),
    locale: localeEnum,
    title: z.string(),
    description: z.string(),
    slug: z.string(),
    author: reference('authors'),
    publishedAt: z.coerce.date(),
    updatedAt: z.coerce.date().optional(),
    draft: z.boolean().default(false),
    seo: z
      .object({
        title: z.string().optional(),
        description: z.string().optional(),
        ogImage: z.string().optional(),
      })
      .optional(),
  }),
});

const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/pages' }),
  schema: z.object({
    translationKey: z.string(),
    locale: localeEnum,
    title: z.string(),
    description: z.string(),
  }),
});

const authors = defineCollection({
  loader: file('./src/content/authors.json'),
  schema: z.object({ name: z.string(), bio: partiallyLocalized.optional() }),
});

const faqs = defineCollection({
  loader: file('./src/content/faqs.json'),
  schema: z.object({
    topic: z.string(),
    order: z.number().int().default(0),
    question: localized,
    answer: localized,
  }),
});

const redirects = defineCollection({
  loader: file('./src/content/redirects.json'),
  schema: z.object({
    from: z.string().startsWith('/'),
    to: z.string().startsWith('/'),
    code: z.literal(301).default(301),
  }),
});

export const collections = {
  settings,
  locations,
  categories,
  allergens,
  dishes,
  articles,
  pages,
  authors,
  faqs,
  redirects,
};
