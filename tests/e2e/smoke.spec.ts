import { expect, test, type Page } from '@playwright/test';

const locales = [
  { prefix: '', hreflang: 'en', heading: 'Apple Vegan Cafe' },
  { prefix: '/th', hreflang: 'th', heading: 'ร้านอาหารเจ' },
  { prefix: '/ru', hreflang: 'ru', heading: 'Apple Vegan Cafe' },
];

const SITE_ORIGIN = 'https://apple-vegan-cafe.com';

function absolute(path: string): string {
  return new URL(path, SITE_ORIGIN).href;
}

type ExpectedAlternates = Record<string, string>;

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

test('restaurant JSON-LD is present and has no self-serving rating', async ({ page }) => {
  await page.goto('/');
  const raw = await page.locator('script[type="application/ld+json"]').first().textContent();
  const jsonld = JSON.parse(raw ?? '{}');
  expect(jsonld['@type']).toBe('Restaurant');
  expect(jsonld.aggregateRating).toBeUndefined();
  expect(jsonld.review).toBeUndefined();
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
