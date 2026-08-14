import { defineCollection, reference } from 'astro:content';
import { z } from 'astro:schema';
import { file, glob } from 'astro/loaders';

/**
 * Single source of truth for the content model.
 * i18n policy: single-file entities — translatable fields are {en,th,ru} objects;
 * non-translatable facts (price, availability, photos) exist exactly once.
 */

const localized = z.object({ en: z.string().min(1), th: z.string().min(1), ru: z.string().min(1) });
const nullableLocalized = localized.nullish().transform((value) => value ?? null);
const verifiedLocalized = z.object({
  en: z.string().trim().min(1),
  th: z.string().trim().min(1),
  ru: z.string().trim().min(1),
});
const nullableVerifiedLocalized = verifiedLocalized.nullish().transform((value) => value ?? null);
const nullableUrl = z.preprocess(
  (value) => (value === '' || value === undefined ? null : value),
  z.string().url().nullable(),
);
const nullableEmail = z.preprocess(
  (value) => (value === '' || value === undefined ? null : value),
  z.string().email().nullable(),
);
const nullableText = z.preprocess(
  (value) => (value === '' || value === undefined ? null : value),
  z.string().min(1).nullable(),
);
const uploadPath = z
  .string()
  .startsWith('/uploads/')
  .regex(/\.(?:avif|webp|jpe?g|png)$/i, 'expected a supported raster image file')
  .refine(
    (value) =>
      value.length > '/uploads/'.length &&
      !value.split('/').includes('..') &&
      !/[?#\\]/.test(value),
    'expected a safe path inside /uploads/',
  );
const nullableUploadPath = z.preprocess(
  (value) => (value === '' || value === undefined ? null : value),
  uploadPath.nullable(),
);
const nullablePositiveInteger = z.preprocess(
  (value) => (value === '' || value === undefined ? null : value),
  z.number().int().positive().nullable(),
);
const grabItemId = z.string().regex(/^THITE\d{19}$/, 'expected a Grab ItemID');
const grabCatalogueImageUrl = z
  .string()
  .url()
  .refine((value) => {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      url.hostname === 'food-cms.grab.com' &&
      url.port === '' &&
      url.username === '' &&
      url.password === '' &&
      url.search === '' &&
      url.hash === '' &&
      /\.(?:webp|jpe?g|png)$/i.test(url.pathname)
    );
  }, 'expected a public food-cms.grab.com image URL without credentials or query data');
const nullableGrabCatalogueImageUrl = z.preprocess(
  (value) => (value === '' || value === undefined ? null : value),
  grabCatalogueImageUrl.nullable(),
);
const partiallyLocalized = z.object({
  en: z.string().optional(),
  th: z.string().optional(),
  ru: z.string().optional(),
});
const localeEnum = z.enum(['en', 'th', 'ru']);

/** "HH:MM" 24h time */
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'expected HH:MM');
const nullableTime = z.preprocess(
  (value) => (value === '' || value === undefined ? null : value),
  time.nullable(),
);
const dayEnum = z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);

