import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// Accessibility floor: no serious/critical axe violations on key pages.
// Moderate/minor findings are reported in CI output but do not fail the build.
const PAGES = [
  '/',
  '/menu/',
  '/contact/',
  '/th/',
  '/th/menu/',
  '/ru/',
  '/ru/menu/',
  '/ru/veganskaya-dostavka-v-pattaye/',
  '/ru/veganskiy-zavtrak-v-pattaye/',
  '/blog/vegan-guide-pattaya/',
];

for (const path of PAGES) {
  test(`axe: no serious/critical violations on ${path}`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    const summary = blocking.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.slice(0, 3).map((n) => n.target.join(' ')),
    }));
    expect(summary, JSON.stringify(summary, null, 2)).toEqual([]);
  });
}
