import { readFileSync, readdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { parse as parseYaml } from 'yaml';

const locales = [
  { prefix: '', hreflang: 'en', heading: 'Vegan Restaurant in Pattaya' },
  { prefix: '/th', hreflang: 'th', heading: 'ร้านอาหารเจ' },
  { prefix: '/ru', hreflang: 'ru', heading: 'Веганское кафе в Паттайе' },
];

const SITE_ORIGIN = 'https://apple-vegan-cafe.com';
const DISHES_DIR = 'src/content/dishes';
const ARTICLES_DIR = 'src/content/articles';
const availableDishCount = readdirSync(DISHES_DIR)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(`${DISHES_DIR}/${f}`, 'utf8')) as { available: boolean })
  .filter((d) => d.available).length;
const allowedSchemaTypes = new Set(['Article', 'BreadcrumbList', 'Menu', 'Restaurant']);

interface ArticleFrontmatter {
  locale: string;
  slug: string;
  draft?: boolean;
}

function absolute(path: string): string {
  return new URL(path, SITE_ORIGIN).href;
}

function readArticleFrontmatter(path: string): ArticleFrontmatter {
  const raw = readFileSync(path, 'utf8');
  const match = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!match) throw new Error(`${path} is missing frontmatter`);
  return parseYaml(match[1] as string) as ArticleFrontmatter;
}

function articlePath(locale: string, slug: string): string {
  return `${locale === 'en' ? '' : `/${locale}`}/blog/${slug}/`;
}

const allArticleFrontmatter = locales.flatMap(({ hreflang }) =>
  readdirSync(`${ARTICLES_DIR}/${hreflang}`)
    .filter((f) => f.endsWith('.md'))
    .map((fileName) => readArticleFrontmatter(`${ARTICLES_DIR}/${hreflang}/${fileName}`)),
);
const publishedArticlePaths = allArticleFrontmatter
  .filter((article) => !article.draft)
  .map((article) => articlePath(article.locale, article.slug));
const draftArticlePaths = allArticleFrontmatter
  .filter((article) => article.draft)
  .map((article) => articlePath(article.locale, article.slug));
const articleIndexPaths = locales.map(({ prefix }) => `${prefix}/blog/`);

function blogIndexPath(article: ArticleFrontmatter): string {
  return `${article.locale === 'en' ? '' : `/${article.locale}`}/blog/`;
}

const publishedArticlePathsByIndex = new Map<string, string[]>(
  articleIndexPaths.map((path) => [path, []]),
);
for (const article of allArticleFrontmatter.filter((article) => !article.draft)) {
  publishedArticlePathsByIndex
    .get(blogIndexPath(article))
    ?.push(articlePath(article.locale, article.slug));
}

type ExpectedAlternates = Record<string, string>;
type JsonLdObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonLdObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function containsKey(value: unknown, key: string): boolean {
  if (Array.isArray(value)) return value.some((item) => containsKey(item, key));
  if (!isObject(value)) return false;
  return key in value || Object.values(value).some((item) => containsKey(item, key));
}

function schemaType(schema: JsonLdObject): string {
  const type = schema['@type'];
  if (typeof type !== 'string') throw new Error(`Invalid JSON-LD @type: ${String(type)}`);
  return type;
}

