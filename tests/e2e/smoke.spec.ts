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
  await expect(xDefault).toHaveAttribute('href', 'https://applevegancafe.com/');
});

test('language switcher links to translated pages', async ({ page }) => {
  await page.goto('/menu/');
  const thLink = page.locator('header a[hreflang="th"]');
  await expect(thLink).toHaveAttribute('href', '/th/menu/');
  const ruLink = page.locator('header a[hreflang="ru"]');
  await expect(ruLink).toHaveAttribute('href', '/ru/menu/');
});

test('canonical is self-referential', async ({ page }) => {
  await page.goto('/th/menu/');
  await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://applevegancafe.com/th/menu/',
  );
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