const calendarDateInBangkok = () => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(new Date())
      .map(({ type, value }) => [type, value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
};

const settings = defineCollection({
  loader: file('./src/content/settings.json'),
  schema: z.object({
    name: z.string(),
    nameLocalized: localized,
    tagline: localized,
    phone: z.string(),
    whatsappUrl: nullableUrl,
    lineUrl: nullableUrl,
    primaryContact: z.enum(['phone', 'line', 'whatsapp']).default('phone'),
    responseHours: nullableLocalized,
    email: nullableEmail,
    social: z.array(z.object({ platform: z.string(), url: z.string().url() })).default([]),
    orderingLinks: z
      .array(
        z.object({
          provider: z.enum(['GrabFood', 'LINE MAN']),
          url: z.string().url(),
        }),
      )
      .refine((links) => new Set(links.map(({ provider }) => provider)).size === links.length, {
        message: 'Only one ordering link is allowed per provider',
      })
      .default([]),
    reviewLinks: z.object({
      googleProfile: nullableUrl,
      googleReview: nullableUrl,
      happycow: nullableUrl,
      tripadvisor: nullableUrl,
    }),
  }),
});

const locations = defineCollection({
  loader: file('./src/content/locations.json'),
  schema: z.object({
    address: localized,
    landmark: nullableLocalized,
    parking: nullableLocalized,
    arrivalNote: nullableLocalized,
    // Filled from the owner's exact pin — do NOT guess coordinates.
    geo: z
      .object({ lat: z.number(), lng: z.number() })
      .nullish()
      .transform((value) => value ?? null),
    mapsUrl: nullableUrl,
    hours: z.array(z.object({ days: z.array(dayEnum).min(1), open: time, close: time })).min(1),
    specialHours: z
      .array(
        z
          .object({
            date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD'),
            open: nullableTime,
            close: nullableTime,
            note: z.string().optional(),
          })
          .refine((hours) => Boolean(hours.open) === Boolean(hours.close), {
            message: 'special hours require both open and close, or neither for a closed day',
          }),
      )
      .default([]),
  }),
});

const operations = defineCollection({
  loader: file('./src/content/operations.json'),
  schema: z.object({
    paymentMethods: z.array(z.enum(['cash', 'thai-qr', 'bank-transfer', 'card'])).default([]),
    paymentNote: nullableLocalized,
    pricePolicy: z.preprocess(
      (value) => (value === '' || value === undefined ? null : value),
      z
        .enum([
          'same_everywhere',
          'website_matches_counter',
          'website_matches_grab',
          'channels_differ',
        ])
        .nullable(),
    ),
    dietaryQuestionsContact: z.preprocess(
      (value) => (value === '' || value === undefined ? null : value),
      z.enum(['phone', 'line', 'whatsapp']).nullable(),
    ),
    // Base dish heat belongs to foodFacts. This separate, owner-verified policy
    // describes which heat requests the kitchen can actually accept.
    spiceRequests: z.preprocess(
      (value) => (value === '' || value === undefined ? null : value),
      z
        .object({
          status: z.enum(['not-offered', 'offered']),
          levels: z
            .array(z.enum(['not-spicy', 'mild', 'medium', 'hot']))
            .default([])
            .refine((levels) => new Set(levels).size === levels.length, {
              message: 'spice request levels must be unique',
            }),
          scopeNote: nullableVerifiedLocalized,
          verifiedBy: z.string().trim().min(1),
          verifiedAt: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD')
            .refine((value) => {
              const date = new Date(`${value}T00:00:00Z`);
              return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
            }, 'expected a real calendar date')
            .refine(
              (value) => value <= calendarDateInBangkok(),
              'verification date must not be in the future',
            ),
        })
        .superRefine((policy, ctx) => {
          if (policy.status === 'offered') {
            if (policy.levels.length === 0) {
              ctx.addIssue({
                code: 'custom',
                path: ['levels'],
                message: 'an offered spice-request policy requires at least one level',
              });
            }
            if (!policy.scopeNote) {
              ctx.addIssue({
                code: 'custom',
                path: ['scopeNote'],
                message: 'an offered spice-request policy must state which dishes it covers',
              });
            }
          } else {
            if (policy.levels.length > 0) {
              ctx.addIssue({
                code: 'custom',
                path: ['levels'],
                message: 'a not-offered spice-request policy cannot list request levels',
              });
            }
            if (policy.scopeNote) {
              ctx.addIssue({
                code: 'custom',
                path: ['scopeNote'],
                message: 'scopeNote belongs only to an offered spice-request policy',
              });
            }
          }
        })
        .nullable(),
    ),
    // null keeps the public FAQ neutral. A verified object is atomic: certification,
    // cooking-alcohol guidance, localized context and verification metadata travel together.
    halalGuidance: z.preprocess(
      (value) => (value === '' || value === undefined ? null : value),
      z
        .object({
          certificationStatus: z.enum(['not-certified', 'certified']),
          certificationDetail: nullableVerifiedLocalized,
          cookingAlcohol: z.enum(['used', 'not-used']),
          note: verifiedLocalized,
          verifiedBy: z.string().trim().min(1),
          verifiedAt: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD')
            .refine((value) => {
              const date = new Date(`${value}T00:00:00Z`);
              return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
            }, 'expected a real calendar date')
            .refine(
              (value) => value <= calendarDateInBangkok(),
              'verification date must not be in the future',
            ),
        })
        .superRefine((guidance, ctx) => {
          if (guidance.certificationStatus === 'certified' && !guidance.certificationDetail) {
            ctx.addIssue({
              code: 'custom',
              path: ['certificationDetail'],
              message: 'certified status requires localized issuer/scope/reference details',
            });
          }
          if (guidance.certificationStatus === 'not-certified' && guidance.certificationDetail) {
            ctx.addIssue({
              code: 'custom',
              path: ['certificationDetail'],
              message: 'certificationDetail belongs only to certified status',
            });
          }
        })
        .nullable(),
    ),
    // null = unknown; enabled=false = owner explicitly confirmed no pickup.
    pickup: z
      .object({
        enabled: z.boolean(),
        contact: z.preprocess(
          (value) => (value === '' || value === undefined ? null : value),
          z.enum(['phone', 'line', 'whatsapp']).nullable(),
        ),
        leadTime: nullableLocalized,
        priceNote: nullableLocalized,
      })
      .superRefine((pickup, ctx) => {
        if (pickup.enabled) {
          if (!pickup.contact) {
            ctx.addIssue({
              code: 'custom',
              path: ['contact'],
              message: 'available pickup requires an ordering contact',
            });
          }
          return;
        }
        for (const field of ['contact', 'leadTime', 'priceNote'] as const) {
          if (pickup[field] !== null) {
            ctx.addIssue({
              code: 'custom',
              path: [field],
              message: `${field} must be empty when pickup is not available`,
            });
          }
        }
      })
      .nullish()
      .transform((value) => value ?? null),
    // null = unknown; an explicit not-accepted policy is still useful to guests.
    reservations: z.preprocess(
      (value) => (value === '' || value === undefined ? null : value),
      z
        .object({
          status: z.enum(['not-accepted', 'accepted', 'large-groups-only']),
          contact: z.preprocess(
            (value) => (value === '' || value === undefined ? null : value),
            z.enum(['phone', 'line', 'whatsapp']).nullable(),
          ),
          minimumPartySize: z.preprocess(
            (value) => (value === '' || value === undefined ? null : value),
            z.number().int().min(2).nullable(),
          ),
          leadTime: nullableLocalized,
          note: nullableLocalized,
        })
        .superRefine((reservation, ctx) => {
          if (reservation.status === 'not-accepted') {
            for (const field of ['contact', 'minimumPartySize', 'leadTime'] as const) {
              if (reservation[field] !== null) {
                ctx.addIssue({
                  code: 'custom',
                  path: [field],
                  message: `${field} must be empty when reservations are not accepted`,
                });
              }
            }
            return;
          }
          if (!reservation.contact) {
            ctx.addIssue({
              code: 'custom',
              path: ['contact'],
              message: 'accepted reservations require a contact channel',
            });
          }
          if (!reservation.leadTime) {
            ctx.addIssue({
              code: 'custom',
              path: ['leadTime'],
              message: 'accepted reservations require a lead time',
            });
          }
          if (reservation.status === 'large-groups-only' && !reservation.minimumPartySize) {
            ctx.addIssue({
              code: 'custom',
              path: ['minimumPartySize'],
              message: 'large-groups-only reservations require a minimum party size',
            });
          }
          if (reservation.status === 'accepted' && reservation.minimumPartySize !== null) {
            ctx.addIssue({
              code: 'custom',
              path: ['minimumPartySize'],
              message: 'minimum party size belongs only to large-groups-only reservations',
            });
          }
        })
        .nullable(),
    ),
  }),
});

const approvedMediaAsset = z
  .object({
    src: uploadPath,
    srcSmall: nullableUploadPath,
    srcLarge: nullableUploadPath,
    srcSmallWidth: nullablePositiveInteger.default(null),
    srcLargeWidth: nullablePositiveInteger.default(null),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    origin: z.enum(['owner-original', 'licensed']),
    rightsHolder: z.string().min(1),
    // Anything added here is copied to public/uploads and therefore deployable.
    // Pending/denied assets must stay outside public content records.
    permission: z.literal('granted'),
    permissionScope: z.literal('website-and-derivatives'),
    confirmedBy: z.string().min(1),
    confirmedAt: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD')
      .refine((value) => {
        const date = new Date(`${value}T00:00:00Z`);
        return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
      }, 'expected a real calendar date')
      .refine(
        (value) => value <= calendarDateInBangkok(),
        'confirmation date must not be in the future',
      ),
    peopleVisibility: z.enum(['none-confirmed', 'recognisable-present']),
    peopleConsent: z.enum(['not-applicable', 'granted']).default('not-applicable'),
    credit: nullableText,
  })
  .superRefine((asset, ctx) => {
    if (asset.peopleVisibility === 'recognisable-present' && asset.peopleConsent !== 'granted') {
      ctx.addIssue({
        code: 'custom',
        path: ['peopleConsent'],
        message: 'recognisable people require granted consent',
      });
    }
    if (asset.peopleVisibility === 'none-confirmed' && asset.peopleConsent !== 'not-applicable') {
      ctx.addIssue({
        code: 'custom',
        path: ['peopleConsent'],
        message: 'use not-applicable when no recognisable people are visible',
      });
    }
    if (asset.origin === 'licensed' && !asset.credit) {
      ctx.addIssue({
        code: 'custom',
        path: ['credit'],
        message: 'licensed media requires a public credit',
      });
    }
    if (Boolean(asset.srcSmall) !== Boolean(asset.srcSmallWidth)) {
      ctx.addIssue({
        code: 'custom',
        path: ['srcSmallWidth'],
        message: 'srcSmall and srcSmallWidth must be provided together',
      });
    }
    if (Boolean(asset.srcLarge) !== Boolean(asset.srcLargeWidth)) {
      ctx.addIssue({
        code: 'custom',
        path: ['srcLargeWidth'],
        message: 'srcLarge and srcLargeWidth must be provided together',
      });
    }
  });

const grabCatalogueMediaAsset = z
  .object({
    src: grabCatalogueImageUrl,
    srcSmall: nullableGrabCatalogueImageUrl.default(null),
    srcLarge: nullableGrabCatalogueImageUrl.default(null),
    srcSmallWidth: nullablePositiveInteger.default(null),
    srcLargeWidth: nullablePositiveInteger.default(null),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    origin: z.literal('grab-merchant-catalogue'),
    grabItemId,
    capturedAt: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD')
      .refine((value) => {
        const date = new Date(`${value}T00:00:00Z`);
        return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
      }, 'expected a real calendar date')
      .refine(
        (value) => value <= calendarDateInBangkok(),
        'capture date must not be in the future',
      ),
    credit: z.null().default(null),
  })
  .superRefine((asset, ctx) => {
    const sources = [
      { field: 'src', url: asset.src, width: asset.width },
      { field: 'srcSmall', url: asset.srcSmall, width: asset.srcSmallWidth },
      { field: 'srcLarge', url: asset.srcLarge, width: asset.srcLargeWidth },
    ] as const;
    for (const source of sources) {
      if (Boolean(source.url) !== Boolean(source.width)) {
        ctx.addIssue({
          code: 'custom',
          path: [source.field === 'src' ? 'width' : `${source.field}Width`],
          message: `${source.field} and its width must be provided together`,
        });
      }
      if (!source.url) continue;
      const pathItemId = new URL(source.url).pathname.match(/THITE\d{19}/)?.[0];
      if (pathItemId !== asset.grabItemId) {
        ctx.addIssue({
          code: 'custom',
          path: [source.field],
          message: 'Grab image URL ItemID must match grabItemId',
        });
      }
    }
    const widths = sources.flatMap((source) => (source.width ? [source.width] : []));
    if (
      new Set(widths).size !== widths.length ||
      widths.some((width, index) => index > 0 && width <= widths[index - 1]!)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['srcLargeWidth'],
        message: 'responsive candidate widths must be unique and strictly increasing',
      });
    }
  });