function expectAbsoluteUrl(value: unknown, label: string) {
  expect(typeof value, label).toBe('string');
  expect(value as string, label).toMatch(/^https:\/\//);
}

async function parseJsonLd(page: Page, path: string): Promise<JsonLdObject[]> {
  await page.goto(path);
  const blocks = await page
    .locator('script[type="application/ld+json"]')
    .evaluateAll((els) => els.map((el) => el.textContent ?? ''));

  return blocks.map((block, index) => {
    const parsed = JSON.parse(block) as unknown;
    if (!isObject(parsed)) throw new Error(`${path} JSON-LD block ${index + 1} is not an object`);
    return parsed;
  });
}

async function expectHeadSeoLinks(
  page: Page,
  path: string,
  expectedAlternates: ExpectedAlternates,
) {
  await page.goto(path);

  await expect(page.locator('head link[rel="canonical"]'), `${path} canonical`).toHaveAttribute(
    'href',
    absolute(path),
  );

  const actualAlternates = await page.locator('head link[rel="alternate"]').evaluateAll((els) =>
    els
      .map((el) => ({
        hreflang: el.getAttribute('hreflang') ?? '',
        href: (el as HTMLLinkElement).href,
      }))
      .sort((a, b) => a.hreflang.localeCompare(b.hreflang)),
  );

  const expected = Object.entries(expectedAlternates)
    .map(([hreflang, href]) => ({ hreflang, href: absolute(href) }))
    .sort((a, b) => a.hreflang.localeCompare(b.hreflang));

  expect(actualAlternates, `${path} hreflang links`).toEqual(expected);
  expect(
    new Set(actualAlternates.map((entry) => entry.hreflang)).size,
    `${path} hreflang values must be unique`,
  ).toBe(actualAlternates.length);
}

async function parseSitemapLocs(page: Page, xml: string): Promise<string[]> {
  return page.evaluate((source) => {
    const doc = new DOMParser().parseFromString(source, 'application/xml');
    const parseError = doc.querySelector('parsererror');
    if (parseError) throw new Error(parseError.textContent ?? 'Invalid sitemap XML');
    return Array.from(doc.querySelectorAll('url > loc'), (loc) => loc.textContent ?? '');
  }, xml);
}

for (const { prefix, hreflang, heading } of locales) {
  test(`home renders in ${hreflang}`, async ({ page }) => {
    await page.goto(`${prefix}/`);
    await expect(page.locator('h1')).toContainText(heading);
    await expect(page.locator(`html[lang="${hreflang}"]`)).toHaveCount(1);
  });

  test(`menu shows dishes with prices in ${hreflang}`, async ({ page }) => {
    await page.goto(`${prefix}/menu/`);
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('main').getByText(/฿\d+/).first()).toBeVisible();
  });
}

test('hreflang set is reciprocal and includes x-default', async ({ page }) => {
  await page.goto('/');
  const links = page.locator('head link[rel="alternate"]');
  const hreflangs = await links.evaluateAll((els) => els.map((el) => el.getAttribute('hreflang')));
  expect(hreflangs.sort()).toEqual(['en', 'ru', 'th', 'x-default']);
  const xDefault = page.locator('head link[hreflang="x-default"]');
  await expect(xDefault).toHaveAttribute('href', 'https://apple-vegan-cafe.com/');
});

test('language switcher links to translated pages', async ({ page }) => {
  await page.goto('/menu/');
  const thLink = page.locator('header a[hreflang="th"]');
  await expect(thLink).toHaveAttribute('href', '/th/menu/');
  const ruLink = page.locator('header a[hreflang="ru"]');
  await expect(ruLink).toHaveAttribute('href', '/ru/menu/');
});

test('language toggle opens without JS and navigates', async ({ page }) => {
  await page.goto('/menu/');
  const thLink = page.locator('header a[hreflang="th"]');
  await expect(thLink).toBeHidden(); // collapsed <details>
  await page.locator('header details summary').click();
  await expect(thLink).toBeVisible();
  await thLink.click();
  await expect(page).toHaveURL('/th/menu/');
  await expect(page.locator('html[lang="th"]')).toHaveCount(1);
});

test('language switcher never disappears: untranslated pages fall back to locale home', async ({
  page,
}) => {
  await page.goto('/pure-veg-jain-friendly/');
  await expect(page.locator('header a[hreflang="th"]')).toHaveAttribute('href', '/th/');
  await expect(page.locator('header a[hreflang="ru"]')).toHaveAttribute('href', '/ru/');
  // translated landing: RU twin exists, switcher links straight to it
  await page.goto('/vegan-breakfast-pattaya/');
  await expect(page.locator('header a[hreflang="ru"]')).toHaveAttribute(
    'href',
    '/ru/veganskiy-zavtrak-v-pattaye/',
  );
  // partially translated article: RU twin exists, TH falls back to home
  await page.goto('/blog/how-to-order-vegan-food-in-thailand/');
  await expect(page.locator('header a[hreflang="ru"]')).toHaveAttribute(
    'href',
    '/ru/blog/kak-zakazat-veganskuyu-edu-v-tailande/',
  );
  await expect(page.locator('header a[hreflang="th"]')).toHaveAttribute('href', '/th/');
});

