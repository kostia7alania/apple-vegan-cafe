import { expect, test } from '@playwright/test';

const locales = [
  { prefix: '', hreflang: 'en', heading: 'Apple Vegan Cafe' },
  { prefix: '/th', hreflang: 'th', heading: 'ร้านอาหารเจ' },
  { prefix: '/ru', hreflang: 'ru', heading: 'Apple Vegan Cafe' },
];

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

test('canonical is self-referential', async ({ page }) => {
  await page.goto('/th/menu/');
  await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://apple-vegan-cafe.com/th/menu/',
  );
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
