import { readFileSync, readdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';

// Regression guards for owner facts that once drifted (HappyCow said Mon–Sat,
// landings hardcoded a "Sunday — Closed" row): the cafe is open EVERY day
// 7:00–22:00, the menu mirrors the owner's Grab export 1:1, and ordering CTAs
// must not silently disappear.

const DISHES_DIR = 'src/content/dishes';
const availableDishCount = readdirSync(DISHES_DIR)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(`${DISHES_DIR}/${f}`, 'utf8')) as { available: boolean })
  .filter((d) => d.available).length;

const GRAB_LINK = /r\.grab\.com/;

for (const prefix of ['', '/th', '/ru']) {
  test(`menu${prefix || '/en'} renders every available dish (${availableDishCount})`, async ({
    page,
  }) => {
    await page.goto(`${prefix}/menu/`);
    await expect(page.locator('main section > ul > li')).toHaveCount(availableDishCount);
  });

  test(`menu${prefix || '/en'} keeps both GrabFood CTAs`, async ({ page }) => {
    await page.goto(`${prefix}/menu/`);
    await expect(page.locator('main a[href*="r.grab.com"]')).toHaveCount(2);
  });
}

test('no page claims a closing day or Mon–Sat hours', async ({ page }) => {
  for (const path of [
    '/contact/',
    '/vegan-breakfast-pattaya/',
    '/vegan-delivery-pattaya/',
    '/pure-veg-jain-friendly/',
  ]) {
    await page.goto(path);
    const body = (await page.locator('body').innerText()).toLowerCase();
    expect(body, `${path} must not say "Monday to Saturday"`).not.toContain('monday to saturday');
    expect(body, `${path} must not show a Closed day`).not.toContain('closed');
  }
});

test('EN landings state the daily 7:00 opening', async ({ page }) => {
  for (const path of ['/vegan-breakfast-pattaya/', '/pure-veg-jain-friendly/']) {
    await page.goto(path);
    await expect(page.locator('body')).toContainText('every day');
  }
});

test('home and contact expose OrderAction pointing at Grab', async ({ page }) => {
  for (const path of ['/', '/contact/']) {
    await page.goto(path);
    const raw = await page.locator('script[type="application/ld+json"]').first().textContent();
    const jsonld = JSON.parse(raw ?? '{}') as {
      potentialAction?: { '@type': string; target: string };
    };
    expect(jsonld.potentialAction?.['@type'], `${path} OrderAction`).toBe('OrderAction');
    expect(jsonld.potentialAction?.target, `${path} OrderAction target`).toMatch(GRAB_LINK);
  }
});