test('canonical and head hreflang stay coherent across page types', async ({ page }) => {
  const structuralPaths = ['/', '/menu/', '/about/', '/blog/', '/faq/', '/contact/'];

  for (const path of structuralPaths) {
    await expectHeadSeoLinks(page, path, {
      en: path,
      th: `/th${path}`,
      ru: `/ru${path}`,
      'x-default': path,
    });
    await expectHeadSeoLinks(page, `/th${path}`, {
      en: path,
      th: `/th${path}`,
      ru: `/ru${path}`,
      'x-default': path,
    });
    await expectHeadSeoLinks(page, `/ru${path}`, {
      en: path,
      th: `/th${path}`,
      ru: `/ru${path}`,
      'x-default': path,
    });
  }

  const localizedPageGroups: { path: string; alternates: ExpectedAlternates }[] = [
    {
      path: '/vegan-breakfast-pattaya/',
      alternates: {
        en: '/vegan-breakfast-pattaya/',
        ru: '/ru/veganskiy-zavtrak-v-pattaye/',
        'x-default': '/vegan-breakfast-pattaya/',
      },
    },
    {
      path: '/ru/veganskiy-zavtrak-v-pattaye/',
      alternates: {
        en: '/vegan-breakfast-pattaya/',
        ru: '/ru/veganskiy-zavtrak-v-pattaye/',
        'x-default': '/vegan-breakfast-pattaya/',
      },
    },
    {
      path: '/vegan-delivery-pattaya/',
      alternates: {
        en: '/vegan-delivery-pattaya/',
        ru: '/ru/veganskaya-dostavka-v-pattaye/',
        'x-default': '/vegan-delivery-pattaya/',
      },
    },
    {
      path: '/ru/veganskaya-dostavka-v-pattaye/',
      alternates: {
        en: '/vegan-delivery-pattaya/',
        ru: '/ru/veganskaya-dostavka-v-pattaye/',
        'x-default': '/vegan-delivery-pattaya/',
      },
    },
    {
      path: '/pure-veg-jain-friendly/',
      alternates: {
        en: '/pure-veg-jain-friendly/',
        'x-default': '/pure-veg-jain-friendly/',
      },
    },
    {
      path: '/th/ร้านอาหารเจ-พัทยา/',
      alternates: {
        th: '/th/ร้านอาหารเจ-พัทยา/',
      },
    },
    {
      path: '/blog/welcome/',
      alternates: {
        en: '/blog/welcome/',
        th: '/th/blog/ยินดีต้อนรับ/',
        ru: '/ru/blog/dobro-pozhalovat/',
        'x-default': '/blog/welcome/',
      },
    },
    {
      path: '/th/blog/ยินดีต้อนรับ/',
      alternates: {
        en: '/blog/welcome/',
        th: '/th/blog/ยินดีต้อนรับ/',
        ru: '/ru/blog/dobro-pozhalovat/',
        'x-default': '/blog/welcome/',
      },
    },
    {
      path: '/ru/blog/dobro-pozhalovat/',
      alternates: {
        en: '/blog/welcome/',
        th: '/th/blog/ยินดีต้อนรับ/',
        ru: '/ru/blog/dobro-pozhalovat/',
        'x-default': '/blog/welcome/',
      },
    },
    {
      path: '/blog/how-to-order-vegan-food-in-thailand/',
      alternates: {
        en: '/blog/how-to-order-vegan-food-in-thailand/',
        ru: '/ru/blog/kak-zakazat-veganskuyu-edu-v-tailande/',
        'x-default': '/blog/how-to-order-vegan-food-in-thailand/',
      },
    },
    {
      path: '/ru/blog/kak-zakazat-veganskuyu-edu-v-tailande/',
      alternates: {
        en: '/blog/how-to-order-vegan-food-in-thailand/',
        ru: '/ru/blog/kak-zakazat-veganskuyu-edu-v-tailande/',
        'x-default': '/blog/how-to-order-vegan-food-in-thailand/',
      },
    },
    {
      path: '/ru/blog/vegan-gid-po-pattaye/',
      alternates: {
        ru: '/ru/blog/vegan-gid-po-pattaye/',
      },
    },
  ];

  for (const { path, alternates } of localizedPageGroups) {
    await expectHeadSeoLinks(page, path, alternates);
  }
});