const dishMediaAsset = z.union([approvedMediaAsset, grabCatalogueMediaAsset]);

const mediaAsset = z.intersection(
  approvedMediaAsset,
  z.object({
    kind: z.enum(['hero', 'exterior', 'family', 'interior']),
    alt: localized,
  }),
);

const siteMedia = defineCollection({
  loader: file('./src/content/site-media.json'),
  schema: z
    .object({ assets: z.array(mediaAsset).default([]) })
    .refine(
      (value) => new Set(value.assets.map((asset) => asset.kind)).size === value.assets.length,
      {
        message: 'only one asset per media kind is allowed',
      },
    ),
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

const foodFacts = z
  .object({
    spicyLevel: z.preprocess(
      (value) => (value === '' || value === undefined ? null : value),
      z.number().int().min(0).max(3).nullable(),
    ),
    allergens: z.object({
      status: z.enum(['unknown', 'verified']),
      contains: z.array(reference('allergens')).default([]),
    }),
    noGlutenIngredients: z.enum(['unknown', 'yes', 'no']),
    jainFriendly: z.enum(['unknown', 'yes', 'no']),
    verifiedBy: nullableText,
    verifiedAt: z.preprocess(
      (value) => (value === '' || value === undefined ? null : value),
      z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD')
        .refine((value) => {
          const date = new Date(`${value}T00:00:00Z`);
          return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
        }, 'expected a real calendar date')
        .refine(
          (value) => value <= calendarDateInBangkok(),
          'verification date must not be in the future',
        )
        .nullable(),
    ),
  })
  .superRefine((facts, ctx) => {
    if (facts.allergens.status === 'unknown' && facts.allergens.contains.length > 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['allergens', 'contains'],
        message: 'unknown allergen status cannot contain verified allergens',
      });
    }
    const hasVerifiedFact =
      facts.spicyLevel !== null ||
      facts.allergens.status === 'verified' ||
      facts.noGlutenIngredients !== 'unknown' ||
      facts.jainFriendly !== 'unknown';
    if (hasVerifiedFact && (!facts.verifiedBy || !facts.verifiedAt)) {
      ctx.addIssue({
        code: 'custom',
        path: ['verifiedBy'],
        message: 'verified food facts require verifiedBy and verifiedAt',
      });
    }
    if (!hasVerifiedFact && (facts.verifiedBy || facts.verifiedAt)) {
      ctx.addIssue({
        code: 'custom',
        path: ['verifiedBy'],
        message: 'verification metadata requires at least one verified food fact',
      });
    }
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
    images: z.array(dishMediaAsset).default([]),
    grabDietaryPreference: z.enum(['vegan', 'vegetarian']).nullable().default(null),
    dietaryTags: z
      .array(z.enum(['vegan', 'jay']))
      .length(2)
      .default(['vegan', 'jay'])
      .refine((tags) => tags.includes('vegan') && tags.includes('jay'), {
        message: 'restaurant-wide dish tags must contain vegan and jay',
      }),
    foodFacts,
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
  schema: z.object({
    name: z.string(),
    type: z.enum(['Person', 'Organization']),
    bio: partiallyLocalized.optional(),
  }),
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
  operations,
  siteMedia,
  categories,
  allergens,
  dishes,
  articles,
  pages,
  authors,
  faqs,
  redirects,
};