test('social preview metadata stays absolute and shareable', async ({ page, request }) => {
  for (const path of ['/', '/menu/', '/th/menu/', '/ru/menu/']) {
    await page.goto(path);
    const expectedUrl = `https://apple-vegan-cafe.com${path}`;

    await expect(page.locator('head meta[property="og:url"]'), `${path} og:url`).toHaveAttribute(
      'content',
      expectedUrl,
    );
    await expect(
      page.locator('head meta[property="og:image"]'),
      `${path} og:image`,
    ).toHaveAttribute('content', 'https://apple-vegan-cafe.com/og-default.png');
    await expect(
      page.locator('head meta[property="og:image:width"]'),
      `${path} og:image:width`,
    ).toHaveAttribute('content', '1200');
    await expect(
      page.locator('head meta[property="og:image:height"]'),
      `${path} og:image:height`,
    ).toHaveAttribute('content', '630');
    await expect(
      page.locator('head meta[name="twitter:card"]'),
      `${path} twitter:card`,
    ).toHaveAttribute('content', 'summary_large_image');
  }

  const ogImage = await request.get('/og-default.png');
  expect(ogImage.ok()).toBe(true);
  expect(ogImage.headers()['content-type']).toContain('image/png');
});

test('head discovery metadata exposes manifest, favicon and sitemap', async ({ page, request }) => {
  await page.goto('/');

  await expect(page.locator('head meta[name="theme-color"]')).toHaveAttribute('content', '#faf6ed');
  await expect(page.locator('head link[rel="icon"]')).toHaveAttribute('href', '/favicon.svg');
  await expect(page.locator('head link[rel="icon"]')).toHaveAttribute('type', 'image/svg+xml');
  await expect(page.locator('head link[rel="manifest"]')).toHaveAttribute(
    'href',
    '/site.webmanifest',
  );
  await expect(page.locator('head link[rel="sitemap"]')).toHaveAttribute(
    'href',
    '/sitemap-index.xml',
  );

  const manifestResponse = await request.get('/site.webmanifest');
  expect(manifestResponse.ok()).toBe(true);
  expect(manifestResponse.headers()['content-type']).toContain('application/manifest+json');
  const manifest = (await manifestResponse.json()) as {
    name?: string;
    short_name?: string;
    display?: string;
    theme_color?: string;
    background_color?: string;
    icons?: { src?: string; sizes?: string; type?: string }[];
  };
  expect(manifest.name).toBe('Apple Vegan Cafe & Restaurant');
  expect(manifest.short_name).toBe('Apple Vegan Cafe');
  expect(manifest.display).toBe('browser');
  expect(manifest.theme_color).toBe('#faf6ed');
  expect(manifest.background_color).toBe('#faf6ed');
  expect(manifest.icons).toEqual(
    expect.arrayContaining([{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' }]),
  );

  const faviconResponse = await request.get('/favicon.svg');
  expect(faviconResponse.ok()).toBe(true);
  expect(faviconResponse.headers()['content-type']).toContain('image/svg+xml');
});

test('launch indexing guard keeps public pages crawlable', async ({ page, request }) => {
  for (const path of ['/', '/menu/', '/th/menu/', '/ru/menu/']) {
    await page.goto(path);
    await expect(page.locator('head meta[name="robots"]'), `${path} must not noindex`).toHaveCount(
      0,
    );
  }

  const robots = await request.get('/robots.txt');
  expect(robots.ok()).toBe(true);
  const robotsBody = await robots.text();
  expect(robotsBody).toContain('Allow: /');
  expect(robotsBody).not.toMatch(/^Disallow: \/$/m);
  expect(robotsBody).toContain('Sitemap: https://apple-vegan-cafe.com/sitemap-index.xml');

  const sitemapIndex = await request.get('/sitemap-index.xml');
  expect(sitemapIndex.ok()).toBe(true);
  const sitemapIndexBody = await sitemapIndex.text();
  expect(sitemapIndexBody).toContain('<sitemapindex');
  expect(sitemapIndexBody).toContain('<loc>https://apple-vegan-cafe.com/sitemap-0.xml</loc>');
});

test('sitemap lists canonical public pages and excludes service URLs', async ({
  page,
  request,
}) => {
  const sitemap = await request.get('/sitemap-0.xml');
  expect(sitemap.ok()).toBe(true);

  const locs = await parseSitemapLocs(page, await sitemap.text());
  expect(new Set(locs).size, 'sitemap loc entries must be unique').toBe(locs.length);
  expect(locs.every((loc) => loc.startsWith(`${SITE_ORIGIN}/`))).toBe(true);
  expect(locs.every((loc) => loc.endsWith('/'))).toBe(true);
  expect(locs.some((loc) => loc.includes('/admin/'))).toBe(false);
  expect(locs.some((loc) => loc.includes('/uploads/'))).toBe(false);
  expect(locs.some((loc) => /[?#]/.test(loc))).toBe(false);
  for (const draftPath of draftArticlePaths) {
    expect(locs, `sitemap must not include draft article ${draftPath}`).not.toContain(
      absolute(draftPath),
    );
  }
  for (const publishedPath of publishedArticlePaths) {
    expect(locs, `sitemap must include published article ${publishedPath}`).toContain(
      absolute(publishedPath),
    );
  }

  expect(locs).toEqual(
    expect.arrayContaining([
      absolute('/'),
      absolute('/menu/'),
      absolute('/th/menu/'),
      absolute('/ru/menu/'),
      absolute('/faq/'),
      absolute('/th/faq/'),
      absolute('/ru/faq/'),
      absolute('/vegan-breakfast-pattaya/'),
      absolute('/ru/veganskiy-zavtrak-v-pattaye/'),
      absolute('/vegan-delivery-pattaya/'),
      absolute('/ru/veganskaya-dostavka-v-pattaye/'),
      absolute('/pure-veg-jain-friendly/'),
      absolute('/th/ร้านอาหารเจ-พัทยา/'),
      absolute('/blog/how-to-order-vegan-food-in-thailand/'),
      absolute('/ru/blog/kak-zakazat-veganskuyu-edu-v-tailande/'),
      absolute('/ru/blog/vegan-gid-po-pattaye/'),
    ]),
  );
});

test('blog indexes link published articles only', async ({ page }) => {
  for (const indexPath of articleIndexPaths) {
    await page.goto(indexPath);
    const articleHrefs = await page
      .locator('main a[href*="/blog/"]')
      .evaluateAll((links) =>
        links.map((link) => (link as HTMLAnchorElement).getAttribute('href') ?? ''),
      );

    for (const publishedPath of publishedArticlePathsByIndex.get(indexPath) ?? []) {
      expect(articleHrefs, `${indexPath} must link published article ${publishedPath}`).toContain(
        publishedPath,
      );
    }
    for (const draftPath of draftArticlePaths) {
      expect(articleHrefs, `${indexPath} must not link draft article ${draftPath}`).not.toContain(
        draftPath,
      );
    }
  }
});

test('draft articles are not publicly routed', async ({ request }) => {
  for (const draftPath of draftArticlePaths) {
    const response = await request.get(draftPath);
    expect(response.status(), `${draftPath} must stay unpublished`).toBe(404);
  }
});

test('restaurant JSON-LD is present and has no self-serving rating', async ({ page }) => {
  await page.goto('/');
  const raw = await page.locator('script[type="application/ld+json"]').first().textContent();
  const jsonld = JSON.parse(raw ?? '{}');
  expect(jsonld['@type']).toBe('Restaurant');
  expect(jsonld.aggregateRating).toBeUndefined();
  expect(jsonld.review).toBeUndefined();
});

test('structured data stays parseable, useful and within safe schema types', async ({ page }) => {
  const pageExpectations: { path: string; types: string[] }[] = [
    { path: '/', types: ['Restaurant'] },
    { path: '/contact/', types: ['Restaurant', 'BreadcrumbList'] },
    { path: '/menu/', types: ['BreadcrumbList', 'Menu'] },
    { path: '/th/menu/', types: ['BreadcrumbList', 'Menu'] },
    { path: '/ru/menu/', types: ['BreadcrumbList', 'Menu'] },
    { path: '/faq/', types: ['BreadcrumbList'] },
    { path: '/blog/how-to-order-vegan-food-in-thailand/', types: ['Article', 'BreadcrumbList'] },
  ];

  for (const { path, types } of pageExpectations) {
    const schemas = await parseJsonLd(page, path);
    expect(schemas.map(schemaType), `${path} schema types`).toEqual(types);

    for (const schema of schemas) {
      const type = schemaType(schema);
      expect(allowedSchemaTypes.has(type), `${path} safe schema type: ${type}`).toBe(true);
      expect(schema['@context'], `${path} ${type} context`).toBe('https://schema.org');
      expect(containsKey(schema, 'aggregateRating'), `${path} ${type} aggregateRating`).toBe(false);
      expect(containsKey(schema, 'review'), `${path} ${type} review`).toBe(false);
      expect(type, `${path} must not emit retired FAQ rich-result markup`).not.toBe('FAQPage');

      if (type === 'BreadcrumbList') {
        const items = schema.itemListElement;
        expect(Array.isArray(items), `${path} BreadcrumbList items`).toBe(true);
        for (const item of items as JsonLdObject[]) {
          expectAbsoluteUrl(item.item, `${path} breadcrumb item URL`);
        }
      }

      if (type === 'Restaurant') {
        expectAbsoluteUrl(schema.url, `${path} Restaurant url`);
        expectAbsoluteUrl(schema.menu, `${path} Restaurant menu`);
        const action = schema.potentialAction;
        if (!isObject(action)) throw new Error(`${path} Restaurant OrderAction is missing`);
        expect(action['@type']).toBe('OrderAction');
        expectAbsoluteUrl(action.target, `${path} Restaurant OrderAction target`);
      }

      if (type === 'Menu') {
        expectAbsoluteUrl(schema.url, `${path} Menu url`);
        const sections = schema.hasMenuSection;
        expect(Array.isArray(sections), `${path} Menu sections`).toBe(true);
        const menuItems = (sections as JsonLdObject[]).flatMap((section) => {
          expect(schemaType(section), `${path} MenuSection type`).toBe('MenuSection');
          expect(typeof section.name, `${path} MenuSection name`).toBe('string');
          expect(Array.isArray(section.hasMenuItem), `${path} MenuSection items`).toBe(true);
          return section.hasMenuItem as JsonLdObject[];
        });
        expect(menuItems, `${path} MenuItem count`).toHaveLength(availableDishCount);

        for (const item of menuItems) {
          expect(schemaType(item), `${path} MenuItem type`).toBe('MenuItem');
          expect(typeof item.name, `${path} MenuItem name`).toBe('string');
          const offers = item.offers;
          if (!isObject(offers)) throw new Error(`${path} MenuItem Offer is missing`);
          expect(offers['@type']).toBe('Offer');
          expect(offers.priceCurrency).toBe('THB');
          expect(typeof offers.price, `${path} MenuItem price`).toBe('number');
          expect(offers.price as number, `${path} MenuItem price positive`).toBeGreaterThan(0);
        }
      }

      if (type === 'Article') {
        expectAbsoluteUrl(schema.url, `${path} Article url`);
        expect(typeof schema.headline, `${path} Article headline`).toBe('string');
        expect(typeof schema.datePublished, `${path} Article datePublished`).toBe('string');
      }
    }
  }
});

test('blog article renders with localized slug', async ({ page }) => {
  await page.goto('/ru/blog/dobro-pozhalovat/');
  await expect(page.locator('h1')).toContainText('Добро пожаловать');
});

test('content pages ship zero client JavaScript', async ({ page }) => {
  await page.goto('/menu/');
  const scripts = await page.locator('script[src]').count();
  expect(scripts).toBe(0);
});
